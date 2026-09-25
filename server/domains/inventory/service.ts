import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { catalogCategories, catalogProductVariants, catalogProducts, inventoryBalances, inventoryLocations, inventoryMovements, inventoryReservations, sellerMembers, sellers } from "../../../drizzle/schema";
import { conflict, forbidden, internalError, invalidState, notFound, validationError } from "../../../shared/errors/appError";
import type { z } from "zod";
import { getDb } from "../../db";
import { writeAuditEvent } from "../../audit/audit";
import { getRequestId } from "../../logging/requestContext";
import { withTransaction } from "../../transactions/database";
import type { adjustmentInputSchema, locationInputSchema, reservationConversionSchema, reservationInputSchema, reservationReleaseSchema, stockInputSchema, updateLocationSchema } from "../../../shared/validation/inventorySchemas";

export type LocationInput = z.infer<typeof locationInputSchema>;
export type StockInput = z.infer<typeof stockInputSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentInputSchema>;
export type ReservationInput = z.infer<typeof reservationInputSchema>;

type Tx = any;
type Actor = { id: number; role: "user" | "admin" };

function insertId(result: unknown): number { const candidate = (result as any)?.[0]?.insertId ?? (result as any)?.insertId; const id = Number(candidate); if (!Number.isInteger(id) || id <= 0) throw new Error("Expected a valid insert id."); return id; }
function affectedRows(result: unknown): number { return Number((result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? (result as any)?.rowsAffected ?? 0); }

async function database() { const db = await getDb(); if (!db) throw internalError("Inventory services are temporarily unavailable."); return db; }

async function activeMembership(userId: number, sellerId?: number) {
  const db = await database();
  const rows = await db.select({ seller: sellers, membership: sellerMembers }).from(sellerMembers).innerJoin(sellers, eq(sellerMembers.sellerId, sellers.id)).where(and(eq(sellerMembers.userId, userId), eq(sellerMembers.status, "active"), sellerId ? eq(sellerMembers.sellerId, sellerId) : undefined)).orderBy(desc(sellers.updatedAt)).limit(1);
  if (!rows.length) throw forbidden("An active seller membership is required.");
  if (rows[0].seller.status !== "approved" || rows[0].seller.verificationStatus !== "approved") throw forbidden("Only approved sellers can manage inventory.");
  return rows[0];
}

async function variantRecord(variantId: number) {
  const db = await database();
  const rows = await db.select({ variant: catalogProductVariants, product: catalogProducts, seller: sellers, category: catalogCategories }).from(catalogProductVariants).innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id)).innerJoin(sellers, eq(catalogProducts.sellerId, sellers.id)).innerJoin(catalogCategories, eq(catalogProducts.categoryId, catalogCategories.id)).where(eq(catalogProductVariants.id, variantId)).limit(1);
  if (!rows.length) throw notFound("SKU not found.");
  const row = rows[0];
  if (row.variant.status !== "active") throw invalidState("This SKU is not active.");
  if (!["approved", "published"].includes(row.product.status) || row.seller.status !== "approved" || row.seller.verificationStatus !== "approved") throw invalidState("Inventory can only be managed for an approved catalog SKU.");
  return row;
}

async function ownedVariant(actor: Actor, variantId: number) {
  const record = await variantRecord(variantId);
  if (actor.role === "admin") return record;
  const membership = await activeMembership(actor.id, record.seller.id);
  if (!["owner", "manager", "catalog_staff", "fulfilment_staff"].includes(membership.membership.memberRole)) throw forbidden("This seller membership cannot manage inventory.");
  return record;
}

async function ownedLocation(actor: Actor, locationId: number, sellerId: number) {
  const db = await database();
  const rows = await db.select().from(inventoryLocations).where(eq(inventoryLocations.id, locationId)).limit(1);
  if (!rows.length) throw notFound("Inventory location not found.");
  const location = rows[0];
  if (location.status !== "active") throw invalidState("This inventory location is not active.");
  if (location.sellerId !== sellerId) throw forbidden("This inventory location belongs to another seller.");
  return location;
}

async function platformLocation(actor: Actor, locationId: number) {
  if (actor.role !== "admin") throw forbidden("Only platform administrators can use platform-owned locations.");
  const db = await database();
  const rows = await db.select().from(inventoryLocations).where(and(eq(inventoryLocations.id, locationId), isNull(inventoryLocations.sellerId))).limit(1);
  if (!rows.length) throw forbidden("This is not an accessible platform inventory location.");
  if (rows[0].status !== "active") throw invalidState("This inventory location is not active.");
  return rows[0];
}

async function ensureBalance(tx: Tx, sellerId: number, variantId: number, locationId: number) {
  await tx.insert(inventoryBalances).values({ sellerId, variantId, locationId, onHand: 0, reserved: 0, damaged: 0, status: "active" }).onDuplicateKeyUpdate({ set: { updatedAt: sql`CURRENT_TIMESTAMP` } });
  const rows = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.sellerId, sellerId), eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.locationId, locationId))).limit(1);
  if (!rows.length) throw internalError("Inventory balance could not be created.");
  return rows[0];
}

function available(balance: { onHand: number; reserved: number }) { return balance.onHand - balance.reserved; }
function signedQuantity(direction: "in" | "out", quantity: number) { return direction === "in" ? quantity : -quantity; }

async function appendMovement(tx: Tx, data: { sellerId: number; variantId: number; locationId: number; reservationId?: number | null; movementType: "initial_stock" | "purchase_receipt" | "manual_adjustment" | "transfer_out" | "transfer_in" | "damage" | "loss" | "return" | "correction" | "reservation" | "reservation_release" | "sale"; balanceType: "on_hand" | "reserved" | "damaged"; direction: "in" | "out"; quantity: number; referenceType?: string | null; referenceId?: string | null; reason?: string | null; actorUserId?: number | null }) {
  if (!Number.isInteger(data.quantity) || data.quantity <= 0) throw validationError("Movement quantity must be a positive integer.");
  await tx.insert(inventoryMovements).values({ ...data, reservationId: data.reservationId ?? null, referenceType: data.referenceType ?? null, referenceId: data.referenceId ?? null, reason: data.reason ?? null, actorUserId: data.actorUserId ?? null, requestId: getRequestId() ?? null });
}

async function audit(tx: Tx, actorUserId: number | null, action: string, entityType: string, entityId: number | string, beforeState?: unknown, afterState?: unknown, reason?: string | null) {
  await writeAuditEvent(tx, { actorUserId, action, entityType, entityId: String(entityId), beforeState, afterState, reason });
}

export async function createSellerLocation(actor: Actor, input: LocationInput) {
  const membership = await activeMembership(actor.id);
  if (!["seller_location", "warehouse"].includes(input.type)) throw forbidden("Sellers cannot create platform fulfillment-center locations.");
  return withTransaction(async (tx) => {
    const result = await tx.insert(inventoryLocations).values({ ...input, sellerId: membership.seller.id, county: input.county ?? null, city: input.city ?? null, address: input.address ?? null });
    const id = insertId(result);
    await audit(tx, actor.id, "inventory.location.created", "inventory_location", id, null, { sellerId: membership.seller.id, name: input.name, type: input.type });
    const rows = await tx.select().from(inventoryLocations).where(eq(inventoryLocations.id, id)).limit(1);
    return rows[0];
  });
}

export async function updateSellerLocation(actor: Actor, input: z.infer<typeof updateLocationSchema>) {
  const membership = await activeMembership(actor.id);
  if (!["seller_location", "warehouse"].includes(input.type)) throw forbidden("Sellers cannot create platform fulfillment-center locations.");
  const location = await ownedLocation(actor, input.id, membership.seller.id);
  return withTransaction(async (tx) => {
    await tx.update(inventoryLocations).set({ name: input.name, type: input.type, country: input.country, county: input.county ?? null, city: input.city ?? null, address: input.address ?? null }).where(eq(inventoryLocations.id, input.id));
    await audit(tx, actor.id, "inventory.location.updated", "inventory_location", input.id, { name: location.name, type: location.type, status: location.status }, { name: input.name, type: input.type, status: location.status });
    const rows = await tx.select().from(inventoryLocations).where(eq(inventoryLocations.id, input.id)).limit(1); return rows[0];
  });
}

export async function archiveSellerLocation(actor: Actor, id: number) {
  const membership = await activeMembership(actor.id);
  const location = await ownedLocation(actor, id, membership.seller.id);
  return withTransaction(async (tx) => {
    await tx.update(inventoryLocations).set({ status: "archived" }).where(eq(inventoryLocations.id, id));
    await audit(tx, actor.id, "inventory.location.archived", "inventory_location", id, { status: location.status }, { status: "archived" });
    return { success: true as const };
  });
}

export async function listSellerLocations(actor: Actor) {
  const membership = await activeMembership(actor.id);
  const db = await database();
  return db.select().from(inventoryLocations).where(and(eq(inventoryLocations.sellerId, membership.seller.id), inArray(inventoryLocations.status, ["active", "inactive"]))).orderBy(desc(inventoryLocations.updatedAt));
}

export async function createPlatformLocation(actor: Actor, input: LocationInput) {
  if (actor.role !== "admin") throw forbidden("Only platform administrators can create platform locations.");
  if (!["warehouse", "fulfillment_center"].includes(input.type)) throw validationError("Platform locations must be warehouses or fulfillment centers.");
  return withTransaction(async (tx) => {
    const result = await tx.insert(inventoryLocations).values({ ...input, sellerId: null, county: input.county ?? null, city: input.city ?? null, address: input.address ?? null });
    const id = insertId(result);
    await audit(tx, actor.id, "inventory.location.created", "inventory_location", id, null, { sellerId: null, name: input.name, type: input.type });
    const rows = await tx.select().from(inventoryLocations).where(eq(inventoryLocations.id, id)).limit(1); return rows[0];
  });
}

export async function listInventory(actor: Actor, variantId?: number | null, locationId?: number | null) {
  const db = await database();
  if (variantId) await ownedVariant(actor, variantId);
  const membership = actor.role === "admin" ? null : await activeMembership(actor.id);
  if (locationId && membership) await ownedLocation(actor, locationId, membership.seller.id);
  const filters = [eq(inventoryBalances.status, "active"), variantId ? eq(inventoryBalances.variantId, variantId) : undefined, locationId ? eq(inventoryBalances.locationId, locationId) : undefined, membership ? eq(inventoryBalances.sellerId, membership.seller.id) : undefined].filter(Boolean) as any[];
  const rows = await db.select({ balance: inventoryBalances, variant: catalogProductVariants, product: catalogProducts, location: inventoryLocations }).from(inventoryBalances).innerJoin(catalogProductVariants, eq(inventoryBalances.variantId, catalogProductVariants.id)).innerJoin(catalogProducts, eq(catalogProductVariants.productId, catalogProducts.id)).innerJoin(inventoryLocations, eq(inventoryBalances.locationId, inventoryLocations.id)).where(and(...filters)).orderBy(desc(inventoryBalances.updatedAt));
  return rows.map((row) => ({ ...row, available: available(row.balance) }));
}

async function mutateStock(actor: Actor, input: StockInput | AdjustmentInput, mode: "initial" | "adjustment") {
  const record = await ownedVariant(actor, input.variantId);
  const sellerId = record.seller.id;
  const location = await ownedLocation(actor, input.locationId, sellerId);
  if (mode === "initial" && (input as StockInput).quantity <= 0) throw validationError("Initial stock quantity must be positive.");
  return withTransaction(async (tx) => {
    const balance = await ensureBalance(tx, sellerId, input.variantId, location.id);
    const before = { onHand: balance.onHand, reserved: balance.reserved, damaged: balance.damaged };
    const delta = mode === "initial" ? (input as StockInput).quantity : (input as AdjustmentInput).delta;
    const movementType = mode === "initial" ? "initial_stock" : (input as AdjustmentInput).movementType;
    if (mode === "adjustment" && delta < 0 && movementType === "return") throw validationError("Returns must add stock; use a positive correction or return quantity.");
    if (mode === "adjustment" && delta > 0 && ["damage", "loss"].includes(movementType)) throw validationError("Damage and loss movements must remove stock.");
    const damagedDelta = mode === "adjustment" && movementType === "damage" && delta < 0 ? Math.abs(delta) : 0;
    const result = await tx.update(inventoryBalances).set({ onHand: sql`${inventoryBalances.onHand} + ${delta}`, damaged: sql`${inventoryBalances.damaged} + ${damagedDelta}` }).where(and(eq(inventoryBalances.id, balance.id), sql`${inventoryBalances.onHand} + ${delta} >= ${inventoryBalances.reserved}`, sql`${inventoryBalances.onHand} + ${delta} >= 0`));
    const rowsAffected = affectedRows(result);
    if (rowsAffected !== 1) throw conflict("Stock cannot be reduced below currently reserved units.");
    const quantity = Math.abs(delta);
    await appendMovement(tx, { sellerId, variantId: input.variantId, locationId: location.id, movementType: movementType as any, balanceType: "on_hand", direction: delta >= 0 ? "in" : "out", quantity, referenceType: input.referenceType, referenceId: input.referenceId, reason: input.reason, actorUserId: actor.id });
    if (damagedDelta > 0) await appendMovement(tx, { sellerId, variantId: input.variantId, locationId: location.id, movementType: "damage", balanceType: "damaged", direction: "in", quantity: damagedDelta, referenceType: input.referenceType, referenceId: input.referenceId, reason: input.reason, actorUserId: actor.id });
    const afterRows = await tx.select().from(inventoryBalances).where(eq(inventoryBalances.id, balance.id)).limit(1);
    const after = afterRows[0];
    await audit(tx, actor.id, mode === "initial" ? "inventory.stock.received" : "inventory.stock.adjusted", "inventory_balance", balance.id, before, { onHand: after.onHand, reserved: after.reserved, damaged: after.damaged, movementType }, input.reason);
    return { balance: { ...after, available: available(after) }, movementType };
  });
}

export function addInitialStock(actor: Actor, input: StockInput) { return mutateStock(actor, input, "initial"); }
export function adjustStock(actor: Actor, input: AdjustmentInput) { return mutateStock(actor, input, "adjustment"); }

export async function listMovements(actor: Actor, input?: { variantId?: number | null; locationId?: number | null }) {
  const rows = await listInventory(actor, input?.variantId, input?.locationId);
  if (!rows.length) return [];
  const db = await database();
  const sellerId = rows[0].balance.sellerId;
  const filters = [eq(inventoryMovements.sellerId, sellerId), input?.variantId ? eq(inventoryMovements.variantId, input.variantId) : undefined, input?.locationId ? eq(inventoryMovements.locationId, input.locationId) : undefined].filter(Boolean) as any[];
  return db.select().from(inventoryMovements).where(and(...filters)).orderBy(desc(inventoryMovements.createdAt)).limit(200);
}

export async function createReservation(actor: Actor, input: ReservationInput) {
  const record = await ownedVariant(actor, input.variantId);
  const location = await ownedLocation(actor, input.locationId, record.seller.id);
  return withTransaction(async (tx) => {
    const balance = await ensureBalance(tx, record.seller.id, input.variantId, location.id);
    const result = await tx.update(inventoryBalances).set({ reserved: sql`${inventoryBalances.reserved} + ${input.quantity}` }).where(and(eq(inventoryBalances.id, balance.id), eq(inventoryBalances.status, "active"), sql`${inventoryBalances.onHand} - ${inventoryBalances.reserved} >= ${input.quantity}`));
    const rowsAffected = affectedRows(result);
    if (rowsAffected !== 1) throw conflict("Insufficient available inventory for this reservation.");
    const reservationResult = await tx.insert(inventoryReservations).values({ sellerId: record.seller.id, variantId: input.variantId, locationId: location.id, quantity: input.quantity, status: "active", expiresAt: input.expiresAt, referenceType: input.referenceType, referenceId: input.referenceId });
    const reservationId = insertId(reservationResult);
    await appendMovement(tx, { sellerId: record.seller.id, variantId: input.variantId, locationId: location.id, reservationId, movementType: "reservation", balanceType: "reserved", direction: "in", quantity: input.quantity, referenceType: input.referenceType, referenceId: input.referenceId, reason: "Stock reservation created", actorUserId: actor.id });
    const afterRows = await tx.select().from(inventoryBalances).where(eq(inventoryBalances.id, balance.id)).limit(1);
    await audit(tx, actor.id, "inventory.reservation.created", "inventory_reservation", reservationId, { available: available(balance) }, { quantity: input.quantity, available: available(afterRows[0]), expiresAt: input.expiresAt, referenceType: input.referenceType, referenceId: input.referenceId });
    return { reservationId, reservation: { id: reservationId, sellerId: record.seller.id, variantId: input.variantId, locationId: location.id, quantity: input.quantity, status: "active" as const, expiresAt: input.expiresAt, referenceType: input.referenceType, referenceId: input.referenceId } };
  });
}

export async function reserveForPayment(tx: Tx, variantId: number, quantity: number, referenceId: string, expiresAt: Date) {
  const record = await variantRecord(variantId);
  if (!Number.isInteger(quantity) || quantity <= 0) throw validationError("Payment reservation quantity must be a positive integer.");
  const balances = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.sellerId, record.seller.id), eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.status, "active"))).orderBy(inventoryBalances.id);
  let remaining = quantity;
  const reservations: number[] = [];
  for (const balance of balances) {
    if (remaining <= 0) break;
    const availableUnits = Math.max(0, balance.onHand - balance.reserved);
    const hold = Math.min(remaining, availableUnits);
    if (!hold) continue;
    const updated = await tx.update(inventoryBalances).set({ reserved: sql`${inventoryBalances.reserved} + ${hold}` }).where(and(eq(inventoryBalances.id, balance.id), eq(inventoryBalances.status, "active"), sql`${inventoryBalances.onHand} - ${inventoryBalances.reserved} >= ${hold}`));
    if (affectedRows(updated) !== 1) continue;
    const result = await tx.insert(inventoryReservations).values({ sellerId: record.seller.id, variantId, locationId: balance.locationId, quantity: hold, status: "active", expiresAt, referenceType: "payment_attempt", referenceId });
    const reservationId = insertId(result);
    reservations.push(reservationId);
    await appendMovement(tx, { sellerId: record.seller.id, variantId, locationId: balance.locationId, reservationId, movementType: "reservation", balanceType: "reserved", direction: "in", quantity: hold, referenceType: "payment_attempt", referenceId, reason: "Payment inventory hold created", actorUserId: null });
    await audit(tx, null, "inventory.reservation.created_for_payment", "inventory_reservation", reservationId, null, { quantity: hold, paymentReference: referenceId, expiresAt });
    remaining -= hold;
  }
  if (remaining > 0) throw conflict("Insufficient available inventory for this payment.");
  return reservations;
}

async function reservationRecord(id: number) { const db = await database(); const rows = await db.select().from(inventoryReservations).where(eq(inventoryReservations.id, id)).limit(1); if (!rows.length) throw notFound("Reservation not found."); return rows[0]; }
async function assertReservationAccess(actor: Actor, reservation: any) { const record = await ownedVariant(actor, reservation.variantId); if (record.seller.id !== reservation.sellerId) throw forbidden("Reservation ownership does not match the SKU owner."); await ownedLocation(actor, reservation.locationId, reservation.sellerId); return record; }

async function releaseReservationInternal(actorUserId: number | null, reservationId: number, reason: string | null, automatic = false) {
  return withTransaction(async (tx) => {
    const rows = await tx.select().from(inventoryReservations).where(eq(inventoryReservations.id, reservationId)).limit(1); if (!rows.length) throw notFound("Reservation not found."); const reservation = rows[0];
    if (["released", "expired", "cancelled"].includes(reservation.status)) return { reservation, alreadyReleased: true as const };
    if (reservation.status === "converted") throw invalidState("Converted reservations cannot be released.");
    const targetStatus = automatic || reservation.expiresAt.getTime() <= Date.now() ? "expired" : "released";
    const stateChange = await tx.update(inventoryReservations).set({ status: targetStatus, releasedAt: new Date(), releaseReason: reason ?? (automatic ? "Reservation expired" : "Reservation released") }).where(and(eq(inventoryReservations.id, reservationId), eq(inventoryReservations.status, "active")));
    const stateRowsAffected = affectedRows(stateChange);
    if (stateRowsAffected !== 1) return { reservation, alreadyReleased: true as const };
    const balanceRows = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.sellerId, reservation.sellerId), eq(inventoryBalances.variantId, reservation.variantId), eq(inventoryBalances.locationId, reservation.locationId))).limit(1); if (!balanceRows.length) throw internalError("Reservation balance is missing."); const balance = balanceRows[0];
    const updateBalance = await tx.update(inventoryBalances).set({ reserved: sql`${inventoryBalances.reserved} - ${reservation.quantity}` }).where(and(eq(inventoryBalances.id, balance.id), sql`${inventoryBalances.reserved} >= ${reservation.quantity}`));
    const rowsAffected = affectedRows(updateBalance); if (rowsAffected !== 1) throw internalError("Reservation balance is inconsistent.");
    await appendMovement(tx, { sellerId: reservation.sellerId, variantId: reservation.variantId, locationId: reservation.locationId, reservationId, movementType: "reservation_release", balanceType: "reserved", direction: "out", quantity: reservation.quantity, referenceType: reservation.referenceType, referenceId: reservation.referenceId, reason: reason ?? (automatic ? "Reservation expired" : "Reservation released"), actorUserId: actorUserId });
    const afterRows = await tx.select().from(inventoryBalances).where(eq(inventoryBalances.id, balance.id)).limit(1);
    await audit(tx, actorUserId, automatic ? "inventory.reservation.expired" : "inventory.reservation.released", "inventory_reservation", reservationId, { status: reservation.status, reserved: balance.reserved }, { status: targetStatus, reserved: afterRows[0].reserved }, reason);
    return { reservation: { ...reservation, status: targetStatus, releasedAt: new Date(), releaseReason: reason }, alreadyReleased: false as const };
  });
}

export function releasePaymentReservation(reservationId: number, reason: string) {
  return releaseReservationInternal(null, reservationId, reason);
}

export async function releaseReservation(actor: Actor, input: z.infer<typeof reservationReleaseSchema>) { const reservation = await reservationRecord(input.id); await assertReservationAccess(actor, reservation); return releaseReservationInternal(actor.id, input.id, input.reason ?? null); }
export async function expireDueReservations(limit = 100) { const db = await database(); const rows = await db.select({ id: inventoryReservations.id }).from(inventoryReservations).where(and(eq(inventoryReservations.status, "active"), lte(inventoryReservations.expiresAt, new Date()))).orderBy(inventoryReservations.expiresAt).limit(limit); const results = []; for (const row of rows) results.push(await releaseReservationInternal(null, row.id, "Reservation expired", true)); return { scanned: rows.length, expired: results.filter((item) => !item.alreadyReleased).length }; }

export async function convertReservation(actor: Actor, input: z.infer<typeof reservationConversionSchema>) { const reservation = await reservationRecord(input.id); await assertReservationAccess(actor, reservation); if (reservation.status !== "active") throw invalidState("Only active reservations can be converted."); const db = await database(); const stateChange = await db.update(inventoryReservations).set({ status: "converted", convertedAt: new Date(), referenceType: input.referenceType, referenceId: input.referenceId }).where(and(eq(inventoryReservations.id, input.id), eq(inventoryReservations.status, "active"))); const rowsAffected = affectedRows(stateChange); if (rowsAffected !== 1) throw invalidState("This reservation has already changed state."); await audit(db, actor.id, "inventory.reservation.converted", "inventory_reservation", input.id, { status: reservation.status, referenceType: reservation.referenceType, referenceId: reservation.referenceId }, { status: "converted", referenceType: input.referenceType, referenceId: input.referenceId }); return reservationRecord(input.id); }

export async function convertReservationForOrder(tx: Tx, reservationId: number, referenceId: string, actorUserId: number | null = null) {
  const [reservation] = await tx.select().from(inventoryReservations).where(eq(inventoryReservations.id, reservationId)).limit(1);
  if (!reservation) throw notFound("Inventory reservation not found.");
  if (reservation.status !== "active") throw invalidState("The inventory reservation is no longer active.");
  if (reservation.expiresAt.getTime() <= Date.now()) throw invalidState("The inventory reservation has expired.");
  const [balance] = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.sellerId, reservation.sellerId), eq(inventoryBalances.variantId, reservation.variantId), eq(inventoryBalances.locationId, reservation.locationId))).limit(1);
  if (!balance || balance.reserved < reservation.quantity || balance.onHand < reservation.quantity) throw conflict("Reserved inventory is no longer available for order creation.");
  const changed = await tx.update(inventoryReservations).set({ status: "converted", convertedAt: new Date(), referenceType: "order", referenceId }).where(and(eq(inventoryReservations.id, reservationId), eq(inventoryReservations.status, "active")));
  if (affectedRows(changed) !== 1) throw invalidState("The inventory reservation was already converted.");
  const balanceChanged = await tx.update(inventoryBalances).set({ onHand: sql`${inventoryBalances.onHand} - ${reservation.quantity}`, reserved: sql`${inventoryBalances.reserved} - ${reservation.quantity}` }).where(and(eq(inventoryBalances.id, balance.id), sql`${inventoryBalances.onHand} >= ${reservation.quantity}`, sql`${inventoryBalances.reserved} >= ${reservation.quantity}`));
  if (affectedRows(balanceChanged) !== 1) throw conflict("Inventory changed while finalizing the order.");
  await appendMovement(tx, { sellerId: reservation.sellerId, variantId: reservation.variantId, locationId: reservation.locationId, reservationId, movementType: "sale", balanceType: "reserved", direction: "out", quantity: reservation.quantity, referenceType: "order", referenceId, reason: "Reservation converted to order", actorUserId });
  await appendMovement(tx, { sellerId: reservation.sellerId, variantId: reservation.variantId, locationId: reservation.locationId, reservationId, movementType: "sale", balanceType: "on_hand", direction: "out", quantity: reservation.quantity, referenceType: "order", referenceId, reason: "Order inventory committed", actorUserId });
  await audit(tx, actorUserId, "inventory.reservation.converted", "inventory_reservation", reservationId, { status: "active", quantity: reservation.quantity }, { status: "converted", referenceType: "order", referenceId }, "Order creation");
  return { ...reservation, status: "converted" as const, convertedAt: new Date(), referenceType: "order", referenceId };
}

export async function listReservations(actor: Actor) { const db = await database(); const membership = await activeMembership(actor.id); return db.select().from(inventoryReservations).where(eq(inventoryReservations.sellerId, membership.seller.id)).orderBy(desc(inventoryReservations.createdAt)).limit(200); }

export async function publicAvailability(variantId: number) { const record = await variantRecord(variantId); const db = await database(); const rows = await db.select({ onHand: sql<number>`COALESCE(SUM(${inventoryBalances.onHand}), 0)`, reserved: sql<number>`COALESCE(SUM(${inventoryBalances.reserved}), 0)` }).from(inventoryBalances).where(and(eq(inventoryBalances.sellerId, record.seller.id), eq(inventoryBalances.variantId, variantId), eq(inventoryBalances.status, "active"))); const availableUnits = Number(rows[0]?.onHand ?? 0) - Number(rows[0]?.reserved ?? 0); return { variantId, status: availableUnits <= 0 ? "out_of_stock" as const : availableUnits <= 5 ? "low_stock" as const : "in_stock" as const, available: availableUnits > 0 }; }

export async function reconcileInventory(actor: Actor) {
  const db = await database(); const membership = actor.role === "admin" ? null : await activeMembership(actor.id); const balances = await db.select().from(inventoryBalances).where(and(eq(inventoryBalances.status, "active"), membership ? eq(inventoryBalances.sellerId, membership.seller.id) : undefined)); const findings: Array<Record<string, unknown>> = [];
  for (const balance of balances) {
    const movements = await db.select({ balanceType: inventoryMovements.balanceType, direction: inventoryMovements.direction, total: sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0)` }).from(inventoryMovements).where(and(eq(inventoryMovements.sellerId, balance.sellerId), eq(inventoryMovements.variantId, balance.variantId), eq(inventoryMovements.locationId, balance.locationId))).groupBy(inventoryMovements.balanceType, inventoryMovements.direction);
    const expected = { on_hand: 0, reserved: 0, damaged: 0 };
    for (const movement of movements) expected[movement.balanceType] += signedQuantity(movement.direction, Number(movement.total));
    const mismatch = expected.on_hand !== balance.onHand || expected.reserved !== balance.reserved || expected.damaged !== balance.damaged || balance.reserved > balance.onHand || available(balance) < 0;
    if (mismatch) findings.push({ balanceId: balance.id, sellerId: balance.sellerId, variantId: balance.variantId, locationId: balance.locationId, stored: { onHand: balance.onHand, reserved: balance.reserved, damaged: balance.damaged }, expected, negativeAvailable: available(balance) < 0 });
  }
  return { checked: balances.length, consistent: findings.length === 0, findings };
}
