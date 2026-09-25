# SokoMart Sprint 10 — Seller Fulfilment and Order Processing

**Status:** Implemented and verified in the current development environment.

Sprint 10 establishes the operational boundary between a paid order and future logistics. Payment and inventory conversion remain Sprint 9 responsibilities. Seller fulfilment now progresses independently for each seller order and stops at a clean logistics handoff boundary.

## Fulfilment state machine

Each `order_seller_orders` row has a server-controlled `fulfilmentState`:

```text
pending → accepted → processing → packed → ready_for_handoff → handed_to_logistics
```

Exception states are `rejected`, `cancelled`, and `failed`. Terminal states cannot transition further. Rejection is allowed only from `pending`, while cancellation is allowed from `pending`, `accepted`, `processing`, or `packed`. Rejection and cancellation require a reason.

The older seller-order `status` and the Sprint 10 `fulfilmentState` are intentionally separate. The legacy status is maintained for compatibility with the Sprint 9 order model, while `fulfilmentState` represents the operational progress used by the new workspace and customer progress view.

The server exposes explicit procedures for each normal action. It does not accept arbitrary status strings from the browser. The router also retains one validated generic transition procedure for internal clients that need to pass a reason or note with a transition.

## Seller authorization

Seller operations resolve seller IDs from the authenticated user’s active membership and the seller’s approved lifecycle state. The browser never supplies a seller ID for authorization. A user without an approved seller membership receives a safe empty seller-order list and cannot read or mutate a seller order.

Seller order detail, history, notes, and fulfilment mutations all apply the same seller-membership scope. A seller member can therefore operate only on seller orders belonging to the approved seller account represented by that membership. The implementation continues to use the existing `seller.order.read_own` and `seller.order.fulfill_own` permissions.

The admin list and detail procedures use the existing `order.manage_any` permission. Sprint 10 gives the admin surface operational visibility and history inspection. It does not give every admin role an unrestricted fulfilment mutation path. Refunds, courier assignment, and post-fulfilment intervention remain separate workflows.

## Database model

Migration `0011_magical_the_enforcers` adds the minimum persistence required for the workflow:

- `order_seller_orders.fulfilmentState` stores the current seller-specific state.
- `acceptedAt`, `processingAt`, `packedAt`, `readyForHandoffAt`, and `handedToLogisticsAt` store operational timestamps.
- `cancellationReason`, `cancelledByUserId`, `cancelledAt`, and `refundRequired` record exception handling without pretending that a refund occurred.
- `orders.fulfilmentStatus` stores an aggregate parent state.
- `seller_order_fulfilment_events` stores immutable transitions, actors, timestamps, reasons, and optional transition notes.
- `seller_order_fulfilment_notes` stores internal seller/admin notes separately from customer-visible order data.

The event and note tables have foreign keys to seller orders and users. Indexed seller-order/time and state/time access paths support workspace and operational queries.

## Parent-order aggregation

Parent fulfilment status is recalculated after every successful seller-order transition. Seller orders remain independent. The aggregation uses these rules:

1. Any `rejected`, `cancelled`, or `failed` seller order makes the parent `exception`.
2. If every seller order is `handed_to_logistics`, the parent is `handed_to_logistics`.
3. If every seller order is still `pending`, the parent is `unfulfilled`.
4. If all seller orders share `accepted`, `processing`, `packed`, or `ready_for_handoff`, the parent takes that state.
5. Any other mixture is `partially_fulfilled`.

This means a multi-vendor order can show one seller as packed and another as processing without losing either child state.

## Inventory and payment behavior

Inventory is not touched by fulfilment transitions. The order-creation transaction has already converted payment-linked reservations and recorded sale movements. Accepting, processing, packing, preparing for handoff, or handing over to logistics does not create another reservation, sale movement, or stock deduction.

Seller rejection and cancellation set `refundRequired = 1` and preserve the payment as successful. This is an explicit handoff to the later Returns & Refunds domain. Sprint 10 does not issue or simulate refunds.

## Fulfilment history and events

Order creation records an initial `pending` event. Each committed state transition records one immutable event with the seller order, previous state, new state, actor, timestamp, optional reason, and optional note. The event is written inside the fulfilment transaction.

After commit, a lightweight domain event hook logs names such as `seller_order.accepted`, `seller_order.processing`, `seller_order.packed`, `seller_order.ready_for_handoff`, and `seller_order.handed_to_logistics`. These hooks do not call a notification provider and cannot cause the fulfilment transaction to fail. Future Notifications and Logistics sprints can consume the same interface.

`ready_for_handoff` is the eligibility boundary for a future logistics consumer. `handed_to_logistics` records the seller’s actual handoff to that future system. No courier, route, delivery proof, or tracking record is created in Sprint 10.

## Seller workspace

Approved sellers can use `/seller/orders` and `/seller/orders/:sellerOrderId`. The list includes the parent order number, seller name, date, current fulfilment state, item count, delivery area, and seller total. The detail view includes the packing list, SKU and variant information, quantities, delivery information needed for legitimate fulfilment, timestamps, the valid next action, immutable history, and internal notes.

Buttons are derived from the current state, but the backend enforces the same transition rules. The workspace provides safe empty behavior for ordinary customers or sellers without approved membership.

## Customer fulfilment visibility

Customers can see seller-specific progress in `/orders/:orderId`. The view displays a progress strip from `pending` through `handed_to_logistics` for each seller order. It does not display internal seller notes, operational reasons, or courier tracking. Delivery tracking remains a later boundary.

## Admin operations

Authorized administrators can use `/admin/fulfilment` to filter seller orders by fulfilment state and search by parent order number. The detail view shows seller order items, delivery information, exception flags, internal notes, and immutable fulfilment history. Seller search is supported through the existing `sellerId` input on the admin order-search contract and the same permission boundary.

The current admin UI intentionally identifies its mutation boundary as read-only. A future operational policy can add narrowly scoped administrative intervention procedures without turning `order.manage_any` into unrestricted fulfilment control.

## Idempotency and concurrency

Fulfilment writes run in a database transaction. The seller order is locked before its current state is evaluated. The final update also includes the expected current state as a compare-and-set predicate. A retry targeting the already committed state returns the current order without writing a second logical event. A concurrent duplicate transition therefore leaves one state change, one history event, and unchanged inventory movements.

The integration suite covers duplicate actions, concurrent packing requests, invalid transitions, terminal states, seller ownership, no-membership behavior, private notes, rejection exceptions, parent aggregation, and inventory immutability.

## Verification

The final verification run produced:

- **68 tests passing** across 15 Vitest files, including 4 Sprint 10 fulfilment tests.
- **Typecheck passing** with `pnpm check`.
- **Production build passing** with `pnpm build`.
- **Migration idempotency passing** with `pnpm drizzle-kit migrate` after recording the applied `0011_magical_the_enforcers` hash.
- **Diff checks passing** with `git diff --check`.
- **Responsive UI verification passing** for storefront, seller fulfilment, admin fulfilment, and customer orders at desktop and mobile viewports.

## Explicit future boundaries

Sprint 10 does not implement warehouse picking, sorting, barcode scanning, courier assignment, delivery zones, route optimization, GPS tracking, delivery proof, returns, refunds, full notifications, commissions, seller payouts, settlement, or advanced dispatch management. Sprint 11 — Warehouse & Sorting — should consume seller orders at `ready_for_handoff` and use the immutable packing list, SKU, quantity, fulfilment history, and seller authorization boundary without duplicating order records.

## References

[1]: ../drizzle/schema.ts "Canonical SokoMart database schema"
[2]: ../server/domains/order/fulfilment.ts "Sprint 10 fulfilment state machine and services"
[3]: ../server/domains/order/router.ts "Order and fulfilment tRPC procedures"
[4]: ../server/fulfilment.sprint10.test.ts "Sprint 10 fulfilment integration tests"
[5]: ../client/src/pages/SellerOrders.tsx "Seller fulfilment workspace"
[6]: ../client/src/pages/AdminFulfilment.tsx "Admin fulfilment operations view"
[7]: ../client/src/pages/Orders.tsx "Customer order progress view"
