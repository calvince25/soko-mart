# SokoMart Sprint 9–11 Work Tracker

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

## Sprint 11 — Warehouse, Sorting, and Dispatch Preparation

- [x] Add multiple warehouse locations, statuses, unique codes, and location-scoped staff assignments.
- [x] Add warehouse RBAC permissions: `warehouse.view`, `warehouse.intake`, `warehouse.sort`, `warehouse.dispatch`, and `warehouse.manage`.
- [x] Add seller handoff intake with unique seller-order ownership, expected quantities, package counts, and immutable events.
- [x] Add package and package-item records with parent-order → seller-order → order-item traceability.
- [x] Support split packages while preventing cumulative quantity over-allocation.
- [x] Add package/intake verification and discrepancy recording/resolution for missing, excess, damaged, wrong, incomplete, and packaging issues.
- [x] Add destination sorting batches, idempotent package assignment, and dispatch-ready transitions.
- [x] Add batch closure only after packages are dispatch-ready.
- [x] Keep warehouse operations separate from inventory deductions and reservations.
- [x] Add row locks, unique constraints, state predicates, and safe retries for receiving, verification, sorting, and dispatch readiness.
- [x] Add immutable warehouse events and audit records for intake, packages, discrepancies, batches, sorting, and dispatch readiness.
- [x] Add responsive `/warehouse` operations workspace with dashboard metrics, intake, package, discrepancy, sorting, and dispatch controls.
- [x] Add Sprint 11 integration coverage for permissions, cross-warehouse IDOR, duplicate intake, split packages, discrepancy resolution, sorting, dispatch, traceability, and inventory immutability.
- [x] Generate/apply additive warehouse migrations `0012_blue_unus` and `0013_watery_barracuda`; verify MySQL-safe constraints and ledger consistency.
- [x] Run focused warehouse tests, full regression, typecheck, production build, migration verification, diff checks, health checks, and responsive UI verification.
- [x] Document Sprint 11 architecture, operations, security, tests, and Sprint 12 handoff contract.
- [x] Future sprint boundary recorded: courier accounts, assignment, routes, GPS, tracking, OTP, delivery proof, returns, refunds, settlement, payouts, and full notifications.

## Sprint 12 — Delivery, Courier, and Shipment Tracking

- [x] Add courier identities linked one-to-one to authenticated users, with lifecycle and verification status.
- [x] Extend RBAC with courier management, shipment assignment, and delivery-action permissions; preserve the legacy admin compatibility path.
- [x] Add shipment records with unique tracking numbers, immutable destination snapshots, seller/order/warehouse ownership, split-package links, and lifecycle timestamps.
- [x] Create shipments only from `dispatch_ready` warehouse packages; keep shipment creation separate from inventory deductions and reservations.
- [x] Add immutable shipment event history with actor, courier, previous state, new state, timestamps, and operational notes.
- [x] Add assignment controls limited to active couriers and logistics/warehouse operators; enforce courier-to-shipment ownership for courier actions.
- [x] Implement server-authoritative pickup, in-transit, and out-for-delivery transitions with compare-and-set state predicates and duplicate-safe event history.
- [x] Add delivery-attempt history for delivered, unavailable, incorrect address, refused, damaged, and other outcomes.
- [x] Add customer-issued, hashed, expiring delivery OTP verification and proof-reference foundation without storing proof bytes in the database.
- [x] Add mobile-first `/delivery` courier/logistics workspace and `/track/:shipmentId` customer tracking timeline with IDOR-safe server reads.
- [x] Add Sprint 12 RBAC and input-boundary regression tests, schema migration `0014_dear_thaddeus_ross`, and foundation seed updates.
- [x] Operational boundary: no GPS or invented coordinates; no route optimization, notification delivery, returns/refunds, courier payouts, or settlement in this sprint.
- [x] Sprint 13 handoff recorded: notification consumers for shipment events, customer/seller tracking embedding in order detail, proof-of-delivery upload to object storage, returns/failed-delivery policy, and courier earnings/settlement remain intentionally deferred.
