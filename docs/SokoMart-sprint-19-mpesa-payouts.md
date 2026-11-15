# SokoMart Sprint 19 — M-Pesa B2C Payout Execution

Sprint 19 extends the immutable Sprint 17 ledger and Sprint 18 beneficiary domain with an asynchronous, provider-neutral payout boundary. It does not mutate ledger entries, settlement snapshots, or beneficiary history. A payout is created only from an approved positive KES seller settlement and a verified primary beneficiary, and it keeps an immutable masked/fingerprint/encrypted destination snapshot for historical traceability.

## Provider boundary

`server/domains/finance/payouts.ts` contains the M-Pesa Daraja B2C adapter. It remains safely unconfigured unless the server has explicit B2C credentials, initiator/security credential, result and timeout callback URLs, and `MPESA_PAYOUT_ENABLED=true`. No fake success is returned. Request acceptance is represented separately from provider confirmation; ambiguous responses enter reconciliation rather than being blindly retried.

The callback is mounted at `POST /api/payouts/mpesa/callback` and is acknowledged only after the provider reference is matched, the provider event is deduplicated, and the payout state transition is accepted. Raw provider payloads and security credentials are never returned to clients or written to audit state; only safe normalized metadata is stored.

## Persistence and worker

Migration `0022_wide_killmonger.sql` adds payout instructions, attempts, provider events, worker jobs, pause control, and encrypted beneficiary destinations. The live database already contained these tables after the earlier Sprint 19 execution; schema verification confirmed their presence and the encrypted beneficiary column. The migration is additive and must not be rerun destructively.

`server/domains/finance/worker.ts` is an on-demand worker unit. It claims one job atomically, recovers stale claims, bounds retries, and routes ambiguous work through reconciliation. `POST /api/scheduled/finance-worker` is cron-authenticated and intentionally does not activate a recurring schedule inside the sandbox; deployment may invoke it through the platform's managed scheduler.

## Authorization and UI

Payout procedures are under `finance.payout.*` permissions. Seller list and initiate procedures use active seller ownership/finance-staff membership. Finance operations can inspect the redacted queue, provider status, events, and pause state. The admin queue is available at `/admin/finance`; seller finance remains at `/seller/finance`.

## Verification

The focused Sprint 19 suite covers disabled-provider behavior, encrypted destination round trips, deterministic references, state-transition guards, provider-result normalization, and router protection. TypeScript and production build are required before checkpointing. Full-suite fixture collisions involving fixed customer phone numbers remain a test-infrastructure concern and must be isolated before claiming a clean parallel full-suite run.
