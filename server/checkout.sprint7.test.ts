import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { catalogCategories, catalogProductVariants, catalogProducts, checkoutSessionGroups, checkoutSessionItems, checkoutSessions, commerceCartItems, commerceCarts, customerAddresses, inventoryBalances, inventoryLocations, sellers, users } from "../drizzle/schema";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function insertId(result: unknown) {
  return Number((result as { insertId?: number }).insertId ?? ((result as Array<{ insertId?: number }>)[0]?.insertId ?? 0));
}

function context(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

integration("checkout Sprint 7", () => {
  let db: Db;
  let user: any;
  let otherUser: any;
  let sellerId: number;
  let secondSellerId: number;
  let categoryId: number;
  let productId: number;
  let secondProductId: number;
  let variantId: number;
  let secondVariantId: number;
  let locationId: number;
  let secondLocationId: number;
  let addressId: number;

  beforeAll(async () => {
    db = (await getDb())!;
    const now = Date.now();
    const userResult = await db.insert(users).values({ openId: `checkout-sprint7-${now}`, name: "Checkout Customer", email: `checkout-${now}@example.com`, role: "user" });
    user = { id: insertId(userResult), openId: `checkout-sprint7-${now}`, name: "Checkout Customer", email: `checkout-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const otherResult = await db.insert(users).values({ openId: `checkout-sprint7-other-${now}`, name: "Other Customer", email: `checkout-other-${now}@example.com`, role: "user" });
    otherUser = { ...user, id: insertId(otherResult), openId: `checkout-sprint7-other-${now}`, email: `checkout-other-${now}@example.com` };
    const sellerResult = await db.insert(sellers).values({ legalBusinessName: `Checkout Seller ${now}`, storeName: `Checkout Seller ${now}`, storeSlug: `checkout-seller-${now}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Test address", businessPhone: "+254700000001", businessEmail: `seller-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    sellerId = insertId(sellerResult);
    const secondSellerResult = await db.insert(sellers).values({ legalBusinessName: `Checkout Seller Two ${now}`, storeName: `Checkout Seller Two ${now}`, storeSlug: `checkout-seller-two-${now}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Test address", businessPhone: "+254700000002", businessEmail: `seller-two-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    secondSellerId = insertId(secondSellerResult);
    const categoryResult = await db.insert(catalogCategories).values({ name: `Checkout Category ${now}`, slug: `checkout-category-${now}`, status: "active" });
    categoryId = insertId(categoryResult);
    const productResult = await db.insert(catalogProducts).values({ sellerId, categoryId, name: `Checkout Product ${now}`, slug: `checkout-product-${now}`, status: "published", moderationStatus: "approved", publishedAt: new Date() });
    productId = insertId(productResult);
    const secondProductResult = await db.insert(catalogProducts).values({ sellerId: secondSellerId, categoryId, name: `Checkout Product Two ${now}`, slug: `checkout-product-two-${now}`, status: "published", moderationStatus: "approved", publishedAt: new Date() });
    secondProductId = insertId(secondProductResult);
    const variantResult = await db.insert(catalogProductVariants).values({ productId, sku: `CHECKOUT-${now}`, name: "Default", priceMinor: 125000, currency: "KES", status: "active" });
    variantId = insertId(variantResult);
    const secondVariantResult = await db.insert(catalogProductVariants).values({ productId: secondProductId, sku: `CHECKOUT-TWO-${now}`, name: "Default", priceMinor: 75000, currency: "KES", status: "active" });
    secondVariantId = insertId(secondVariantResult);
    const locationResult = await db.insert(inventoryLocations).values({ sellerId, name: "Checkout Warehouse", type: "warehouse", country: "Kenya", county: "Nairobi", city: "Nairobi", status: "active" });
    locationId = insertId(locationResult);
    const secondLocationResult = await db.insert(inventoryLocations).values({ sellerId: secondSellerId, name: "Checkout Warehouse Two", type: "warehouse", country: "Kenya", county: "Nairobi", city: "Nairobi", status: "active" });
    secondLocationId = insertId(secondLocationResult);
    await db.insert(inventoryBalances).values([{ sellerId, variantId, locationId, onHand: 20, reserved: 0, damaged: 0, status: "active" }, { sellerId: secondSellerId, variantId: secondVariantId, locationId: secondLocationId, onHand: 20, reserved: 0, damaged: 0, status: "active" }]);
    const addressResult = await db.insert(customerAddresses).values({ userId: user.id, recipientName: "Checkout Customer", recipientPhone: "+254700000003", label: "home", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Westlands", estateBuilding: "Test Estate", apartmentHouse: "A1", streetRoad: "Test Road", directions: "Near the mall", isDefault: 1, status: "active" });
    addressId = insertId(addressResult);
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(checkoutSessions).where(eq(checkoutSessions.userId, user.id));
    const carts = await db.select({ id: commerceCarts.id }).from(commerceCarts).where(eq(commerceCarts.userId, user.id));
    for (const cart of carts) await db.delete(commerceCartItems).where(eq(commerceCartItems.cartId, cart.id));
    await db.delete(commerceCarts).where(eq(commerceCarts.userId, user.id));
    await db.delete(customerAddresses).where(eq(customerAddresses.userId, user.id));
    await db.delete(inventoryBalances).where(and(eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.locationId, locationId)));
    await db.delete(inventoryBalances).where(and(eq(inventoryBalances.variantId, secondVariantId), eq(inventoryBalances.locationId, secondLocationId)));
    await db.delete(inventoryLocations).where(eq(inventoryLocations.id, locationId));
    await db.delete(inventoryLocations).where(eq(inventoryLocations.id, secondLocationId));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, variantId));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, secondVariantId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, productId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, secondProductId));
    await db.delete(catalogCategories).where(eq(catalogCategories.id, categoryId));
    await db.delete(sellers).where(eq(sellers.id, sellerId));
    await db.delete(sellers).where(eq(sellers.id, secondSellerId));
    await db.delete(users).where(eq(users.id, user.id));
    await db.delete(users).where(eq(users.id, otherUser.id));
  });

  it("requires authentication and rejects an empty cart", async () => {
    const anonymous = appRouter.createCaller(context(null));
    await expect(anonymous.commerce.checkout.create({ shippingMethod: "standard" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const caller = appRouter.createCaller(context(user));
    await expect(caller.commerce.checkout.create({ shippingMethod: "standard" })).rejects.toThrow("Your cart is empty.");
  });

  it("creates an immutable, seller-grouped preview with server totals and address snapshot", async () => {
    const caller = appRouter.createCaller(context(user));
    await caller.commerce.cart.addItem({ variantId, quantity: 2 });
    await caller.commerce.cart.addItem({ variantId: secondVariantId, quantity: 1 });
    const pending = await caller.commerce.checkout.create({ shippingMethod: "standard", idempotencyKey: `pending-${Date.now()}` });
    expect(pending.session.status).toBe("validated");
    expect(pending.issues.some((issue) => issue.code === "ADDRESS_REQUIRED")).toBe(true);
    expect(pending.groups).toHaveLength(2);
    expect(pending.items).toHaveLength(2);
    expect(pending.pricing.subtotal).toEqual({ amountMinor: 325000, currency: "KES" });
    const ready = await caller.commerce.checkout.setAddress({ sessionId: pending.session.id, addressId });
    expect(ready.session.status).toBe("ready_for_payment");
    expect(ready.address).toMatchObject({ recipientName: "Checkout Customer", county: "Nairobi", neighborhood: "Westlands" });
    expect(ready.pricing.total).toEqual({ amountMinor: 325000, currency: "KES" });
    await db.update(customerAddresses).set({ neighborhood: "Changed Later" }).where(eq(customerAddresses.id, addressId));
    const reread = await caller.commerce.checkout.get({ sessionId: ready.session.id });
    expect((reread.address as any).neighborhood).toBe("Westlands");
  });

  it("is idempotent and prevents cross-customer session access", async () => {
    const caller = appRouter.createCaller(context(user));
    const key = `same-${Date.now()}`;
    const first = await caller.commerce.checkout.create({ addressId, shippingMethod: "standard", idempotencyKey: key });
    const second = await caller.commerce.checkout.create({ addressId, shippingMethod: "standard", idempotencyKey: key });
    expect(second.session.id).toBe(first.session.id);
    const otherCaller = appRouter.createCaller(context(otherUser));
    await expect(otherCaller.commerce.checkout.get({ sessionId: first.session.id })).rejects.toThrow("Checkout session not found.");
    const rows = await db.select().from(checkoutSessionItems).where(eq(checkoutSessionItems.sessionId, first.session.id));
    expect(rows.length).toBeGreaterThan(0);
    const groups = await db.select().from(checkoutSessionGroups).where(eq(checkoutSessionGroups.sessionId, first.session.id));
    expect(groups.length).toBeGreaterThan(0);
  });
});
