
## Sprint 17 — Finance, Commission & Settlement Accounting

- [x] Add immutable double-entry finance accounts, transactions, debit/credit entries, unique transaction references, and idempotency keys.
- [x] Recognize successful paid orders after authoritative order finalization with balanced seller entitlement, commission, clearing, and platform fee/shipping/tax entries.
- [x] Add basis-point commission rules with seller/category/product scope, priority, and immutable calculation snapshots.
- [x] Add seller finance summaries for gross, commission, holds, settled, available, and pending amounts.
- [x] Add audited seller holds and controlled manual adjustments; support cases cannot directly mutate financial balances.
- [x] Add settlement periods and seller settlement snapshots with seller-period uniqueness and duplicate-settlement protection.
- [x] Add provider-neutral payout contract that explicitly refuses to fake unconfigured transfers.
- [x] Add finance RBAC permissions and idempotent role seeding for ledger, rules, holds, adjustments, and settlement operations.
- [x] Add `/seller/finance` seller workspace for accounting visibility without promising payout execution.
- [x] Add Sprint 17 focused regression coverage: 5/5 finance tests; 18/18 finance + returns + support tests.
- [x] Run typecheck, production build, migration generation, active database table verification, and permission seed.
- [x] Document Sprint 17 in `docs/SokoMart-sprint-17-finance-settlements.md`.
- [x] Explicitly defer provider-backed payouts, successful-refund reversal postings, scheduled settlement workers, tax invoices, chargebacks, FX, and reconciliation exports to Sprint 18.
- [x] Record the broader regression caveat: earlier Sprint 8–10 suites have shared fixed-phone/reused-database fixture cleanup collisions when run against a non-isolated database; Sprint 17 focused paths pass.
- [x] Sprint 18 handoff documented: payout beneficiary onboarding/provider callbacks, refund ledger reversals, settlement worker leases, and fixture isolation hardening.

## Sprint 18 — Seller payout beneficiary onboarding

- [x] Add seller-owned M-Pesa/mobile-money beneficiary records with masked destinations and HMAC fingerprints; never store PINs or provider secrets.
- [x] Add server-controlled DRAFT, PENDING_VERIFICATION, VERIFIED, SUSPENDED, DEACTIVATED, and REJECTED lifecycle transitions.
- [x] Add immutable beneficiary lifecycle events and transaction-bound audit records.
- [x] Enforce seller ownership, approved/verified seller checks, finance-staff/owner membership checks, and IDOR-safe beneficiary procedures.
- [x] Enforce at most one verified primary beneficiary per seller with a nullable unique database constraint.
- [x] Add finance RBAC permissions, security notifications/outbox integration, and authenticated `/seller/finance` onboarding UI.
- [x] Keep the provider payout boundary explicitly unconfigured; no fake payout success or real transfer is attempted.
- [x] Generate/apply migrations `0020_nostalgic_hellcat.sql` and `0021_rare_jazinda.sql`; validate focused tests, typecheck, and production build.
- [x] Document Sprint 18 in `docs/SokoMart-sprint-18-beneficiaries.md`.
- [x] Defer real M-Pesa verification/B2C payout callbacks, settlement worker leases, refund reversal postings, and legacy parallel-fixture isolation to the next finance hardening sprint; no provider success is simulated in Sprint 18.

## Sprint 19 — M-Pesa B2C payout execution and finance worker

- [x] Add encrypted-at-rest beneficiary destination storage while keeping raw destinations and provider credentials out of API responses, logs, and audit snapshots.
- [x] Add provider-neutral M-Pesa Daraja B2C submission/status boundaries with explicit configuration gating, asynchronous states, safe normalization, and no fake success when unconfigured.
- [x] Add seller payout instructions, immutable masked/fingerprint snapshots, provider attempts/events, settlement linkage, idempotency, callback replay protection, and reconciliation-required handling.
- [x] Add deployment-managed cron worker endpoint with atomic claims, stale recovery, bounded retries, payout submission, and reconciliation-first processing; no sandbox timer is enabled.
- [x] Add finance payout queue/status/event/pause permissions, seller-safe list/initiation procedures, admin queue UI at `/admin/finance`, and payout outbox notification templates.
- [x] Generate migration `0022_wide_killmonger.sql`; verify the persistent database already contains its additive tables/column; seed the payout permissions idempotently.
- [x] Add Sprint 19 focused regression coverage: 5/5 tests; rerun typecheck and production build successfully.
- [x] Document Sprint 19 in `docs/SokoMart-sprint-19-mpesa-payouts.md`.
- [x] Isolate legacy full-suite phone fixtures with collision-resistant per-test numbers; the full shared-database suite now passes cleanly.

## Sprint 20 — Production-readiness audit and hardening

- [x] Audit identity, RBAC/IDOR, catalog/inventory, commerce/payments, M-Pesa/finance, logistics, returns/support, and operations scope against the Sprint 20 acceptance criteria; document the operations-audit credit limitation explicitly.
- [x] Add trusted shared-secret gates to customer-payment and seller-payout callback routes; callbacks without configured secrets are rejected before financial state changes.
- [x] Reject fractional-KES payout amounts instead of silently flooring seller entitlements; enforce payout pause in payout creation and worker submission.
- [x] Close the cross-warehouse eligible-handoff listing leak, repair assignment-to-pickup delivery state flow, require active verified couriers, restrict OTP issue to out-for-delivery shipments, and validate support context ownership/relationships.
- [x] Add payout conversion regression coverage; final validation is 25 test files / 119 tests passing, typecheck clean, production build clean, and live preview healthy.
- [x] Write `docs/SokoMart-sprint-20-production-readiness-audit.md` with a no-go recommendation for unrestricted real-money production until remaining blockers are closed.
- [x] Remove the legacy all-permissions admin shortcut from permission middleware and authorization helpers; update warehouse coverage to grant explicit permissions in tests.
- [x] Require owner/finance-staff membership for seller finance summaries and ledgers; force renewed catalog moderation after edits to approved/published variants.
- [x] Align cart availability with canonical on-hand/reserved inventory semantics, consume delivery OTP credentials after success, and make delivery attempt updates compare-and-set safe.
- [x] Calculate refund totals by joined return-item identity rather than relying on database row order.
- [x] Include approved/processing/successful refund deductions and audited adjustment credits/debits in seller available balances and settlement snapshots.
- [x] Unify commission-rule selection for ledger postings and immutable snapshots; add idempotent ledger reversal postings when a refund reaches the authoritative successful state.
- [x] Require storage-style proof references for successful delivery attempts, enforce proof presence in the service, consume OTPs after success, and cover the boundary with regression tests.
- [x] Synchronize a non-cancelled parent order to completed only after every shipment is delivered, using a transactional compare-and-set flow.
- [x] Synchronize a seller order to completed only after every shipment belonging to that seller order is delivered, within the delivery transaction.
- [ ] Complete remaining Sprint 20 blockers: authoritative refund provider/reconciliation, distributed rate limiting, and deployment/provider verification.
