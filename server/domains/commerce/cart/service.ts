import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  catalogCategories,
  catalogProductMedia,
  catalogProductVariants,
  catalogProducts,
  commerceCartItems,
  commerceCarts,
  inventoryBalances,
  sellerMembers,
  sellers,
} from "../../../../drizzle/schema";
import { conflict, invalidState, notFound, validationError } from "../../../../shared/errors/appError";
import { Money, DEFAULT_CURRENCY } from "../../../../shared/money/money";
import { CART_MAX_LINE_QUANTITY, CART_MIN_LINE_QUANTITY } from "../../../../shared/validation/commerceSchemas";
import { getDb } from "../../../db";
import { writeAuditEvent } from "../../../audit/audit";
import { getRequestId } from "../../../logging/requestContext";
import { withTransaction } from "../../../transactions/database";

const PUBLIC_PRODUCT_STATUS = "published" as const;
const PUBLIC_SELLER_STATUS = "approved" as const;

async function database() {
  const db = await getDb();
  if (!db) throw invalidState("Cart services are temporarily unavailable.");
  return db;
}

async function lockCustomer(tx: any, userId: number) {
  const result = await tx.execute(sql`SELECT id FROM users WHERE id = ${Number(userId)} FOR UPDATE`);
  if (!result) throw notFound("Customer account not found.");
}

async function activeCartForUser(db: any, userId: number) {
  const rows = await db.select().from(commerceCarts)
    .where(and(eq(commerceCarts.userId, userId), eq(commerceCarts.status, "active")))
    .orderBy(desc(commerceCarts.updatedAt), desc(commerceCarts.id)).limit(1);
  return rows[0] ?? null;
}

async function getOrCreateActiveCart(userId: number) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId);
    const existing = await activeCartForUser(tx, userId);
    if (existing) return existing;
    const activeKey = `user:${userId}:active`;
    try {
      await tx.insert(commerceCarts).values({ userId, status: "active", currency: DEFAULT_CURRENCY, activeKey });
    } catch (error) {
      const concurrent = await activeCartForUser(tx, userId);
      if (concurrent) return concurrent;
      throw error;
    }
    const created = await activeCartForUser(tx, userId);
    if (!created) throw invalidState("Active cart could not be created.");
    await writeAuditEvent(tx, { actorUserId: userId, action: "commerce.cart.created", entityType: "commerce_cart", entityId: String(created.id), afterState: { status: created.status, currency: created.currency }, requestId: getRequestId() });
    return created;
  });
}

async function purchasableVariant(db: any, variantId: number) {
  const rows = await db.select({ variant: catalogProductVariants, product: catalogProducts, seller: sellers, category: catalogCategories })
    .from(catalogProductVariants)
    .innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id))
    .innerJoin(sellers, eq(catalogProducts.sellerId, sellers.id))
    .innerJoin(catalogCategories, eq(catalogProducts.categoryId, catalogCategories.id))
    .where(eq(catalogProductVariants.id, variantId)).limit(1);
  if (!rows.length) throw notFound("Product variant not found.");
  const row = rows[0];
  if (row.variant.status !== "active") throw invalidState("This SKU is no longer available.");
  if (row.product.status !== PUBLIC_PRODUCT_STATUS || row.product.moderationStatus !== "approved") throw invalidState("This product is not currently available for purchase.");
  if (row.seller.status !== PUBLIC_SELLER_STATUS || row.seller.verificationStatus !== "approved") throw invalidState("This seller is not currently available.");
  if (row.category.status !== "active") throw invalidState("This product category is no longer active.");
  return row;
}

async function existingVariant(db: any, variantId: number) {
  const rows = await db.select({ variant: catalogProductVariants, product: catalogProducts, seller: sellers, category: catalogCategories })
    .from(catalogProductVariants)
    .innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id))
    .innerJoin(sellers, eq(catalogProducts.sellerId, sellers.id))
    .innerJoin(catalogCategories, eq(catalogProducts.categoryId, catalogCategories.id))
    .where(eq(catalogProductVariants.id, variantId)).limit(1);
  return rows[0] ?? null;
}

async function availabilityMap(db: any, variantIds: number[]) {
  const map = new Map<number, number>();
  if (!variantIds.length) return map;
  const rows = await db.select().from(inventoryBalances).where(and(inArray(inventoryBalances.variantId, variantIds), eq(inventoryBalances.status, "active")));
  for (const row of rows) {
    const available = Math.max(0, row.onHand - row.reserved - row.damaged);
    map.set(row.variantId, (map.get(row.variantId) ?? 0) + available);
  }
  return map;
}

function availabilityState(available: number, requested: number): "in_stock" | "low_stock" | "limited_availability" | "out_of_stock" {
  if (available <= 0) return "out_of_stock";
  if (available < requested) return "limited_availability";
  if (available <= 5) return "low_stock";
  return "in_stock";
}

async function hydrateCart(userId: number, cart: any, dbOverride?: any) {
  const db = dbOverride ?? await database();
  const rows = await db.select({ item: commerceCartItems, variant: catalogProductVariants, product: catalogProducts, seller: sellers, category: catalogCategories })
    .from(commerceCartItems)
    .innerJoin(catalogProductVariants, eq(commerceCartItems.variantId, catalogProductVariants.id))
    .innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id))
    .innerJoin(sellers, eq(catalogProducts.sellerId, sellers.id))
    .innerJoin(catalogCategories, eq(catalogProducts.categoryId, catalogCategories.id))
    .where(eq(commerceCartItems.cartId, cart.id))
    .orderBy(desc(commerceCartItems.updatedAt));
  const variantIds = rows.map((row: any) => row.variant.id);
  const availableByVariant = await availabilityMap(db, variantIds);
  const productIds: number[] = Array.from(new Set<number>(rows.map((row: any) => Number(row.product.id))));
  const mediaRows = productIds.length ? await db.select().from(catalogProductMedia).where(inArray(catalogProductMedia.productId, productIds)).orderBy(catalogProductMedia.displayOrder) : [];
  const lines = rows.map((row: any) => {
    const currentAvailable = availableByVariant.get(row.variant.id) ?? 0;
    const visible = row.variant.status === "active" && row.product.status === PUBLIC_PRODUCT_STATUS && row.product.moderationStatus === "approved" && row.seller.status === PUBLIC_SELLER_STATUS && row.seller.verificationStatus === "approved" && row.category.status === "active";
    const priceChanged = visible && (row.item.addedPriceMinor !== row.variant.priceMinor || row.item.addedCurrency !== row.variant.currency);
    const issues: string[] = [];
    if (!visible) issues.push(row.seller.status !== PUBLIC_SELLER_STATUS || row.seller.verificationStatus !== "approved" ? "Seller unavailable" : row.variant.status !== "active" ? "SKU unavailable" : "Product unavailable");
    if (priceChanged) issues.push("Price changed");
    if (visible && currentAvailable <= 0) issues.push("Out of stock");
    const primaryMedia = mediaRows.find((media: any) => media.productId === row.product.id && media.isPrimary === 1) ?? mediaRows.find((media: any) => media.productId === row.product.id);
    return {
      id: row.item.id,
      variantId: row.variant.id,
      productId: row.product.id,
      productSlug: row.product.slug,
      productName: row.product.name,
      variantName: row.variant.name,
      sku: row.variant.sku,
      sellerId: row.seller.id,
      sellerName: row.seller.storeName,
      categoryName: row.category.name,
      quantity: row.item.quantity,
      addedPriceMinor: row.item.addedPriceMinor,
      addedCurrency: row.item.addedCurrency,
      currentPriceMinor: visible ? row.variant.priceMinor : null,
      currentCurrency: visible ? row.variant.currency : null,
      imageUrl: primaryMedia ? `/manus-storage/${primaryMedia.storageKey}` : null,
      availability: availabilityState(currentAvailable, row.item.quantity),
      purchasable: visible && issues.length === 0,
      priceChanged,
      issues,
      addedAt: row.item.addedAt,
      updatedAt: row.item.updatedAt,
    };
  });
  const subtotal = lines.reduce((sum: Money, line: any) => sum.add(new Money((line.currentPriceMinor ?? line.addedPriceMinor) * line.quantity, cart.currency)), Money.zero(cart.currency));
  return { cart, items: lines, subtotal: subtotal.toJSON(), itemCount: lines.reduce((sum: number, line: any) => sum + line.quantity, 0), checkoutBlocked: lines.some((line: any) => !line.purchasable) };
}

export async function getCart(userId: number) {
  const cart = await getOrCreateActiveCart(userId);
  return hydrateCart(userId, cart);
}

export async function addItem(userId: number, input: { variantId: number; quantity: number }) {
  if (!Number.isInteger(input.quantity) || input.quantity < CART_MIN_LINE_QUANTITY || input.quantity > CART_MAX_LINE_QUANTITY) throw validationError(`Quantity must be between ${CART_MIN_LINE_QUANTITY} and ${CART_MAX_LINE_QUANTITY}.`);
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId);
    const cart = (await activeCartForUser(tx, userId)) ?? await (async () => { const activeKey = `user:${userId}:active`; await tx.insert(commerceCarts).values({ userId, status: "active", currency: DEFAULT_CURRENCY, activeKey }); return activeCartForUser(tx, userId); })();
    if (!cart) throw invalidState("Active cart could not be created.");
    const row = await purchasableVariant(tx, input.variantId);
    if (row.variant.currency !== cart.currency) throw validationError(`This cart accepts ${cart.currency} items only.`);
    const [existing] = await tx.select().from(commerceCartItems).where(and(eq(commerceCartItems.cartId, cart.id), eq(commerceCartItems.variantId, input.variantId))).limit(1);
    const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
    if (nextQuantity > CART_MAX_LINE_QUANTITY) throw validationError(`A cart line cannot exceed ${CART_MAX_LINE_QUANTITY} units.`);
    if (existing) {
      await tx.update(commerceCartItems).set({ quantity: nextQuantity, updatedAt: new Date() }).where(eq(commerceCartItems.id, existing.id));
    } else {
      await tx.insert(commerceCartItems).values({ cartId: cart.id, variantId: input.variantId, quantity: input.quantity, addedPriceMinor: row.variant.priceMinor, addedCurrency: row.variant.currency });
    }
    await tx.update(commerceCarts).set({ updatedAt: new Date() }).where(eq(commerceCarts.id, cart.id));
    await writeAuditEvent(tx, { actorUserId: userId, action: existing ? "commerce.cart_item.increased" : "commerce.cart_item.added", entityType: "commerce_cart_item", entityId: String(existing?.id ?? input.variantId), afterState: { cartId: cart.id, variantId: input.variantId, quantity: nextQuantity, inventoryReserved: false }, requestId: getRequestId() });
    return hydrateCart(userId, cart, tx);
  });
}

async function ownedCartItem(tx: any, userId: number, itemId: number) {
  const cart = await activeCartForUser(tx, userId);
  if (!cart) throw notFound("Active cart not found.");
  const [item] = await tx.select().from(commerceCartItems).where(and(eq(commerceCartItems.id, itemId), eq(commerceCartItems.cartId, cart.id))).limit(1);
  if (!item) throw notFound("Cart item not found.");
  return { cart, item };
}

export async function setItemQuantity(userId: number, itemId: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < CART_MIN_LINE_QUANTITY || quantity > CART_MAX_LINE_QUANTITY) throw validationError(`Quantity must be between ${CART_MIN_LINE_QUANTITY} and ${CART_MAX_LINE_QUANTITY}.`);
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId); const { cart, item } = await ownedCartItem(tx, userId, itemId);
    await tx.update(commerceCartItems).set({ quantity, updatedAt: new Date() }).where(eq(commerceCartItems.id, item.id));
    await tx.update(commerceCarts).set({ updatedAt: new Date() }).where(eq(commerceCarts.id, cart.id));
    await writeAuditEvent(tx, { actorUserId: userId, action: "commerce.cart_item.quantity_set", entityType: "commerce_cart_item", entityId: String(item.id), beforeState: { quantity: item.quantity }, afterState: { quantity }, requestId: getRequestId() });
    return hydrateCart(userId, cart, tx);
  });
}

export async function increaseItem(userId: number, itemId: number, quantity = 1) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId); const { cart, item } = await ownedCartItem(tx, userId, itemId); const next = item.quantity + quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || next > CART_MAX_LINE_QUANTITY) throw validationError(`A cart line cannot exceed ${CART_MAX_LINE_QUANTITY} units.`);
    await tx.update(commerceCartItems).set({ quantity: next, updatedAt: new Date() }).where(eq(commerceCartItems.id, item.id));
    await tx.update(commerceCarts).set({ updatedAt: new Date() }).where(eq(commerceCarts.id, cart.id));
    return hydrateCart(userId, cart, tx);
  });
}

export async function decreaseItem(userId: number, itemId: number, quantity = 1) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId); const { cart, item } = await ownedCartItem(tx, userId, itemId); const next = item.quantity - quantity;
    if (!Number.isInteger(quantity) || quantity < 1) throw validationError("Quantity must be a positive integer.");
    if (next <= 0) { await tx.delete(commerceCartItems).where(eq(commerceCartItems.id, item.id)); }
    else await tx.update(commerceCartItems).set({ quantity: next, updatedAt: new Date() }).where(eq(commerceCartItems.id, item.id));
    await tx.update(commerceCarts).set({ updatedAt: new Date() }).where(eq(commerceCarts.id, cart.id));
    return hydrateCart(userId, cart, tx);
  });
}

export async function removeItem(userId: number, itemId: number) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId); const { cart, item } = await ownedCartItem(tx, userId, itemId);
    await tx.delete(commerceCartItems).where(eq(commerceCartItems.id, item.id));
    await tx.update(commerceCarts).set({ updatedAt: new Date() }).where(eq(commerceCarts.id, cart.id));
    await writeAuditEvent(tx, { actorUserId: userId, action: "commerce.cart_item.removed", entityType: "commerce_cart_item", entityId: String(item.id), beforeState: item, requestId: getRequestId() });
    return hydrateCart(userId, cart, tx);
  });
}

export async function clearCart(userId: number) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId); const cart = await activeCartForUser(tx, userId); if (!cart) return getCart(userId);
    await tx.delete(commerceCartItems).where(eq(commerceCartItems.cartId, cart.id));
    await tx.update(commerceCarts).set({ updatedAt: new Date() }).where(eq(commerceCarts.id, cart.id));
    await writeAuditEvent(tx, { actorUserId: userId, action: "commerce.cart.cleared", entityType: "commerce_cart", entityId: String(cart.id), requestId: getRequestId() });
    return hydrateCart(userId, cart, tx);
  });
}

export async function validateCart(userId: number) {
  return getCart(userId);
}

export async function finalizePurchasedCartLines(tx: any, cartId: number, variantIds: number[], userId: number) {
  if (!variantIds.length) return { removed: 0, cartConverted: false };
  const result = await tx.delete(commerceCartItems).where(and(eq(commerceCartItems.cartId, cartId), inArray(commerceCartItems.variantId, variantIds)));
  const removed = Number((result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0);
  const remaining = await tx.select({ id: commerceCartItems.id }).from(commerceCartItems).where(eq(commerceCartItems.cartId, cartId)).limit(1);
  const cartConverted = remaining.length === 0;
  if (cartConverted) await tx.update(commerceCarts).set({ status: "converted", activeKey: null, updatedAt: new Date() }).where(and(eq(commerceCarts.id, cartId), eq(commerceCarts.status, "active")));
  else await tx.update(commerceCarts).set({ updatedAt: new Date() }).where(eq(commerceCarts.id, cartId));
  await writeAuditEvent(tx, { actorUserId: userId, action: "commerce.cart.finalized_for_order", entityType: "commerce_cart", entityId: String(cartId), afterState: { purchasedVariantIds: variantIds, removed, cartConverted }, requestId: getRequestId() });
  return { removed, cartConverted };
}

export async function findVariantForCart(userId: number, variantId: number) {
  const db = await database();
  const row = await existingVariant(db, variantId);
  if (!row) throw notFound("Product variant not found.");
  return { visible: row.variant.status === "active" && row.product.status === PUBLIC_PRODUCT_STATUS && row.product.moderationStatus === "approved" && row.seller.status === PUBLIC_SELLER_STATUS && row.seller.verificationStatus === "approved", variant: row.variant, product: row.product, seller: row.seller };
}
