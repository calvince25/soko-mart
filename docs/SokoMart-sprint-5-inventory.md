# SokoMart Sprint 5 — Inventory and Stock Control

**Status:** Implemented and verified  
**Scope:** Seller and platform stock control foundation  
**Out of scope:** Orders, checkout, carts, payments, delivery, and customer-facing stock reservation workflows

## 1. Purpose

Sprint 5 adds a dedicated inventory domain for a multi-seller marketplace. Catalog SKU identity and stock state are intentionally separate: a `catalog_product_variant` describes what is sold, while inventory records where units are held and how the balance changed.

The implementation is designed for the future SokoMart commerce flow without pretending that orders or payments already exist.

## 2. Data model

### `inventory_locations`

Represents a physical or operational stock location.

- Seller-owned locations use `sellerId` and may be `seller_location` or `warehouse`.
- Platform-owned locations use a `NULL sellerId` and may be `warehouse` or `fulfillment_center`.
- Locations have `active`, `inactive`, and `archived` states.
- Sellers cannot create or convert a location into a platform fulfillment center.

### `inventory_balances`

One row per seller + variant + location.

- `onHand`: physical units recorded at the location.
- `reserved`: units held for a future workflow.
- `damaged`: units quarantined as damaged.
- `available = onHand - reserved`.
- A unique key prevents duplicate balance projections for the same SKU and location.

### `inventory_movements`

Append-only operational ledger. Each movement contains:

- seller, variant, location, and optional reservation reference;
- movement type and balance type;
- direction and positive quantity;
- actor, request ID, reference, reason, and timestamp.

Supported movement types include `initial_stock`, `purchase_receipt`, `manual_adjustment`, `damage`, `loss`, `return`, `correction`, `reservation`, `reservation_release`, and `sale` (reserved for the future order domain).

### `inventory_reservations`

A transactional stock hold for a future checkout/order boundary.

- States: `active`, `released`, `expired`, `converted`, `cancelled`.
- Reservations carry a future reference type and reference ID.
- Expiry is handled by a backend service, not by a client timer.
- Release and conversion are single-winner state transitions.

## 3. Transaction and concurrency rules

### Stock receipt and adjustment

Receipt and adjustment operations run inside a database transaction:

1. Validate the SKU, seller ownership, location ownership, and operation rules.
2. Create or reuse the balance projection.
3. Update `onHand` using an atomic conditional update.
4. Reject reductions below reserved units or below zero.
5. Append the movement ledger entry.
6. Append an audit event in the same transaction.

Damage adjustments also append a second `damaged` ledger movement so reconciliation covers both the on-hand decrease and the damaged-unit increase.

### Reservation creation

Reservation creation uses an atomic conditional balance update:

```text
onHand - reserved >= requested quantity
```

If the condition fails, the request returns a conflict and no reservation or ledger movement is committed. This prevents overselling when two requests race for the last units.

### Release and expiry

Release first changes the reservation from `active` to its final state using a conditional update. Only the request that changes one row can subtract reserved units, append a release movement, and write an audit event. Repeated release calls return an idempotent `alreadyReleased` result.

`expireDueReservations()` scans due active reservations, then uses the same release boundary. The service is ready to be called by a future scheduled worker without exposing timer logic to the browser.

### Conversion

Conversion changes `active` to `converted` with a conditional update and records the future order reference. Converted reservations cannot be released. Stock remains reserved until the future order/fulfilment domain defines the sale movement and final decrement.

## 4. Authorization and IDOR protection

Every seller mutation validates both:

1. an approved seller membership with an allowed member role; and
2. ownership of the target SKU and location.

Seller-owned SKU and location IDs are never trusted from the client by themselves. A seller cannot receive stock into another seller's location, list another seller's movements, release another seller's reservation, or manipulate another seller's SKU.

Platform administrators can create platform locations, inspect inventory across locations, reconcile balances, and run the expiry service through admin procedures.

## 5. tRPC surface

The router is mounted at `inventory`:

- `inventory.availability` — public boolean availability/status for one approved SKU; does not expose warehouse quantity or location detail.
- `inventory.locations.list/create/update/archive` — seller location management.
- `inventory.seller.list` — seller balances with location context.
- `inventory.seller.addInitialStock` — first receipt for a SKU/location.
- `inventory.seller.adjustStock` — controlled receipt, correction, damage, loss, return, or purchase adjustment.
- `inventory.seller.movements` — append-only movement history.
- `inventory.seller.reservations.list/create/release/convert` — reservation lifecycle.
- `inventory.seller.reconcile` — compare balance projections with movement history.
- `inventory.admin.locations.create` — platform location creation.
- `inventory.admin.list/reconcile/expireReservations` — platform operations.

All mutation inputs are validated through `shared/validation/inventorySchemas.ts`.

## 6. Seller UI

`/seller/inventory` provides:

- available-unit, active-location, and active-reservation metrics;
- seller warehouse/store location creation;
- initial stock receiving;
- controlled stock adjustment with movement type and reason;
- future reservation creation and release;
- reservation list with expiry and reference metadata;
- reconciliation action and consistency result;
- current SKU/location balance table.

The UI deliberately uses numeric SKU/variant IDs for this foundation. A later catalog/inventory integration can replace those fields with searchable SKU selectors once the product-management experience is expanded.

The seller portal and catalog pages link to the inventory workspace.

## 7. Reconciliation

Reconciliation groups movement quantities by balance type and direction, then compares the calculated totals to the stored balance projection. It reports:

- balance ID;
- seller, variant, and location;
- stored values;
- expected ledger values;
- negative availability flags.

This makes the ledger the audit source of truth while keeping the balance table suitable for fast storefront reads.

## 8. Verification

The Sprint 5 suite covers:

- strict integer quantities and future expiry validation;
- initial receiving and immutable movement history;
- damage movement and damaged-unit accounting;
- multiple locations for one SKU;
- cross-seller SKU/location/movement/reservation isolation;
- insufficient-stock conflicts;
- idempotent release;
- backend expiry;
- converted reservation release rejection;
- concurrent reservation attempts;
- reconciliation detection and recovery;
- public availability safety.

Final verification for this sprint:

- `pnpm check` — passed
- `pnpm test` — **10 files passed, 47 tests passed**
- `pnpm build` — passed
- `pnpm drizzle-kit migrate` — passed with no pending migration
- migration `0006_daily_boomerang` — applied and recorded in Drizzle bookkeeping

## 9. Next boundaries

The next commerce sprint should add order and checkout orchestration around this foundation:

1. create an order snapshot of product, variant, price, currency, seller, and address data;
2. convert or release reservations from an order state machine;
3. append `sale` movements only after the order transition is transactionally defined;
4. add payment idempotency and provider reconciliation separately;
5. add fulfilment, delivery, returns, and seller settlement as separate domains.

No checkout, payment, cart, or order behavior is included in Sprint 5.
