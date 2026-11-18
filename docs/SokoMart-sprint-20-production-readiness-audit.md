# SokoMart Sprint 20 Production-Readiness Audit

**Audit date:** 17 November 2026  
**Verdict:** **No-go for unrestricted production or real-money controlled rollout.** The repository has a strong transactional foundation and many server-side ownership checks, but confirmed payment-webhook authenticity, logistics, authorization, support-context, catalog-moderation, and finance-control blockers remain.

## Scope and method

Seven independent reviewers inspected the actual source, Drizzle schema/migrations, routers, frontend surfaces, and focused tests against the Sprint 20 requirements in `pasted_content_2.txt`. Reviewers did not modify application files. The eighth operations reviewer did not complete because the audit workflow exhausted its subagent credit budget; deployment operations therefore remain an explicit unverified area rather than a pass. Findings below distinguish confirmed code defects from external-provider or deployment items that could not be live-tested.

## Executive summary

The application is not ready for an unrestricted launch. The highest-risk issue is that both customer M-Pesa and seller B2C payout callback routes accepted unauthenticated payloads and could transition financial state based on a provider reference alone. Additional confirmed blockers include a legacy `admin` role bypass that grants every permission, cross-warehouse handoff disclosure, an inoperable assigned-to-pickup delivery state transition, incomplete shipment/order synchronization, unsafe support context foreign keys, published catalog variant edits without renewed moderation, inconsistent damaged-stock semantics, incomplete refund execution/reconciliation, and payout controls that did not fully constrain execution. Focused tests passed in several domains, but many delivery, concurrency, provider, refund, and database-backed scenarios were not exercised against real infrastructure.

## Prioritized findings

### Critical

1. **Unauthenticated M-Pesa callbacks can change financial state.** `/api/payments/mpesa/callback` accepted parsed JSON without provider authentication and could mark payment successful, finalize inventory/order state, and trigger finance recognition. `/api/payouts/mpesa/callback` likewise could confirm a payout and complete a settlement. Amount, currency, reference, and replay checks are not equivalent to authenticity.

### High

2. **Legacy admin bypass defeats least privilege.** Permission middleware treats `users.role === 'admin'` as all permissions, bypassing explicit role grants and audit assignment controls.
3. **Warehouse handoff listing leaks cross-location seller/order/address data.** Eligible handoffs were loaded globally and filtered only by whether the caller had any non-empty warehouse scope.
4. **Delivery lifecycle is deadlocked.** Assignment moved a shipment to `assigned`, while pickup only accepted `pickup_pending`; no normal procedure bridged the states. Delivery completion also did not update parent order/seller-order state.
5. **Support ticket context IDs were trusted.** Customers could submit unrelated seller-order, shipment, return, or refund IDs, allowing cross-party ticket exposure through seller views.
6. **Published/approved catalog variants could be edited without renewed moderation.** Price, SKU, and variant name changes remained publicly eligible.
7. **Payout and finance controls were incomplete.** Payout amounts were silently floored to whole KES; payout pause was not enforced in all execution paths; refund/adjustment amounts were omitted from seller availability; failed payouts could leave settlements reserved; commission rule selection differed between ledger entries and snapshots.
8. **Refund execution was not production-capable.** The adapter remained unconfigured/processing with no authoritative provider callback, reconciliation worker, or terminal failure path; multi-item refund arithmetic paired rows by array order.
9. **Identity/account controls need deployment hardening.** The declared account limiter was not mounted and the in-memory limiter is not suitable for horizontal production deployment.

### Medium

- Delivery OTP issuance was not restricted to eligible shipments, was returned in the API response, and was not consumed after use; proof references were arbitrary strings rather than verified evidence.
- Courier activation did not require verification; warehouse staff had global delivery-operator behavior instead of location scope.
- Generic reservation idempotency, unique-key race handling, SLA policy enforcement, audit minimization, notification recovery, and evidence object ownership require additional hardening.
- Live Safaricom, notification, storage, courier, and refund-provider behavior was not verified.

## Remediation applied in this audit

The following confirmed risks were remediated in the current working tree:

- Added explicit shared-secret header checks for both M-Pesa callback routes, with separate customer-payment and payout callback secrets. Missing secrets now reject callbacks before any financial state change.
- Rejected payout amounts that are not positive whole-KES minor-unit values instead of silently flooring them.
- Enforced the payout emergency pause before payout creation and worker submission.
- Restricted non-admin eligible-handoff reads to an explicitly authorized warehouse selection, removing the prior unscoped global listing behavior.
- Changed assignment to enter the existing `pickup_pending` state and required couriers to be active and verified.
- Restricted customer delivery OTP issuance to `out_for_delivery` shipments.
- Added server-side support context validation for order, seller-order, shipment, return, and refund relationships before ticket creation.
- Removed the legacy all-permissions admin shortcut; permission-protected procedures now require explicit grants. Seller finance summaries and ledgers likewise require owner or finance-staff membership.
- Forced renewed catalog moderation after edits to approved/published variants, aligned cart availability with on-hand/reserved inventory semantics, consumed delivery OTP credentials after successful delivery, made delivery attempt updates compare-and-set safe, and calculated refund totals by joined return-item identity.
- Included refund and adjustment effects in seller availability, unified commission-rule selection for ledger and snapshot calculations, and added an idempotent immutable ledger reversal when a refund reaches the authoritative successful state.
- Required storage-style proof references for successful delivery attempts, enforced proof presence in the service layer, and retained one-time OTP consumption.
- Synchronized seller-order status to completed only when all shipments for that seller order are delivered, in the same guarded delivery transaction as parent-order synchronization.

These changes were validated with 25 test files and 119 passing tests, a clean typecheck, and a clean production build. The callback secret mechanism must be configured at the trusted ingress/provider adapter; no live Safaricom callback claim is made.

## Verified controls

The audit confirmed server-side ownership checks for customer accounts, cart/checkout/order reads, seller catalog and inventory operations, beneficiary access, payout eligibility, immutable ledger balancing, return eligibility, support permissions, notification user scoping, and warehouse package traceability. The prior Sprint 19 full suite reported 25 test files and 118 tests passing, but that result does not cover the confirmed gaps above or live provider behavior.

## Provider and deployment limitations

No Safaricom sandbox or production credentials were available. STK Push, Daraja B2C, callback delivery/authentication, transaction-status queries, provider limits, timeout semantics, and real-money reconciliation remain unverified. The finance worker has a deployment-managed endpoint but no scheduler registration can be proven from this repository. The operations audit reviewer did not complete because the workflow exhausted its credit budget; migration replay, ingress proxy configuration, distributed rate limiting, secret rotation, monitoring, and alerting require a separate deployment review.

## Go/no-go recommendation

**No-go for unrestricted production.** A controlled internal preview may continue with M-Pesa providers disabled and callback secrets configured only for test adapters. Before real-money or broad customer launch, close the two callback-authentication deployment tests, remove or explicitly migrate the legacy admin bypass, complete the delivery/order consistency flow, fix support-context authorization and finance settlement reconciliation, implement an authoritative refund provider/reconciliation path, run database-backed concurrency tests, and complete the operations/deployment audit.
