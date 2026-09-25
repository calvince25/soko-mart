import { and, desc, eq, inArray } from "drizzle-orm";
import {
  orderAddressSnapshots,
  orderItems,
  orderSellerOrders,
  orders,
  sellerOrderFulfilmentEvents,
  sellerOrderFulfilmentNotes,
} from "../../../drizzle/schema";
import { forbidden, invalidState, notFound } from "../../../shared/errors/appError";
import type { FulfilmentState } from "../../../shared/validation/orderSchemas";
import { recordAuditEvent, writeAuditEvent } from "../../audit/audit";
import { getDb } from "../../db";
import { getRequestId } from "../../logging/requestContext";
import { withTransaction } from "../../transactions/database";
import { emitSellerOrderFulfilmentEvent } from "./events";
import { getSellerOrder, sellerIdsForUser } from "./service";

export const fulfilmentTransitions: Record<FulfilmentState, FulfilmentState[]> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["processing", "cancelled"],
  processing: ["packed", "cancelled", "failed"],
  packed: ["ready_for_handoff", "cancelled", "failed"],
  ready_for_handoff: ["handed_to_logistics"],
  handed_to_logistics: [],
  rejected: [],
  cancelled: [],
  failed: [],
};

const legacyFulfilmentStatus: Record<FulfilmentState, "unfulfilled" | "processing" | "ready" | "completed"> = {
  pending: "unfulfilled",
  accepted: "processing",
  processing: "processing",
  packed: "ready",
  ready_for_handoff: "ready",
  handed_to_logistics: "completed",
  rejected: "unfulfilled",
  cancelled: "unfulfilled",
  failed: "unfulfilled",
};

function nextTimestamp(targetState: FulfilmentState) {
  const now = new Date();
  return targetState === "accepted" ? { acceptedAt: now } : targetState === "processing" ? { processingAt: now } : targetState === "packed" ? { packedAt: now } : targetState === "ready_for_handoff" ? { readyForHandoffAt: now } : targetState === "handed_to_logistics" ? { handedToLogisticsAt: now } : {};
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw invalidState("Order services are temporarily unavailable.");
  return db;
}

async function aggregateParentFulfilment(tx: any, parentOrderId: number) {
  const children = await tx.select({ state: orderSellerOrders.fulfilmentState }).from(orderSellerOrders).where(eq(orderSellerOrders.parentOrderId, parentOrderId));
  const states = children.map((child: any) => child.state as FulfilmentState);
  let aggregate: "unfulfilled" | "accepted" | "processing" | "packed" | "ready_for_handoff" | "handed_to_logistics" | "partially_fulfilled" | "exception" = "unfulfilled";
  if (states.some((state: FulfilmentState) => ["rejected", "cancelled", "failed"].includes(state))) aggregate = "exception";
  else if (states.every((state: FulfilmentState) => state === "handed_to_logistics")) aggregate = "handed_to_logistics";
  else if (states.every((state: FulfilmentState) => state === "pending")) aggregate = "unfulfilled";
  else if (states.every((state: FulfilmentState) => state === "accepted")) aggregate = "accepted";
  else if (states.every((state: FulfilmentState) => state === "processing")) aggregate = "processing";
  else if (states.every((state: FulfilmentState) => state === "packed")) aggregate = "packed";
  else if (states.every((state: FulfilmentState) => state === "ready_for_handoff")) aggregate = "ready_for_handoff";
  else aggregate = "partially_fulfilled";
  await tx.update(orders).set({ fulfilmentStatus: aggregate, updatedAt: new Date() }).where(eq(orders.id, parentOrderId));
  return aggregate;
}

export async function transitionSellerFulfilment(userId: number, sellerOrderId: number, targetState: FulfilmentState, reason?: string, note?: string) {
  const sellerIds = await sellerIdsForUser(userId);
  if (!sellerIds.length) throw forbidden("An approved seller membership is required.");
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM order_seller_orders WHERE id = ${Number(sellerOrderId)} FOR UPDATE`);
    const [current] = await tx.select().from(orderSellerOrders).where(and(eq(orderSellerOrders.id, sellerOrderId), inArray(orderSellerOrders.sellerId, sellerIds))).limit(1);
    if (!current) throw notFound("Seller order not found.");
    const currentState = current.fulfilmentState as FulfilmentState;
    if (currentState === targetState) return { current, changed: false, parentFulfilment: null, previousState: currentState };
    if (!fulfilmentTransitions[currentState]?.includes(targetState)) throw invalidState(`Seller order cannot transition from ${currentState} to ${targetState}.`);
    if (targetState === "rejected" && currentState !== "pending") throw invalidState("Only pending seller orders can be rejected.");
    if ((targetState === "cancelled" || targetState === "rejected") && !reason) throw invalidState("A reason is required for seller rejection or cancellation.");
    const update: any = { fulfilmentState: targetState, fulfilmentStatus: legacyFulfilmentStatus[targetState], updatedAt: new Date(), ...nextTimestamp(targetState) };
    if (targetState === "cancelled" || targetState === "rejected") Object.assign(update, { cancellationReason: reason, cancelledByUserId: userId, cancelledAt: new Date(), refundRequired: 1 });
    const updateResult = await tx.update(orderSellerOrders).set(update).where(and(eq(orderSellerOrders.id, sellerOrderId), eq(orderSellerOrders.fulfilmentState, currentState)));
    const affectedRows = Number((updateResult as any)?.affectedRows ?? (updateResult as any)?.[0]?.affectedRows ?? (updateResult as any)?.rowsAffected ?? 1);
    if (affectedRows === 0) {
      const [latest] = await tx.select().from(orderSellerOrders).where(eq(orderSellerOrders.id, sellerOrderId)).limit(1);
      return { current: latest ?? current, changed: false, parentFulfilment: null, previousState: currentState };
    }
    await tx.insert(sellerOrderFulfilmentEvents).values({ sellerOrderId, previousState: currentState, newState: targetState, actorUserId: userId, reason: reason ?? null, note: note ?? null });
    if (note) await tx.insert(sellerOrderFulfilmentNotes).values({ sellerOrderId, actorUserId: userId, note });
    const parentFulfilment = await aggregateParentFulfilment(tx, current.parentOrderId);
    await writeAuditEvent(tx, { actorUserId: userId, action: `seller_order.fulfilment.${targetState}`, entityType: "seller_order", entityId: String(sellerOrderId), beforeState: { fulfilmentState: currentState }, afterState: { fulfilmentState: targetState, parentFulfilment, refundRequired: targetState === "cancelled" || targetState === "rejected" }, reason: reason ?? null, requestId: getRequestId() });
    return { current: { ...current, fulfilmentState: targetState, fulfilmentStatus: legacyFulfilmentStatus[targetState] }, changed: true, parentFulfilment, previousState: currentState };
  });
  if (result.changed) emitSellerOrderFulfilmentEvent({ sellerOrderId, parentOrderId: result.current.parentOrderId, previousState: result.previousState, newState: targetState, actorUserId: userId, reason });
  return getSellerOrder(userId, sellerOrderId);
}

export async function addSellerFulfilmentNote(userId: number, sellerOrderId: number, note: string) {
  const sellerIds = await sellerIdsForUser(userId);
  const db = await dbOrThrow();
  const [sellerOrder] = await db.select().from(orderSellerOrders).where(and(eq(orderSellerOrders.id, sellerOrderId), inArray(orderSellerOrders.sellerId, sellerIds))).limit(1);
  if (!sellerOrder) throw notFound("Seller order not found.");
  await db.insert(sellerOrderFulfilmentNotes).values({ sellerOrderId, actorUserId: userId, note });
  await recordAuditEvent({ actorUserId: userId, action: "seller_order.fulfilment_note_added", entityType: "seller_order", entityId: String(sellerOrderId), afterState: { noteLength: note.length }, requestId: getRequestId() });
  return getSellerOrder(userId, sellerOrderId);
}

export async function getSellerFulfilmentHistory(userId: number, sellerOrderId: number) {
  const sellerIds = await sellerIdsForUser(userId);
  const db = await dbOrThrow();
  const [sellerOrder] = await db.select().from(orderSellerOrders).where(and(eq(orderSellerOrders.id, sellerOrderId), inArray(orderSellerOrders.sellerId, sellerIds))).limit(1);
  if (!sellerOrder) throw notFound("Seller order not found.");
  const events = await db.select().from(sellerOrderFulfilmentEvents).where(eq(sellerOrderFulfilmentEvents.sellerOrderId, sellerOrderId)).orderBy(desc(sellerOrderFulfilmentEvents.createdAt));
  const notes = await db.select().from(sellerOrderFulfilmentNotes).where(eq(sellerOrderFulfilmentNotes.sellerOrderId, sellerOrderId)).orderBy(desc(sellerOrderFulfilmentNotes.createdAt));
  return { events, notes };
}

export async function listAdminFulfilmentOrders(input: { limit: number; offset: number; fulfilmentState?: FulfilmentState; sellerId?: number; orderNumber?: string }) {
  const db = await dbOrThrow();
  const rows = await db.select({ sellerOrder: orderSellerOrders, orderNumber: orders.orderNumber, currency: orders.currency, customerTown: orderAddressSnapshots.town, customerCounty: orderAddressSnapshots.county }).from(orderSellerOrders).innerJoin(orders, eq(orderSellerOrders.parentOrderId, orders.id)).leftJoin(orderAddressSnapshots, eq(orderAddressSnapshots.orderId, orders.id)).where(and(input.fulfilmentState ? eq(orderSellerOrders.fulfilmentState, input.fulfilmentState) : undefined, input.sellerId ? eq(orderSellerOrders.sellerId, input.sellerId) : undefined, input.orderNumber ? eq(orders.orderNumber, input.orderNumber) : undefined)).orderBy(desc(orderSellerOrders.createdAt)).limit(input.limit).offset(input.offset);
  const ids = rows.map((row: any) => row.sellerOrder.id);
  const counts = ids.length ? await db.select({ sellerOrderId: orderItems.sellerOrderId }).from(orderItems).where(inArray(orderItems.sellerOrderId, ids)) : [];
  return rows.map((row: any) => ({ ...row.sellerOrder, orderNumber: row.orderNumber, currency: row.currency, customerTown: row.customerTown, customerCounty: row.customerCounty, itemCount: counts.filter((item: any) => item.sellerOrderId === row.sellerOrder.id).length }));
}

export async function getAdminFulfilmentHistory(sellerOrderId: number) {
  const db = await dbOrThrow();
  const [sellerOrder] = await db.select().from(orderSellerOrders).where(eq(orderSellerOrders.id, sellerOrderId)).limit(1);
  if (!sellerOrder) throw notFound("Seller order not found.");
  const events = await db.select().from(sellerOrderFulfilmentEvents).where(eq(sellerOrderFulfilmentEvents.sellerOrderId, sellerOrderId)).orderBy(desc(sellerOrderFulfilmentEvents.createdAt));
  const notes = await db.select().from(sellerOrderFulfilmentNotes).where(eq(sellerOrderFulfilmentNotes.sellerOrderId, sellerOrderId)).orderBy(desc(sellerOrderFulfilmentNotes.createdAt));
  return { events, notes };
}
