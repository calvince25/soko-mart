# SokoMart Sprint 6 — Persistent Cart and Wishlist

**Status:** Implemented and verified.

## Scope

Sprint 6 replaces the storefront's authoritative React-only cart and wishlist state with authenticated, database-backed commerce services. The customer owns one active cart that persists across refreshes and sessions. Wishlist entries are also persisted per authenticated customer.

Guest carts are intentionally not implemented in this sprint. Unauthenticated customers can browse the storefront, but adding to cart or saving a wishlist item directs them to authentication. This avoids silently introducing guest identifiers, expiration, merge semantics, and security rules before they are explicitly designed.

## Data model

The migration `0007_sparkling_cassandra_nova` adds:

- `commerce_carts`: customer owner, `active`/`converted`/`abandoned` status, currency, timestamps, and a deterministic active-cart key.
- `commerce_cart_items`: one unique line per cart and variant, integer quantity, and the price/currency at the time the line was added for price-change messaging.
- `commerce_wishlist_items`: one unique wishlist line per customer and SKU/variant.

Cart and wishlist rows reference the canonical catalog variant. Product names, seller IDs, currency, stock, and prices supplied by the browser are never authoritative.

## Cart lifecycle and concurrency

Adding an item creates or reuses the customer's active cart inside a transaction. The customer row is locked during active-cart creation, and the deterministic active key is unique. Cart-line uniqueness prevents duplicate active lines for the same SKU; adding the same SKU increases its quantity.

Quantity APIs are explicit:

- `addItem(quantity)` increases an existing line.
- `setItemQuantity(quantity)` sets an absolute line quantity.
- `increaseItem`, `decreaseItem`, `removeItem`, and `clear` provide dedicated operations.

The configurable line limit is 1–99 units. A cart quantity is not a stock guarantee.

## Pricing and validation

The server derives the current SKU price and currency from the catalog. `getCart` and `validate` return the current server-calculated subtotal using integer minor-unit arithmetic through the Sprint 1 `Money` value object.

Each line reports:

- Current price and whether the price changed since the line was added.
- A safe availability state: `in_stock`, `low_stock`, `limited_availability`, or `out_of_stock`.
- Checkout-blocking issues for unavailable products, sellers, SKUs, changed prices, and insufficient availability.

Exact warehouse quantities are not exposed. Validation performs no inventory mutation and never creates a reservation. Inventory reservation remains a checkout responsibility.

## Catalog and seller safety

`addItem` requires an active SKU, a published and approved product, an active category, and an approved/verified seller. Existing cart lines are preserved when a product or seller later becomes unavailable, but the line is marked non-purchasable so checkout cannot use it.

Wishlist additions require a currently visible variant. Existing wishlist lines are retained and marked unavailable if catalog or seller visibility changes. Wishlist operations never touch inventory balances or reservations.

## API surface

The modular `commerce` router exposes:

- `commerce.cart.get`
- `commerce.cart.addItem`
- `commerce.cart.setItemQuantity`
- `commerce.cart.increaseItem`
- `commerce.cart.decreaseItem`
- `commerce.cart.removeItem`
- `commerce.cart.clear`
- `commerce.cart.validate`
- `commerce.wishlist.get`
- `commerce.wishlist.addItem`
- `commerce.wishlist.removeItem`
- `commerce.wishlist.clear`

Every procedure is protected and derives ownership from the authenticated session. Client-supplied `userId`, `customerId`, seller ID, product name, price, currency, and stock are not accepted as authority.

## Storefront integration

The existing storefront keeps its sharp marketplace layout, but persistent cart and wishlist queries now drive the account-aware controls. Authenticated users see database-backed cart counts, live server totals, price-change notices, availability warnings, and persisted heart states. Unauthenticated users receive a clear sign-in path. Static demo cards remain visible when the development catalog has no published rows, but they do not pretend to be persistent SKUs.

## Tests

Sprint 6 coverage includes authenticated access control, one active cart persistence, multi-seller lines, server pricing, no-reservation behavior, seller suspension handling, wishlist duplicate prevention, wishlist visibility changes, and cross-customer cart IDOR protection.

## Deliberate next boundary

Checkout, order snapshots, payment idempotency, delivery pricing, fulfilment, returns, and settlement remain outside Sprint 6. Checkout will call cart validation and then perform authoritative inventory reservation in a later sprint.
