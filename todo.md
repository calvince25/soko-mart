
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
- [x] Sprint 14 handoff documented: scheduled outbox worker with leases/dead-letter handling, configured provider adapters/callbacks, secure external OTP delivery, and test-fixture isolation hardening remain the next sprint's implementation scope.

## Sprint 14 — Reviews, Ratings & Reputation

- [x] Add dedicated reviews domain with server-authoritative product and seller review lifecycle.
- [x] Add transaction-traceable `reviews` and object-storage-reference `review_media` tables in additive migration `0016_yummy_menace`.
- [x] Enforce paid, non-cancelled, delivered-shipment eligibility from authenticated customer ownership; do not trust client product, seller, delivery, or verified-purchase claims.
- [x] Prevent duplicates with database-level unique purchase keys and conflict-safe creation.
- [x] Add controlled own-review edits/removal, mandatory re-moderation after edits, server-computed published-only aggregates, and 10-per-24-hour anti-spam guard.
- [x] Add seller self-review protection for all seller memberships, not only active members.
- [x] Add review media reference registration with a six-reference limit; keep bytes outside the database.
- [x] Add publish/hide/reject moderation with audit events and `review.published` notification integration.
- [x] Add customer `/reviews` review center and permission-gated `/admin/reviews` moderation workspace with mobile verification.
- [x] Add review RBAC permissions and rerun idempotent foundation seeding.
- [x] Add Sprint 14 boundary tests; focused suite 16 passed and full suite 89 passed across 19 files.
- [x] Verify typecheck, production build, migration alignment, active database tables/indexes, dev health, desktop, and 375px mobile UI.
- [x] Document architecture, eligibility/returns policy, moderation, media boundary, verification, limitations, and Sprint 15 handoff in `docs/SokoMart-sprint-14-reviews.md`.
- [x] Explicit boundary: no invented returns system, review replies, helpful votes, appeals, asynchronous media moderation, or advanced fraud scoring.
- [x] Sprint 15 handoff documented: returns/refund eligibility hook, signed media upload workflow, seller replies, and stronger fraud/rate-limit signals.
