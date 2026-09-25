# SokoMart Sprint 2 — Customer Account Guide

**Status:** Implemented and verified  
**Scope:** Customer identity extension, profile, phone, saved addresses, and account UI. Marketplace catalog, cart, checkout, payment, order, seller, and delivery systems remain deferred.

## Architecture

Sprint 2 extends the Sprint 1 modular monolith rather than creating a second authentication or customer system:

```text
Manus OAuth identity
        │
      users
        │
  ┌─────┼───────────────────────┐
  │     │                       │
profiles phones          addresses
```

The existing OAuth identity and `users` row remain the source of authentication truth. `customer_profiles`, `customer_phones`, and `customer_addresses` store customer-owned business data. The account tRPC router lives at `server/domains/account/router.ts`, with persistence and business rules in `server/domains/account/service.ts`.

No client-supplied user ID is accepted by account mutations. Ownership always comes from `ctx.user.id` established by the existing authenticated session and permission middleware.

## Customer profiles

`customer_profiles` is one-to-one with `users` through a unique `userId` foreign key. It stores:

- First and last name.
- Display name.
- Optional avatar URL.
- Optional date of birth, validated as a past date.
- Preferred language.
- Preferred three-letter currency.
- Explicit `active`, `suspended`, or `closed` status.
- Created and updated timestamps.

Authentication fields such as OAuth open ID, email, login method, and legacy role remain in `users`. The profile does not duplicate OAuth identity data.

The account read procedure creates a profile lazily for an authenticated user if one does not exist. This makes the feature safe for existing OAuth users without requiring a second registration flow.

## Phone numbers

`customer_phones` stores one current phone number per user and enforces global uniqueness on `normalizedPhone`. The stored normalized value is separate from the display value.

For Kenya, the normalizer accepts formats such as:

- `0712 345 678`
- `0712345678`
- `+254 712 345 678`
- `+254712345678`

All are stored as `+254712345678`. Non-Kenyan numbers must use international format and remain supported through the country-aware normalizer rather than being forced through Kenyan rules.

Entering or changing a phone does **not** set `verifiedAt`. Verification is deliberately a separate future workflow for SMS or another trusted verification provider. The account UI communicates this distinction to the customer.

## Addresses

`customer_addresses` supports multiple active addresses per customer. It includes:

- Recipient name and normalized recipient phone.
- `home`, `work`, or `other` label.
- Country, county, town, neighborhood.
- Estate/building, apartment/house, street/road, directions.
- Postal code.
- Latitude and longitude placeholders for future logistics integration.
- `isDefault` flag.
- `active` or `inactive` status for soft deletion.
- Created and updated timestamps.

Map integration is intentionally not required in Sprint 2. Coordinates are validated as bounded numeric values and stored as strings to preserve exact submitted precision for later mapping work.

## Default-address rules

Address mutations use the Sprint 1 transaction boundary:

- A customer may have multiple active addresses.
- Creating the first active address automatically makes it default.
- Creating an address with `isDefault=true` clears the previous default in the same transaction.
- Setting an address as default clears every other active address for that customer in the same transaction.
- Deleting an address is a soft deactivation, not a physical delete.
- If the deleted address was default, the most recently updated active address is promoted safely.
- A customer may have no addresses, but must never have more than one active default.

The server derives ownership from the authenticated user for every list, get, create, update, delete, and set-default operation.

## Future order safety

Orders must not depend on a mutable saved address row. At checkout, the future order service must:

1. Load the customer-owned address through the account service.
2. Validate that it is active and owned by the customer.
3. Copy the full delivery data into an immutable order-address snapshot.
4. Store the snapshot with the order or fulfillment record before payment/order confirmation.
5. Use the snapshot for historical display, fulfillment, support, returns, and disputes.

`toAddressSnapshot` provides the current pure helper for the snapshot shape. It returns a frozen object containing recipient and location fields without the mutable address ID or current default flag. Future order tables should persist the snapshot as explicit columns or a controlled JSON payload according to the order-domain design.

Changing or deleting a saved address after checkout must never change the historical order destination.

## tRPC procedures

The modular account router exposes:

```text
account.get
account.updateProfile
account.updatePhone
account.addresses.list
account.addresses.get
account.addresses.create
account.addresses.update
account.addresses.delete
account.addresses.setDefault
```

All procedures are `protectedProcedure` procedures. They use the existing session authentication and are not public. Address procedures accept only the address ID as a lookup key; the service adds the authenticated user ID to every query predicate.

## Validation

Server-side Zod schemas cover:

- Profile name and display fields.
- Preferred language and currency.
- Phone format and country code.
- Recipient name and phone.
- Address label.
- Country, county, town, and neighborhood.
- Optional building, apartment, street, directions, and postal code.
- Optional bounded coordinates.
- Strict object shapes that reject unknown ownership fields such as `userId`.

The account UI mirrors these rules for usability, but the server remains authoritative. Invalid input must be rejected even when the UI is bypassed.

## Audit events

Account changes record append-only audit events:

- `CUSTOMER_PROFILE_UPDATED`
- `CUSTOMER_PHONE_UPDATED`
- `CUSTOMER_ADDRESS_CREATED`
- `CUSTOMER_ADDRESS_UPDATED`
- `CUSTOMER_ADDRESS_DEACTIVATED`
- `CUSTOMER_ADDRESS_DEFAULT_SET`

Address audit writes occur through the same transaction as the address mutation, preserving the Sprint 1 atomicity boundary.

## Database migration

Sprint 2 adds migration `0003_fancy_mad_thinker.sql` with three non-destructive tables, foreign keys to `users`, uniqueness constraints, and query-path indexes. Existing users and Sprint 1 tables are preserved.

Future schema changes must still follow:

```bash
pnpm drizzle-kit generate
# review generated SQL
pnpm drizzle-kit migrate
```

## Testing and verification

Sprint 2 adds tests for:

- Kenyan phone normalization and invalid phone rejection.
- Strict rejection of client-supplied ownership fields.
- Authentication enforcement for account procedures.
- Transactional default switching.
- Soft deletion and replacement-default promotion.
- Immutable future-order address snapshot construction.
- Existing Sprint 1 test coverage remains passing.

The verified commands are:

```bash
pnpm check
pnpm test
pnpm build
pnpm drizzle-kit migrate
```
