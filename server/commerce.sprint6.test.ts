import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { catalogCategories, catalogProductVariants, catalogProducts, commerceCartItems, commerceCarts, commerceWishlistItems, inventoryReservations, sellers, users } from "../drizzle/schema";

const integration = process.env.DATABASE_URL ? describe : describe.skip;

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Fixture = { user: any; sellerId: number; categoryId: number; productId: number; variantId: number };

function insertId(result: unknown) {
  return Number((result as { insertId?: number }).insertId ?? ((result as Array<{ insertId?: number }>)[0]?.insertId ?? 0));
}

function context(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

async function makeFixture(db: Db, suffix: string, userId?: number): Promise<Fixture> {
  const now = Date.now();
  const [userResult] = userId ? [{ insertId: userId }] : [await db.insert(users).values({ openId: `commerce-sprint6-${suffix}-${now}`, name: `Cart Test ${suffix}`, email: `commerce-${suffix}-${now}@example.com`, role: "user" })];
  const createdUserId = userId ?? insertId(userResult);
  const sellerResult = await db.insert(sellers).values({ legalBusinessName: `Cart Seller ${suffix} ${now}`, storeName: `Cart Seller ${suffix}`, storeSlug: `cart-seller-${suffix}-${now}`, businessDescription: "Sprint 6 fixture", businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Test address", businessPhone: "+254700000001", businessEmail: `seller-${suffix}-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
  const sellerId = insertId(sellerResult);
  const categoryResult = await db.insert(catalogCategories).values({ name: `Cart Category ${suffix} ${now}`, slug: `cart-category-${suffix}-${now}`, description: "Sprint 6 fixture", status: "active" });
  const categoryId = insertId(categoryResult);
  const productResult = await db.insert(catalogProducts).values({ sellerId, categoryId, name: `Cart Product ${suffix} ${now}`, slug: `cart-product-${suffix}-${now}`, shortDescription: "Sprint 6 fixture", status: "published", moderationStatus: "approved", publishedAt: new Date() });
  const productId = insertId(productResult);
  const variantResult = await db.insert(catalogProductVariants).values({ productId, sku: `CART-${suffix}-${now}`, name: "Default", priceMinor: 125000, currency: "KES", status: "active" });
  const variantId = insertId(variantResult);
  return { user: { id: createdUserId, openId: `commerce-sprint6-${suffix}-${now}`, name: `Cart Test ${suffix}`, email: `commerce-${suffix}-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, sellerId, categoryId, productId, variantId };
}

integration("commerce Sprint 6", () => {
  let db: Db;
  let fixture: Fixture;
  let second: Fixture;

  beforeAll(async () => {
    db = (await getDb())!;
    fixture = await makeFixture(db, "one");
    second = await makeFixture(db, "two", fixture.user.id);
  });

  afterAll(async () => {
    if (!db || !fixture) return;
    const userIds = [fixture.user.id];
    await db.delete(commerceWishlistItems).where(eq(commerceWishlistItems.userId, fixture.user.id));
    const carts = await db.select({ id: commerceCarts.id }).from(commerceCarts).where(eq(commerceCarts.userId, fixture.user.id));
    for (const cart of carts) await db.delete(commerceCartItems).where(eq(commerceCartItems.cartId, cart.id));
    await db.delete(commerceCarts).where(eq(commerceCarts.userId, fixture.user.id));
    await db.delete(inventoryReservations).where(and(eq(inventoryReservations.variantId, fixture.variantId), eq(inventoryReservations.referenceType, "commerce-test")));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, fixture.variantId));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, second.variantId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, fixture.productId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, second.productId));
    await db.delete(catalogCategories).where(eq(catalogCategories.id, fixture.categoryId));
    await db.delete(catalogCategories).where(eq(catalogCategories.id, second.categoryId));
    await db.delete(sellers).where(eq(sellers.id, fixture.sellerId));
    await db.delete(sellers).where(eq(sellers.id, second.sellerId));
    await db.delete(users).where(eq(users.id, fixture.user.id));
    void userIds;
  });

  it("requires authentication for cart and wishlist reads", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.commerce.cart.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.commerce.wishlist.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("persists one active cart and supports multiple sellers without reserving inventory", async () => {
    const caller = appRouter.createCaller(context(fixture.user));
    const first = await caller.commerce.cart.get();
    const added = await caller.commerce.cart.addItem({ variantId: fixture.variantId, quantity: 2 });
    const secondAdded = await caller.commerce.cart.addItem({ variantId: second.variantId, quantity: 1 });
    const again = await caller.commerce.cart.get();
    expect(first.cart.status).toBe("active");
    expect(added.items).toHaveLength(1);
    expect(secondAdded.items).toHaveLength(2);
    expect(again.cart.id).toBe(first.cart.id);
    expect(again.itemCount).toBe(3);
    expect(again.subtotal).toEqual({ amountMinor: 375000, currency: "KES" });
    const reservations = await db.select().from(inventoryReservations).where(eq(inventoryReservations.variantId, fixture.variantId));
    expect(reservations).toHaveLength(0);
  });

  it("revalidates live price and seller status without deleting the cart line", async () => {
    const caller = appRouter.createCaller(context(fixture.user));
    await db.update(catalogProductVariants).set({ priceMinor: 150000 }).where(eq(catalogProductVariants.id, fixture.variantId));
    const priceChanged = await caller.commerce.cart.validate({});
    const line = priceChanged.items.find((item) => item.variantId === fixture.variantId)!;
    expect(line.priceChanged).toBe(true);
    expect(line.currentPriceMinor).toBe(150000);
    expect(line.issues).toContain("Price changed");
    await db.update(sellers).set({ status: "suspended" }).where(eq(sellers.id, fixture.sellerId));
    const sellerUnavailable = await caller.commerce.cart.validate({});
    const unavailableLine = sellerUnavailable.items.find((item) => item.variantId === fixture.variantId)!;
    expect(unavailableLine.purchasable).toBe(false);
    expect(unavailableLine.issues).toContain("Seller unavailable");
    expect(sellerUnavailable.items.some((item) => item.variantId === fixture.variantId)).toBe(true);
    await db.update(sellers).set({ status: "approved" }).where(eq(sellers.id, fixture.sellerId));
  });

  it("supports wishlist persistence, duplicate prevention, and visibility state", async () => {
    const caller = appRouter.createCaller(context(fixture.user));
    const added = await caller.commerce.wishlist.addItem({ variantId: fixture.variantId });
    const duplicate = await caller.commerce.wishlist.addItem({ variantId: fixture.variantId });
    expect(added).toHaveLength(1);
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0]?.visible).toBe(true);
    await db.update(catalogProducts).set({ status: "suspended" }).where(eq(catalogProducts.id, fixture.productId));
    const unavailable = await caller.commerce.wishlist.get();
    expect(unavailable[0]?.visible).toBe(false);
    expect(unavailable[0]?.issue).toContain("no longer available");
    await caller.commerce.wishlist.removeItem({ variantId: fixture.variantId });
    expect(await caller.commerce.wishlist.get()).toHaveLength(0);
    await db.update(catalogProducts).set({ status: "published" }).where(eq(catalogProducts.id, fixture.productId));
  });

  it("prevents a customer from manipulating another customer's cart item", async () => {
    const caller = appRouter.createCaller(context(fixture.user));
    const other = await makeFixture(db, "three");
    const otherCaller = appRouter.createCaller(context(other.user));
    const otherCart = await otherCaller.commerce.cart.addItem({ variantId: other.variantId, quantity: 1 });
    const itemId = otherCart.items[0]!.id;
    await expect(caller.commerce.cart.removeItem({ itemId })).rejects.toThrow("Cart item not found.");
    await db.delete(commerceCartItems).where(eq(commerceCartItems.id, itemId));
    await db.delete(commerceCarts).where(eq(commerceCarts.userId, other.user.id));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, other.variantId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, other.productId));
    await db.delete(catalogCategories).where(eq(catalogCategories.id, other.categoryId));
    await db.delete(sellers).where(eq(sellers.id, other.sellerId));
    await db.delete(users).where(eq(users.id, other.user.id));
  });
});
