# SokoMart Sprint 14 — Reviews, Ratings & Reputation

## Delivered

Sprint 14 adds a dedicated Reviews domain integrated with the existing customer, seller, catalog, orders, warehouse, shipment, notification, audit, RBAC, and WebDev storage-reference patterns.

### Persistent model

- `reviews` stores product and seller reviews with customer, product/seller, parent order, seller order, and optional order-item traceability.
- `purchaseKey` is a database-level unique idempotency key: `product:{customerId}:{orderItemId}` or `seller:{customerId}:{sellerOrderId}`.
- Review status is server-controlled: `pending`, `published`, `rejected`, `hidden`, or `removed`.
- `verifiedPurchase` is written by the service and is not accepted from client input.
- `review_media` stores object-storage references and metadata only; media bytes never enter MySQL.
- Migration: `drizzle/0016_yummy_menace.sql` (additive; applied to the active database).

## Eligibility and trust policy

A customer becomes eligible only when the server can join the authenticated customer to:

1. A paid, non-cancelled parent order.
2. The requested order item or seller order.
3. A warehouse package containing the item.
4. A shipment containing that package with status `delivered`.

The client cannot claim purchase ownership, product identity, seller identity, delivery state, or verified-purchase status. Product reviews are tied to an order item; seller reviews are tied to a seller order. Active or inactive seller members cannot review their own store or products. Failed, cancelled, unpaid, unfulfilled, undelivered, and delivery-attempt-only orders are not eligible.

Returns/refunds are not yet modeled by SokoMart, so the explicit Sprint 14 rule is: a delivered, paid purchase remains review-eligible until a future returns/refunds domain introduces a policy hook. That boundary is documented for Sprint 15 rather than inventing a parallel return system.

## Services and APIs

`server/domains/review/service.ts` provides reusable eligibility checks, eligible-item discovery, product/seller review creation, controlled own-review edits, own-review withdrawal, review-media reference registration, server-computed aggregates, public published review lists, and moderation.

`tRPC` procedures are registered under `review`:

- Public: `productReviews`, `sellerReviews`, `summary`.
- Customer: `eligibleItems`, `eligibility`, `sellerEligibility`, `createProduct`, `createSeller`, `updateOwn`, `removeOwn`, `addMedia`, `getOwn`.
- Moderation: `moderation`, `moderate`.

Customer edits preserve the original transaction relationship and always return the review to `pending`; customers cannot publish, alter moderation fields, alter verified-purchase state, or change aggregate values.

## Aggregates and abuse controls

Published-only count and average queries are computed by the server. No client-supplied aggregate or rating summary is persisted. Duplicate submissions are protected by the unique `purchaseKey` constraint and conflict handling, including concurrent-request races. A lightweight server-side limit of 10 review submissions per customer per rolling 24 hours reduces spam. Publication and moderation actions are audited.

## Notifications

Publishing a review emits `review.published` to the existing notification outbox. The notification template confirms publication without exposing private moderation data.

## UI

- `/reviews`: authenticated, mobile-first customer review center showing only delivered-purchase opportunities and real submission forms for product/store reviews.
- `/admin/reviews`: permission-gated moderation queue with publish, hide, and reject actions.
- `/orders` now links to the review center.

The UI intentionally shows a truthful empty state when no delivered eligible purchases exist; it does not fabricate ratings or reviews.

## RBAC

Added permissions:

- `review.read`
- `review.create`
- `review.update_own`
- `review.moderate`

The foundation seed is idempotent and has been rerun for existing roles.

## Verification

- Focused Sprint 14 + Sprint 12 + Sprint 13 tests: **16 passed**.
- Full regression suite: **89 passed across 19 files**.
- `pnpm check`: passed.
- `pnpm build`: passed; Vite emitted only the existing large-chunk advisory.
- `pnpm drizzle-kit generate`: no schema changes remaining after `0016_yummy_menace.sql`.
- Active database verified with `reviews`, `review_media`, purchase uniqueness, product indexes, and seller indexes.
- Desktop and 375px mobile screenshots checked for `/reviews` and `/admin/reviews`.
- Dev server and language service healthy.

## Explicit boundaries / Sprint 15 handoff

- Object-storage upload/signing UI and asynchronous media moderation are not included; Sprint 14 accepts server-authorized storage references and keeps bytes out of the database.
- Returns, refunds, review eligibility invalidation after a return, review replies, helpful votes, appeals, advanced fraud scoring, and review-bomb detection remain future work.
- Sprint 15 should add the returns/refunds eligibility hook, seller replies, review media upload workflow, and stronger rate-limit/fraud signals without weakening transaction-bound eligibility.
