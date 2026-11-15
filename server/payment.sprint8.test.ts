import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { catalogCategories, catalogProductVariants, catalogProducts, checkoutSessions, commerceCartItems, commerceCarts, customerAddresses, customerPhones, inventoryBalances, inventoryLocations, inventoryMovements, inventoryReservations, orderAddressSnapshots, orderItems, orderReservationLinks, orderSellerOrders, orders, paymentAttempts, paymentCallbackEvents, paymentReservations, sellers, users } from "../drizzle/schema";
import { expirePaymentAttempt, processMpesaCallback } from "./domains/payment/service";
import { uniqueTestPhone } from "./testFixtures";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
function insertId(result: unknown) { return Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0); }
function context(user: any): TrpcContext { return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

integration("payments Sprint 8", () => {
  let db: Db;
  let user: any;
  let otherUser: any;
  let sellerId: number;
  let categoryId: number;
  let productId: number;
  let variantId: number;
  let locationId: number;
  let addressId: number;
  let testPhone: string;
  const paymentIds: number[] = [];

  beforeAll(async () => {
    db = (await getDb())!;
    const now = Date.now();
    testPhone = uniqueTestPhone();
    const openId = `payment-sprint8-${now}`;
    const otherOpenId = `payment-sprint8-other-${now}`;
    const userResult = await db.insert(users).values({ openId, name: "Payment Customer", email: `payment-${now}@example.com`, role: "user" });
    const otherResult = await db.insert(users).values({ openId: otherOpenId, name: "Payment Other", email: `payment-other-${now}@example.com`, role: "user" });
    user = { id: insertId(userResult), openId, name: "Payment Customer", email: `payment-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    otherUser = { id: insertId(otherResult), openId: otherOpenId, name: "Payment Other", email: `payment-other-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    await db.insert(customerPhones).values({ userId: user.id, normalizedPhone: testPhone, displayPhone: testPhone, countryCode: "KE", verifiedAt: new Date() });
    const sellerResult = await db.insert(sellers).values({ legalBusinessName: `Payment Seller ${now}`, storeName: `Payment Seller ${now}`, storeSlug: `payment-seller-${now}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Test address", businessPhone: "+254700000008", businessEmail: `payment-seller-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    sellerId = insertId(sellerResult);
    const categoryResult = await db.insert(catalogCategories).values({ name: `Payment Category ${now}`, slug: `payment-category-${now}`, status: "active" });
    categoryId = insertId(categoryResult);
    const productResult = await db.insert(catalogProducts).values({ sellerId, categoryId, name: `Payment Product ${now}`, slug: `payment-product-${now}`, status: "published", moderationStatus: "approved", publishedAt: new Date() });
    productId = insertId(productResult);
    const variantResult = await db.insert(catalogProductVariants).values({ productId, sku: `PAY-${now}`, name: "Default", priceMinor: 125000, currency: "KES", status: "active" });
    variantId = insertId(variantResult);
    const locationResult = await db.insert(inventoryLocations).values({ sellerId, name: "Payment Warehouse", type: "warehouse", country: "Kenya", county: "Nairobi", city: "Nairobi", status: "active" });
    locationId = insertId(locationResult);
    await db.insert(inventoryBalances).values({ sellerId, variantId, locationId, onHand: 10, reserved: 0, damaged: 0, status: "active" });
    const addressResult = await db.insert(customerAddresses).values({ userId: user.id, recipientName: "Payment Customer", recipientPhone: testPhone, label: "home", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Kilimani", isDefault: 1, status: "active" });
    addressId = insertId(addressResult);
  });

  async function createReadyCheckout() {
    const caller = appRouter.createCaller(context(user));
    const cart = await caller.commerce.cart.addItem({ variantId, quantity: 1 });
    return caller.commerce.checkout.create({ addressId, shippingMethod: "standard", idempotencyKey: `payment-checkout-${Date.now()}-${Math.random()}` });
  }

  afterAll(async () => {
    if (!db) return;
    if (paymentIds.length) {
      const links = await db.select({ reservationId: paymentReservations.inventoryReservationId }).from(paymentReservations).where(inArray(paymentReservations.paymentAttemptId, paymentIds));
      const createdOrders = await db.select({ id: orders.id }).from(orders).where(inArray(orders.paymentAttemptId, paymentIds));
      for (const order of createdOrders) {
        const sellerRows = await db.select({ id: orderSellerOrders.id }).from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, order.id));
        await db.delete(orderReservationLinks).where(eq(orderReservationLinks.orderId, order.id));
        if (sellerRows.length) await db.delete(orderItems).where(inArray(orderItems.sellerOrderId, sellerRows.map((row) => row.id)));
        await db.delete(orderAddressSnapshots).where(eq(orderAddressSnapshots.orderId, order.id));
        await db.delete(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, order.id));
        await db.delete(orders).where(eq(orders.id, order.id));
      }
      await db.delete(paymentAttempts).where(inArray(paymentAttempts.id, paymentIds));
      if (links.length) await db.delete(inventoryReservations).where(inArray(inventoryReservations.id, links.map((row) => row.reservationId)));
      await db.delete(paymentCallbackEvents).where(inArray(paymentCallbackEvents.paymentAttemptId, paymentIds));
    }
    const carts = await db.select({ id: commerceCarts.id }).from(commerceCarts).where(eq(commerceCarts.userId, user.id));
    for (const cart of carts) await db.delete(commerceCartItems).where(eq(commerceCartItems.cartId, cart.id));
    await db.delete(checkoutSessions).where(eq(checkoutSessions.userId, user.id));
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
    await db.delete(sellers).where(eq(sellers.id, sellerId));
    await db.delete(users).where(eq(users.id, user.id));
    await db.delete(users).where(eq(users.id, otherUser.id));
  });

  it("creates a pending M-Pesa attempt from the server checkout total and holds inventory", async () => {
    const caller = appRouter.createCaller(context(user));
    const checkout = await createReadyCheckout();
    expect(checkout.session.status).toBe("ready_for_payment");
    const result = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: `pay-${Date.now()}` });
    paymentIds.push(result.payment.id);
    expect(result.payment.status).toBe("pending");
    expect(result.payment.amountMinor).toBe(checkout.session.totalMinor);
    expect(result.payment.phone).toContain("****");
    const [balance] = await db.select().from(inventoryBalances).where(and(eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.locationId, locationId)));
    expect(balance).toBeTruthy();
    const reservations = await db.select().from(paymentReservations).where(eq(paymentReservations.paymentAttemptId, result.payment.id));
    expect(reservations.length).toBe(1);
  });

  it("enforces ownership, idempotency, callback amount validation, and duplicate callback safety", async () => {
    const caller = appRouter.createCaller(context(user));
    const checkout = await createReadyCheckout();
    const key = `pay-idempotent-${Date.now()}`;
    const first = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: key });
    paymentIds.push(first.payment.id);
    const second = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: key });
    expect(second.payment.id).toBe(first.payment.id);
    await expect(appRouter.createCaller(context(otherUser)).commerce.payment.get({ paymentId: first.payment.id })).rejects.toThrow("Payment attempt not found.");
    const providerReference = first.payment.providerReference!;
    await expect(processMpesaCallback({ Body: { stkCallback: { CheckoutRequestID: providerReference, ResultCode: 0, CallbackMetadata: { Item: [{ Name: "Amount", Value: 1 }] } } } })).rejects.toThrow("amount");
    const successPayload = { Body: { stkCallback: { CheckoutRequestID: providerReference, ResultCode: 0, CallbackMetadata: { Item: [{ Name: "Amount", Value: first.payment.amountMinor / 100 }, { Name: "MpesaReceiptNumber", Value: "RCP123" }] } } } };
    const applied = await processMpesaCallback(successPayload);
    expect(applied.ignored).toBe(false);
    const duplicate = await processMpesaCallback(successPayload);
    expect(duplicate.ignored).toBe(true);
    const status = await caller.commerce.payment.get({ paymentId: first.payment.id });
    expect(status.payment.status).toBe("successful");
    await expect(caller.commerce.payment.cancel({ paymentId: first.payment.id })).rejects.toThrow("cannot transition");
  });

  it("keeps failed attempts auditable and releases their inventory hold for retry", async () => {
    const caller = appRouter.createCaller(context(user));
    const checkout = await createReadyCheckout();
    const first = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: `pay-fail-${Date.now()}` });
    paymentIds.push(first.payment.id);
    await processMpesaCallback({ Body: { stkCallback: { CheckoutRequestID: first.payment.providerReference, ResultCode: 1032, ResultDesc: "Request cancelled by customer" } } });
    const failed = await caller.commerce.payment.get({ paymentId: first.payment.id });
    expect(failed.payment.status).toBe("cancelled");
    expect(failed.reservations[0].status).toBe("released");
    const retry = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: `pay-retry-${Date.now()}` });
    paymentIds.push(retry.payment.id);
    expect(retry.payment.id).not.toBe(first.payment.id);
  });

  it("expires a pending attempt server-side and releases its hold", async () => {
    const caller = appRouter.createCaller(context(user));
    const checkout = await createReadyCheckout();
    const attempt = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: `pay-expire-${Date.now()}` });
    paymentIds.push(attempt.payment.id);
    await db.update(paymentAttempts).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(paymentAttempts.id, attempt.payment.id));
    await expirePaymentAttempt(attempt.payment.id);
    const expired = await caller.commerce.payment.get({ paymentId: attempt.payment.id });
    expect(expired.payment.status).toBe("expired");
    expect(expired.reservations[0].status).toBe("released");
  });
});
