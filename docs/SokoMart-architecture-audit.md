# SokoMart Production Marketplace Audit and Architecture Plan

**Prepared:** 25 September 2026  
**Project:** SokoMart  
**Scope:** Audit and architecture planning only. No marketplace feature implementation was started in this phase.

## Executive conclusion

SokoMart is currently a **React storefront prototype with a functioning authentication foundation**, not a functioning multi-vendor marketplace. The public page renders a responsive marketplace-style interface, and users can interact with locally held product cards, filters, a wishlist, a cart, and a demo checkout. These shopping interactions are not persisted and do not call marketplace APIs. The server currently exposes only authentication, a health check, owner notification, OAuth callback, and storage proxy functionality. The live database contains only `users` and `__drizzle_migrations` tables.

The existing foundation is suitable for incremental development because it already provides React, tRPC, Express, Drizzle, MySQL/TiDB connectivity, Manus OAuth, server-side JWT verification, and object storage helpers. The main architectural risk is not a broken framework. It is the absence of domain models and server-side business workflows. The next phase should therefore begin with identity, roles, catalog, inventory, cart, order decomposition, payments, and ledger boundaries before adding seller, logistics, support, or mobile features.

The current UI should be preserved. It can be connected to real procedures and gradually split into feature pages without another visual rewrite.

## Audit method and evidence

This assessment reviewed the repository structure, package configuration, client routes and pages, frontend state management, tRPC wiring, server bootstrap, authentication code, database schema and migration, storage helpers, runtime configuration, tests, and the live database metadata. The classification below distinguishes code that is executable from interface text that only implies a capability.

The live database inspection confirmed one application table, `users`, plus the migration bookkeeping table. No catalog, order, payment, seller, logistics, review, support, or finance tables exist.[1]

## A. Current architecture

### Technology stack

| Layer | Current implementation | Assessment |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 | Functional shell with one primary storefront page |
| Routing | Wouter | Only `/`, `/404`, and a fallback route are registered |
| UI components | Radix-based shadcn-style components plus Lucide icons | Broad component library is available but most marketplace UI is inline in `Home.tsx` |
| Data fetching | tRPC React client over `/api/trpc` with TanStack Query and SuperJSON | Authentication uses tRPC; marketplace UI does not |
| Backend | Express 4 with tRPC 11 | Server is running, but the application router has almost no domain procedures |
| Database | MySQL/TiDB through `drizzle-orm/mysql2` | Connected and migrated, but only the core user table exists |
| ORM and migrations | Drizzle schema and SQL migration files | Schema is minimal; no relations or marketplace migrations exist |
| Authentication | Manus OAuth callback, signed JWT session cookie, optional preview Bearer fallback | This is the most complete backend capability |
| Object storage | Manus Forge presigned S3 upload/get helpers and `/manus-storage/*` proxy | Implemented as infrastructure, unused by product features |
| Payments | None | The UI mentions M-Pesa, but no payment provider or webhook flow exists |
| Email, SMS, WhatsApp | None | No provider, templates, queue, or delivery status exists |
| Hosting | WebDev managed development server and Node build output | Production build succeeds; marketplace operational requirements are not implemented |
| Testing | Vitest with one logout test | No catalog, order, authorization, payment, or integration coverage |

The project dependencies include primitives that could support future features, such as forms, validation adapters, charts, date utilities, file storage SDKs, and HTTP clients. Their presence does not mean the corresponding business feature exists.

### Frontend routing and page inventory

The application registers `Home` at `/`, `NotFound` at `/404`, and a catch-all `NotFound` route.[2] `Home.tsx` contains the entire current customer storefront, including product data, category data, seller labels, filtering, wishlist state, cart state, product details, checkout modal, newsletter form, and most marketplace copy. `ComponentShowcase.tsx` is a development/demo page and is not registered in the application router. There are no customer account, seller, admin, order, payment, support, return, or tracking routes.

The existing `DashboardLayout` and related dashboard components are available in the repository, but they are not connected to a role-aware route. Their presence is a reusable UI asset rather than an existing admin system.

### Server and API inventory

The main tRPC router exposes:

- `auth.me`, a public query that returns the current request user or `null`.
- `auth.logout`, a public mutation that clears the session cookie.
- `system.health`, a public health procedure with timestamp validation.
- `system.notifyOwner`, an admin-protected owner notification procedure.

There are no procedures for products, categories, brands, search, inventory, cart, wishlist, checkout, orders, payments, shipments, reviews, support, sellers, commissions, payouts, or analytics. The only conventional Express routes added outside tRPC are the OAuth callback and the storage proxy.[3]

### Database inventory

The TypeScript schema defines one application table:

- `users`: integer primary key, unique OAuth `openId`, nullable name and email, login method, `user | admin` role enum, and timestamps.

The applied SQL migration contains the same table and no foreign keys beyond the primary key and unique `openId` constraint.[4] `drizzle/relations.ts` is empty. There are no marketplace relationships, status columns, monetary columns, product indexes, inventory constraints, or audit tables.

### Authentication and security foundation

The OAuth flow uses a one-time nonce stored in a `__Host-oauth_state` cookie. The callback validates that nonce before exchanging the authorization code. It then synchronizes the user, creates a signed HS256 JWT session token, stores it in an HTTP-only cookie, and redirects to `/`.[5]

The request context treats authentication as optional. `protectedProcedure` and `adminProcedure` enforce server-side access when a procedure uses them. The current role model contains only `user` and `admin`; it is not sufficient for a multi-role marketplace. The owner OpenID is promoted to admin during user upsert, which is acceptable for the scaffold owner but not a complete production role-management policy.

The session cookie is configured with `httpOnly`, `path=/`, `sameSite=none`, and a request-derived `secure` flag. The application also supports a preview-specific Bearer fallback from browser session storage. This fallback is useful for WebView and preview constraints, but it must remain isolated from customer-facing token flows and must never become an alternative to a short-lived, revocable production session strategy.

## B. Existing functional features

The following features are functional in the narrow sense that their current code executes and has been verified at the UI or infrastructure layer:

1. The application builds successfully with TypeScript and Vite/esbuild.
2. The `/` route renders a responsive marketplace storefront.
3. The search field filters the in-memory product list.
4. Category buttons filter the in-memory product list where a matching category exists.
5. Product cards open a product detail modal.
6. Wishlist buttons update in-memory state for the current page session.
7. Cart buttons add products to in-memory state and support quantity changes and removal.
8. The checkout modal opens from the cart.
9. Manus OAuth login can be initiated by the provided client helper.
10. The authentication hook reads current user state through the server and can call logout.
11. The OAuth callback, session verification, admin middleware, owner notification wrapper, and storage proxy are implemented infrastructure paths.
12. The existing logout test validates that the session cookie is cleared with expected attributes.

These features are functional as prototype behavior. They should not yet be described as production commerce functionality.

## C. Existing incomplete features

The storefront contains interface-level starts for the following capabilities, but each needs server persistence, validation, authorization, and error handling before it is a real feature:

| Feature | Current state | Required completion boundary |
|---|---|---|
| Product discovery | Local hardcoded array with client-side filtering | Catalog tables, search API, pagination, indexing, stock visibility, and seller attribution |
| Categories and brands | Local arrays | Admin-managed taxonomy and brand tables with slugs and indexes |
| Product details | Modal only | Product route, variants, images, attributes, stock, seller, delivery promise, and SEO metadata |
| Wishlist | Page-memory array | Authenticated wishlist tables and idempotent server mutations |
| Cart | Page-memory array | Persistent customer or guest cart, quantity validation, price snapshotting, stock checks, and merge-on-login behavior |
| Checkout | Modal with delivery text and fixed M-Pesa label | Address, shipping method, server-calculated totals, payment intent, webhook confirmation, and order creation |
| Flash sale | Static countdown and regular product subset | Promotions, eligibility windows, price rules, reservations, and server-side expiry enforcement |
| Reviews | Rating text is hardcoded on products | Verified-purchase reviews, moderation, aggregates, and abuse controls |
| Seller onboarding | Toast says registration is coming soon | Application, KYC or business verification, store profile, approval workflow, and seller permissions |
| Delivery | Marketing text only | Delivery zones, service levels, shipment creation, courier events, and customer tracking |
| Customer support | Footer link shows a toast | Ticket and message records, agent roles, SLA status, and notifications |
| Mobile app | No mobile project exists | Shared API contracts, app authentication, native navigation, push notifications, and release pipeline |

## D. Existing broken or misleading features

No TypeScript or production build errors were found during the audit. The primary defects are behavioral and architectural rather than compiler failures.

### Misleading commerce claims

The storefront labels the experience “M-Pesa ready,” displays a “Secure checkout” path, presents a Flash Sale countdown, and ends the demo flow with a “Demo order placed” success toast. No payment provider, payment transaction table, order endpoint, webhook, or fulfilment record exists. These labels must remain clearly marked as demo-only until the underlying workflows are implemented.

### Static countdown

The Flash Sale timer is hardcoded as `01:09:12`. It does not count down, expire products, or change pricing. A real promotion must be time-bound on the server and validated again at checkout.

### In-memory state loss

Cart and wishlist state are held in React state. Refreshing the page loses them. Multiple devices cannot share them, and the server cannot use them to build an order. This also means the checkout modal cannot guarantee price or inventory consistency.

### Category mismatch

The UI offers categories such as TV, Appliances, Computers, and Automotive, but the local catalog has no products for most of those categories. This produces empty states or a false impression of inventory depth.

### Brand search mismatch

The popular brand buttons write a brand name into the generic product search. Because products do not contain a structured brand field, many brand buttons produce no results or rely on seller-name coincidences.

### Login display edge case

The header falls back to the label `Account` when a signed-in user has no name, but the authentication flow creates the user from upstream OAuth data and does not guarantee a non-empty name in all cases. A production account profile should have an explicit display-name policy and a profile completion flow.

### Monolithic storefront page

`Home.tsx` currently combines data modeling, presentation, filtering, cart logic, wishlist logic, modal logic, checkout copy, and footer interactions. This makes the first page fast to prototype but creates a high risk of duplicated rules and difficult testing when server-backed features are introduced.

### External image hotlinks

Product and promotional images are loaded directly from Unsplash URLs. The project has a storage helper, but current product media is not stored in SokoMart-managed object storage. This creates dependency, licensing, performance, cache, and availability risks for production catalog media.

## E. Missing marketplace features

The complete multi-vendor scope requires five cooperating domains. They should not be implemented as one large feature.

### Customer domain

SokoMart needs a customer profile separate from the OAuth identity. It needs addresses, default-address rules, carts, wishlists, order history, review eligibility, return requests, refund visibility, notification preferences, and support tickets.

### Seller domain

A seller needs an onboarding application, verification records, a store profile, legal and payout data, product ownership, inventory, seller-level orders, fulfilment actions, return handling, commission statements, wallet balance, payout requests, and seller notifications.

### Catalog and merchandising domain

The catalog needs categories, brands, products, variants, images, attributes, pricing, stock status, search metadata, moderation status, and promotion eligibility. The public catalog must expose only approved and sellable records.

### Operations domain

Orders must be split by seller while retaining one parent customer order. Each seller order needs its own fulfilment state, warehouse or pickup information, shipment, courier assignment, delivery events, failed-delivery handling, and return-to-sender path.

### Finance and control domain

Payments, refunds, commissions, seller wallet movements, payouts, reconciliation, and audit logs require an append-only financial history. Financial state must not be represented only by mutable balance fields or client-side totals.

## F. Database problems

The current database is a scaffold-level identity store. It is not a marketplace schema.

1. **Missing domain tables.** There are no product, seller, inventory, cart, order, payment, shipment, return, refund, review, promotion, commission, payout, support, notification, or audit tables.
2. **Insufficient roles.** `user | admin` cannot represent seller, courier, finance, warehouse, support, product manager, logistics manager, marketplace admin, or super admin responsibilities.
3. **No relationships.** `relations.ts` is empty, and there are no foreign-key constraints connecting business records.
4. **No money model.** The schema has no integer minor-unit monetary columns, currency fields, tax components, discount components, or payment references.
5. **No status model.** There are no constrained state values or transition history records.
6. **No inventory safety.** There are no stock quantities, reservations, movement logs, optimistic version fields, or unique SKU constraints.
7. **No order decomposition.** There is no parent-order and seller-order relationship, so one checkout cannot safely support multiple sellers.
8. **No idempotency.** There are no idempotency keys for checkout, payment callbacks, refunds, or payout operations.
9. **No auditability.** There is no audit log for actor, action, entity, before/after state, reason, or request correlation ID.
10. **No operational indexes.** There are no indexes for product discovery, seller filtering, order status, payment references, shipment tracking, or support queues.
11. **No privacy lifecycle.** There are no consent, data-export, account-deletion, or retention fields.

The new schema should be introduced in additive migrations. The existing `users` table should be preserved, then extended through profile and role-assignment tables rather than replaced casually.

## G. Security problems and controls required

### Current positive controls

The OAuth state cookie is host-only and the callback checks the nonce before token exchange. Session tokens are signed and verified server-side. tRPC includes reusable protected and admin middleware. Owner notification is admin-protected and validates message lengths. Secrets are read from environment variables rather than hardcoded in application source.[6]

### Current gaps and risks

| Risk | Why it matters | Required control |
|---|---|---|
| Single coarse admin role | Any admin-designated user would share all admin capabilities | Permission-based RBAC with scoped permissions and server-side policy checks |
| No business authorization | No seller or order procedures exist to test ownership boundaries | Every mutation must scope records to the authenticated actor or authorized role |
| No rate limiting | Login-adjacent, search, checkout, and support endpoints could be abused | Per-IP, per-account, and per-operation limits with safe retry behavior |
| No payment webhook verification | Payment success cannot be trusted from the browser | Provider signature validation, idempotency, event storage, and replay protection |
| Client-side totals | Prices, discounts, and quantities can be changed in the browser | Server recalculation from current catalog, promotion, shipping, and tax data |
| No stock reservation | Concurrent checkout can oversell | Transactional reservation with expiry and atomic decrement |
| 50 MB global body parser | Every request accepts a large payload budget | Route-specific limits and multipart/object-storage upload paths |
| Long-lived one-year session token | Compromise gives a long window for abuse | Short-lived access tokens, rotating refresh or revocation strategy, device/session records |
| Storage proxy cache control | `Cache-Control: no-store` is safe but inefficient for public media | Public immutable media paths and signed private paths with appropriate cache policy |
| External image URLs | Media can change or disappear and may not be licensed for commerce | Store approved media in managed object storage and persist metadata |
| No audit log | Finance, moderation, and admin actions cannot be investigated | Append-only audit events with actor, entity, reason, and correlation ID |
| No validation layer for marketplace input | Product, address, coupon, and order payloads could be malformed | Shared Zod schemas with server-side validation and domain error codes |
| No security headers or abuse controls visible in app bootstrap | Browser and API hardening is incomplete | Helmet-equivalent headers, CORS policy, CSRF strategy where cookies are used, and request logging |

These controls should be added before real payments, seller payouts, or customer personal data are introduced.

## H. Recommended target architecture

### Bounded domains

The application should remain a modular monolith initially. A modular monolith is simpler to deploy and test than multiple services, while still separating domain logic and database access. The recommended boundaries are:

1. **Identity and access:** users, profiles, roles, permissions, sessions, and audit actors.
2. **Catalog:** categories, brands, products, variants, images, attributes, and product moderation.
3. **Merchandising:** prices, promotions, coupons, flash sales, and search projections.
4. **Seller operations:** seller applications, stores, verification, inventory, seller orders, commissions, and payouts.
5. **Customer commerce:** addresses, carts, wishlists, checkout, parent orders, and customer notifications.
6. **Payments and finance:** payment intents, provider transactions, refunds, ledger entries, seller wallets, and payout batches.
7. **Logistics:** warehouses, delivery zones, shipments, courier assignments, tracking events, and failed-delivery workflows.
8. **Customer care:** support tickets, messages, attachments, escalations, and service-level status.
9. **Platform control:** CMS content, admin dashboards, reporting, feature flags, and audit review.

Each domain should expose procedures through feature-specific server modules. The tRPC router should compose those modules rather than continue growing as one file.

### Request flow

A public catalog request should pass through a catalog procedure, validate its input, query approved products with pagination and indexes, and return a typed response. A checkout request should be a protected procedure that loads the customer cart, validates current prices and inventory, groups items by seller, creates payment intent state, and commits a parent order plus seller orders only after the payment policy permits it. External payment callbacks should enter through a dedicated webhook route or validated procedure and should be idempotent.

The client should use tRPC hooks for server state. Local state should be limited to transient UI state such as open drawers, selected filters, and optimistic interaction state. Cart, wishlist, product data, checkout totals, and order state should be server-owned.

### Data and media strategy

Product images should be uploaded through the existing object-storage helper and stored as media metadata records. The catalog should store an immutable media key, dimensions, content type, alt text, sort order, and moderation status. Images should not be placed in `client/public` or hotlinked from third-party sites.

### Mobile strategy

The future Android/iOS app should consume the same typed API and domain rules as the web client. It should not duplicate payment, inventory, promotion, or order logic in the mobile client. The API contract should stabilize during the catalog, cart, checkout, and order phases before the mobile app begins implementation.

## Target normalized database design

The following design is the recommended foundation. It is intentionally more structured than the current database, but it avoids creating warehouse and courier complexity before the catalog and order boundaries are stable.

### Identity, profiles, and access

| Table | Purpose | Key relationships and constraints |
|---|---|---|
| `users` | Preserve the existing OAuth identity | Unique `openId`; status; created/updated timestamps |
| `customer_profiles` | Customer-specific profile and preferences | One-to-one with `users`; phone and marketing consent fields |
| `seller_profiles` | Legal and operational seller identity | One-to-one with `users`; verification status; unique tax/business identifiers where available |
| `seller_stores` | Public store information | Many stores can be supported later; unique slug; owner seller profile |
| `roles` | Named platform roles | Unique code |
| `permissions` | Atomic capabilities | Unique code |
| `user_roles` | Assign roles to users | Unique user-role pair; optional scope |
| `role_permissions` | Map roles to permissions | Unique role-permission pair |
| `addresses` | Customer and seller addresses | Owner type and owner ID, or separate owner tables if stronger referential integrity is preferred; default-address constraint at application level |
| `sessions` | Production session/device management | User, token hash, device, expiry, revoked timestamp |

### Catalog and merchandising

| Table | Purpose | Key relationships and constraints |
|---|---|---|
| `categories` | Hierarchical taxonomy | Self-referencing `parentId`; unique slug; active and display-order indexes |
| `brands` | Structured brand directory | Unique normalized name and slug |
| `products` | Seller-owned catalog listing | Seller store, category, brand; moderation status; unique public slug |
| `product_variants` | SKU-level purchasable item | Product, unique seller SKU, barcode where available, price in minor units, currency, weight, status |
| `product_images` | Managed product media | Variant or product, storage key, alt text, sort order, moderation status |
| `product_attributes` | Flexible structured attributes | Product or variant, attribute name and normalized value; indexed for selected filters |
| `prices` | Effective price history | Variant, currency, minor-unit amount, effective-from/to, source, audit actor |
| `promotions` | Campaign and rule container | Status, time window, scope, budget or usage constraints |
| `promotion_items` | Products or variants in a promotion | Promotion, variant, promotional price or discount rule |
| `coupons` | Customer redeemable codes | Unique code, validity window, usage and customer limits |
| `coupon_redemptions` | Coupon usage ledger | Coupon, order, customer, unique order-coupon constraint |

### Customer commerce

| Table | Purpose | Key relationships and constraints |
|---|---|---|
| `carts` | Active or historical cart container | Customer or guest token, status, currency, timestamps |
| `cart_items` | Cart contents | Cart, variant, quantity; unique cart-variant pair |
| `wishlists` | Customer wishlist container | Customer; unique customer and list name if multiple lists are supported |
| `wishlist_items` | Saved variants | Wishlist, product or variant; unique pair |
| `orders` | Customer-facing parent order | Customer, totals, currency, address snapshot, payment state, order state, unique public number |
| `order_items` | Immutable checkout lines | Parent order, variant, seller snapshot, price snapshot, quantity, totals, fulfillment status |
| `seller_orders` | Seller-specific child order | Parent order, seller store, seller status, totals, fulfillment timestamps; unique parent-seller pair |
| `order_events` | Customer-visible and internal state history | Order, actor, from/to status, reason, timestamp |
| `notifications` | In-app and delivery notification record | User, type, payload, read/delivered timestamps |

Address and seller information used at checkout should be copied into immutable order snapshots. Orders must not change historically when the customer later edits their profile or a seller changes store information.

### Inventory and logistics

| Table | Purpose | Key relationships and constraints |
|---|---|---|
| `warehouses` | Physical or seller-fulfilled stock location | Location, status, operating metadata |
| `inventory` | Available, reserved, and damaged quantities | Variant and warehouse; unique pair; non-negative quantities enforced by transactions |
| `inventory_movements` | Append-only stock movement history | Variant, warehouse, movement type, quantity, reference type/id, actor |
| `inventory_reservations` | Temporary checkout holds | Variant, warehouse, order/cart reference, quantity, expiry, status |
| `shipments` | Seller-order delivery unit | Seller order, origin, destination snapshot, carrier, tracking number, status |
| `shipment_items` | Shipment contents | Shipment, order item, quantity |
| `shipment_events` | Tracking history | Shipment, event code, location, event time, source, raw reference |
| `delivery_zones` | Shipping price and service rules | Geographic definition, price rules, active state |
| `couriers` | Courier partners or users | Courier user or organization, service coverage, status |
| `courier_assignments` | Shipment-to-courier assignment | Shipment, courier, assignment state, accepted/declined timestamps |

### Payments and finance

| Table | Purpose | Key relationships and constraints |
|---|---|---|
| `payments` | Customer payment intent for a parent order | Order, provider, amount, currency, status, idempotency key |
| `payment_transactions` | Provider event and attempt record | Payment, provider reference, event type, raw payload hash, unique provider reference |
| `refunds` | Refund request and result | Order or order item, payment, amount, reason, status, provider reference |
| `ledger_accounts` | Financial account categories | Customer payment clearing, platform revenue, seller payable, refund clearing, and others |
| `ledger_entries` | Append-only double-entry movements | Transaction reference, debit/credit account, minor-unit amount, currency, immutable timestamp |
| `seller_commissions` | Commission calculation by seller order line | Seller order/item, commission rule, gross, fee, net payable |
| `seller_wallets` | Materialized seller balance view | Seller; derived from ledger and reconciled, not the authoritative ledger |
| `wallet_transactions` | Seller wallet presentation history | Seller, ledger reference, amount, available-at timestamp |
| `seller_payouts` | Payout batches and requests | Seller, amount, destination snapshot, status, approval and provider references |
| `payout_items` | Lines included in a payout | Payout, seller wallet transaction, amount |

Money should be stored in integer minor units, such as cents, with an explicit ISO currency code. The application must never derive a payable seller balance from browser totals or floating-point arithmetic.

### Returns, reviews, support, and governance

| Table | Purpose | Key relationships and constraints |
|---|---|---|
| `returns` | Customer return request | Order, customer, reason, status, approval and receipt dates |
| `return_items` | Item-level return request | Return, order item, quantity, condition, resolution |
| `reviews` | Verified-purchase review | Customer, order item, product, rating, content, moderation status; one review per eligible order item unless policy says otherwise |
| `support_tickets` | Customer or seller support case | Requester, order or seller reference, priority, status, assignment |
| `support_messages` | Ticket conversation | Ticket, author, body, attachments, internal flag |
| `audit_logs` | Security and operational audit | Actor, action, entity, entity ID, before/after JSON, reason, request ID, timestamp |
| `cms_pages` | Admin-managed policy and content pages | Slug, status, version, author, published timestamp |
| `feature_flags` | Controlled rollout | Key, environment, audience scope, status |

## I. Order architecture

A customer checkout may contain products from multiple sellers. The order model must preserve a single customer-facing checkout while allowing independent seller fulfilment.

```text
Customer
  └── Order (parent checkout, totals, payment, customer status)
        ├── Seller Order A (seller A totals and status)
        │     ├── Order Item A1
        │     └── Shipment A
        ├── Seller Order B (seller B totals and status)
        │     ├── Order Item B1
        │     └── Shipment B
        └── Seller Order C (seller C totals and status)
              ├── Order Item C1
              └── Shipment C
```

The checkout transaction should do the following:

1. Load the authenticated customer cart.
2. Lock or reserve inventory for every variant.
3. Recalculate each line price from server-owned catalog data.
4. Apply valid promotions and coupons.
5. Calculate shipping per seller order or delivery group.
6. Create one parent order and one seller order per distinct seller.
7. Create immutable order item snapshots.
8. Create a payment intent or pending payment record with an idempotency key.
9. Confirm the order according to the payment policy. For asynchronous M-Pesa, the order may remain `payment_pending` until the verified callback arrives.
10. Release reservations and transition orders to cancellation or failure when payment expires.

A seller must be able to fulfil, cancel, return, and ship its own child order without changing another seller’s child order. The parent order should calculate an aggregate customer status from child states and payment state rather than allowing arbitrary manual edits.

## J. State machines

All state changes should be implemented as explicit transition functions or domain services. A procedure must reject a transition that is not in the allowed graph.

### Parent order

```text
pending_payment -> paid -> processing -> partially_fulfilled -> fulfilled
pending_payment -> payment_failed
pending_payment -> cancelled
paid -> cancelled                     (only within policy window)
processing -> partially_fulfilled
processing -> cancelled                (only for remaining unfulfilled items)
partially_fulfilled -> fulfilled
fulfilled -> return_requested         (only when policy permits)
```

### Payment

```text
created -> pending
pending -> authorized
pending -> failed
pending -> expired
authorized -> captured
authorized -> cancelled
captured -> partially_refunded
captured -> refunded
```

The actual provider may use different event names. Provider events should map into this internal state machine and be stored before applying a state change.

### Seller order

```text
created -> accepted
created -> rejected
accepted -> processing
processing -> ready_for_pickup
processing -> packed
packed -> handed_to_carrier
handed_to_carrier -> delivered
handed_to_carrier -> delivery_failed
delivery_failed -> reattempt_scheduled
delivery_failed -> return_to_sender
return_to_sender -> returned
accepted -> cancelled              (policy dependent)
delivered -> return_requested      (policy dependent)
```

### Shipment and delivery

```text
created -> label_pending
label_pending -> ready_for_dispatch
ready_for_dispatch -> dispatched
dispatched -> in_transit
in_transit -> out_for_delivery
out_for_delivery -> delivered
out_for_delivery -> failed
afailed -> reattempt_scheduled
reattempt_scheduled -> out_for_delivery
failed -> return_to_sender
return_to_sender -> returned
```

The internal state should use a consistently named `failed` state; the typo-like transition label `afailed` above is intentionally not part of the implementation and should be corrected to `failed` when encoded.

### Return and refund

```text
return_requested -> under_review
under_review -> approved
under_review -> rejected
approved -> pickup_scheduled
pickup_scheduled -> received
received -> inspected
inspected -> refund_pending
inspected -> replacement_pending
inspected -> rejected
refund_pending -> refunded
```

A refund should be driven by a verified payment/refund operation and ledger entry, not by a front-end success toast.

### Seller payout

```text
eligible -> requested
requested -> under_review
under_review -> approved
under_review -> rejected
approved -> processing
processing -> paid
processing -> failed
failed -> processing
```

Each transition should record who or what caused it, the prior state, the new state, the reason, and the external provider reference where applicable.

### Support ticket

```text
open -> triaged
triaged -> assigned
assigned -> waiting_on_customer
assigned -> waiting_on_internal
waiting_on_customer -> assigned
waiting_on_internal -> assigned
assigned -> resolved
resolved -> reopened
reopened -> assigned
```

## K. Permissions and RBAC

The platform should use roles for administration convenience and permissions for enforcement. Frontend visibility is only a user-experience optimization; server-side procedures must check the permission required for each operation.

| Role | Primary permissions |
|---|---|
| Super Admin | Manage platform configuration, roles, permissions, audit access, and emergency controls |
| Marketplace Admin | Manage sellers, catalog moderation, promotions, orders, and customer escalations |
| Product Manager | Create and edit categories, brands, products, attributes, images, and merchandising content |
| Finance | View payments, refunds, commissions, ledger, seller balances, and approve payouts |
| Customer Support | View customer cases, order context, returns, refunds within policy, and support tickets |
| Logistics Manager | Manage warehouses, delivery zones, shipment rules, courier assignments, and delivery exceptions |
| Warehouse Staff | Receive, pick, pack, hand over, and record inventory movements for assigned warehouses |
| Seller | Manage own store, products, inventory, seller orders, returns, earnings, and payout requests |
| Courier | View assigned shipments, update allowed delivery events, and record proof of delivery or failure |
| Customer | Manage own profile, addresses, carts, wishlists, orders, reviews, returns, and support tickets |

A recommended permission naming scheme is resource-action, such as `catalog.product.read`, `catalog.product.approve`, `order.read_own`, `order.manage_any`, `seller.order.fulfill_own`, `finance.payout.approve`, and `support.ticket.assign`. Seller and courier records require ownership or assignment scope checks in addition to the role permission.

## L. Implementation roadmap

The project should be delivered in dependent phases. Each phase should have a migration, procedures, UI, integration, security, and test definition before it is considered complete.

### Phase 0: Contract and environment hardening

**Features.** Establish domain module boundaries, error conventions, input schemas, request correlation IDs, structured logs, and a decision record for money and timezone rules.

**Database.** Add migration conventions, UUID or numeric identifier policy, status enum strategy, currency and minor-unit conventions, and audit-log base tables.

**Backend.** Split the monolithic router into feature routers. Add a consistent `protectedProcedure`, permission middleware, error mapping, rate limiting strategy, and transaction helper.

**Frontend.** Preserve the current visual UI. Split `Home.tsx` into catalog, cart, product detail, and shared marketplace components without changing user-facing behavior.

**Integrations.** Confirm production database, object storage, notification, and deployment credentials. Do not connect payments yet.

**Security.** Add headers, request size policies, secret validation at startup, session lifecycle decisions, and abuse logging.

**Testing.** Add unit tests for auth middleware, role and permission checks, money helpers, status transitions, and validation failures.

**Dependencies.** Existing WebDev scaffold is sufficient; payment and courier contracts are not yet required.

### Phase 1: Identity, RBAC, customer profile, and seller onboarding

**Features.** Add customer profiles, addresses, role assignment, seller applications, verification status, seller store profile, and admin approval screens.

**Database.** Add profile, address, seller, store, roles, permissions, user-role, session, and audit tables.

**Backend.** Implement protected profile procedures, seller application transitions, admin approval rules, ownership checks, and audit entries.

**Frontend.** Add account, addresses, seller onboarding, and role-aware dashboard routes using the existing dashboard components where appropriate.

**Integrations.** Add email or notification delivery only after a provider is selected.

**Security.** Enforce least privilege, sensitive-field masking, seller ownership scope, and anti-duplicate seller applications.

**Testing.** Cover role matrices, ownership boundaries, invalid transitions, duplicate applications, and unauthenticated access.

**Dependencies.** Phase 0 permissions and audit boundaries.

### Phase 2: Catalog, media, search, and inventory

**Features.** Implement categories, brands, products, variants, product images, attributes, seller catalog management, moderation, inventory, reservations, and public discovery.

**Database.** Add catalog, media, pricing, inventory, warehouse, reservation, and movement tables with indexes for slug, SKU, seller, category, status, and search filters.

**Backend.** Add public product queries, seller product mutations, admin moderation, storage upload procedures, price validation, stock reservations, and pagination.

**Frontend.** Connect the current home page, category rail, filters, product modal or route, seller catalog screens, and admin catalog screens to tRPC.

**Integrations.** Use managed object storage for product media. Add a search engine only if database search is insufficient after measuring query performance.

**Security.** Validate image type and size, isolate seller ownership, prevent unpublished product leakage, and prevent overselling through transactional reservations.

**Testing.** Test product visibility, seller scope, unique SKU, media authorization, pagination, filter combinations, stock reservation, and concurrent decrements.

**Dependencies.** Phase 1 identity and seller store ownership.

### Phase 3: Cart, multi-seller checkout, payments, and orders

**Features.** Add persistent carts, wishlist, customer addresses, server-calculated totals, coupons, payment intents, parent orders, seller orders, order history, and order events.

**Database.** Add carts, cart items, wishlists, wishlist items, orders, order items, seller orders, payments, payment transactions, coupons, and order events.

**Backend.** Implement transactional checkout, price and promotion validation, seller-order decomposition, idempotency keys, payment callbacks, order transitions, and customer order queries.

**Frontend.** Replace local cart and wishlist state with server state. Add checkout address selection, shipping selection, payment status, order confirmation, and order history without rebuilding the visual design.

**Integrations.** Select and connect M-Pesa Daraja or another licensed payment provider. Define callback URL, signature or secret validation, reconciliation, timeout, and retry behavior.

**Security.** Never trust client totals or payment success. Verify provider callbacks, enforce idempotency, protect personal data, and record financial state transitions.

**Testing.** Use provider sandbox tests, duplicate callback tests, payment timeout tests, multi-seller order tests, price-change tests, inventory contention tests, and end-to-end checkout tests.

**Dependencies.** Catalog, inventory, addresses, and a confirmed payment provider contract.

### Phase 4: Fulfilment, delivery, returns, refunds, and notifications

**Features.** Add seller fulfilment, warehouse receiving, packing, shipments, courier assignment, delivery tracking, failed delivery, return-to-sender, returns, refunds, and customer notifications.

**Database.** Add shipments, shipment items, shipment events, delivery zones, couriers, assignments, returns, return items, refunds, notifications, and notification delivery attempts.

**Backend.** Implement transition guards, delivery pricing, shipment creation, tracking ingestion, refund requests, return eligibility, and notification orchestration.

**Frontend.** Add seller fulfilment views, customer order tracking, return requests, refund status, courier views, and admin logistics screens.

**Integrations.** Select courier and delivery provider contracts. Add email, SMS, WhatsApp, or push only where operationally necessary and legally approved.

**Security.** Protect address and phone data, limit courier scope to assigned shipments, verify proof-of-delivery events, and secure webhook endpoints.

**Testing.** Test each state transition, partial shipment, failed delivery, return window, refund idempotency, courier ownership, and notification retry.

**Dependencies.** Phase 3 orders and payments.

### Phase 5: Finance, commissions, payouts, support, promotions, and analytics

**Features.** Add double-entry ledger, seller commissions, seller wallets, payout batches, support tickets, promotions, CMS, reporting, and operational analytics.

**Database.** Add ledger accounts and entries, commission rules, seller wallet projections, payouts, payout items, support tickets, support messages, promotions, and audit expansion.

**Backend.** Implement commission calculation, payout eligibility, finance approval, reconciliation, support workflow, promotion rule evaluation, and analytics queries.

**Frontend.** Add finance dashboard, seller earnings, payout requests, support agent workspace, promotion management, CMS pages, and analytics views.

**Integrations.** Connect payout rails, support channels, analytics warehouse, and approved messaging providers.

**Security.** Segregate finance duties, require approval for payouts and refunds above thresholds, log all sensitive actions, and make ledger entries append-only.

**Testing.** Test ledger balance, commission edge cases, payout retries, refund accounting, support escalation, promotion stacking, and report reconciliation.

**Dependencies.** Payments, orders, seller verification, and audit logs.

### Phase 6: Android/iOS application and scale hardening

**Features.** Build customer mobile app first, then seller operations if needed. Add push notifications, offline-friendly browsing, deep links, and mobile-specific checkout handling.

**Database and backend.** Reuse the existing APIs and rules. Add device tokens, push notification preferences, API versioning, and mobile session policies.

**Frontend.** Create an Expo mobile project with shared typed contracts and shared domain formatting, while keeping platform-appropriate navigation and interaction.

**Integrations.** App stores, push notifications, analytics, crash reporting, and deep-link providers.

**Security.** Protect mobile tokens, implement logout-all-devices, enforce API version and device limits, and avoid storing payment secrets in the app.

**Testing.** Add device matrix testing, accessibility, deep links, push delivery, mobile payment callback behavior, and release regression suites.

**Dependencies.** Stable web APIs and production checkout/order flows.

## M. Dependencies required before production claims

The following dependencies are external decisions or credentials, not code that can be safely invented:

1. **Payment provider:** M-Pesa Daraja or another licensed provider, including till/paybill details, callback endpoints, production credentials, settlement policy, and reconciliation process.
2. **Delivery operations:** in-house or third-party courier, delivery zones, rate card, SLA, tracking events, proof-of-delivery policy, and return-to-sender policy.
3. **Seller verification:** business and tax identification requirements, KYC policy, payout bank or mobile-money rules, and seller agreement.
4. **Messaging:** email, SMS, WhatsApp, or push provider, sender identity, templates, opt-in policy, and retry limits.
5. **Legal and compliance:** privacy policy, terms, returns policy, consumer protection requirements, data retention, tax treatment, and financial reconciliation controls.
6. **Media and content:** approved product data, seller-owned images, brand permissions, category taxonomy, and merchandising rules.
7. **Operations:** customer support hours, warehouse model, courier coverage, refund authority, and finance approval roles.

No payment, courier, SMS, WhatsApp, or seller payout integration should be represented as complete until the corresponding provider contract and production credentials are available.

## N. Risks and technical debt

The largest risk is building attractive frontend flows before defining transactional boundaries. If the current local cart and checkout are extended directly, later payment and inventory work will require a rewrite. The second risk is underestimating multi-seller order decomposition. A parent order with child seller orders must be established before fulfilment and finance.

A third risk is using a mutable seller balance rather than an append-only ledger. This would make refunds, partial deliveries, commission changes, and payout reconciliation difficult to audit. A fourth risk is adding real customer and seller data before rate limiting, permission scopes, privacy controls, and audit logs are in place.

The current monolithic `Home.tsx`, the single `users` role enum, absence of domain tests, hardcoded catalog data, external image hotlinks, and one-year sessions are manageable technical debt for a prototype. They should be addressed in Phase 0 or Phase 1 before production data enters the system.

## O. Definition of done for this audit phase

This phase is complete when:

- The existing stack and runtime are documented.
- Existing functional, partial, UI-only, broken, and missing capabilities are distinguished.
- The live database inventory is confirmed.
- Architectural and security gaps are recorded before implementation.
- The target multi-vendor domain boundaries are defined.
- The normalized database design includes parent orders and seller orders.
- State transitions are explicit rather than arbitrary.
- Server-side RBAC requirements are defined.
- A phased roadmap identifies features, database work, backend work, frontend work, integrations, security, tests, and dependencies.
- No production feature is claimed solely because a UI element exists.
- Existing UI behavior remains unchanged during the audit.

## Final audit report summary

**A. Current architecture:** React/Vite/Tailwind frontend, Express/tRPC backend, Drizzle/MySQL persistence, Manus OAuth, and object-storage infrastructure.

**B. Existing functional features:** Responsive storefront rendering, local catalog filtering, local cart/wishlist interactions, demo checkout modal, OAuth entry points, auth session handling, storage helpers, and a small test surface.

**C. Existing incomplete features:** Catalog, search, product details, wishlist persistence, cart persistence, checkout, flash sales, seller onboarding, and customer account workflows.

**D. Existing broken or misleading features:** Static countdown, false M-Pesa/security claims, demo order success, in-memory state loss, category/brand mismatch, monolithic page logic, and external media hotlinks.

**E. Missing marketplace features:** Sellers, inventory, parent and seller orders, payments, fulfilment, shipments, couriers, returns, refunds, reviews, commissions, payouts, support, notifications, analytics, CMS, and mobile app.

**F. Database problems:** Only `users` exists; there are no relationships, business constraints, money fields, statuses, indexes, reservations, ledgers, or audit records.

**G. Security problems:** Coarse roles, no business authorization surface, no rate limits, no webhook or idempotency controls, client-side totals, broad body limits, long session lifetime, and no operational audit log.

**H. Recommended target architecture:** Modular monolith with domain-specific routers and services, server-owned commerce state, transactional checkout, normalized catalog and order models, object storage for media, permission-based RBAC, and append-only finance records.

**I. Development phases:** Hardening; identity and seller onboarding; catalog and inventory; checkout and payments; fulfilment and returns; finance and support; mobile and scale.

**J. Dependencies required:** Payment provider, courier model, seller verification policy, messaging provider, legal/compliance decisions, approved media, and operating procedures.

**K. Risks and technical debt:** Frontend-first transactional drift, absent order decomposition, monolithic page code, incomplete roles, lack of tests, hardcoded data, external media dependencies, and long-lived sessions.

## References

[1]: ../drizzle/schema.ts "Current SokoMart Drizzle schema"  
[2]: ../client/src/App.tsx "Current SokoMart route registration"  
[3]: ../server/routers.ts "Current SokoMart tRPC router"  
[4]: ../drizzle/0000_short_eddie_brock.sql "Applied initial SokoMart database migration"  
[5]: ../server/_core/oauth.ts "Current SokoMart OAuth callback implementation"  
[6]: ../server/_core/trpc.ts "Current SokoMart authorization middleware"
