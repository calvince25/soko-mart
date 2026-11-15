import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { catalogCategories, catalogProductVariants, catalogProducts, checkoutSessions, commerceCartItems, commerceCarts, customerAddresses, customerPhones, inventoryBalances, inventoryLocations, inventoryMovements, inventoryReservations, orderItems, orderReservationLinks, orderSellerOrders, orders, paymentAttempts, paymentCallbackEvents, paymentReservations, sellerMembers, sellerOrderFulfilmentEvents, sellerOrderFulfilmentNotes, sellers, users } from "../drizzle/schema";
import { processMpesaCallback } from "./domains/payment/service";
import { uniqueTestPhone } from "./testFixtures";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
function insertId(result: unknown) { return Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0); }
function context(user: any, permissions = ["order.read_own", "seller.order.read_own", "seller.order.fulfill_own", "order.manage_any"]): TrpcContext { return { user, permissions: new Set(permissions), req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

integration("fulfilment Sprint 10", { timeout: 30000 }, () => {
  let db: Db;
  let sellerUser: any;
  let otherUser: any;
  let sellerId: number;
  let secondarySellerId: number;
  let categoryId: number;
  let productId: number;
  let variantId: number;
  let locationId: number;
  let addressId: number;
  let memberId: number;
  let testPhone: string;
  const paymentIds: number[] = [];
  const checkoutIds: number[] = [];
  const orderIds: number[] = [];

  beforeAll(async () => {
    db = (await getDb())!;
    const now = Date.now();
    testPhone = uniqueTestPhone();
    const openId = `fulfilment-sprint10-${now}`;
    const otherOpenId = `fulfilment-sprint10-other-${now}`;
    const userResult = await db.insert(users).values({ openId, name: "Fulfilment Seller", email: `fulfilment-${now}@example.com`, role: "user" });
    const otherResult = await db.insert(users).values({ openId: otherOpenId, name: "Other Customer", email: `fulfilment-other-${now}@example.com`, role: "user" });
    sellerUser = { id: insertId(userResult), openId, name: "Fulfilment Seller", email: `fulfilment-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    otherUser = { id: insertId(otherResult), openId: otherOpenId, name: "Other Customer", email: `fulfilment-other-${now}@example.com`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    await db.insert(customerPhones).values({ userId: sellerUser.id, normalizedPhone: testPhone, displayPhone: testPhone, countryCode: "KE", verifiedAt: new Date() });
    const sellerResult = await db.insert(sellers).values({ legalBusinessName: `Fulfilment Seller ${now}`, storeName: `Fulfilment Seller ${now}`, storeSlug: `fulfilment-seller-${now}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Test address", businessPhone: "+254700000008", businessEmail: `fulfilment-seller-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    sellerId = insertId(sellerResult);
    const secondarySellerResult = await db.insert(sellers).values({ legalBusinessName: `Fulfilment Secondary ${now}`, storeName: `Fulfilment Secondary ${now}`, storeSlug: `fulfilment-secondary-${now}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Secondary address", businessPhone: "+254700000007", businessEmail: `fulfilment-secondary-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    secondarySellerId = insertId(secondarySellerResult);
    const memberResult = await db.insert(sellerMembers).values({ sellerId, userId: sellerUser.id, memberRole: "owner", status: "active" });
    memberId = insertId(memberResult);
    const categoryResult = await db.insert(catalogCategories).values({ name: `Fulfilment Category ${now}`, slug: `fulfilment-category-${now}`, status: "active" });
    categoryId = insertId(categoryResult);
    const productResult = await db.insert(catalogProducts).values({ sellerId, categoryId, name: `Fulfilment Product ${now}`, slug: `fulfilment-product-${now}`, status: "published", moderationStatus: "approved", publishedAt: new Date() });
    productId = insertId(productResult);
    const variantResult = await db.insert(catalogProductVariants).values({ productId, sku: `FUL-${now}`, name: "Default", priceMinor: 125000, currency: "KES", status: "active" });
    variantId = insertId(variantResult);
    const locationResult = await db.insert(inventoryLocations).values({ sellerId, name: "Fulfilment Warehouse", type: "warehouse", country: "Kenya", county: "Nairobi", city: "Nairobi", status: "active" });
    locationId = insertId(locationResult);
    await db.insert(inventoryBalances).values({ sellerId, variantId, locationId, onHand: 20, reserved: 0, damaged: 0, status: "active" });
    const addressResult = await db.insert(customerAddresses).values({ userId: sellerUser.id, recipientName: "Fulfilment Customer", recipientPhone: testPhone, label: "home", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Kilimani", estateBuilding: "Test Estate", streetRoad: "Test Road", directions: "Near the market", isDefault: 1, status: "active" });
    addressId = insertId(addressResult);
  });

  async function createPaidOrder() {
    const caller = appRouter.createCaller(context(sellerUser));
    await caller.commerce.cart.addItem({ variantId, quantity: 1 });
    const checkout = await caller.commerce.checkout.create({ addressId, shippingMethod: "standard", idempotencyKey: `fulfilment-checkout-${Date.now()}-${Math.random()}` });
    checkoutIds.push(checkout.session.id);
    const payment = await caller.commerce.payment.initiate({ checkoutSessionId: checkout.session.id, provider: "mpesa", phone: testPhone, idempotencyKey: `fulfilment-payment-${Date.now()}-${Math.random()}` });
    paymentIds.push(payment.payment.id);
    const applied = await processMpesaCallback({ Body: { stkCallback: { CheckoutRequestID: payment.payment.providerReference, ResultCode: 0, CallbackMetadata: { Item: [{ Name: "Amount", Value: payment.payment.amountMinor / 100 }, { Name: "MpesaReceiptNumber", Value: `FUL${payment.payment.id}` }] } } } });
    const orderId = applied.order!.order.id;
    orderIds.push(orderId);
    const [sellerOrder] = await db.select().from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId));
    return { orderId, sellerOrderId: sellerOrder.id };
  }

  afterAll(async () => {
    if (!db) return;
    for (const orderId of orderIds) {
      const sellerOrderRows = await db.select({ id: orderSellerOrders.id }).from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId));
      const sellerOrderIds = sellerOrderRows.map((row) => row.id);
      if (sellerOrderIds.length) {
        await db.delete(orderReservationLinks).where(inArray(orderReservationLinks.sellerOrderId, sellerOrderIds));
        await db.delete(orderItems).where(inArray(orderItems.sellerOrderId, sellerOrderIds));
      }
      await db.delete(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
    for (const paymentId of paymentIds) {
      await db.delete(paymentCallbackEvents).where(eq(paymentCallbackEvents.paymentAttemptId, paymentId));
      await db.delete(paymentAttempts).where(eq(paymentAttempts.id, paymentId));
    }
    for (const checkoutId of checkoutIds) await db.delete(checkoutSessions).where(eq(checkoutSessions.id, checkoutId));
    const carts = await db.select({ id: commerceCarts.id }).from(commerceCarts).where(eq(commerceCarts.userId, sellerUser.id));
    for (const cart of carts) await db.delete(commerceCartItems).where(eq(commerceCartItems.cartId, cart.id));
    await db.delete(commerceCarts).where(eq(commerceCarts.userId, sellerUser.id));
    await db.delete(customerAddresses).where(eq(customerAddresses.userId, sellerUser.id));
    await db.delete(customerPhones).where(eq(customerPhones.userId, sellerUser.id));
    await db.delete(inventoryMovements).where(eq(inventoryMovements.locationId, locationId));
    await db.delete(inventoryReservations).where(eq(inventoryReservations.locationId, locationId));
    await db.delete(inventoryBalances).where(and(eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.locationId, locationId)));
    await db.delete(inventoryLocations).where(eq(inventoryLocations.id, locationId));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, variantId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, productId));
    await db.delete(catalogCategories).where(eq(catalogCategories.id, categoryId));
    await db.delete(sellerMembers).where(eq(sellerMembers.id, memberId));
    await db.delete(sellers).where(eq(sellers.id, sellerId));
    await db.delete(sellers).where(eq(sellers.id, secondarySellerId));
    await db.delete(users).where(inArray(users.id, [sellerUser.id, otherUser.id]));
  });

  it("enforces the lifecycle, creates immutable history, and is idempotent", async () => {
    const { sellerOrderId } = await createPaidOrder();
    const caller = appRouter.createCaller(context(sellerUser));
    await caller.commerce.order.sellerAccept({ sellerOrderId });
    const duplicate = await caller.commerce.order.sellerAccept({ sellerOrderId });
    expect(duplicate.sellerOrder.fulfilmentState).toBe("accepted");
    await expect(caller.commerce.order.sellerHandToLogistics({ sellerOrderId })).rejects.toThrow("cannot transition");
    await caller.commerce.order.sellerStartProcessing({ sellerOrderId });
    const before = await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
    await Promise.all([caller.commerce.order.sellerMarkPacked({ sellerOrderId }), caller.commerce.order.sellerMarkPacked({ sellerOrderId })]);
    await caller.commerce.order.sellerReadyForHandoff({ sellerOrderId });
    const final = await caller.commerce.order.sellerHandToLogistics({ sellerOrderId });
    expect(final.sellerOrder.fulfilmentState).toBe("handed_to_logistics");
    const after = await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
    expect(after.length).toBe(before.length);
    const events = await db.select().from(sellerOrderFulfilmentEvents).where(eq(sellerOrderFulfilmentEvents.sellerOrderId, sellerOrderId)).orderBy(sellerOrderFulfilmentEvents.id);
    expect(events.map((event) => event.newState)).toEqual(["pending", "accepted", "processing", "packed", "ready_for_handoff", "handed_to_logistics"]);
    expect(events.filter((event) => event.newState === "packed")).toHaveLength(1);
    const [parent] = await db.select().from(orders).where(eq(orders.id, final.sellerOrder.parentOrderId));
    expect(parent.fulfilmentStatus).toBe("handed_to_logistics");
  });

  it("keeps seller ownership and internal notes server-side", async () => {
    const { sellerOrderId } = await createPaidOrder();
    const sellerCaller = appRouter.createCaller(context(sellerUser));
    const otherCaller = appRouter.createCaller(context(otherUser));
    await sellerCaller.commerce.order.sellerAddFulfilmentNote({ sellerOrderId, note: "Packed in protective wrap" });
    const detail = await sellerCaller.commerce.order.sellerGet({ sellerOrderId });
    expect(detail.notes[0].note).toBe("Packed in protective wrap");
    await expect(otherCaller.commerce.order.sellerGet({ sellerOrderId })).rejects.toThrow("required");
    await expect(otherCaller.commerce.order.sellerAccept({ sellerOrderId })).rejects.toThrow("required");
    expect(await otherCaller.commerce.order.sellerList({ limit: 20, offset: 0 })).toEqual([]);
    const adminList = await sellerCaller.commerce.order.adminFulfilmentList({ limit: 20, offset: 0, fulfilmentState: "pending" });
    expect(adminList.some((row) => row.id === sellerOrderId)).toBe(true);
  });

  it("records seller rejection as a refund-required exception without faking a refund", async () => {
    const { sellerOrderId, orderId } = await createPaidOrder();
    const caller = appRouter.createCaller(context(sellerUser));
    await caller.commerce.order.sellerReject({ sellerOrderId, reason: "Product issue discovered during packing" });
    const detail = await caller.commerce.order.sellerGet({ sellerOrderId });
    expect(detail.sellerOrder.fulfilmentState).toBe("rejected");
    expect(detail.sellerOrder.refundRequired).toBe(1);
    const [parent] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(parent.fulfilmentStatus).toBe("exception");
    const [payment] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, paymentIds[paymentIds.length - 1]));
    expect(payment.status).toBe("successful");
    expect((await db.select().from(sellerOrderFulfilmentNotes).where(eq(sellerOrderFulfilmentNotes.sellerOrderId, sellerOrderId)))).toHaveLength(0);
  });

  it("keeps seller states independent and aggregates a mixed parent order", async () => {
    const { orderId, sellerOrderId } = await createPaidOrder();
    await db.insert(orderSellerOrders).values({ parentOrderId: orderId, sellerId: secondarySellerId, sellerName: "Fulfilment Secondary", sellerSlug: "fulfilment-secondary", sellerSubtotalMinor: 0, shippingMinor: 0, taxMinor: 0, feeMinor: 0, totalMinor: 0, status: "confirmed", fulfilmentStatus: "processing", fulfilmentState: "processing" });
    const caller = appRouter.createCaller(context(sellerUser));
    await caller.commerce.order.sellerAccept({ sellerOrderId });
    const [parent] = await db.select().from(orders).where(eq(orders.id, orderId));
    const children = await db.select({ state: orderSellerOrders.fulfilmentState }).from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, orderId));
    expect(children.map((child) => child.state).sort()).toEqual(["accepted", "processing"]);
    expect(parent.fulfilmentStatus).toBe("partially_fulfilled");
  });
});
