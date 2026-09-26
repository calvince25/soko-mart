# SokoMart Sprint 13 — Notification and Communication Infrastructure

## 1. Architecture

Sprint 13 adds a dedicated `server/domains/notification` domain without replacing the existing marketplace domain events. Existing payment, order, seller fulfilment, warehouse, and delivery event emitters now log the business event and enqueue a durable notification outbox record **after the business transaction has committed**.

The downstream flow is:

```text
business transaction
  -> post-commit domain event emitter
  -> notification_outbox (unique event key)
  -> recipient resolution and template selection
  -> notifications (one record per recipient/channel)
  -> channel adapter
  -> notification_delivery_attempts
```

External communication never runs inside the payment, order, shipment, or delivery transaction. A provider failure therefore marks the notification delivery as failed/retryable without changing marketplace state.

## 2. Event System

Connected real event types include:

- Payments: `payment.successful`, `payment.failed`
- Orders: `order.created`, `seller_order.created`
- Seller fulfilment: `seller_order.fulfilment.accepted`, `processing`, `packed`, `ready_for_handoff`, `handed_to_logistics`, and other emitted state transitions
- Warehouse: existing `warehouse.*` events plus `package.dispatch_ready`
- Delivery: `shipment.created`, `shipment.assigned`, `shipment.picked_up`, `shipment.in_transit`, `shipment.out_for_delivery`, `shipment.delivered`, `shipment.delivery_attempted`, `shipment.delivery_failed`, and `delivery.otp_issued`

The existing event adapters remain responsible for operational logging; the notification domain consumes the same post-commit event boundary. No client-side event trigger or test-only fake trigger was added.

## 3. Notification Model

- `notification_templates`: versioned template code, category, channel, rendered title/body source, and active flag. Templates are created idempotently when first used.
- `notification_preferences`: user-scoped channel/category preferences. Security messages cannot be disabled.
- `notifications`: immutable rendered notification content plus recipient, category, channel, status, idempotency key, related entity, navigation path, read state, retry state, and provider result.
- `notification_outbox`: durable event envelope with unique `eventKey`, JSON payload, processing status, attempt count, next retry time, and last error.
- `notification_delivery_attempts`: append-only delivery history with channel, provider, attempt number, result, provider status, latency-compatible timestamps, and failure reason.

Indexes cover recipient/read/created queries, status/next-attempt queues, event type, related entity, channel/status, and outbox retry queries. User and delivery-attempt foreign keys preserve ownership and history.

## 4. Channels

- **In-app:** configured and actually delivered by the internal adapter. The notification center reads persisted backend records.
- **Email:** provider adapter boundary exists; no provider credentials are configured in this environment. It returns `failed/unconfigured`, never fake success.
- **SMS:** provider adapter boundary exists; no provider credentials are configured.
- **WhatsApp:** provider adapter boundary exists; no provider credentials are configured.

External providers are intentionally not invented or called synchronously. Provider secrets are not stored in source code or logged.

## 5. In-App Notification Center

`/notifications` provides:

- unread count badge
- paginated notification list
- clear new/read styling
- mark-one-read and mark-all-read actions
- related entity navigation when available
- readable timestamps in the local browser timezone
- real backend loading, empty, and error states
- polling every 15 seconds for a responsive refresh without unnecessary realtime complexity

The center is linked from the authenticated order shell. Seller and courier users can use the same ownership-scoped center, and operational notifications are resolved from seller membership, courier identity, and warehouse assignment rather than client-supplied recipient IDs.

## 6. Preferences

The preferences panel exposes `email`, `sms`, and `whatsapp` by category: `transactional`, `operational`, and `promotional`. In-app delivery is always retained. Security messages, including delivery verification notifications, cannot be disabled. Promotional preferences are stored separately and no promotional messages are generated in this sprint.

## 7. Templates

Template selection is centralized in `server/domains/notification/service.ts`. Event type plus recipient type determines the template, and variables are interpolated server-side. Rendered title/body and template code/version are preserved on the notification record so later template edits do not rewrite historical messages.

The current implementation uses code-owned default templates with idempotent persistence into `notification_templates`; a future admin template editor can safely build on the version column and unique `(code, version)` constraint.

## 8. Reliability

- Duplicate business events are suppressed by unique outbox `eventKey`.
- Duplicate recipient/channel notifications are suppressed by unique notification idempotency keys.
- Each delivery has an append-only attempt row.
- Retry state, count, maximum retries, next attempt time, provider result, and failure reason are persisted.
- Failed unconfigured external channels remain visibly failed instead of being presented as delivered.
- In-app delivery is performed downstream from the marketplace transaction.
- The current environment processes an outbox entry asynchronously at enqueue time and exposes persisted retry state; a scheduled queue worker/sweep is intentionally left for Sprint 14 production hardening.

## 9. Security

- tRPC procedures use `permissionProcedure` with `notification.read`, `notification.preferences.update`, `notification.manage`, and `notification.retry`.
- Notification list, unread count, read, and preference procedures derive the user ID from the authenticated session.
- Seller recipients are resolved through active seller membership.
- Courier recipients are resolved through the courier identity linked to the authenticated user.
- Warehouse staff recipients are resolved through active warehouse assignments.
- Admin monitoring and retry are permission-gated; notification content is not exposed by the monitoring list.
- Notification logs include notification ID, event, channel, provider, attempt, result, latency, and failure reason, but not OTP plaintext, passwords, payment credentials, or provider secrets.
- OTP verification remains server-side and hashed in Sprint 12. Sprint 13 emits an OTP notification event without logging or persisting OTP plaintext in the notification content.

## 10. UI

- Customer: `/notifications` notification center, unread badge, read controls, pagination, and preferences.
- Seller: same authenticated notification center with seller-membership-scoped operational events.
- Courier: same center with courier-assignment and delivery-task events.
- Admin: `/admin/notifications` operational monitoring table with event, audience, channel, status, attempts, failure reason, and authorized retry controls.

Desktop and 390px mobile screenshots were captured successfully. The admin table intentionally remains horizontally scrollable on narrow screens so operational columns are not collapsed into unreadable cards.

## 11. Database and Migration

Migration: `drizzle/0015_soft_masked_marvel.sql`.

New tables:

- `notification_templates`
- `notification_preferences`
- `notifications`
- `notification_outbox`
- `notification_delivery_attempts`

The migration is additive and was applied through WebDev SQL execution. Read-only verification confirmed all five tables exist. `pnpm drizzle-kit generate` subsequently reported `No schema changes, nothing to migrate`, confirming the canonical schema and generated migration are aligned.

## 12. API

Major procedures under `trpc.notification`:

- `list`
- `unreadCount`
- `markRead`
- `markAllRead`
- `preferences`
- `updatePreference`
- `monitoring`
- `retry`

Inputs are validated in `shared/validation/notificationSchemas.ts`. No procedure accepts a client-trusted recipient user ID for authorization.

## 13. Testing

New Sprint 13 tests: `server/notification.sprint13.test.ts` — **5/5 passed**.

Coverage includes:

- authentication and notification-read RBAC
- security preference protection
- no fake success for an unconfigured email provider
- retry authorization

Focused Sprint 12 + Sprint 13 run: **10/10 passed**.

Full suite result: **74 passed, 9 skipped, 2 suites blocked by pre-existing shared-database fixture collisions**. The failures are the known Sprint 8/9/10 fixture issue: parallel suites attempt to reuse `+254710174012` under the unique customer-phone constraint. No Sprint 13 suite failed, no existing tests were deleted or weakened, and the issue remains documented technical debt for a later test-isolation sprint.

## 14. Verification

| Check | Result |
|---|---|
| TypeScript | Passed: `pnpm check` |
| Production build | Passed: Vite + esbuild bundle |
| Migration generation | Passed; no ungenerated schema changes after `0015` |
| Database migration | Applied successfully; all five tables verified |
| Sprint 13 tests | Passed: 5/5 |
| Sprint 12 + Sprint 13 focused tests | Passed: 10/10 |
| Full test suite | 74 passed, 9 skipped; 2 pre-existing fixture-collision suites blocked |
| Health diagnostics | Dev server running, dependencies OK, LSP no errors, TypeScript no errors |
| Desktop UI | Notification center and admin monitor screenshots captured at 1280×900 |
| Mobile UI | Notification center and admin monitor screenshots captured at 390×844 |

## 15. Unresolved Issues

1. Email, SMS, and WhatsApp providers are abstraction-ready but not configured in this environment; their deliveries are explicitly marked unconfigured/failed rather than faked.
2. The outbox has durable retry fields and an authorized manual retry procedure, but a scheduled worker/sweep with leasing and dead-letter alerting remains Sprint 14 production hardening.
3. Sprint 12 OTP generation is connected to the notification event pipeline, but because no secure SMS/WhatsApp provider is configured, this sprint does not claim external OTP delivery.
4. Existing Sprint 8/9/10 shared fixture isolation remains technical debt and is clearly separated from Sprint 13 results.
5. The production bundle retains the existing Vite chunk-size warning; this sprint did not introduce a code-splitting refactor.

## 16. Sprint 14 Handoff

Safe integration points for the next sprint:

- Emit `{ eventType, entityType, entityId, eventKey, payload }` through `enqueueNotificationEvent` after a committed domain transaction.
- Add recipient resolution using authenticated ownership or server-side membership/identity joins in `recipientUsers`.
- Add a versioned default to the centralized `templates` map and preserve rendered history in `notifications`.
- Add a real adapter implementing `NotificationChannelAdapter` in `server/domains/notification/channels.ts`; return provider message IDs and explicit retryable/permanent results.
- Build a scheduled outbox worker around `notification_outbox.status`, `nextAttemptAt`, and attempt leasing.
- Add encrypted/ephemeral secret handling for provider-delivered OTP content without writing OTP plaintext to logs or durable rendered in-app content.
- Add provider callback validation and delivery-status reconciliation using `notificationDeliveryAttempts`.
- Fix shared test fixture isolation before expanding full integration fan-out.
