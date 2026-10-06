import { and, desc, eq, gte, inArray, like, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  checkoutSessionGroups,
  checkoutSessionItems,
  checkoutSessions,
  commerceCartItems,
  customerAddresses,
  inventoryReservations,
  orderAddressSnapshots,
  orderItems,
  orderReservationLinks,
  orderSellerOrders,
  orders,
  paymentAttempts,
  paymentReservations,
  sellers,
  sellerMembers,
  sellerOrderFulfilmentEvents,
  sellerOrderFulfilmentNotes,
} from "../../../drizzle/schema";
import { conflict, forbidden, invalidState, notFound } from "../../../shared/errors/appError";
import { recordAuditEvent, writeAuditEvent } from "../../audit/audit";
import { getDb } from "../../db";
import { getRequestId } from "../../logging/requestContext";
import { withTransaction } from "../../transactions/database";
import { toAddressSnapshot } from "../account/service";
import { convertReservationForOrder } from "../inventory/service";
import { finalizePurchasedCartLines } from "../commerce/cart/service";
import { emitOrderCreated } from "./events";
import { recognizeOrderPayment } from "../finance/service";
import type { AdminOrderSearchInput } from "../../../shared/validation/orderSchemas";
import type { FulfilmentState } from "../../../shared/validation/orderSchemas";

function insertId(result: unknown) { return Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0); }
async function database() { const db = await getDb(); if (!db) throw invalidState("Order services are temporarily unavailable."); return db; }
function orderNumber() { return `SM-${new Date().getUTCFullYear()}-${nanoid(10).toUpperCase()}`; }
function sum(values: number[]) { return values.reduce((total, value) => total + Number(value), 0); }

async function hydrateOrder(db: any, order: any) {
  const [sellerOrders, address] = await Promise.all([
    db.select().from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, order.id)).orderBy(orderSellerOrders.id),
    db.select().from(orderAddressSnapshots).where(eq(orderAddressSnapshots.orderId, order.id)).limit(1),
  ]);
  const items = sellerOrders.length ? await db.select().from(orderItems).where(inArray(orderItems.sellerOrderId, sellerOrders.map((row: any) => row.id))).orderBy(orderItems.id) : [];
  const [payment] = await db.select({ id: paymentAttempts.id, provider: paymentAttempts.provider, providerReference: paymentAttempts.providerReference, status: paymentAttempts.status, amountMinor: paymentAttempts.amountMinor, currency: paymentAttempts.currency }).from(paymentAttempts).where(eq(paymentAttempts.id, order.paymentAttemptId)).limit(1);
  return { order, address: address[0] ?? null, payment: payment ?? null, sellerOrders: sellerOrders.map((sellerOrder: any) => ({ ...sellerOrder, items: items.filter((item: any) => item.sellerOrderId === sellerOrder.id) })) };
}

export async function createOrderFromSuccessfulPayment(userId: number, paymentId: number) {
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM payment_attempts WHERE id = ${Number(paymentId)} FOR UPDATE`);
    const [payment] = await tx.select().from(paymentAttempts).where(and(eq(paymentAttempts.id, paymentId), eq(paymentAttempts.userId, userId))).limit(1);
    if (!payment) throw notFound("Payment attempt not found.");
    const [existing] = await tx.select().from(orders).where(eq(orders.paymentAttemptId, paymentId)).limit(1);
    if (existing) return { order: existing, sellerOrderIds: [] as number[], existing: true as const };
    if (payment.status !== "successful") throw invalidState("Only a verified successful payment can create an order.");
    const [checkout] = await tx.select().from(checkoutSessions).where(and(eq(checkoutSessions.id, payment.checkoutSessionId), eq(checkoutSessions.userId, userId))).limit(1);
    if (!checkout) throw notFound("Checkout session not found.");
    if (checkout.status === "cancelled" || checkout.status === "completed") throw invalidState("This checkout has already been completed or cancelled.");
    if (checkout.currency !== payment.currency || checkout.totalMinor !== payment.amountMinor) throw conflict("Payment and checkout totals do not reconcile.");
    const [address] = await tx.select().from(customerAddresses).where(and(eq(customerAddresses.id, checkout.addressId ?? 0), eq(customerAddresses.userId, userId))).limit(1);
    const addressSnapshot = (checkout.addressSnapshot as any) ?? (address ? toAddressSnapshot(address) : null);
    if (!addressSnapshot && !address) throw invalidState("A delivery address snapshot is required before order creation.");
    const [groups, items] = await Promise.all([
      tx.select().from(checkoutSessionGroups).where(eq(checkoutSessionGroups.sessionId, checkout.id)).orderBy(checkoutSessionGroups.id),
      tx.select().from(checkoutSessionItems).where(eq(checkoutSessionItems.sessionId, checkout.id)).orderBy(checkoutSessionItems.id),
    ]);
    if (!groups.length || !items.length) throw invalidState("The checkout snapshot has no purchasable lines.");
    const parentSubtotal = sum(groups.map((group: any) => group.subtotalMinor));
    const parentShipping = sum(groups.map((group: any) => group.shippingMinor));
    const parentFees = sum(groups.map((group: any) => group.feeMinor));
    const parentTax = sum(groups.map((group: any) => group.taxMinor));
    const parentTotal = sum(groups.map((group: any) => group.totalMinor));
    if (parentSubtotal !== checkout.subtotalMinor || parentShipping !== checkout.shippingMinor || parentFees !== checkout.feeMinor || parentTax !== checkout.taxMinor || parentTotal !== checkout.totalMinor) throw conflict("Checkout seller totals do not reconcile.");
    const links = await tx.select({ link: paymentReservations, reservation: inventoryReservations }).from(paymentReservations).innerJoin(inventoryReservations, eq(paymentReservations.inventoryReservationId, inventoryReservations.id)).where(eq(paymentReservations.paymentAttemptId, payment.id));
    const reservationsByVariant = new Map<number, any[]>();
    for (const row of links) reservationsByVariant.set(row.reservation.variantId, [...(reservationsByVariant.get(row.reservation.variantId) ?? []), row.reservation]);
    for (const item of items) {
      const reservations = reservationsByVariant.get(item.variantId) ?? [];
      if (sum(reservations.map((reservation: any) => reservation.quantity)) !== item.quantity) throw invalidState("Inventory reservations do not cover the checkout quantity.");
      if (reservations.some((reservation: any) => reservation.status !== "active" || reservation.expiresAt.getTime() <= Date.now())) throw invalidState("An inventory reservation expired before order creation.");
    }
    const sellerRows: any[] = await tx.select().from(sellers).where(inArray(sellers.id, groups.map((group: any) => group.sellerId)));
    const sellerMap = new Map(sellerRows.map((seller: any) => [seller.id, seller]));
    const orderNumberValue = orderNumber();
    const parentInsert = await tx.insert(orders).values({ orderNumber: orderNumberValue, userId, checkoutSessionId: checkout.id, paymentAttemptId: payment.id, currency: checkout.currency, subtotalMinor: checkout.subtotalMinor, shippingMinor: checkout.shippingMinor, taxMinor: checkout.taxMinor, feeMinor: checkout.feeMinor, discountMinor: 0, totalMinor: checkout.totalMinor, status: "confirmed", paymentStatus: "paid" });
    const orderId = insertId(parentInsert);
    if (!orderId) throw invalidState("Parent order could not be created.");
    await tx.insert(orderAddressSnapshots).values({ orderId, ...addressSnapshot });
    const sellerOrderIds: number[] = [];
    for (const group of groups) {
      const seller = sellerMap.get(group.sellerId);
      if (!seller) throw invalidState("Seller snapshot could not be resolved.");
      const sellerInsert = await tx.insert(orderSellerOrders).values({ parentOrderId: orderId, sellerId: group.sellerId, sellerName: group.sellerName, sellerSlug: seller.storeSlug, sellerSubtotalMinor: group.subtotalMinor, shippingMinor: group.shippingMinor, taxMinor: group.taxMinor, feeMinor: group.feeMinor, totalMinor: group.totalMinor, status: "confirmed", fulfilmentStatus: "unfulfilled" });
      const sellerOrderId = insertId(sellerInsert);
      if (!sellerOrderId) throw invalidState("Seller order could not be created.");
      sellerOrderIds.push(sellerOrderId);
      await tx.insert(sellerOrderFulfilmentEvents).values({ sellerOrderId, previousState: null, newState: "pending", actorUserId: userId, reason: "Order received", note: null });
      await writeAuditEvent(tx, { actorUserId: userId, action: "seller_order.created", entityType: "seller_order", entityId: String(sellerOrderId), afterState: { parentOrderId: orderId, sellerId: group.sellerId, totalMinor: group.totalMinor }, requestId: getRequestId() });
      for (const item of items.filter((candidate: any) => candidate.sellerId === group.sellerId)) {
        const itemInsert = await tx.insert(orderItems).values({ sellerOrderId, productId: item.productId, variantId: item.variantId, sellerId: item.sellerId, productName: item.productName, variantName: item.variantName, sku: item.sku, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, lineSubtotalMinor: item.lineSubtotalMinor, currency: item.currency });
        const orderItemId = insertId(itemInsert);
        if (!orderItemId) throw invalidState("Order item could not be created.");
        for (const reservation of reservationsByVariant.get(item.variantId) ?? []) {
          await convertReservationForOrder(tx, reservation.id, orderNumberValue, userId);
          await tx.insert(orderReservationLinks).values({ orderId, sellerOrderId, orderItemId, inventoryReservationId: reservation.id });
        }
      }
    }
    await finalizePurchasedCartLines(tx, checkout.cartId, items.map((item: any) => item.variantId), userId);
    await tx.update(checkoutSessions).set({ status: "completed", updatedAt: new Date() }).where(eq(checkoutSessions.id, checkout.id));
    await writeAuditEvent(tx, { actorUserId: userId, action: "order.created", entityType: "order", entityId: String(orderId), afterState: { orderNumber: orderNumberValue, paymentAttemptId: payment.id, checkoutSessionId: checkout.id, totalMinor: checkout.totalMinor, sellerOrderIds }, requestId: getRequestId() });
    await writeAuditEvent(tx, { actorUserId: userId, action: "payment.associated", entityType: "payment_attempt", entityId: String(payment.id), afterState: { orderId, orderNumber: orderNumberValue }, requestId: getRequestId() });
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return { order, sellerOrderIds, existing: false as const };
  });
  if (!result.order) throw invalidState("Order creation returned no order.");
  if (!result.existing) emitOrderCreated({ orderId: result.order.id, orderNumber: result.order.orderNumber, userId, paymentAttemptId: paymentId, sellerOrderIds: result.sellerOrderIds });
  if (!result.existing) await recognizeOrderPayment(result.order.id);
  const db = await database();
  return hydrateOrder(db, result.order);
}

export async function listMyOrders(userId: number, limit = 50, offset = 0) {
  const db = await database();
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
}
export async function getMyOrder(userId: number, orderId: number) {
  const db = await database();
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order) throw notFound("Order not found.");
  return hydrateOrder(db, order);
}
export async function getMyOrderByNumber(userId: number, orderNumberValue: string) {
  const db = await database();
  const [order] = await db.select().from(orders).where(and(eq(orders.orderNumber, orderNumberValue), eq(orders.userId, userId))).limit(1);
  if (!order) throw notFound("Order not found.");
  return hydrateOrder(db, order);
}

export async function sellerIdsForUser(userId: number, required = true) {
  const db = await database();
  const rows = await db.select({ sellerId: sellerMembers.sellerId }).from(sellerMembers).innerJoin(sellers, eq(sellerMembers.sellerId, sellers.id)).where(and(eq(sellerMembers.userId, userId), eq(sellerMembers.status, "active"), eq(sellers.status, "approved"), eq(sellers.verificationStatus, "approved")));
  if (!rows.length && required) throw forbidden("An approved seller membership is required.");
  return rows.map((row) => row.sellerId);
}
export async function listSellerOrders(userId: number, limit = 50, offset = 0) {
  const db = await database(); const sellerIds = await sellerIdsForUser(userId, false);
  if (!sellerIds.length) return [];
  const rows = await db.select({ sellerOrder: orderSellerOrders, orderNumber: orders.orderNumber, currency: orders.currency, customerTown: orderAddressSnapshots.town, customerCounty: orderAddressSnapshots.county }).from(orderSellerOrders).innerJoin(orders, eq(orderSellerOrders.parentOrderId, orders.id)).leftJoin(orderAddressSnapshots, eq(orderAddressSnapshots.orderId, orders.id)).where(inArray(orderSellerOrders.sellerId, sellerIds)).orderBy(desc(orderSellerOrders.createdAt)).limit(limit).offset(offset);
  const ids = rows.map((row: any) => row.sellerOrder.id);
  const itemRows = ids.length ? await db.select({ sellerOrderId: orderItems.sellerOrderId }).from(orderItems).where(inArray(orderItems.sellerOrderId, ids)) : [];
  return rows.map((row: any) => ({ ...row.sellerOrder, orderNumber: row.orderNumber, currency: row.currency, customerTown: row.customerTown, customerCounty: row.customerCounty, itemCount: itemRows.filter((item: any) => item.sellerOrderId === row.sellerOrder.id).length }));
}
export async function getSellerOrder(userId: number, sellerOrderId: number) {
  const db = await database(); const sellerIds = await sellerIdsForUser(userId);
  const [sellerOrder] = await db.select().from(orderSellerOrders).where(and(eq(orderSellerOrders.id, sellerOrderId), inArray(orderSellerOrders.sellerId, sellerIds))).limit(1);
  if (!sellerOrder) throw notFound("Seller order not found.");
  const [parent] = await db.select().from(orders).where(eq(orders.id, sellerOrder.parentOrderId)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.sellerOrderId, sellerOrder.id)).orderBy(orderItems.id);
  const [address] = await db.select().from(orderAddressSnapshots).where(eq(orderAddressSnapshots.orderId, sellerOrder.parentOrderId)).limit(1);
  const history = await db.select().from(sellerOrderFulfilmentEvents).where(eq(sellerOrderFulfilmentEvents.sellerOrderId, sellerOrder.id)).orderBy(sellerOrderFulfilmentEvents.id);
  const notes = await db.select().from(sellerOrderFulfilmentNotes).where(eq(sellerOrderFulfilmentNotes.sellerOrderId, sellerOrder.id)).orderBy(desc(sellerOrderFulfilmentNotes.createdAt));
  return { sellerOrder, parent: parent ? { id: parent.id, orderNumber: parent.orderNumber, createdAt: parent.createdAt, currency: parent.currency, fulfilmentStatus: parent.fulfilmentStatus } : null, items, address: address ?? null, history, notes };
}

const sellerTransitions: Record<string, string[]> = { confirmed: ["processing"], processing: ["ready_for_fulfilment"], ready_for_fulfilment: ["completed"], completed: [] };
export async function updateSellerOrderStatus(userId: number, sellerOrderId: number, status: "processing" | "ready_for_fulfilment" | "completed") {
  const current = await getSellerOrder(userId, sellerOrderId);
  if (!sellerTransitions[current.sellerOrder.status]?.includes(status)) throw invalidState(`Seller order cannot transition from ${current.sellerOrder.status} to ${status}.`);
  const db = await database();
  await db.update(orderSellerOrders).set({ status, fulfilmentStatus: status === "processing" ? "processing" : status === "ready_for_fulfilment" ? "ready" : "completed", updatedAt: new Date() }).where(and(eq(orderSellerOrders.id, sellerOrderId), eq(orderSellerOrders.sellerId, current.sellerOrder.sellerId), eq(orderSellerOrders.status, current.sellerOrder.status)));
  if (status === "completed") {
    const siblings = await db.select({ status: orderSellerOrders.status }).from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, current.sellerOrder.parentOrderId));
    if (siblings.length > 0 && siblings.every((row: any) => row.status === "completed")) await db.update(orders).set({ status: "completed", updatedAt: new Date() }).where(and(eq(orders.id, current.sellerOrder.parentOrderId), eq(orders.status, "confirmed")));
  }
  await recordAuditEvent({ actorUserId: userId, action: "seller_order.status_changed", entityType: "seller_order", entityId: String(sellerOrderId), beforeState: { status: current.sellerOrder.status }, afterState: { status }, requestId: getRequestId() });
  return getSellerOrder(userId, sellerOrderId);
}

export async function searchOrders(input: AdminOrderSearchInput) {
  const db = await database();
  const filters: any[] = [];
  if (input.orderNumber) filters.push(like(orders.orderNumber, `%${input.orderNumber}%`));
  if (input.customerId) filters.push(eq(orders.userId, input.customerId));
  if (input.status) filters.push(eq(orders.status, input.status));
  if (input.createdFrom) filters.push(gte(orders.createdAt, input.createdFrom));
  if (input.createdTo) filters.push(lte(orders.createdAt, input.createdTo));
  if (input.paymentReference) {
    const paymentRows = await db.select({ id: paymentAttempts.id }).from(paymentAttempts).where(like(paymentAttempts.providerReference, `%${input.paymentReference}%`));
    filters.push(paymentRows.length ? inArray(orders.paymentAttemptId, paymentRows.map((row) => row.id)) : eq(orders.id, -1));
  }
  if (input.sellerId) {
    const sellerRows = await db.select({ parentOrderId: orderSellerOrders.parentOrderId }).from(orderSellerOrders).where(eq(orderSellerOrders.sellerId, input.sellerId));
    filters.push(sellerRows.length ? inArray(orders.id, sellerRows.map((row) => row.parentOrderId)) : eq(orders.id, -1));
  }
  return db.select().from(orders).where(filters.length ? and(...filters) : undefined).orderBy(desc(orders.createdAt)).limit(input.limit).offset(input.offset);
}
export async function getAdminOrder(orderId: number) { const db = await database(); const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1); if (!order) throw notFound("Order not found."); return hydrateOrder(db, order); }
export async function getAdminSellerOrder(sellerOrderId: number) { const db = await database(); const [sellerOrder] = await db.select().from(orderSellerOrders).where(eq(orderSellerOrders.id, sellerOrderId)).limit(1); if (!sellerOrder) throw notFound("Seller order not found."); return hydrateSellerOrderByAdmin(db, sellerOrder); }
export async function hydrateSellerOrderByAdmin(db: any, sellerOrder: any) { const [parent] = await db.select().from(orders).where(eq(orders.id, sellerOrder.parentOrderId)).limit(1); const items = await db.select().from(orderItems).where(eq(orderItems.sellerOrderId, sellerOrder.id)); const [address] = await db.select().from(orderAddressSnapshots).where(eq(orderAddressSnapshots.orderId, sellerOrder.parentOrderId)).limit(1); const history = await db.select().from(sellerOrderFulfilmentEvents).where(eq(sellerOrderFulfilmentEvents.sellerOrderId, sellerOrder.id)).orderBy(sellerOrderFulfilmentEvents.id); const notes = await db.select().from(sellerOrderFulfilmentNotes).where(eq(sellerOrderFulfilmentNotes.sellerOrderId, sellerOrder.id)).orderBy(desc(sellerOrderFulfilmentNotes.createdAt)); return { sellerOrder, parent, items, address: address ?? null, history, notes }; }
