
## Sprint 16 — Support & Dispute Resolution

- [x] Add support ticket, message, assignment, event, evidence-reference, and SLA policy tables in additive migration `0018_hard_shard`.
- [x] Add support categories, priorities, lifecycle state machine, transaction context, idempotency, assignment, SLA timestamps, and immutable event history.
- [x] Add customer case creation/history/detail, secure replies, and internal-note separation.
- [x] Add seller-scoped visibility derived from active seller membership and seller-order ownership.
- [x] Add permission-gated support queue, assignment, status changes, escalation, evidence references, SLA breaches, and policy procedures.
- [x] Add notification templates and outbox routing for support case creation, messages, and status changes.
- [x] Add `/support`, `/support/:ticketId`, `/seller/support`, and `/admin/support` responsive surfaces.
- [x] Add dedicated RBAC permissions for customer creation, messaging, seller visibility, queue management, resolution, evidence, escalation, and SLA policy management.
- [x] Add Sprint 16 focused regression suite: 18/18 passed across notification, returns, and support boundaries.
- [x] Verify `pnpm check`, `pnpm build`, migration generation, permission seeding, and active database presence of all six `support_*` tables.
- [x] Document architecture, authorization, state machine, UI, verification, explicit boundaries, and Sprint 17 handoff in `docs/SokoMart-sprint-16-support-disputes.md`.
- [x] Explicit boundary: no fake email/SMS delivery, telephony, AI classification, automated refund callbacks, reverse-logistics inventory posting, or legal chargeback adjudication.
- [x] Sprint 17 handoff documented: outbox worker leases/dead letters, provider callbacks, seller SLA automation, dispute evidence/inventory linkage, analytics, CSAT, and attachment orchestration.
