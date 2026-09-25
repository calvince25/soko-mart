
# SokoMart Sprint 9 Work Tracker

- [x] Add immutable parent-order, seller-order, order-item, address-snapshot, and reservation-link tables in migration `0010_huge_rocket_racer`.
- [x] Create exactly one parent order from a verified successful payment using a locked payment row and unique payment/order relationship.
- [x] Create one seller order per checkout seller group with copied seller identity and server-calculated totals.
- [x] Persist immutable product, SKU, variant, seller, quantity, unit-price, subtotal, and currency line snapshots.
- [x] Persist an immutable delivery address snapshot from the checkout snapshot or authoritative saved address.
- [x] Convert linked inventory reservations exactly once into sale movements and decrement reserved/on-hand balances transactionally.
- [x] Remove purchased cart lines and clear converted cart active keys so a new active cart can be created.
- [x] Mark checkout complete and emit post-commit order-created/order-confirmed logs.
- [x] Add customer order list/detail APIs and customer-safe IDOR protection.
- [x] Add approved seller membership-scoped order list/detail APIs and guarded fulfilment status transitions.
- [x] Add admin order search/detail procedures using `order.manage_any`.
- [x] Add customer order history/confirmation UI, payment-to-order redirect, seller order list/detail UI, and seller navigation.
- [x] Add Sprint 9 integration coverage and documentation; update Sprint 8 cleanup for callback-created orders.
- [x] Future sprint boundary recorded: fulfilment logistics, courier tracking, returns/refunds, payouts/settlement, notifications, split shipments, and post-fulfilment cancellation.
