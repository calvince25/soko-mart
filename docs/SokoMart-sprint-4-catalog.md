# SokoMart Sprint 4 — Product Catalog Guide

**Status:** Implemented and verified

## Scope

Sprint 4 establishes the persistent catalog foundation for categories, brands, structured attributes, seller-owned products, variants/SKUs, product media references, pricing, moderation, publishing, and safe public reads. It intentionally does **not** implement inventory, cart, checkout, payments, orders, delivery, commissions, payouts, reviews, promotions, or advanced search.

## Database relationships

- `catalog_categories` is a hierarchical taxonomy using `parentId`, globally unique slugs, status, display order, image reference, and SEO fields.
- `catalog_brands` stores optional product brands with globally unique slugs, status, logo reference, and SEO fields.
- `catalog_attributes` and `catalog_attribute_values` define reusable typed attribute definitions and select values.
- `catalog_category_attributes` attaches relevant attributes to categories and marks required fields.
- `catalog_products` belongs to a seller, category, and optional brand. The seller foreign key uses `ON DELETE RESTRICT`, so accountable seller ownership cannot be silently removed.
- `catalog_product_variants` belongs to a product and enforces globally unique SKUs.
- `catalog_variant_attribute_values` stores normalized variant attribute selections/values instead of an uncontrolled JSON blob.
- `catalog_product_media` stores object-storage references, not file bytes. Media can attach to products or variants and has primary/display-order metadata.
- `catalog_product_slug_history` reserves previous product slugs so future name changes do not silently reuse or break public URLs.

## Category architecture

Categories are server-managed and not hard-coded into product records. The service validates self-parenting, circular ancestry, inactive parents, and a maximum hierarchy depth of six levels. Categories with non-archived products cannot be archived; dependent products must be moved or archived first. The database enforces unique slugs and foreign-key relationships while the service enforces tree rules.

## Brand architecture

Brands are optional. Product creation accepts `brandId: null` for unbranded products. Brand slugs are globally unique and brands are deactivated rather than destructively deleted. Products retain their brand relationship through `ON DELETE SET NULL`.

## Product and seller ownership

Every product requires a seller foreign key. Seller procedures resolve the authenticated user through an active seller membership and approved seller lifecycle state; clients cannot select an arbitrary seller ID for authorization. Seller members with `owner`, `manager`, or `catalog_staff` roles can manage the seller's catalog subject to the permission catalog.

## Variant/SKU architecture

A product may have any number of variants. Each variant stores a globally unique SKU, name/reference, selling price, optional compare-at price, currency, and lifecycle status. Variant creation and updates validate non-negative prices and compare-at ordering. Variant attributes reference category-configured attributes and validate select values against the selected attribute.

## Pricing representation

Prices are integer minor units using the Sprint 1 `Money` convention: KES uses 100 minor units per major unit, so `KES 1,299.99` is stored as `129999` with `currency = KES`. No floating-point database values are used. Promotions, discount rules, commissions, wallets, and payouts remain out of scope.

## Inventory separation

No stock quantity or availability field was added to product or variant records. Catalog owns product identity, SKU identity, and pricing only. Inventory will become the future source of truth for quantities, warehouses, stock movements, reservations, and availability checks.

## Product state machine

Seller-created products start as `draft` with `moderationStatus = not_submitted`.

- `draft` / `rejected` → seller submits → `pending_review`
- `pending_review` → reviewer approves → `approved`
- `approved` → reviewer publishes → `published`
- `pending_review` → reviewer rejects with reason → `rejected`
- `published` → reviewer suspends with optional reason → `suspended`
- `suspended` → reviewer restores → `published`
- seller archive → `archived`

Sellers cannot self-approve, publish, suspend, or bypass moderation. Editing approved/published/suspended product identity returns the product to `pending_review`; low-risk media changes are recorded separately, but inventory and purchasing behavior do not exist yet.

## Public visibility

Public product reads require all of the following:

- seller status is `approved`
- seller verification status is `approved`
- product status is `published`
- product moderation status is `approved`
- category status is `active`

Public response shaping intentionally excludes seller IDs, private seller contacts, moderation status and reasons, internal audit data, storage keys, and administrative metadata. Media is exposed only as the derived `/manus-storage/{key}` reference.

## Media/storage architecture

Product media stores a storage key and metadata in `catalog_product_media`; bytes remain in the existing object-storage abstraction. Seller media operations require the authenticated seller to own the product, enforce a `catalog/seller/{sellerId}/` namespace, allow only JPEG, PNG, WebP, AVIF, and MP4 MIME types, cap files at 10 MiB, and validate product/variant ownership. The API supports primary-image replacement and display ordering metadata. A future upload UI should use server-issued/presigned storage operations rather than accepting arbitrary public keys.

## Permissions

Seller permissions added:

- `seller.product.submit_own`
- `seller.variant.manage_own`
- `seller.product.media_manage_own`

Existing `seller.product.create_own` and `seller.product.update_own` protect product writes. Existing `catalog.category.manage` protects category, brand, attribute, and category-attribute administration. Existing `catalog.product.approve` protects product review, publish, reject, suspend, and restore operations.

## Audit events

Important catalog mutations write audit records with actor, action, entity, before/after state where relevant, reason when supplied, and request correlation ID:

- category/brand/attribute/category-attribute created, updated, archived
- product created, updated, submitted, archived
- product variant created and updated
- variant attribute changes
- product media changes
- product approved, published, rejected, suspended, and restored

Sensitive seller contact information and storage credentials are not placed in audit snapshots.

## Public and seller procedures

Public:

- list/view active categories
- list/view active brands
- list published visible products
- view a published product with variants and media

Seller:

- list own products
- create/update/archive own product drafts
- submit own products for review
- create/update own variants
- set category-valid variant attributes
- add/list own product media

Admin:

- manage categories, brands, attributes, and category attributes
- list products for review
- approve, publish, reject, suspend, and restore products

## Verification

- `pnpm check`: passed
- `pnpm test`: passed — 38 tests across 9 files
- `pnpm build`: passed
- `pnpm drizzle-kit migrate`: passed and idempotent after bookkeeping update
- Catalog migration: `0005_acoustic_the_anarchist.sql`
- Sprint 4 tests cover slug validation, category/product/variant/media input validation, integer pricing, anonymous access, missing-permission/IDOR boundaries, persistent catalog tables, and public response safety.

## Unresolved issues / Sprint 5 preservation notes

1. The current catalog UI records a storage reference but does not yet provide a binary upload control. Sprint 5 should add a server-authorized presigned upload flow and connect it to the existing storage abstraction.
2. Product category/brand selectors in the seller UI are intentionally minimal; a later UX pass should provide searchable selectors and category-specific attribute forms.
3. Variant attribute writes support one value per attribute per variant; multi-select UI and richer validation can be added without changing the normalized relationship.
4. Public product discovery is deliberately unsophisticated. Search, filtering, ranking, and recommendations must be layered on top of public visibility rules rather than bypassing them.
5. Inventory must remain a separate domain and must not reintroduce `stock` fields into catalog tables.
