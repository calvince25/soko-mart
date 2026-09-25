# SokoMart Sprint 7 — Checkout & Pricing

**Status:** Implemented and verified.

## Scope

Sprint 7 turns an authenticated customer's active cart into a server-authoritative checkout preview for a multi-vendor marketplace. It does not create orders, reserve inventory, or process payment. Those concerns remain future domain boundaries.

A checkout preview captures what will become a future parent order with seller-level child orders:

```text
Parent order
├── Seller group A
├── Seller group B
└── Seller group C
```

## Checkout session lifecycle

`checkout_sessions` supports the server-controlled states `active`, `validated`, `ready_for_payment`, `expired`, `cancelled`, and `completed`. The current Sprint 7 procedures create `validated` previews when an address or cart issue still needs attention, and `ready_for_payment` previews when the cart and delivery address are valid. Clients cannot write lifecycle states.

Sessions belong to the authenticated user derived from the Manus session. Every read, refresh, address selection, and cancellation is ownership-scoped. A session expires after 30 minutes. Refreshing or changing the address creates a new immutable snapshot and cancels the previous open session rather than mutating its historical commercial data.

## Immutable snapshot

The checkout snapshot stores:

- Customer and cart ownership references.
- Product ID, SKU/variant ID, product name, variant name, SKU, seller ID, and seller/store name.
- Quantity, authoritative unit price, currency, and line subtotal.
- Address ID plus a copied delivery address snapshot.
- Shipping method, shipping charge, platform fee, tax, subtotal, and total.
- Validation issues, expiry, and lifecycle timestamps.

The address snapshot is created with the existing Sprint 2 `toAddressSnapshot` helper. Later edits to the saved address do not change a previously created checkout preview.

## Multi-vendor grouping

Each preview stores immutable seller groups in `checkout_session_groups` and immutable commercial lines in `checkout_session_items`. The grouping is derived from server-resolved cart lines, not browser-supplied seller or price data. One active cart can therefore produce several seller-level checkout groups while retaining one customer-facing payable total.

## Pricing framework

Prices are read again from the current cart/catalog state. Money remains integer minor units through the existing `Money` value object. The current framework returns explicit components:

| Component | Sprint 7 behavior |
|---|---|
| Subtotal | Sum of current server-authoritative SKU prices × quantity |
| Standard shipping | KES 0 placeholder pending logistics policy |
| Platform fees | KES 0 placeholder pending fee policy |
| Tax | KES 0 placeholder pending tax configuration |
| Total | Subtotal + shipping + fees + tax |

The response includes framework policy identifiers so future shipping, fee, and tax engines can be added without changing the checkout contract. No browser amount is trusted.

## Validation and idempotency

Checkout preparation rejects an empty cart. It carries forward cart-line validation issues such as unavailable sellers/SKUs, price changes, and stock problems. Missing delivery addresses are represented as an `ADDRESS_REQUIRED` issue until the customer selects a saved address. No checkout call reserves inventory; inventory reservation remains a payment/checkout execution concern for a later sprint.

An optional authenticated-user-scoped idempotency key returns the original session instead of creating duplicate checkout snapshots. The database uniqueness constraint protects the boundary.

## API surface

The new `commerce.checkout` router exposes:

- `create({ addressId?, shippingMethod, idempotencyKey? })`
- `get({ sessionId })`
- `refresh({ sessionId })`
- `setAddress({ sessionId, addressId })`
- `cancel({ sessionId })`

The storefront's existing checkout dialog now calls `create`, reuses saved addresses, displays seller groups and authoritative totals, and shows the server's validation issues. The payment action is intentionally disabled and labeled as the next sprint boundary.

## Tests

Sprint 7 integration coverage verifies authentication, empty-cart rejection, multi-seller grouping, server totals, address snapshot immutability, idempotent creation, and cross-customer session access protection. The full regression suite continues to cover Sprints 1–6.

## Next boundary

The next sprint can add delivery rate selection, real shipping calculation, fee/tax policies, inventory reservation, payment idempotency, and final parent/seller order creation without weakening this snapshot contract.
