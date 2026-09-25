import { and, desc, eq } from "drizzle-orm";
import {
  checkoutSessionGroups,
  checkoutSessionItems,
  checkoutSessions,
  commerceCarts,
  customerAddresses,
} from "../../../drizzle/schema";
import { conflict, invalidState, notFound, validationError } from "../../../shared/errors/appError";
import { DEFAULT_CURRENCY, Money } from "../../../shared/money/money";
import { toAddressSnapshot } from "../account/service";
import { getCart } from "../commerce/cart/service";
import { getDb } from "../../db";
import { writeAuditEvent } from "../../audit/audit";
import { getRequestId } from "../../logging/requestContext";
import { withTransaction } from "../../transactions/database";
import type { CheckoutCreateInput } from "../../../shared/validation/checkoutSchemas";

const CHECKOUT_TTL_MS = 30 * 60 * 1000;
const STANDARD_SHIPPING_MINOR = 0;
const PLATFORM_FEE_MINOR = 0;
const TAX_MINOR = 0;

type CheckoutIssue = { code: string; message: string; variantId?: number };

async function database() {
  const db = await getDb();
  if (!db) throw invalidState("Checkout services are temporarily unavailable.");
  return db;
}

function normalizeIssues(value: unknown): CheckoutIssue[] {
  return Array.isArray(value) ? value as CheckoutIssue[] : [];
}

function ensureOpen(session: any) {
  if (["expired", "cancelled", "completed"].includes(session.status)) {
    throw invalidState("This checkout session is no longer active.");
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw invalidState("This checkout session has expired. Refresh checkout to continue.");
  }
}

async function ownedSession(tx: any, userId: number, sessionId: number) {
  const [session] = await tx.select().from(checkoutSessions)
    .where(and(eq(checkoutSessions.id, sessionId), eq(checkoutSessions.userId, userId))).limit(1);
  if (!session) throw notFound("Checkout session not found.");
  return session;
}

async function readSession(userId: number, sessionId: number) {
  const db = await database();
  const [session] = await db.select().from(checkoutSessions)
    .where(and(eq(checkoutSessions.id, sessionId), eq(checkoutSessions.userId, userId))).limit(1);
  if (!session) throw notFound("Checkout session not found.");
  if (new Date(session.expiresAt).getTime() <= Date.now() && ["active", "validated", "ready_for_payment"].includes(session.status)) {
    await db.update(checkoutSessions).set({ status: "expired", updatedAt: new Date() }).where(eq(checkoutSessions.id, session.id));
    session.status = "expired";
  }
  const [groups, items] = await Promise.all([
    db.select().from(checkoutSessionGroups).where(eq(checkoutSessionGroups.sessionId, session.id)).orderBy(checkoutSessionGroups.id),
    db.select().from(checkoutSessionItems).where(eq(checkoutSessionItems.sessionId, session.id)).orderBy(checkoutSessionItems.id),
  ]);
  return {
    session,
    address: session.addressSnapshot,
    groups,
    items,
    issues: normalizeIssues(session.issues),
    pricing: {
      subtotal: new Money(session.subtotalMinor, session.currency).toJSON(),
      shipping: new Money(session.shippingMinor, session.currency).toJSON(),
      fees: new Money(session.feeMinor, session.currency).toJSON(),
      tax: new Money(session.taxMinor, session.currency).toJSON(),
      total: new Money(session.totalMinor, session.currency).toJSON(),
      framework: { shippingMethod: session.shippingMethod, shippingPolicy: "standard_pending_logistics", feePolicy: "platform_fee_pending_policy", taxPolicy: "tax_pending_tax_configuration" },
    },
  };
}

async function createSnapshot(userId: number, input: CheckoutCreateInput, replaceSessionId?: number) {
  const cart = await getCart(userId);
  if (!cart.items.length) throw validationError("Your cart is empty.");
  const issues: CheckoutIssue[] = cart.items.flatMap((item: any) => item.purchasable ? [] : [{ code: "CART_LINE_INVALID", message: item.issues?.join("; ") || "Cart line cannot be purchased.", variantId: item.variantId }]);
  if (cart.items.some((item: any) => item.priceChanged)) issues.push({ code: "PRICE_CHANGED", message: "One or more prices changed. Review the current prices before payment." });

  const sessionId = await withTransaction(async (tx) => {
    if (replaceSessionId) {
      const previous = await ownedSession(tx, userId, replaceSessionId);
      ensureOpen(previous);
      await tx.update(checkoutSessions).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(checkoutSessions.id, previous.id));
    }
    if (input.idempotencyKey) {
      const [existing] = await tx.select().from(checkoutSessions).where(and(eq(checkoutSessions.userId, userId), eq(checkoutSessions.idempotencyKey, input.idempotencyKey))).limit(1);
      if (existing) return existing.id;
    }
    let addressSnapshot: any = null;
    let addressId: number | null = input.addressId ?? null;
    if (addressId) {
      const [address] = await tx.select().from(customerAddresses).where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active"))).limit(1);
      if (!address) throw notFound("Delivery address not found.");
      addressSnapshot = toAddressSnapshot(address);
    } else {
      issues.push({ code: "ADDRESS_REQUIRED", message: "Select a delivery address before payment." });
    }
    const currency = cart.subtotal.currency || DEFAULT_CURRENCY;
    const subtotal = new Money(cart.subtotal.amountMinor, currency);
    const shipping = new Money(STANDARD_SHIPPING_MINOR, currency);
    const fees = new Money(PLATFORM_FEE_MINOR, currency);
    const tax = new Money(TAX_MINOR, currency);
    const total = subtotal.add(shipping).add(fees).add(tax);
    const status = issues.length ? "validated" : "ready_for_payment";
    const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);
    const result = await tx.insert(checkoutSessions).values({ userId, cartId: cart.cart.id, status, currency, shippingMethod: input.shippingMethod, addressId, addressSnapshot, subtotalMinor: subtotal.amountMinor, shippingMinor: shipping.amountMinor, feeMinor: fees.amountMinor, taxMinor: tax.amountMinor, totalMinor: total.amountMinor, issues, idempotencyKey: input.idempotencyKey ?? null, expiresAt, validatedAt: new Date() });
    const sessionId = Number((result as any).insertId ?? (result as any)[0]?.insertId ?? 0);
    if (!sessionId) throw invalidState("Checkout session could not be created.");
    const groupMap = new Map<number, { sellerId: number; sellerName: string; subtotal: Money; items: any[] }>();
    for (const item of cart.items as any[]) {
      const lineSubtotal = new Money((item.currentPriceMinor ?? item.addedPriceMinor) * item.quantity, currency);
      const group: { sellerId: number; sellerName: string; subtotal: Money; items: any[] } = groupMap.get(item.sellerId) ?? { sellerId: item.sellerId, sellerName: item.sellerName, subtotal: Money.zero(currency), items: [] as any[] };
      group.subtotal = group.subtotal.add(lineSubtotal);
      group.items.push({ ...item, lineSubtotal });
      groupMap.set(item.sellerId, group);
      await tx.insert(checkoutSessionItems).values({ sessionId, sellerId: item.sellerId, productId: item.productId, variantId: item.variantId, productName: item.productName, variantName: item.variantName, sku: item.sku, sellerName: item.sellerName, quantity: item.quantity, unitPriceMinor: item.currentPriceMinor ?? item.addedPriceMinor, currency, lineSubtotalMinor: lineSubtotal.amountMinor });
    }
    for (const group of Array.from(groupMap.values())) {
      await tx.insert(checkoutSessionGroups).values({ sessionId, sellerId: group.sellerId, sellerName: group.sellerName, subtotalMinor: group.subtotal.amountMinor, shippingMinor: 0, feeMinor: 0, taxMinor: 0, totalMinor: group.subtotal.amountMinor });
    }
    await writeAuditEvent(tx, { actorUserId: userId, action: "checkout.session.created", entityType: "checkout_session", entityId: String(sessionId), afterState: { status, cartId: cart.cart.id, addressId, totalMinor: total.amountMinor }, requestId: getRequestId() });
    return sessionId;
  });
  return readSession(userId, sessionId);
}

export function createCheckoutSession(userId: number, input: CheckoutCreateInput) {
  return createSnapshot(userId, input);
}

export function getCheckoutSession(userId: number, sessionId: number) {
  return readSession(userId, sessionId);
}

export async function refreshCheckoutSession(userId: number, sessionId: number) {
  const current = await readSession(userId, sessionId);
  ensureOpen(current.session);
  return createSnapshot(userId, { addressId: current.session.addressId ?? undefined, shippingMethod: current.session.shippingMethod as "standard" }, sessionId);
}

export async function setCheckoutAddress(userId: number, sessionId: number, addressId: number) {
  const current = await readSession(userId, sessionId);
  ensureOpen(current.session);
  return createSnapshot(userId, { addressId, shippingMethod: current.session.shippingMethod as "standard" }, sessionId);
}

export async function cancelCheckoutSession(userId: number, sessionId: number) {
  return withTransaction(async (tx) => {
    const session = await ownedSession(tx, userId, sessionId);
    ensureOpen(session);
    await tx.update(checkoutSessions).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(checkoutSessions.id, session.id));
    await writeAuditEvent(tx, { actorUserId: userId, action: "checkout.session.cancelled", entityType: "checkout_session", entityId: String(session.id), beforeState: session, afterState: { status: "cancelled" }, requestId: getRequestId() });
    return readSession(userId, session.id);
  });
}
