# SokoMart Sprint 8 — Payments & Payment State

**Status:** Implemented and verified.

## Scope

Sprint 8 adds a provider-agnostic payment domain between immutable checkout and the future order system:

```text
Persistent cart → Checkout snapshot → Payment attempt → Verified payment → Future order creation
```

The sprint does **not** create parent orders, seller orders, payouts, commissions, or refunds. A verified payment is a durable `successful` state that Sprint 9 can consume transactionally.

## Provider abstraction

`server/domains/payment/provider.ts` defines the normalized `PaymentProvider` contract:

- Initiate a provider payment.
- Return a provider reference without treating acceptance as success.
- Parse provider callbacks into normalized internal statuses.
- Query provider status where supported.

`MpesaProvider` implements Safaricom STK Push using server-only `MPESA_*` configuration. Additional card or wallet adapters can implement the same interface without changing checkout or payment state management.

When credentials are absent outside production, the adapter uses a deterministic mock reference for local development and automated tests. Production remains fail-closed and requires the consumer key, consumer secret, shortcode, passkey, and callback URL.

## Payment lifecycle

Payment states are server-controlled:

`created → pending → processing → successful`

Failure paths transition to `failed`, `cancelled`, or `expired`. A successful payment may later transition only to `refunded` or `partially_refunded`, which are reserved for a future refunds sprint. Clients cannot submit authoritative statuses.

Every attempt stores the customer, checkout session, provider, provider reference, internal reference, server-derived amount/currency, status, masked phone, failure category/message, non-secret metadata, expiry, and timestamps in `payment_attempts`.

## Amount and checkout authority

Payment initiation retrieves the owned checkout session server-side and requires:

- `ready_for_payment` checkout state.
- No checkout validation issues.
- Unexpired session.
- KES currency for the current M-Pesa adapter.
- Whole-KES amount for STK Push.

The request contains no amount field. Subtotal, shipping, fee, tax, total, and currency always come from the immutable checkout snapshot.

## Phone handling

The payment service reuses `normalizePhone` from the identity domain. The submitted number must match the saved customer phone; missing saved phones and mismatches return clear validation errors. The browser never receives M-Pesa secrets, tokens, passkeys, or consumer credentials.

## Inventory boundary

Opening or reviewing checkout does not reserve inventory. When a payment attempt is created, `reserveForPayment` reuses the existing inventory balance, append-only movement ledger, and reservation tables inside the payment transaction. Holds:

- Reference the payment’s internal reference.
- Have the payment expiry as their expiry.
- Lock/update available balances transactionally to prevent overselling.
- Support multiple checkout lines and inventory locations.
- Link through `payment_reservations`.
- Release on provider failure, customer cancellation, callback cancellation, or server expiry.

No order or stock conversion occurs on payment success; the future Orders sprint owns that boundary.

## STK Push and callbacks

The flow is:

1. Customer reviews server totals and enters the saved M-Pesa phone.
2. Server creates a pending payment and inventory holds.
3. Server requests STK Push.
4. Provider acceptance moves the attempt to `processing` (or remains `pending` for the local mock); it is not success.
5. Customer enters the M-Pesa PIN.
6. `POST /api/payments/mpesa/callback` receives the provider callback.
7. The adapter validates and normalizes the provider reference, result, amount, and currency.
8. The payment transaction records the callback event, updates the state, and audits the transition.

Callbacks are provider-reference scoped and amount/currency checked. `payment_callback_events` uses `(provider, providerEventId)` uniqueness so replayed callbacks are safely ignored. Only normalized reconciliation fields are persisted; raw provider payloads are not stored as payment metadata.

## Reconciliation and expiry

Authenticated users can call `commerce.payment.reconcile` for a server-side provider query where supported. The browser never polls Safaricom directly. The service also exposes `expirePaymentAttempt` and bounded `expirePaymentAttempts` operations for a worker or scheduled process; expiry releases holds and preserves the payment attempt as auditable history.

## API surface

The `commerce.payment` router exposes:

- `initiate({ checkoutSessionId, provider: "mpesa", phone, idempotencyKey? })`
- `get({ paymentId })`
- `cancel({ paymentId, reason? })`
- `reconcile({ paymentId })`

All procedures are authenticated and ownership-scoped. Authenticated-user idempotency keys prevent duplicate Pay clicks from creating duplicate attempts. Multiple attempts remain visible in history, while a second successful payment for the same checkout is rejected.

## Storefront behavior

The existing checkout dialog now:

- Shows the saved phone field without changing the marketplace visual language.
- Calls the server payment initiation procedure.
- Displays “request sent” only after the backend accepts the STK request.
- Polls SokoMart’s payment status endpoint every three seconds.
- Stops on terminal state or after two minutes.
- Shows success only for server-confirmed `successful` status.
- Shows failure/cancellation/expiry messages and a retry action.

## Tests

`server/payment.sprint8.test.ts` covers:

- Server-derived checkout amount and KES payment creation.
- Transactional inventory hold creation.
- Payment ownership and IDOR protection.
- Authenticated idempotency.
- Callback amount rejection.
- Callback state transition and duplicate callback safety.
- Invalid cancellation after success.
- Failed/cancelled attempt hold release and retry.
- Server-driven expiry and hold release.

## Next boundary

Sprint 9 can consume `successful` payment attempts to create one parent order and one seller order per checkout group, atomically snapshot delivery/payment references, convert inventory reservations into stock movements, and implement post-payment reconciliation. No order records are created in Sprint 8.

## References

[1]: server/domains/payment/service.ts "SokoMart payment service"
[2]: server/domains/payment/provider.ts "SokoMart M-Pesa provider adapter"
[3]: server/payment.sprint8.test.ts "SokoMart Sprint 8 payment integration tests"
[4]: drizzle/0009_aromatic_sunset_bain.sql "SokoMart Sprint 8 payment migration"
