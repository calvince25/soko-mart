# SokoMart Sprint 9–10 Work Tracker

## Sprint 9 — Orders

- [x] Add immutable parent-order, seller-order, order-item, address-snapshot, and reservation-link tables in migration `0010_huge_rocket_racer`.
- [x] Create exactly one parent order from a verified successful payment using a locked payment row and unique payment/order relationship.
- [x] Create one seller order per checkout seller group with copied seller identity and server-calculated totals.
- [x] Persist immutable product, SKU, variant, seller, quantity, unit-price, subtotal, and currency line snapshots.
- [x] Persist an immutable delivery address snapshot from the checkout snapshot or authoritative saved address.
- [x] Convert linked inventory reservations exactly once into sale movements and decrement reserved/on-hand balances transactionally.
- [x] Remove purchased cart lines and clear converted cart active keys so a new active cart can be created.
- [x] Mark checkout complete and emit post-commit order-created/order-confirmed logs.
- [x] Add customer order list/detail APIs and customer-safe IDOR protection.
- [x] Add approved seller membership-scoped order list/detail APIs and guarded legacy fulfilment status transitions.
- [x] Add admin order search/detail procedures using `order.manage_any`.
- [x] Add customer order history/confirmation UI, payment-to-order redirect, seller order list/detail UI, and seller navigation.
- [x] Add Sprint 9 integration coverage and documentation; update Sprint 8 cleanup for callback-created orders.

## Sprint 10 — Seller Fulfilment and Order Processing

- [x] Add server-controlled seller fulfilment states: `pending`, `accepted`, `processing`, `packed`, `ready_for_handoff`, and `handed_to_logistics`.
- [x] Add exception states for `rejected`, `cancelled`, and `failed` with reason, actor, timestamp, and refund-required metadata.
- [x] Add immutable fulfilment event history and internal seller notes with foreign keys and query indexes.
- [x] Add parent-order fulfilment aggregation without collapsing independent seller-order states.
- [x] Add approved seller membership-scoped fulfilment actions and no-membership safe empty views.
- [x] Add explicit accept, process, pack, ready-for-handoff, logistics handoff, reject, cancel, history, and note procedures.
- [x] Add compare-and-set transaction protection for concurrent actions and duplicate logical transition retries.
- [x] Keep fulfilment transitions separate from inventory conversion; no additional deductions or reservations are created.
- [x] Add seller fulfilment workspace with packing list, delivery details, action buttons, status timeline, history, and internal notes.
- [x] Add customer-safe fulfilment progress visibility without exposing internal notes or courier tracking.
- [x] Add admin operational fulfilment view with status filtering, order-number search, seller-order inspection, exception highlighting, and history.
- [x] Add post-commit fulfilment domain event hooks for future notifications and logistics consumers.
- [x] Add Sprint 10 integration coverage for lifecycle validity, rejection, IDOR, notes, parent aggregation, inventory immutability, and concurrency.
- [x] Generate and apply additive migration `0011_magical_the_enforcers`; record its hash in the Drizzle ledger and verify idempotency.
- [x] Run full regression tests, typecheck, production build, migration verification, diff checks, and responsive UI screenshots.
- [x] Document Sprint 10 implementation and explicit operational boundaries.
- [x] Future sprint boundary recorded: warehouse picking, sorting, barcode workflows, courier assignment, tracking, delivery proof, returns, refunds, notifications, settlement, and payouts.
