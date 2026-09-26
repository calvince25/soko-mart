# SokoMart Sprint 15 — Returns, Inspections & Refunds

## Delivered

Sprint 15 extends the post-delivery chain with an item-level returns and refunds foundation:

- Configurable return-policy records with seller scope and a platform fallback window.
- Customer return requests are eligible only when the order is paid, the item belongs to the authenticated customer, the shipment is delivered, the return window is open, and unused quantity remains.
- Partial quantities are supported. A unique request-item constraint and server-side quantity aggregation prevent duplicate or excessive returns.
- Return requests preserve the seller-order and order-item traceability needed for split shipments and seller visibility.
- Server-authoritative return lifecycle: `requested → approved/rejected → in_transit → received → inspected → refund_approved → refund_processing → refunded/closed`.
- Immutable return events and audit entries for customer requests, operational decisions, and inspections.
- Inspection outcomes (`approved`, `partial`, `rejected`) and item dispositions (`restock`, `damaged`, `quarantine`, `discard`) are stored independently of the customer request.
- Refund records include provider, amount in integer minor units, currency, original payment attempt, idempotency key, provider reference, and lifecycle state.
- Refund processing uses a provider-neutral adapter. An unconfigured provider remains `processing`; the browser cannot claim a successful refund and no fake provider reference is generated.
- Existing notification outbox integration covers return and refund status updates.

## API and access model

Customer procedures:

- `returns.eligibleItems`
- `returns.eligibility`
- `returns.create`
- `returns.listMine`
- `returns.get`

Seller procedure:

- `returns.sellerList` — scoped through active seller membership and seller-order ownership.

Operations and finance procedures:

- `returns.operations`
- `returns.decide`
- `returns.updateStatus`
- `returns.inspect`
- `returns.approveRefund`
- `returns.processRefund`

The dedicated permissions are `return.read_own`, `return.create_own`, `return.read_seller`, `return.process`, `return.inspect`, `refund.read`, `refund.approve`, and `refund.process`. Customer, seller, finance, support, logistics, and platform role grants are seeded idempotently.

## UI

- `/returns` — customer eligibility, request form, quantity selection, reason selection, request history, and empty/loading/error states.
- `/returns/:returnId` — customer-safe event timeline, item quantities, and refund status.
- `/seller/returns` — seller-scoped read-only return visibility with customer notes and status.
- `/admin/returns` — operations queue with approve/reject, receive, inspection, and refund approval actions.

The UI follows the existing SokoMart red/charcoal marketplace visual language and was checked at desktop and 375px mobile widths.

## Verification

- `pnpm check` — passed.
- Full regression: **20 test files, 95 tests passed**.
- Focused Sprint 15 + neighboring logistics/notification/review tests: **22 tests passed**.
- `pnpm build` — passed; Vite and server bundles produced successfully.
- `pnpm drizzle-kit generate` — no ungenerated schema changes after migration generation.
- Additive migration `drizzle/0017_useful_blindfold.sql` applied to the active database.
- Foundation permission seed completed with 65 permissions and existing-user assignments.
- WebDev health diagnostics: dependencies, LSP, and TypeScript healthy.

## Explicit boundaries

Two external integrations remain intentionally adapter-based:

1. **Payment provider refund callbacks.** The provider adapter is safe but unconfigured in this environment. Provider credentials, callback verification, replay protection, and reconciliation must be added before real money is moved.
2. **Inventory disposition mutation.** Inspection stores the authoritative disposition; a warehouse-specific restock/quarantine movement should be added once the return receiving location and SKU movement policy are finalized. No inventory quantity is silently changed by the current inspection endpoint.

## Sprint 16 handoff

Recommended next scope:

- Add authenticated M-Pesa refund initiation and callback reconciliation using a dedicated refund idempotency key and provider reference.
- Add warehouse return receiving with location, scan/package references, append-only inventory movements, and disposition authorization.
- Add return labels or courier reverse-shipment support.
- Add seller-configurable policies and per-category exclusions once business policy is finalized.
- Add notification templates with return-number interpolation and operational SLA escalation.
