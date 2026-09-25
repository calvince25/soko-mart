# SokoMart Sprint 9 — Orders & Order Finalization

**Status:** Implemented and verified in the current development environment.

## Scope delivered

Sprint 9 turns a verified successful payment into a durable marketplace order. The handoff is **server-owned, transactional, idempotent, and historical**:

1. A successful payment is locked and checked against its checkout session and server-calculated KES total.
2. One immutable parent order is created with a human-readable `SM-YYYY-...` order number.
3. One seller order is created per seller group from the checkout snapshot.
4. Each order line stores product, variant, SKU, seller, quantity, unit price, line subtotal, and currency snapshots.
5. The checkout delivery address is copied into a dedicated immutable order address snapshot.
6. Linked inventory reservations are converted exactly once into committed stock movements.
7. Purchased lines are removed from the cart. If no unrelated lines remain, the cart is marked `converted` and its active key is cleared so a fresh active cart can be created.
8. Checkout is marked `completed` and order-created/confirmed events are emitted after the transaction commits.

## Data model

- `orders`: parent marketplace order and authoritative financial totals.
- `order_seller_orders`: seller-specific operational children with isolated status and fulfilment status.
- `order_items`: immutable product and pricing snapshots.
- `order_address_snapshots`: immutable recipient and delivery data.
- `order_reservation_links`: exactly-once links between committed order items and inventory reservations.

All monetary values are integer minor units and all order currencies are copied from the server checkout/payment boundary. No client-supplied total is trusted at order creation.

## Authorization

- Customers can list/read only their own parent orders and order numbers.
- Seller users can list/read/update only seller orders belonging to an active approved seller membership.
- Seller status changes follow a guarded sequence: `confirmed → processing → ready_for_fulfilment → completed`.
- Admin order search and detail procedures use `order.manage_any`.
- Customer and seller IDOR coverage is included in the Sprint 9 integration suite.

## Payment and inventory handoff

Successful M-Pesa callback processing now invokes order creation. Replayed callbacks are harmless: the payment lock and unique payment/order relationship return the existing order rather than creating another one. Inventory conversion decrements both `reserved` and `on_hand`, appends sale movements, and rejects expired or already-converted reservations.

Failed, cancelled, and expired payments remain outside order creation and continue to release their inventory holds through Sprint 8 payment behavior.

## Storefront and seller UI

- Customers can open `/orders` to view their order history and `/orders/:orderId` for confirmation, payment, seller-group, item, total, and delivery details.
- The checkout flow redirects to the real order confirmation after backend-confirmed payment and order creation.
- Approved seller users can open `/seller/orders` and `/seller/orders/:sellerOrderId` to view their own orders, delivery data, items, totals, and guarded fulfilment actions.
- Existing marketplace visual design is preserved; new screens use the same dense Kenyan marketplace styling.

## Tests

`server/order.sprint9.test.ts` covers:

- immutable parent/seller/item/address snapshots;
- authoritative payment totals;
- reservation conversion and stock decrement;
- purchased cart-line finalization and fresh-cart behavior;
- duplicate callback and retry idempotency;
- customer and seller IDOR protection;
- seller membership scope;
- guarded seller fulfilment transitions.

Sprint 8 payment tests were updated to clean up orders created by successful callbacks and remain passing.

## Deliberate future boundaries

The following are intentionally not implemented in Sprint 9:

- courier assignment, shipment labels, tracking events, and delivery proof;
- returns, refunds, partial refunds, and payment reversal workflows;
- seller settlement, commissions, payout batches, and reconciliation;
- customer notifications beyond internal order-created logging;
- split-shipment and multi-location delivery allocation;
- cancellation rules after fulfilment begins.

Sprint 10 should build on these immutable order and seller-order records rather than recomputing historical data from mutable catalog, address, cart, or payment rows.
