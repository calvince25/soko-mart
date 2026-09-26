
## Sprint 15 — Returns, Inspections & Refunds

- [x] Add return policy, request, item quantity, inspection, refund, and immutable return-event tables in additive migration `0017_useful_blindfold`.
- [x] Enforce server-authoritative eligibility: paid order, authenticated customer ownership, delivered shipment, open policy window, and remaining item quantity.
- [x] Add partial-quantity returns, single-seller-order grouping, idempotency keys, duplicate protection, and return state-machine guards.
- [x] Add customer request/history/detail, seller-scoped visibility, and operations/finance procedures with dedicated RBAC permissions.
- [x] Add approval/rejection, receiving, inspection outcomes, item dispositions, refund approval, and provider-neutral refund processing.
- [x] Preserve provider honesty: unconfigured refund providers remain processing and cannot fabricate success or provider references.
- [x] Connect return/refund status events to the notification outbox and audit trail.
- [x] Add `/returns`, `/returns/:returnId`, `/seller/returns`, and `/admin/returns` responsive workspaces.
- [x] Add Sprint 15 tests: focused neighboring suite 22/22 passed; full regression 95/95 passed across 20 files.
- [x] Verify typecheck, production build, schema generation, migration application, permissions seed, database health, desktop screenshots, and 375px mobile screenshots.
- [x] Document architecture, eligibility, state machine, security, provider/inventory boundaries, verification, and Sprint 16 handoff in `docs/SokoMart-sprint-15-returns-refunds.md`.
- [x] Explicit boundary: real provider refund callbacks and warehouse inventory disposition movements remain adapter/integration work, with no silent inventory deduction or fake payment success.
- [x] Sprint 16 handoff documented: authenticated M-Pesa refund callbacks, return receiving and append-only stock movements, reverse logistics labels, seller-configurable policy exclusions, and SLA escalation.
