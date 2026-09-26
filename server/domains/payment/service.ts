import { and, eq, inArray, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { checkoutSessions, customerPhones, inventoryReservations, paymentAttempts, paymentCallbackEvents, paymentReservations } from "../../../drizzle/schema";
import { conflict, invalidState, notFound, validationError } from "../../../shared/errors/appError";
import { normalizePhone } from "../../../shared/validation/phone";
import { emitPaymentResult } from "./events";
import type { PaymentInitiateInput } from "../../../shared/validation/paymentSchemas";
import { recordAuditEvent, writeAuditEvent } from "../../audit/audit";
import { getDb } from "../../db";
import { getRequestId } from "../../logging/requestContext";
import { withTransaction } from "../../transactions/database";
import { releasePaymentReservation, reserveForPayment } from "../inventory/service";
import { getCheckoutSession } from "../checkout/service";
import { mpesaProvider, type PaymentProviderCallback } from "./provider";
import { createOrderFromSuccessfulPayment } from "../order/service";

const PAYMENT_TTL_MS = 15 * 60 * 1000;
const terminal = ["successful", "failed", "cancelled", "expired", "refunded", "partially_refunded"] as const;
type PaymentStatus = typeof paymentAttempts.$inferSelect["status"];

const transitions: Record<PaymentStatus, PaymentStatus[]> = {
  created: ["pending", "cancelled", "expired"],
  pending: ["processing", "successful", "failed", "cancelled", "expired"],
  processing: ["successful", "failed", "cancelled", "expired"],
  successful: ["refunded", "partially_refunded"],
  failed: [], cancelled: [], expired: [], refunded: [], partially_refunded: [],
};

async function database() {
  const db = await getDb();
  if (!db) throw invalidState("Payment services are temporarily unavailable.");
  return db;
}

function ensureTransition(from: PaymentStatus, to: PaymentStatus) {
  if (from === to) return;
  if (!transitions[from].includes(to)) throw invalidState(`Payment cannot transition from ${from} to ${to}.`);
}

function insertId(result: unknown) { return Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0); }
function maskPhone(phone: string) { return `${phone.slice(0, 6)}****${phone.slice(-2)}`; }

async function ownedPayment(userId: number, paymentId: number) {
  const db = await database();
  const [payment] = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.id, paymentId), eq(paymentAttempts.userId, userId))).limit(1);
  if (!payment) throw notFound("Payment attempt not found.");
  return payment;
}

async function releasePaymentHolds(paymentId: number, reason: string) {
  const db = await database();
  const links = await db.select().from(paymentReservations).where(eq(paymentReservations.paymentAttemptId, paymentId));
  for (const link of links) await releasePaymentReservation(link.inventoryReservationId, reason);
}

async function paymentView(userId: number, paymentId: number) {
  const payment = await ownedPayment(userId, paymentId);
  const db = await database();
  const reservations = await db.select({ link: paymentReservations, reservation: inventoryReservations }).from(paymentReservations).innerJoin(inventoryReservations, eq(paymentReservations.inventoryReservationId, inventoryReservations.id)).where(eq(paymentReservations.paymentAttemptId, paymentId));
  return { payment: { ...payment, phone: payment.phone ? `${payment.phone.slice(0, 6)}****${payment.phone.slice(-2)}` : null }, reservations: reservations.map((row) => row.reservation) };
}

async function customerPhone(userId: number, inputPhone: string) {
  const supplied = normalizePhone(inputPhone, "KE");
  const db = await database();
  const [stored] = await db.select().from(customerPhones).where(eq(customerPhones.userId, userId)).limit(1);
  if (!stored) throw validationError("Add a phone number to your SokoMart account before paying with M-Pesa.");
  if (stored && stored.normalizedPhone !== supplied.normalizedPhone) throw validationError("Use the phone number saved on your SokoMart account for M-Pesa.");
  return supplied.normalizedPhone;
}

export async function initiatePayment(userId: number, input: PaymentInitiateInput) {
  const checkout = await getCheckoutSession(userId, input.checkoutSessionId);
  if (checkout.session.status !== "ready_for_payment" || checkout.issues.length) throw invalidState("This checkout is not ready for payment. Refresh checkout and resolve the listed issues.");
  if (checkout.session.currency !== "KES") throw invalidState("M-Pesa payments currently support KES checkout sessions only.");
  if (checkout.session.totalMinor % 100 !== 0) throw invalidState("This checkout total cannot be represented as a whole KES amount for M-Pesa.");
  if (checkout.session.expiresAt.getTime() <= Date.now()) throw invalidState("This checkout session has expired.");
  const phone = await customerPhone(userId, input.phone);
  const internalReference = `SM-PAY-${nanoid(22)}`;
  let paymentId: number;
  const expiresAt = new Date(Math.min(checkout.session.expiresAt.getTime(), Date.now() + PAYMENT_TTL_MS));
  const existing = input.idempotencyKey ? await (async () => { const db = await database(); const [row] = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.userId, userId), eq(paymentAttempts.idempotencyKey, input.idempotencyKey!))).limit(1); return row; })() : null;
  if (existing) return paymentView(userId, existing.id);
  const db = await database();
  const [successful] = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.userId, userId), eq(paymentAttempts.checkoutSessionId, input.checkoutSessionId), eq(paymentAttempts.status, "successful"))).limit(1);
  if (successful) throw conflict("This checkout has already been successfully paid.");
  const created = await withTransaction(async (tx) => {
    const result = await tx.insert(paymentAttempts).values({ userId, checkoutSessionId: input.checkoutSessionId, provider: input.provider, internalReference, idempotencyKey: input.idempotencyKey ?? null, amountMinor: checkout.session.totalMinor, currency: checkout.session.currency, status: "created", phone, expiresAt, metadata: { checkoutStatus: checkout.session.status } });
    const id = insertId(result);
    if (!id) throw invalidState("Payment attempt could not be created.");
    for (const item of checkout.items) {
      const reservationIds = await reserveForPayment(tx, item.variantId, item.quantity, internalReference, expiresAt);
      for (const inventoryReservationId of reservationIds) await tx.insert(paymentReservations).values({ paymentAttemptId: id, inventoryReservationId });
    }
    await tx.update(paymentAttempts).set({ status: "pending", updatedAt: new Date() }).where(eq(paymentAttempts.id, id));
    await writeAuditEvent(tx, { actorUserId: userId, action: "payment.created", entityType: "payment_attempt", entityId: String(id), afterState: { checkoutSessionId: input.checkoutSessionId, provider: input.provider, amountMinor: checkout.session.totalMinor, currency: checkout.session.currency, phone: maskPhone(phone) }, requestId: getRequestId() });
    return id;
  });
  paymentId = created;
  try {
    const providerResponse = await mpesaProvider.initiate({ internalReference, amountMinor: checkout.session.totalMinor, currency: checkout.session.currency, phone, callbackUrl: "configured-server-callback", accountReference: internalReference, description: "SokoMart checkout" });
    await withTransaction(async (tx) => {
      await tx.update(paymentAttempts).set({ providerReference: providerResponse.providerReference, status: providerResponse.status, metadata: providerResponse.rawMetadata ?? null, updatedAt: new Date() }).where(and(eq(paymentAttempts.id, paymentId), eq(paymentAttempts.status, "pending")));
      await writeAuditEvent(tx, { actorUserId: userId, action: "payment.initiated", entityType: "payment_attempt", entityId: String(paymentId), afterState: { provider: input.provider, providerReference: providerResponse.providerReference, status: providerResponse.status }, requestId: getRequestId() });
    });
  } catch (error) {
    await failPayment(paymentId, "PROVIDER_INITIATION_FAILED", error instanceof Error ? error.message : "Payment provider initiation failed.");
    throw error;
  }
  return paymentView(userId, paymentId);
}

async function applyResult(callback: PaymentProviderCallback, actorUserId: number | null = null) {
  const db = await database();
  let paymentId: number | null = null;
  const outcome = await withTransaction(async (tx) => {
    const [payment] = await tx.select().from(paymentAttempts).where(and(eq(paymentAttempts.provider, "mpesa"), eq(paymentAttempts.providerReference, callback.providerReference))).limit(1);
    if (!payment) throw notFound("Payment attempt for provider reference was not found.");
    paymentId = payment.id;
    if (callback.amountMinor !== undefined && callback.amountMinor !== payment.amountMinor) throw conflict("Payment callback amount does not match the checkout total.");
    if (callback.currency && callback.currency !== payment.currency) throw conflict("Payment callback currency does not match the checkout currency.");
    const [duplicate] = await tx.select().from(paymentCallbackEvents).where(and(eq(paymentCallbackEvents.provider, "mpesa"), eq(paymentCallbackEvents.providerEventId, callback.eventId))).limit(1);
    if (duplicate) return { ignored: true as const, status: payment.status };
    const result = await tx.insert(paymentCallbackEvents).values({ provider: "mpesa", providerEventId: callback.eventId, paymentAttemptId: payment.id, payload: { providerReference: callback.providerReference, status: callback.status, amountMinor: callback.amountMinor ?? null, currency: callback.currency ?? null, failureCode: callback.failureCode ?? null }, status: "received" });
    await writeAuditEvent(tx, { actorUserId, action: "payment.callback.received", entityType: "payment_attempt", entityId: String(payment.id), afterState: { provider: "mpesa", providerReference: callback.providerReference, eventId: callback.eventId }, requestId: getRequestId() });
    const target: PaymentStatus = callback.status === "successful" ? "successful" : callback.status === "cancelled" ? "cancelled" : "failed";
    if (payment.status === "successful" || terminal.includes(payment.status as any)) {
      await tx.update(paymentCallbackEvents).set({ status: "ignored", processedAt: new Date() }).where(eq(paymentCallbackEvents.id, insertId(result)));
      return { ignored: true as const, status: payment.status };
    }
    ensureTransition(payment.status, target);
    await tx.update(paymentAttempts).set({ status: target, providerReference: callback.providerReference, failureCode: callback.failureCode ?? null, failureMessage: callback.failureMessage ?? null, completedAt: target === "successful" ? new Date() : null, updatedAt: new Date() }).where(eq(paymentAttempts.id, payment.id));
    await tx.update(paymentCallbackEvents).set({ status: "processed", processedAt: new Date() }).where(eq(paymentCallbackEvents.id, insertId(result)));
    await writeAuditEvent(tx, { actorUserId, action: target === "successful" ? "payment.successful" : "payment.failed", entityType: "payment_attempt", entityId: String(payment.id), beforeState: { status: payment.status }, afterState: { status: target, providerReference: callback.providerReference, failureCode: callback.failureCode }, requestId: getRequestId() });
    return { ignored: false as const, status: target };
  });
  if (paymentId && !outcome.ignored && ["failed", "cancelled"].includes(outcome.status)) await releasePaymentHolds(paymentId, `Payment ${outcome.status}`);
  return { paymentId, ...outcome };
}

async function orderForSuccessfulPayment(paymentId: number | null) {
  if (!paymentId) return null;
  const db = await database();
  const [payment] = await db.select({ id: paymentAttempts.id, userId: paymentAttempts.userId, status: paymentAttempts.status }).from(paymentAttempts).where(eq(paymentAttempts.id, paymentId)).limit(1);
  if (!payment || payment.status !== "successful") return null;
  return createOrderFromSuccessfulPayment(payment.userId, payment.id);
}

export async function processMpesaCallback(payload: unknown) {
  const result = await applyResult(mpesaProvider.parseCallback(payload));
  if (result.paymentId && !result.ignored) {
    const database = await getDb();
    const [payment] = database ? await database.select({ userId: paymentAttempts.userId }).from(paymentAttempts).where(eq(paymentAttempts.id, result.paymentId)).limit(1) : [];
    if (payment) emitPaymentResult({ paymentId: result.paymentId, userId: payment.userId, status: result.status as "successful" | "failed" | "cancelled" });
  }
  return { ...result, order: result.status === "successful" ? await orderForSuccessfulPayment(result.paymentId) : null };
}

export async function getPayment(userId: number, paymentId: number) { return paymentView(userId, paymentId); }

export async function cancelPayment(userId: number, paymentId: number, reason = "Customer cancelled payment") {
  const payment = await ownedPayment(userId, paymentId);
  ensureTransition(payment.status, "cancelled");
  await withTransaction(async (tx) => {
    await tx.update(paymentAttempts).set({ status: "cancelled", cancelledAt: new Date(), failureMessage: reason, updatedAt: new Date() }).where(and(eq(paymentAttempts.id, paymentId), eq(paymentAttempts.userId, userId), eq(paymentAttempts.status, payment.status)));
    await writeAuditEvent(tx, { actorUserId: userId, action: "payment.cancelled", entityType: "payment_attempt", entityId: String(paymentId), beforeState: { status: payment.status }, afterState: { status: "cancelled", reason }, requestId: getRequestId() });
  });
  await releasePaymentHolds(paymentId, reason);
  return paymentView(userId, paymentId);
}

export async function failPayment(paymentId: number, failureCode: string, failureMessage: string) {
  const payment = await (async () => { const db = await database(); const [row] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, paymentId)).limit(1); if (!row) throw notFound("Payment attempt not found."); return row; })();
  if (terminal.includes(payment.status as any)) return payment;
  ensureTransition(payment.status, "failed");
  const db = await database();
  await db.update(paymentAttempts).set({ status: "failed", failureCode, failureMessage, updatedAt: new Date() }).where(eq(paymentAttempts.id, paymentId));
  await releasePaymentHolds(paymentId, failureMessage);
  return payment;
}

export async function expirePaymentAttempt(paymentId: number) {
  const payment = await (async () => { const db = await database(); const [row] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, paymentId)).limit(1); if (!row) throw notFound("Payment attempt not found."); return row; })();
  if (terminal.includes(payment.status as any)) return payment;
  ensureTransition(payment.status, "expired");
  const db = await database();
  await db.update(paymentAttempts).set({ status: "expired", failureCode: "PAYMENT_EXPIRED", failureMessage: "Payment attempt expired.", updatedAt: new Date() }).where(eq(paymentAttempts.id, paymentId));
  await recordAuditEvent({ actorUserId: payment.userId, action: "payment.expired", entityType: "payment_attempt", entityId: String(paymentId), beforeState: { status: payment.status }, afterState: { status: "expired" }, requestId: getRequestId() });
  await releasePaymentHolds(paymentId, "Payment attempt expired");
  return payment;
}

export async function reconcilePayment(userId: number, paymentId: number) {
  const payment = await ownedPayment(userId, paymentId);
  if (!payment.providerReference || terminal.includes(payment.status as any)) return paymentView(userId, paymentId);
  const status = await mpesaProvider.queryStatus(payment.providerReference);
  if (status === "pending" || status === "processing") return paymentView(userId, paymentId);
  const result = await applyResult({ eventId: `reconcile:${payment.providerReference}:${status}`, providerReference: payment.providerReference, status, raw: { source: "reconciliation" } }, userId);
  if (result.status === "successful") await orderForSuccessfulPayment(result.paymentId);
  return paymentView(userId, paymentId);
}

export async function expirePaymentAttempts(limit = 100) {
  const db = await database();
  const rows = await db.select({ id: paymentAttempts.id }).from(paymentAttempts).where(and(inArray(paymentAttempts.status, ["pending", "processing"]), lte(paymentAttempts.expiresAt, new Date()))).limit(limit);
  let expired = 0;
  for (const row of rows) { try { await expirePaymentAttempt(row.id); expired += 1; } catch { /* keep reconciliation loop safe */ } }
  return { scanned: rows.length, expired };
}
