# SokoMart Sprint 6 Work Tracker

- [x] Inspect catalog, inventory, customer identity, authentication, tRPC, and the existing local cart/wishlist prototype.
- [x] Add persistent active carts, cart lines, and wishlist lines with ownership, uniqueness, and foreign-key constraints.
- [x] Apply and record migration `0007_sparkling_cassandra_nova`.
- [x] Implement server-authoritative cart add, set, increase, decrease, remove, clear, get, and validate operations.
- [x] Implement live price-change detection, safe availability states, checkout-blocking issues, and integer-money totals.
- [x] Preserve cart lines when products or sellers become unavailable.
- [x] Ensure add-to-cart does not create inventory reservations.
- [x] Implement persistent wishlist add, remove, clear, visibility checks, and duplicate prevention.
- [x] Connect the existing storefront cart and wishlist controls to authenticated tRPC data.
- [x] Add guest-cart decision and sign-in messaging instead of silently introducing merge semantics.
- [x] Add Sprint 6 integration coverage for authentication, persistence, multi-seller carts, pricing, no-reservation behavior, visibility changes, wishlist state, and IDOR protection.
- [x] Run typecheck, focused commerce tests, full regression tests, production build, and migration verification.
- [x] Document Sprint 6 architecture and the checkout/order boundary.
- [x] Future sprint boundary recorded: checkout orchestration, order snapshots, payment idempotency, fulfilment, returns, and settlement remain intentionally out of Sprint 6.

# SokoMart Sprint 7 Work Tracker

- [x] Reuse existing customer, cart, catalog, seller, inventory, money, validation, audit, and transaction boundaries.
- [x] Add checkout session lifecycle with server-controlled status, ownership, expiry, cancellation, and refresh-by-new-snapshot behavior.
- [x] Add immutable checkout session, seller-group, and line-snapshot tables with additive migration `0008_glamorous_sabra`.
- [x] Snapshot server-authoritative product, SKU, seller, quantity, price, currency, and line subtotal data.
- [x] Reuse Sprint 2 saved addresses and persist an immutable delivery address snapshot.
- [x] Group checkout lines by seller for future parent-order and seller-order decomposition.
- [x] Add explicit subtotal, shipping, fee, tax, and total pricing components using integer minor-unit money.
- [x] Add validation issue reporting for empty carts, invalid cart lines, price changes, and missing delivery addresses.
- [x] Add authenticated-user-scoped idempotency keys and cross-customer session protection.
- [x] Keep checkout preparation separate from orders, payments, logistics, and inventory reservations.
- [x] Replace the storefront demo checkout dialog with a server-backed checkout preview using saved addresses and seller totals.
- [x] Add Sprint 7 integration tests and documentation.
- [x] Future sprint boundary recorded: delivery rates, fee/tax policies, inventory reservation, payment idempotency, and parent/seller order creation.

# SokoMart Sprint 8 Work Tracker

- [x] Add provider-agnostic payment domain and M-Pesa adapter boundary.
- [x] Add server-controlled payment attempt lifecycle: created, pending, processing, successful, failed, cancelled, expired, refunded, and partially_refunded.
- [x] Add payment attempt, callback event, and payment-reservation linkage tables in migration `0009_aromatic_sunset_bain`.
- [x] Use server-authoritative checkout totals and KES currency; never accept a client amount or currency.
- [x] Reuse customer phone normalization and require the saved customer phone for M-Pesa.
- [x] Implement server-only STK Push configuration, deterministic non-production mock behavior, and production fail-closed configuration.
- [x] Add rate-limited M-Pesa callback endpoint with provider reference, amount/currency checks, normalized callback storage, and replay idempotency.
- [x] Reserve existing inventory transactionally at payment initiation, link holds to the payment attempt, and release on failure, cancellation, or expiry.
- [x] Add authenticated payment read, initiate, cancel, and reconciliation procedures with ownership protection.
- [x] Replace checkout demo payment UI with server-confirmed status polling, timeout, and retry behavior.
- [x] Add Sprint 8 integration coverage for amount authority, ownership, idempotency, callback replay, invalid transitions, failed retry, and expiry release.
- [x] Document Sprint 8 payment architecture and the future order handoff.
- [x] Future sprint boundary recorded: parent/seller orders, reservation conversion, fulfilment, refunds, payouts, and settlement remain out of Sprint 8.
