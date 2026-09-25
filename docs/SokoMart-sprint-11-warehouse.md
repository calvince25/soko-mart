# SokoMart Sprint 11 — Warehouse, Sorting & Dispatch Preparation

**Status:** Implemented and verified

Sprint 11 introduces a warehouse operations domain between seller fulfilment and future courier/delivery workflows. It records the physical movement and preparation of committed orders without creating duplicate inventory deductions.

## 1. Warehouse architecture

The warehouse domain is implemented under `server/domains/warehouse` and is exposed as `commerce.warehouse` tRPC procedures. The domain owns:

- multiple warehouse locations and active/inactive/maintenance status;
- warehouse-user assignments for location-scoped staff access;
- seller handoff intake records;
- package records and order-item contents;
- discrepancy records and resolution state;
- destination sorting batches;
- immutable operational events and audit entries.

The service uses transaction-scoped row locks for handoff intake, package verification, package-to-batch assignment, and dispatch readiness. State changes are compare-and-set guarded where concurrent operators could otherwise append duplicate history.

## 2. Warehouse/location model

`warehouses` stores a human-readable name, unique operational code, country, county, town, address, and status. `warehouse_user_assignments` maps staff to active locations and records the assigning operator.

Global operators are recognized through the existing RBAC role records (`super_admin`, `marketplace_admin`, and `logistics_manager`). Other warehouse users must have an active assignment for a target warehouse. The service enforces this scope independently of the client UI.

## 3. Intake workflow

Only seller orders in `handed_to_logistics` can enter intake. Receiving a handoff:

1. locks the seller order;
2. checks for an existing intake by the unique seller-order constraint;
3. creates one intake for the selected warehouse;
4. calculates expected item quantity from immutable order items;
5. records expected package count and received count;
6. writes a warehouse event and audit entry.

A repeated receive request returns the existing intake when the warehouse matches. A conflicting warehouse receives a conflict instead of creating a second intake.

The workspace supports selecting an eligible handoff, receiving it, opening intake details, creating package records, verifying packages, and verifying the intake as a whole.

## 4. Package model

`warehouse_packages` belongs to one intake, seller order, parent order, seller, and warehouse. It copies delivery destination fields from the immutable order address snapshot and keeps the package reference unique.

`warehouse_package_items` links each package to one immutable `order_items` row and stores the quantity placed in that package. Package creation validates that every order item belongs to the seller order and that cumulative package quantity never exceeds the ordered quantity.

Package metadata can be updated until dispatch preparation has made it operationally immutable. Package details expose package contents, order-item traceability, discrepancies, and the assigned sorting batch.

## 5. Split-package handling

A seller order may be represented by multiple packages. Each package can contain a subset of order-item quantity, while the cumulative quantity across all packages is bounded by the order quantity. The unique package/order-item link prevents duplicate rows inside one package; the service still permits the same order item to be split across multiple packages.

## 6. Verification and discrepancy handling

Packages move through `received`, `verification_required`, `verified`, `discrepancy`, `sorted`, and `dispatch_ready`. Verification is idempotent for already verified or later-stage packages. A package with an open discrepancy cannot be verified.

Discrepancies support missing item, excess item, damaged package, wrong item, incomplete shipment, and packaging problem types. They keep the reporter, quantity, description, resolution status, resolution note, resolver, and resolution timestamp. Resolving all open discrepancies returns the affected intake/package to `verification_required`; a second verification is required before sorting.

The UI keeps discrepancy details inside the warehouse workspace. They are not exposed through the customer order surface.

## 7. Sorting architecture

Verified packages can be grouped into a `warehouse_sorting_batches` record by destination country, county, town, optional zone, and delivery method. A package can belong to only one batch through a unique package assignment. Adding a package moves it to `sorted`; duplicate assignment to the same batch is idempotent, while assignment to another batch is rejected.

A package can become `dispatch_ready` only after it is sorted. A batch can be closed only after all assigned packages are dispatch-ready. Batch and package events are recorded in immutable warehouse history.

## 8. Dispatch-ready handoff

The `package.dispatch_ready` operational event is the Sprint 12 boundary. It contains the warehouse, package entity, previous state, new state, actor, and timestamp. The future delivery domain can consume this handoff without rebuilding intake, package, or sorting logic.

No courier account, courier assignment, route, GPS, delivery proof, OTP, or live tracking is implemented in Sprint 11.

## 9. Inventory interaction

Warehouse receiving, verification, sorting, batching, and dispatch readiness do **not** write inventory movements, reservations, or balances. Inventory was already committed during payment/order finalization in earlier sprints. This separation prevents duplicate stock deductions and leaves future physical location transfers to the existing inventory movement system.

## 10. RBAC and security

The following permission codes are seeded:

- `warehouse.view`
- `warehouse.intake`
- `warehouse.sort`
- `warehouse.dispatch`
- `warehouse.manage`

Warehouse procedures use server-side permission middleware and then apply location scope in the service. Sellers and customers cannot use warehouse procedures. Warehouse staff cannot read another assigned location. Logistics managers and platform administrators may operate across permitted warehouse functionality according to the existing role model. Internal notes, staff identity, discrepancy details, and warehouse identifiers stay out of customer order hydration.

## 11. Idempotency and concurrency

The implementation uses:

- unique warehouse codes;
- unique seller-order intake records;
- unique package references;
- unique package/order-item links per package;
- unique package-to-batch assignments;
- row locks on seller-order intake, package verification, batch assignment, and dispatch-ready transitions;
- state predicates on updates;
- idempotent retries for already-completed transitions.

These safeguards protect duplicate receiving, verification, sorting, and dispatch-ready requests from concurrent warehouse workers.

## 12. Database migrations

Sprint 11 adds the reviewed additive warehouse migration `0012_blue_unus.sql` after the generated constraint names were shortened for MySQL compatibility. The assignment extension is recorded separately in `0013_watery_barracuda.sql`. Together, the migrations include warehouse locations, assignments, intake, package, package-item, discrepancy, sorting-batch, batch-package, and immutable event tables.

The local Drizzle journal and application migration ledger must remain aligned before future schema work. Migration verification is part of the release checklist.

## 13. UI

`/warehouse` is a responsive internal workspace with:

- dashboard metrics for awaiting intake, received, verification, discrepancies, sorting queue, dispatch-ready packages, and active batches;
- warehouse selection;
- seller handoff receiving;
- intake register and detail view;
- package quantity allocation for split packages;
- package verification;
- discrepancy recording and resolution state visibility;
- sorting batch creation and package assignment;
- dispatch-ready and batch-close actions;
- safe sign-in, empty, loading, and server-error states.

The page preserves SokoMart’s compact marketplace visual language while using a denser operational layout for internal users.

## 14. Tests and verification

`server/warehouse.sprint11.test.ts` covers:

- seller permission denial;
- assigned-versus-unassigned warehouse access;
- administrator cross-location visibility;
- duplicate/concurrent handoff receiving;
- split package creation and quantity limits;
- package and intake verification;
- discrepancy recording, resolution, and re-verification;
- sorting batch creation and idempotent package assignment;
- dispatch-ready package and batch closure;
- parent order → seller order → package → order-item traceability;
- cross-warehouse package IDOR protection;
- no additional inventory movement writes.

The focused Sprint 11 suite passes **5 tests**. The complete Sprint 1–10 regression suite remains the release gate and must be rerun after the final migration and UI verification.

## 15. Unresolved operational edge cases

- The current internal UI uses compact prompts for some receiving, discrepancy, and destination inputs; these can become dedicated forms when warehouse operators and validation copy are finalized.
- Receiving records an expected package count supplied by the operator; verification compares it with packages actually recorded and creates an incomplete-shipment discrepancy when they diverge.
- Courier assignment, dispatch manifests, tracking, delivery proof, returns, refunds, settlement, and notifications are intentionally deferred.

## 16. Sprint 12 consumption contract

Sprint 12 — Delivery, Courier & Tracking — should consume:

1. `warehousePackages` with `status = dispatch_ready`;
2. the package’s seller order and parent order identifiers;
3. destination country, county, town, zone, delivery method, and address snapshot;
4. sorting-batch reference and warehouse identifier;
5. the immutable `package.dispatch_ready` warehouse event;
6. the existing audit/event conventions for downstream handoff processing.

Sprint 12 should not deduct inventory again. It should add courier assignment, dispatch execution, delivery status, tracking, delivery proof, and customer-safe progress on top of this boundary.

## References

- `drizzle/schema.ts` — warehouse, order, and inventory tables.
- `server/domains/warehouse/service.ts` — authorization, state machine, transactions, and handoff logic.
- `server/domains/warehouse/router.ts` — permission-gated tRPC procedures.
- `client/src/pages/WarehouseWorkspace.tsx` — internal warehouse UI.
- `server/warehouse.sprint11.test.ts` — Sprint 11 integration coverage.
- `shared/permissions/catalog.ts` — permission codes and role grants.
