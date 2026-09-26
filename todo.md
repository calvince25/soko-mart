
## Sprint 13 — Notification and Communication Infrastructure

- [x] Add dedicated notification domain with centralized templates, recipient resolution, channel abstraction, and post-commit event consumption.
- [x] Add persistent notification, preference, outbox, and delivery-attempt tables in additive migration `0015_soft_masked_marvel`.
- [x] Add unique outbox event keys and notification idempotency keys to suppress duplicate payment/order/shipment/delivery notifications.
- [x] Add in-app adapter with durable rendered notifications, read state, unread count, pagination, and polling refresh.
- [x] Add email, SMS, and WhatsApp adapter boundaries that explicitly report unconfigured providers instead of faking success.
- [x] Add customer, seller, courier, warehouse staff, and admin recipient resolution from server-side ownership, membership, assignment, and role joins.
- [x] Add notification preferences with transactional/operational/promotional separation; security notifications remain enabled.
- [x] Connect payment, order, seller fulfilment, warehouse, shipment, delivery attempt, and OTP events to the real notification outbox.
- [x] Add notification center `/notifications`, preferences controls, and permission-gated admin monitoring `/admin/notifications` with retry controls.
- [x] Add notification RBAC permissions and idempotent foundation seed updates.
- [x] Add Sprint 13 focused tests: 5/5 passed; Sprint 12 + Sprint 13 focused tests: 10/10 passed.
- [x] Run full regression: 74 passed and 9 skipped; distinguish two pre-existing Sprint 8/9/10 shared-phone fixture-collision suites from Sprint 13 results.
- [x] Verify typecheck, production build, migration alignment, database tables/indexes, health diagnostics, desktop screenshots, and 390px mobile screenshots.
- [x] Document architecture, event contract, channel/provider status, security, limitations, verification, and Sprint 14 handoff in `docs/SokoMart-sprint-13-notifications.md`.
- [x] Explicit boundary: no promotions, bulk messaging, support/ticketing, returns/refunds, GPS, route optimization, payouts, or new payment providers.
- [ ] Sprint 14 handoff: scheduled outbox worker with leases/dead-letter handling, configured provider adapters/callbacks, secure external OTP delivery, and test-fixture isolation hardening.
