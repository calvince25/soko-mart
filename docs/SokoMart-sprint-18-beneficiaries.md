# SokoMart Sprint 18 — Seller payout beneficiaries

## Status

**Implemented and validated:** secure seller-owned M-Pesa beneficiary onboarding on top of the Sprint 17 immutable ledger and settlement snapshot foundation.

## Scope delivered

- Added `seller_payout_beneficiaries` as a separate payout-account domain. Sprint 17 ledger, earnings, holds, settlement snapshots, and payout boundary remain unchanged.
- Added immutable `seller_payout_beneficiary_events` history for creation, submission, verification review, primary selection, primary replacement, and deactivation.
- Supported provider/account values are deliberately narrow: `mpesa` + `mobile_money`.
- Stored destination data is limited to a masked phone representation and an HMAC-SHA256 fingerprint. Raw phone destinations, PINs, passkeys, access tokens, and other provider secrets are never persisted or returned.
- Added server-controlled lifecycle transitions:
  - `DRAFT → PENDING_VERIFICATION`
  - `PENDING_VERIFICATION → VERIFIED | REJECTED | DEACTIVATED`
  - `VERIFIED → SUSPENDED | DEACTIVATED`
  - `SUSPENDED → VERIFIED | DEACTIVATED`
  - `REJECTED → DRAFT | PENDING_VERIFICATION | DEACTIVATED`
  - `DEACTIVATED` is terminal.
- Added a nullable unique `(sellerId, isPrimary)` constraint so MySQL permits multiple secondary accounts while enforcing at most one primary account per seller. Only verified accounts can be selected as primary.
- Added seller-safe procedures under `finance.beneficiaries` for listing audited accounts, reading history, creating drafts, submitting for verification, selecting a primary account, and deactivating an account.
- Added finance-only review procedure for `VERIFIED`, `SUSPENDED`, and `REJECTED` transitions; suspension/rejection requires a reason.
- Added seller membership and approved/verified seller checks. Seller IDs and beneficiary IDs are re-checked server-side to prevent IDOR access.
- Added security notifications through the existing outbox/template abstraction for lifecycle changes.
- Extended `/seller/finance` with a mobile-first onboarding panel, masked account display, status badges, audited-event count, and safe controls. The existing earnings and immutable ledger UI remains intact.
- Added dedicated RBAC permissions:
  - `finance.payout_account.read_own`
  - `finance.payout_account.manage_own`
  - `finance.payout_account.review`

## Provider boundary

The payout provider remains intentionally unconfigured. `unavailablePayoutProvider` continues to return a safe, explicit failure and no payout is initiated or represented as successful. Real M-Pesa verification callbacks and B2C payout callbacks require provider credentials, callback URLs, signature/replay controls, reconciliation, and a separately reviewed integration in a later sprint.

## Files

- `drizzle/schema.ts`
- `drizzle/0020_nostalgic_hellcat.sql`
- `drizzle/0021_rare_jazinda.sql`
- `server/domains/finance/beneficiaries.ts`
- `server/domains/finance/beneficiaryRouter.ts`
- `server/domains/finance/router.ts`
- `server/domains/notification/service.ts`
- `shared/validation/beneficiarySchemas.ts`
- `shared/permissions/catalog.ts`
- `client/src/pages/Finance.tsx`
- `server/finance.sprint18.test.ts`

## Validation

- Sprint 17 + Sprint 18 focused regression: **9 tests passed**.
- TypeScript check: passed.
- Production build: passed.
- Migration `0020` was generated, reviewed, and applied. A MySQL identifier-length issue was corrected with explicit short FK names before completion.
- Corrective migration `0021` was generated, reviewed, and applied to make the primary marker nullable and add the one-primary unique constraint.
- Active database verification and permission seeding remain part of final runtime validation.

## Deferred follow-up

- Real M-Pesa beneficiary verification callback integration.
- Real M-Pesa B2C payout initiation/status/callback/reconciliation.
- Settlement worker leases and scheduled outbox/settlement processing.
- Refund ledger reversal postings and broader fixture isolation for legacy parallel tests.
