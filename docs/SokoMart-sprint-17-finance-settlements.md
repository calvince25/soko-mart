# SokoMart Sprint 17 — Finance, Commission & Settlement Accounting

## Delivered

Sprint 17 adds an immutable financial accounting layer between successful commerce events and future seller payouts. Amounts remain integer minor units and currency is stored on every financial record.

### Persistence

- `finance_accounts` — platform, seller, clearing, commission, and receivable accounts.
- `finance_transactions` — immutable transaction header with unique transaction number and idempotency key.
- `finance_entries` — debit/credit lines; every posted transaction must balance.
- `finance_commission_rules` — versionable basis-point commission rules with seller/category/product scope and priority.
- `finance_snapshots` — immutable seller-order earning snapshots containing gross, commission, net, rate, rule, currency, and calculation version.
- `finance_holds` — seller-level operational holds with reason, reference, actor, and release metadata.
- `finance_adjustments` — audited positive/negative seller corrections with mandatory reason, reference, administrator, and idempotency key.
- `settlement_periods` — open/calculating/review/approved/processing/completed/failed/cancelled periods.
- `seller_settlements` — immutable-at-creation seller settlement snapshots with gross, commission, refunds, adjustments, holds, net, currency, status, and unique seller-period protection.

Migration `0019_little_catseye.sql` is generated from the canonical Drizzle schema. The active database was verified and the additive tables were applied without modifying marketplace records.

## Accounting behavior

A successfully finalized paid order triggers post-commit finance recognition. Recognition is idempotent on `order-payment:{orderId}` and creates balanced lines for:

1. Customer payment into platform clearing.
2. Seller net entitlement.
3. Platform commission.
4. Platform-controlled shipping, tax, and fee remainder.

Commission is calculated in minor units using basis points and stored in a snapshot. Future commission-rule changes do not rewrite historical snapshots. Account provisioning is safe for retry/race paths and transaction headers are unique by idempotency key.

The finance API exposes ledger reads, seller summaries, commission rule creation, holds, audited adjustments, and settlement generation. Settlement generation only proceeds for a period in `review`, refuses a non-positive available balance, and uses a unique seller-period constraint plus idempotency key to prevent double settlement.

## Security and authorization

New permission codes:

- `finance.ledger.read`
- `finance.commission.manage`
- `finance.adjustment.create`
- `finance.hold.manage`
- `finance.settlement.read_own`
- `finance.settlement.manage`
- `finance.settlement.approve`

All procedures require authenticated, permission-derived context. Finance records are never client-written directly. Manual adjustments require amount, currency, reason, reference, administrator identity, timestamp, and idempotency protection. Support remains non-financial: a support case may request or reference a hold, but it cannot mutate balances.

## Refund and return boundary

Returns and refunds remain authoritative in Sprint 15. Sprint 17 preserves the explicit boundary that a customer opening a return does not reverse seller earnings. A future financial reversal transaction should be posted only after the refund provider confirms a successful refund and the return/refund state is committed.

## Payout boundary

`server/domains/finance/payouts.ts` defines a provider-neutral contract for create, status, reconciliation, and callbacks. The current adapter returns `configured: false` and never pretends that money was transferred. No payout provider or seller bank/mobile-money transfer is enabled in this sprint.

## UI

`/seller/finance` provides a mobile-friendly seller earnings view with net, available, held, and settled amounts plus immutable ledger activity. It deliberately presents accounting readiness rather than promising a payout date or transfer.

## Verification

- `pnpm check` — passed.
- `pnpm build` — passed.
- Focused Sprint 17, Sprint 15, and Sprint 16 tests — 18/18 passed.
- Sprint 17 finance boundary tests — 5/5 passed.
- Foundation permission seed — completed idempotently (`seededPermissions: 80`, `assignedExistingUsers: 11`).
- Migration generation — passed; `drizzle/0019_little_catseye.sql` generated.
- Runtime database table verification — passed for finance and settlement tables.
- Full regression was exercised; the finance-focused paths passed. The broader suite still contains shared fixed-phone/test-fixture cleanup collisions in earlier Sprint 8–10 suites when executed against a reused database, which are separate from Sprint 17 finance boundary assertions.

## Explicitly deferred to Sprint 18

- Successful external seller payout execution and callbacks.
- Bank/mobile-money seller beneficiary onboarding.
- Refund reversal ledger postings after provider confirmation.
- Scheduled settlement calculation worker and lease/dead-letter handling.
- Tax invoices, VAT withholding, chargebacks, disputes, FX, multi-currency settlement, and reconciliation exports.
- Full isolation/reset strategy for legacy integration fixtures.
