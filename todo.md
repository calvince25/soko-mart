
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
