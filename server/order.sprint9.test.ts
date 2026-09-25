import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { catalogCategories, catalogProductVariants, catalogProducts, checkoutSessions, commerceCartItems, commerceCarts, customerAddresses, customerPhones, inventoryBalances, inventoryLocations, inventoryMovements, inventoryReservations, orderAddressSnapshots, orderItems, orderReservationLinks, orderSellerOrders, orders, paymentAttempts, paymentCallbackEvents, paymentReservations, sellerMembers, sellers, users } from "../drizzle/schema";
import { processMpesaCallback } from "./domains/payment/service";
import { createOrderFromSuccessfulPayment } from "./domains/order/service";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
function insertId(result: unknown) { return Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0); }
function context(user: any): TrpcContext { return { user, permissions: new Set(["order.read_own", "seller.order.read_own", "seller.order.fulfill_own"]), req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

integration("orders Sprint 9", () => {
  let db: Db;
  let user: any;
  let otherUser: any;
  let sellerId: number;
  let categoryId: number;
  let productId: number;
  let variantId: number;
  let locationId: number;
  let addressId: number;
  let memberId: number;
  let paymentId: number;
  let orderId: number;
  let testPhone: string;
  let checkoutId: number;

  beforeAll(async () => {
    db = (await getDb())!;
    const now = Date.now();
    testPhone = `+2547${String(now).slice(-8)}`;
    const openId = `order-sprint9-${now}`;
    const otherOpenId = `order-sprint9-other-${now}`;
    const userResult = await db.insert(users).values({ openId, name: "Order Customer", email: `order-${now}@example.com`, role: "user" });
    const otherResult = await db.insert(users).values({ openId: otherOpenId, name: "Order Other", email: `order-other-${now}@example.com`, role: "user" });
    user = { id: insertId(userResult), openId, name: "Order Customer", email: `order-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    otherUser = { id: insertId(otherResult), openId: otherOpenId, name: "Order Other", email: `order-other-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    await db.insert(customerPhones).values({ userId: user.id, normalizedPhone: testPhone, displayPhone: testPhone, countryCode: "KE", verifiedAt: new Date() });
    const sellerResult = await db.insert(sellers).values({ legalBusinessName: `Order Seller ${now}`, storeName: `Order Seller ${now}`, storeSlug: `order-seller-${now}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Test address", businessPhone: "+254700000009", businessEmail: `order-seller-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    sellerId = insertId(sellerResult);
    const memberResult = await db.insert(sellerMembers).values({ sellerId, userId: user.id, memberRole: "owner", status: "active" });
    memberId = insertId(memberResult);
    const categoryResult = await db.insert(catalogCategories).values({ name: `Order Category ${now}`, slug: `order-category-${now}`, status: "active" });
    categoryId = insertId(categoryResult);
    const productResult = await db.insert(catalogProducts).values({ sellerId, categoryId, name: `Order Product ${now}`, slug: `order-product-${now}`, status: "published", moderationStatus: "approved", publishedAt: new Date() });
    productId = insertId(productResult);
    const variantResult = await db.insert(catalogProductVariants).values({ productId, sku: `ORD-${now}`, name: "Default", priceMinor: 125000, currency: "KES", status: "active" });
    variantId = insertId(variantResult);
    const locationResult = await db.insert(inventoryLocations).values({ sellerId, name: "Order Warehouse", type: "warehouse", country: "Kenya", county: "Nairobi", city: "Nairobi", status: "active" });
    locationId = insertId(locationResult);
    await db.insert(inventoryBalances).values({ sellerId, variantId, locationId, onHand: 10, reserved: 0, damaged: 0, status: "active" });
    const addressResult = await db.insert(customerAddresses).values({ userId: user.id, recipientName: "Order Customer", recipientPhone: testPhone, label: "home", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Kilimani", estateBuilding: "Test Estate", streetRoad: "Test Road", directions: "Near the market", isDefault: 1, status: "active" });
    addressId = insertId(addressResult);
  });

  async function createReadyPayment() {
    const caller = appRouter.createCaller(context(user));
    await caller.commerce.cart.addItem({ variantId, quantity: 1 });
    const checkout = await caller.commerce.checkout.create({ addressId, shippingMethod: "standard", idempotencyKey: `order-checkout-${Date.now()}-${Math.random()}` });
    checkoutId = checkout.session.id;
    const payment = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: `order-payment-${Date.now()}-${Math.random()}` });
    paymentId = payment.payment.id;
    return payment.payment;
  }

  afterAll(async () => {
    if (!db) return;
    if (orderId) {
      await db.delete(orderReservationLinks).where(eq(orderReservationLinks.orderId, orderId));
      await db.delete(orderItems).where(inArray(orderItems.sellerOrderId, (await db.select({ id: orderSellerOrders.id }).from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId))).map((row) => row.id)));
      await db.delete(orderAddressSnapshots).where(eq(orderAddressSnapshots.orderId, orderId));
      await db.delete(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
    if (paymentId) await db.delete(paymentCallbackEvents).where(eq(paymentCallbackEvents.paymentAttemptId, paymentId));
    if (paymentId) await db.delete(paymentAttempts).where(eq(paymentAttempts.id, paymentId));
    if (checkoutId) await db.delete(checkoutSessions).where(eq(checkoutSessions.id, checkoutId));
    const carts = await db.select({ id: commerceCarts.id }).from(commerceCarts).where(eq(commerceCarts.userId, user.id));
    for (const cart of carts) await db.delete(commerceCartItems).where(eq(commerceCartItems.cartId, cart.id));
    await db.delete(commerceCarts).where(eq(commerceCarts.userId, user.id));
    await db.delete(customerAddresses).where(eq(customerAddresses.userId, user.id));
    await db.delete(customerPhones).where(eq(customerPhones.userId, user.id));
    await db.delete(inventoryMovements).where(eq(inventoryMovements.locationId, locationId));
    await db.delete(inventoryReservations).where(eq(inventoryReservations.locationId, locationId));
    await db.delete(inventoryBalances).where(and(eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.locationId, locationId)));
    await db.delete(inventoryLocations).where(eq(inventoryLocations.id, locationId));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, variantId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, productId));
    await db.delete(catalogCategories).where(eq(catalogCategories.id, categoryId));
    await db.delete(sellerMembers).where(eq(sellerMembers.id, memberId));
    await db.delete(sellers).where(eq(sellers.id, sellerId));
    await db.delete(users).where(inArray(users.id, [user.id, otherUser.id]));
  });

  it("creates one immutable parent order and seller order from a successful payment", async () => {
    const payment = await createReadyPayment();
    const applied = await processMpesaCallback({ Body: { stkCallback: { CheckoutRequestID: payment.providerReference, ResultCode: 0, CallbackMetadata: { Item: [{ Name: "Amount", Value: payment.amountMinor / 100 }, { Name: "MpesaReceiptNumber", Value: "ORDRCP" }] } } } });
    expect(applied.ignored).toBe(false);
    expect(applied.order?.order.orderNumber).toMatch(/^SM-/);
    orderId = applied.order!.order.id;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    const sellerOrders = await db.select().from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId));
    const items = await db.select().from(orderItems).where(eq(orderItems.sellerOrderId, sellerOrders[0].id));
    const [address] = await db.select().from(orderAddressSnapshots).where(eq(orderAddressSnapshots.orderId, orderId));
    expect(order.status).toBe("confirmed");
    expect(order.totalMinor).toBe(payment.amountMinor);
    expect(sellerOrders).toHaveLength(1);
    expect(items[0].productName).toContain("Order Product");
    expect(address.recipientName).toBe("Order Customer");
    expect(address.directions).toBe("Near the market");
  });

  it("converts reservations, decrements stock, finalizes purchased cart lines, and is idempotent", async () => {
    const [paymentReservation] = await db.select().from(paymentReservations).where(eq(paymentReservations.paymentAttemptId, paymentId));
    const [reservation] = await db.select().from(inventoryReservations).where(eq(inventoryReservations.id, paymentReservation.inventoryReservationId));
    expect(reservation.status).toBe("converted");
    const [balance] = await db.select().from(inventoryBalances).where(and(eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.locationId, locationId)));
    expect(balance.onHand).toBe(9);
    expect(balance.reserved).toBe(0);
    const [cart] = await db.select().from(commerceCarts).where(and(eq(commerceCarts.userId, user.id), eq(commerceCarts.status, "converted"))).orderBy(commerceCarts.id);
    expect(cart).toBeTruthy();
    const cartItems = await db.select().from(commerceCartItems).where(eq(commerceCartItems.cartId, cart.id));
    expect(cartItems).toHaveLength(0);
    const duplicate = await processMpesaCallback({ Body: { stkCallback: { CheckoutRequestID: (await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, paymentId)))[0].providerReference, ResultCode: 0, CallbackMetadata: { Item: [{ Name: "Amount", Value: 1250 }, { Name: "MpesaReceiptNumber", Value: "ORDRCP" }] } } } });
    expect(duplicate.ignored).toBe(true);
    expect((await db.select().from(orders).where(eq(orders.paymentAttemptId, paymentId))).length).toBe(1);
  });

  it("protects customer and seller order access by ownership and membership", async () => {
    const caller = appRouter.createCaller(context(user));
    const otherCaller = appRouter.createCaller(context(otherUser));
    const customerOrder = await caller.commerce.order.myGet({ orderId });
    expect(customerOrder.order.id).toBe(orderId);
    await expect(otherCaller.commerce.order.myGet({ orderId })).rejects.toThrow("Order not found.");
    expect(await otherCaller.commerce.order.sellerList({ limit: 20, offset: 0 })).toEqual([]);
    const sellerOrder = await caller.commerce.order.sellerList({ limit: 20, offset: 0 });
    expect(sellerOrder.some((row) => row.parentOrderId === orderId)).toBe(true);
    const details = await caller.commerce.order.sellerGet({ sellerOrderId: sellerOrder[0].id });
    expect(details.parent?.orderNumber).toBe(customerOrder.order.orderNumber);
  });

  it("allows a seller to advance fulfilment status through guarded transitions", async () => {
    const caller = appRouter.createCaller(context(user));
    const [sellerOrder] = await db.select().from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId));
    await caller.commerce.order.sellerUpdateStatus({ sellerOrderId: sellerOrder.id, status: "processing" });
    await caller.commerce.order.sellerUpdateStatus({ sellerOrderId: sellerOrder.id, status: "ready_for_fulfilment" });
    const final = await caller.commerce.order.sellerUpdateStatus({ sellerOrderId: sellerOrder.id, status: "completed" });
    expect(final.sellerOrder.status).toBe("completed");
    await expect(caller.commerce.order.sellerUpdateStatus({ sellerOrderId: sellerOrder.id, status: "processing" })).rejects.toThrow("cannot transition");
  });

  it("never creates a second order when the payment-to-order handoff is retried", async () => {
    const result = await createOrderFromSuccessfulPayment(user.id, paymentId);
    expect(result.order.id).toBe(orderId);
    expect((await db.select().from(orders).where(eq(orders.paymentAttemptId, paymentId))).length).toBe(1);
  });
});
