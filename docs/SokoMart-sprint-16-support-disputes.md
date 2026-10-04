# SokoMart Sprint 16 — Support & Dispute Resolution

## Delivered

Sprint 16 adds a dedicated, server-authoritative support domain for customer cases, seller-linked disputes, and internal operations.

### Persistence

Migration `0018_hard_shard.sql` adds:

- `support_tickets` with category, priority, lifecycle status, transaction context, idempotency key, assignment, and SLA timestamps.
- `support_messages` with customer/support/seller/system authors and internal-note protection.
- `support_events` for immutable lifecycle history.
- `support_assignments` for routing history.
- `support_evidence` for storage-backed metadata only; file bytes are not stored in MySQL.
- `support_sla_policies` for priority-specific response and resolution targets.

The active database already contained these tables from the prior Sprint 16 execution state. The normal Drizzle migrator still encounters the historical courier-table ledger mismatch before reaching migration 0018; no destructive operation was used and the support tables were verified directly.

## API and security

The support router exposes customer, seller, and operations procedures:

- Customer: create, list, get, reply, and add evidence.
- Seller: seller-order-scoped support visibility.
- Support operations: queue, assignment, status transitions, escalation, SLA breach list, and SLA policy upsert.

Ownership is derived from the authenticated session. Customer transaction context is checked against the authenticated customer for order links. Seller visibility requires an active seller membership and a linked seller order. Internal notes and operations actions are permission-gated; customer views exclude internal notes.

The state machine prevents arbitrary writes:

```text
open/reopened → in_progress | pending_customer | pending_seller | escalated | resolved
in_progress → pending_customer | pending_seller | escalated | resolved
pending_customer → in_progress | resolved | reopened
pending_seller → in_progress | escalated | resolved
escalated → in_progress | pending_customer | pending_seller | resolved
resolved → closed | reopened
closed → reopened
```

Support notification templates are routed through the existing notification outbox for new cases, replies, and status updates. All changes remain auditable through the existing audit helper.

## UI

- `/support` — customer case creation and history.
- `/support/:ticketId` — secure conversation and case detail.
- `/seller/support` — seller-scoped case visibility.
- `/admin/support` — support operations queue with SLA count, status updates, and refresh.

The pages follow the existing SokoMart red/charcoal marketplace language and use mobile-first responsive layouts.

## Verification

- `pnpm check` passed.
- Focused regression suite passed: **18 tests** across Sprint 13 notification, Sprint 15 returns, and Sprint 16 support.
- `pnpm build` passed.
- `pnpm drizzle-kit generate` produced additive migration `0018_hard_shard.sql` and snapshot `0018_snapshot.json`.
- `pnpm seed:foundation` passed with 73 permissions and 11 existing users assigned.
- Active database verified with all six `support_*` tables present.

## Explicit boundaries

This sprint does not claim automated email/SMS delivery, contact-center telephony, AI ticket classification, warehouse reverse-logistics movement posting, refund callbacks, or legal/chargeback adjudication. Those remain adapter-backed Sprint 17+ work.

## Sprint 17 handoff

- Outbox worker leases, retry/dead-letter handling, and provider callback reconciliation.
- Seller response deadlines and automated escalation policies.
- Return/refund dispute evidence linkage and append-only inventory disposition movements.
- Support analytics, CSAT, operational dashboards, and attachment upload orchestration.
