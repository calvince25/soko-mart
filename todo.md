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
