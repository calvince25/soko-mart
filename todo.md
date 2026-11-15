
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
