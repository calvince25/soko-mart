# SokoMart Sprint 3 — Seller Domain Guide

**Status:** Implemented foundation

## Separation of identities

A seller is a business identity, not a customer profile. OAuth `users`, customer profile data, and seller records remain separate. A seller is connected to users through `seller_members`, whose structure supports an owner plus future manager, catalog, fulfilment, and finance staff. Sprint 3 only uses the owner relationship.

## State machine

Seller status is server-controlled:

```text
draft → pending_verification → under_review → approved
                                      └──────→ rejected → draft
approved → suspended → approved
approved → closed
```

The client cannot assign status. Submission changes a draft to `pending_verification`; an authorized reviewer must move it to `under_review`, then a separate permissioned approval action changes it to `approved`. Rejection and suspension record a reason. No automatic approval exists.

## Verification documents

`seller_verification_documents` stores document type, private storage key, original filename, MIME type, size, upload time, review status, reviewer, review time, and rejection reason. The database stores a storage reference rather than a public image URL. Document keys must be inside `private/seller/{sellerId}/...`; public product/image storage must not be used for verification material. A future upload endpoint can issue a presigned private upload URL and then call the metadata procedure.

## Applications

Seller profile data is editable while the seller is in `draft` or `rejected`. Submission creates or updates a versioned application and makes submitted information review-controlled. A rejected application can be revised into a new version; submitted and under-review records are not silently overwritten. The portal always shows the current lifecycle state and reason where present.

## Ownership and authorization

Every seller operation resolves membership from the authenticated session and active `seller_members` row. Client-provided seller IDs are only resource selectors; they are never proof of ownership. Admin review uses existing RBAC permission middleware:

- `seller.application.review`
- `seller.application.approve`
- `seller.application.suspend`

Marketplace admins receive these permissions; ordinary customers do not. Seller-owned procedures require active owner membership. All submission, profile-change, document, review, approval, rejection, suspension, and reactivation events are written to the existing audit log.

## Store identity and visibility

Store slugs are Unicode-normalized, lowercased, URL-safe, collision-resolved, and unique. Slug history retains old slugs so future redirects can preserve historical references. The active slug can be changed only before approval in this sprint; post-approval slug changes should be implemented later with redirect records and explicit review policy.

Only sellers with both `status = approved` and `verificationStatus = approved` are returned by the public-store procedure. Draft, pending, under-review, rejected, suspended, and closed stores are not discoverable. Catalog and marketplace search are intentionally not implemented yet.

## Portal states

The seller portal supports:

- no application: create a seller draft;
- draft: edit and submit;
- pending verification / under review: read-only status messaging;
- rejected: reason display and a new editable draft;
- approved: approved store identity and future-commerce readiness;
- suspended / closed: restricted-state messaging.

The portal does not invent sales, order, inventory, balance, or payout data.
