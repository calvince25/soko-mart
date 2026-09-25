import { and, desc, eq, inArray } from "drizzle-orm";
import {
  catalogCategories,
  catalogProductMedia,
  catalogProductVariants,
  catalogProducts,
  commerceWishlistItems,
  sellers,
} from "../../../../drizzle/schema";
import { invalidState, notFound } from "../../../../shared/errors/appError";
import { getDb } from "../../../db";
import { writeAuditEvent } from "../../../audit/audit";
import { getRequestId } from "../../../logging/requestContext";

async function database() {
  const db = await getDb();
  if (!db) throw invalidState("Wishlist services are temporarily unavailable.");
  return db;
}

async function variantRow(db: any, variantId: number) {
  const rows = await db.select({ item: commerceWishlistItems, variant: catalogProductVariants, product: catalogProducts, seller: sellers, category: catalogCategories })
    .from(commerceWishlistItems)
    .innerJoin(catalogProductVariants, eq(commerceWishlistItems.variantId, catalogProductVariants.id))
    .innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id))
    .innerJoin(sellers, eq(catalogProducts.sellerId, sellers.id))
    .innerJoin(catalogCategories, eq(catalogProducts.categoryId, catalogCategories.id))
    .where(eq(commerceWishlistItems.variantId, variantId)).limit(1);
  return rows[0] ?? null;
}

async function visibleVariant(db: any, variantId: number) {
  const rows = await db.select({ variant: catalogProductVariants, product: catalogProducts, seller: sellers, category: catalogCategories })
    .from(catalogProductVariants)
    .innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id))
    .innerJoin(sellers, eq(catalogProducts.sellerId, sellers.id))
    .innerJoin(catalogCategories, eq(catalogProducts.categoryId, catalogCategories.id))
    .where(eq(catalogProductVariants.id, variantId)).limit(1);
  if (!rows.length) throw notFound("Product variant not found.");
  const row = rows[0];
  if (row.variant.status !== "active") throw invalidState("This SKU is no longer available.");
  if (row.product.status !== "published" || row.product.moderationStatus !== "approved") throw invalidState("This product is not currently visible.");
  if (row.seller.status !== "approved" || row.seller.verificationStatus !== "approved") throw invalidState("This seller is not currently visible.");
  if (row.category.status !== "active") throw invalidState("This product category is no longer visible.");
  return row;
}

export async function getWishlist(userId: number) {
  const db = await database();
  const rows = await db.select({ item: commerceWishlistItems, variant: catalogProductVariants, product: catalogProducts, seller: sellers, category: catalogCategories })
    .from(commerceWishlistItems)
    .innerJoin(catalogProductVariants, eq(commerceWishlistItems.variantId, catalogProductVariants.id))
    .innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id))
    .innerJoin(sellers, eq(catalogProducts.sellerId, sellers.id))
    .innerJoin(catalogCategories, eq(catalogProducts.categoryId, catalogCategories.id))
    .where(eq(commerceWishlistItems.userId, userId))
    .orderBy(desc(commerceWishlistItems.createdAt));
  const productIds: number[] = Array.from(new Set<number>(rows.map((row: any) => Number(row.product.id))));
  const mediaRows = productIds.length ? await db.select().from(catalogProductMedia).where(inArray(catalogProductMedia.productId, productIds)).orderBy(catalogProductMedia.displayOrder) : [];
  return rows.map((row: any) => {
    const visible = row.variant.status === "active" && row.product.status === "published" && row.product.moderationStatus === "approved" && row.seller.status === "approved" && row.seller.verificationStatus === "approved" && row.category.status === "active";
    const primaryMedia = mediaRows.find((media: any) => media.productId === row.product.id && media.isPrimary === 1) ?? mediaRows.find((media: any) => media.productId === row.product.id);
    return {
      id: row.item.id,
      variantId: row.variant.id,
      productId: row.product.id,
      productSlug: row.product.slug,
      productName: row.product.name,
      variantName: row.variant.name,
      sellerId: row.seller.id,
      sellerName: row.seller.storeName,
      priceMinor: row.variant.priceMinor,
      currency: row.variant.currency,
      imageUrl: primaryMedia ? `/manus-storage/${primaryMedia.storageKey}` : null,
      visible,
      issue: visible ? null : "This item is no longer available for purchase.",
      createdAt: row.item.createdAt,
    };
  });
}

export async function addWishlistItem(userId: number, variantId: number) {
  const db = await database();
  const row = await visibleVariant(db, variantId);
  await db.insert(commerceWishlistItems).values({ userId, variantId }).onDuplicateKeyUpdate({ set: { variantId } });
  const [item] = await db.select().from(commerceWishlistItems).where(and(eq(commerceWishlistItems.userId, userId), eq(commerceWishlistItems.variantId, variantId))).limit(1);
  await writeAuditEvent(db, { actorUserId: userId, action: "commerce.wishlist_item.added", entityType: "commerce_wishlist_item", entityId: String(item?.id ?? variantId), afterState: { userId, variantId, productId: row.product.id }, requestId: getRequestId() });
  return getWishlist(userId);
}

export async function removeWishlistItem(userId: number, variantId: number) {
  const db = await database();
  const existing = await variantRow(db, variantId);
  if (!existing || existing.item.userId !== userId) throw notFound("Wishlist item not found.");
  await db.delete(commerceWishlistItems).where(and(eq(commerceWishlistItems.id, existing.item.id), eq(commerceWishlistItems.userId, userId)));
  await writeAuditEvent(db, { actorUserId: userId, action: "commerce.wishlist_item.removed", entityType: "commerce_wishlist_item", entityId: String(existing.item.id), beforeState: existing.item, requestId: getRequestId() });
  return getWishlist(userId);
}

export async function clearWishlist(userId: number) {
  const db = await database();
  await db.delete(commerceWishlistItems).where(eq(commerceWishlistItems.userId, userId));
  await writeAuditEvent(db, { actorUserId: userId, action: "commerce.wishlist.cleared", entityType: "commerce_wishlist", entityId: String(userId), requestId: getRequestId() });
  return [];
}
