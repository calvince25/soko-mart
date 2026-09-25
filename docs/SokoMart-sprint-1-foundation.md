# SokoMart Sprint 1 Foundation Guide

**Status:** Implemented and verified  
**Scope:** Modular-monolith foundation only. Marketplace business features remain intentionally disabled.

## Purpose

Sprint 1 converts the original SokoMart prototype into a safer foundation for future marketplace domains without changing the storefront design or replacing the technology stack. The application remains a React 19, TypeScript, Vite, Tailwind, Express, tRPC, Drizzle, and MySQL/TiDB modular monolith.

This guide is the implementation contract for future developers and AI agents. It describes what is available now, what is intentionally not available, and the conventions that future catalog, seller, inventory, order, payment, logistics, finance, support, promotion, and review sprints must follow.

## Implemented module boundaries

```text
server/
  _core/                 Framework wiring, OAuth, tRPC context, Vite, storage
  auth/                  Durable session records and revocation helpers
  audit/                 Append-oriented audit event writer
  config/                Centralized environment/configuration access
  domains/
    identity/            Authentication-compatible identity router
    platform/            Health and owner-notification router
  errors/                Safe error mapping and Express error responses
  logging/               Structured logs and request correlation context
  money/                 Server import boundary for exact money values
  permissions/           Database-backed role and permission checks
  rateLimit/             Operation-specific in-memory limiter foundation
  security/              Security headers and restricted CORS behavior
  transactions/          Database transaction and idempotency boundaries
  validation/            Shared validation exports and conventions

drizzle/
  schema.ts              Users plus roles, permissions, user_roles,
                         role_permissions, sessions, and audit_logs
  migrations/             Generated migration history

shared/
  errors/                Stable application error codes
  money/                 Exact integer minor-unit Money value object
  permissions/           Role and permission catalog
  validation/            Shared request and mutation schemas

scripts/
  seed-foundation.ts     Idempotent system RBAC seed and existing-user mapping
```

The application router is composed from `identityRouter` and `platformRouter`. The legacy `auth` namespace remains as an alias to the identity router so the existing frontend authentication contract is not broken. No product, seller, cart, order, payment, shipment, return, refund, review, promotion, support, or finance procedures were added in this sprint.

## Authentication and session rules

Manus OAuth remains the identity provider. The OAuth callback still validates the one-time state nonce, exchanges the code, synchronizes the user, signs the session JWT, and sets the existing session cookie.

The session lifetime is now configurable through `SESSION_TTL_MS` and defaults to eight hours instead of one year. Each OAuth-created cookie session is also represented in the `sessions` table with a SHA-256 token hash, user, user agent, IP address, expiry, last-used time, and revocation timestamp.

The request authenticator checks the durable session record for cookie-backed sessions. A revoked or expired record is rejected even if its JWT signature remains valid. Logout revokes the current durable session when the token is available. `auth.logoutAll` revokes all active sessions for the authenticated user and clears the current cookie.

The preview Bearer fallback remains available only when `APP_ENV` is not `production`. Production customer authentication must use the normal session-cookie path unless a future explicit mobile authentication design is added.

Future session work should add device/session management UI, explicit refresh or re-authentication, and logout-all-devices screens. Do not reintroduce one-year browser sessions.

## RBAC rules

The legacy `users.role` enum is preserved as a compatibility field. It must not be expanded into a second coarse authorization system. New server procedures should use the database-backed RBAC model:

```text
users
  └── user_roles ── roles ── role_permissions ── permissions
```

The seeded system roles are:

- `super_admin`
- `marketplace_admin`
- `product_manager`
- `finance`
- `customer_support`
- `logistics_manager`
- `warehouse_staff`
- `seller`
- `courier`
- `customer`

Permissions follow the `resource.action` naming convention. Ownership is represented in the action name where relevant, such as `seller.store.update_own`, `seller.order.fulfill_own`, and `order.read_own`. Cross-entity access still requires a scope check in the domain service; a permission code alone is not sufficient.

Use the following procedure types:

- `publicProcedure` for intentionally public procedures.
- `protectedProcedure` for any authenticated procedure.
- `permissionProcedure("resource.action")` for a procedure requiring a specific server-side permission.
- `adminProcedure` only for compatibility with existing scaffold behavior while the remaining platform operations migrate to explicit permissions.

Frontend route visibility is not authorization. Every mutation and protected query must enforce its rule in the server procedure or domain service.

The legacy `admin` user role currently bypasses permission checks for compatibility. New role-management work should gradually migrate those users to explicit `super_admin` or `marketplace_admin` assignments, then remove the compatibility bypass only after all existing admin flows have migrated and been tested.

## Database conventions

### Identifiers and relationships

The current project uses auto-incrementing integer primary keys. Sprint 1 keeps that strategy for consistency with `users`. Every new domain table should use the same strategy unless a domain has a documented reason to use a different identifier.

Foreign keys must be declared in the Drizzle schema whenever a relationship is known. Use `cascade` only for dependent records that have no meaning without their parent. Use `set null` for actor or attribution references that must survive deletion. Do not rely only on application checks for uniqueness or referential integrity.

### Timestamps

Persist business timestamps as UTC-compatible database timestamps. In TypeScript, use `Date` values. Convert to the user’s local timezone only at the presentation boundary. Every table should use explicit `createdAt` and `updatedAt` fields where records are mutable. Event and audit tables should be append-oriented and need only the creation timestamp unless a correction record is part of the design.

### Soft deletion and status

Do not physically delete records that affect customer history, financial reconciliation, auditability, or legal retention. Add a status or `deletedAt` field where a future domain needs archive behavior. Status changes must use a transition function or domain service, not arbitrary assignments from route handlers.

### Indexes and names

Use explicit index names in the form `idx_<table>_<columns>` and unique constraints in the form `uq_<table>_<columns>`. Add indexes for foreign keys, unique public identifiers, state queues, and the primary query paths defined by the domain. Avoid speculative indexes until a query path exists.

### Migrations

The Sprint 1 migrations are:

- `0001_abandoned_juggernaut.sql`: creates roles, permissions, user-role assignments, role-permission assignments, sessions, audit logs, and indexes.
- `0002_wealthy_spectrum.sql`: adds foreign-key constraints for the foundation relationships.

The development database contains the migration bookkeeping rows for both migrations. Future schema changes must follow this sequence:

1. Update `drizzle/schema.ts`.
2. Run `pnpm drizzle-kit generate`.
3. Review the generated SQL for destructive operations and constraint correctness.
4. Apply the reviewed migration through the project migration workflow.
5. Verify that existing users and required records remain intact.
6. Run `pnpm drizzle-kit migrate` and the database foundation test.

Do not create product, inventory, order, payment, shipment, return, refund, promotion, seller-wallet, payout, or full support tables before their respective sprint begins.

## Money conventions

All future financial values must use integer minor units. The `Money` value object in `shared/money/money.ts` supports:

- `amountMinor` as a safe integer.
- An explicit three-letter uppercase currency code.
- Exact addition and subtraction.
- Safe integer multiplication for quantities.
- Same-currency comparison.
- Locale-aware formatting at the presentation edge.
- JSON serialization as `{ amountMinor, currency }`.

The default currency is configurable through the application design and currently defaults to `KES`. Never use JavaScript floating-point arithmetic for price, tax, discount, shipping, commission, refund, wallet, payout, or ledger calculations. Database columns for future money fields should use integer minor-unit columns plus an explicit currency column.

## Transactions and idempotency

`withTransaction` is the server boundary for multi-write database work. A future domain service should receive the Drizzle transaction client and keep external side effects outside the transaction until commit is successful.

The first operations that require transactions are expected to be checkout, stock reservations, order creation, refunds, seller payouts, and ledger entries. Those features are not implemented in Sprint 1.

`validateIdempotencyKey` establishes the input convention for operations that may be retried. Future payment, webhook, refund, and payout implementations must store durable idempotency records with a unique operation key. The current Sprint 1 helper intentionally does not pretend to provide durable idempotency before a domain has defined its operation record.

## Error handling

Use the stable error codes in `shared/errors/appError.ts`:

- `AUTHENTICATION_REQUIRED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INVALID_STATE`
- `INTERNAL_ERROR`

Domain code should throw `AppError` factories or a `TRPCError` where the tRPC contract specifically requires it. Error formatting maps public errors to stable `appCode` values. Unexpected errors are logged server-side and return a generic message. Do not return database messages, stack traces, credentials, JWTs, payment secrets, or full private payloads to customers.

## Logging and correlation IDs

Every request passes through `requestCorrelationMiddleware`. The middleware accepts a validated incoming `x-request-id` or creates a UUID, returns it in the response header, and stores it in `AsyncLocalStorage`.

Structured logs include timestamp, level, event, request ID, method, path, status, and duration. They must remain free of passwords, tokens, payment credentials, and unnecessary personal data. Audit events reuse the current request ID so a future payment or webhook operation can connect HTTP logs, audit records, provider events, and errors.

Use `logger.info`, `logger.warn`, and `logger.error` rather than ad hoc production logging. When logging an error, include a stable event name and safe metadata, not the complete request body.

## Audit logging

`audit_logs` is append-oriented. It supports actor, action, entity type, entity ID, before state, after state, reason, request ID, and creation time. `recordAuditEvent` sanitizes JSON values before persistence.

Normal application code must not update or delete existing audit records. Administrative and financial domain actions must record an audit event with a stable action name, the actor, the affected entity, and a meaningful reason. The platform owner-notification mutation demonstrates the pattern with `PLATFORM_OWNER_NOTIFICATION_SENT`.

Future actions should use explicit names such as `ADMIN_APPROVED_SELLER`, `ADMIN_REJECTED_PRODUCT`, `FINANCE_APPROVED_PAYOUT`, and `SUPPORT_UPDATED_ORDER`.

## Rate limiting

The current limiter is an in-memory foundation for the single managed instance. It is operation-specific and exposes separate policies for OAuth callbacks, the tRPC gateway, account operations, search, checkout, support submissions, and future webhooks.

The limiter is not a multi-instance production store. Before horizontal scaling or high-volume public launch, replace the memory store with a shared rate-limit store and retain operation-specific policies. Do not apply one global limit to all routes. The future policy key should combine the safest available identity signals, such as authenticated user ID and normalized client IP, without logging or persisting sensitive credentials.

## Security configuration

The server now:

- Disables the Express `x-powered-by` header.
- Adds content-type, frame, referrer, permissions, and production HSTS headers.
- Uses a restricted CORS policy based on `ALLOWED_ORIGINS` rather than reflecting arbitrary origins.
- Reduces global JSON and URL-encoded body limits from 50 MB to configurable values.
- Validates required runtime configuration in production.
- Isolates the preview Bearer fallback from production.
- Adds request correlation and structured logs.
- Preserves secure cookie handling through the existing OAuth cookie helper.

Future uploads should use object storage rather than increasing global body limits. Future webhook routes should have dedicated authentication, signature checks, replay protection, idempotency, and a specific rate-limit policy.

## Configuration

Use `server/config/env.ts` as the only application configuration accessor. The supported configuration includes:

- `APP_ENV`: `development`, `preview`, `production`, or `test`.
- `SESSION_TTL_MS`: browser session duration, defaulting to eight hours.
- `REQUEST_BODY_LIMIT`: JSON body limit, defaulting to `1mb`.
- `URLENCODED_BODY_LIMIT`: URL-encoded body limit, defaulting to `100kb`.
- `ALLOWED_ORIGINS`: comma-separated permitted origins.
- `RATE_LIMIT_STORE`: future store selector, currently `memory`.
- Existing OAuth, database, Manus Forge, and owner environment variables.

Never hard-code or expose API keys, JWT secrets, database credentials, OAuth secrets, storage credentials, payment credentials, or provider tokens.

## Testing contract

Sprint 1 adds tests for:

- Unauthenticated protected access.
- Server-side permission rejection and acceptance.
- Legacy admin compatibility.
- Money arithmetic, formatting, integer validation, and currency mismatch.
- Pagination and mutation validation.
- Safe unexpected-error mapping.
- Idempotency key validation.
- Session expiry and revocation semantics.
- Operation-specific rate limiting.
- Audit JSON sanitization.
- Request correlation context.
- Database migration presence, role and permission counts, user-role assignment, and preserved users.
- Existing logout behavior.

Run the complete verification set with:

```bash
pnpm check
pnpm test
pnpm build
pnpm drizzle-kit migrate
```

A passing TypeScript build alone is not sufficient. Future sprints must add domain-level tests, transition tests, authorization matrix tests, database integration tests, and end-to-end flows for any new business capability.

## Intentionally deferred work

Sprint 1 does not implement or expose fake versions of:

- Product catalog and catalog UI.
- Seller onboarding or seller dashboards.
- Inventory and stock reservations.
- Persistent cart or wishlist.
- Checkout or M-Pesa.
- Orders or seller-order decomposition.
- Shipments, couriers, delivery tracking, or returns.
- Refunds, commissions, wallets, payouts, or ledger entries.
- Customer support, notifications, promotions, reviews, or analytics.
- Android or iOS applications.

Those features must use this guide as their infrastructure contract and should be introduced in separate migrations and feature modules.
