import { and, desc, eq, inArray, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  orderAddressSnapshots,
  orderItems,
  orderSellerOrders,
  orders,
  roles,
  sellers,
  userRoles,
  users,
  warehouseDiscrepancies,
  warehouseEvents,
  warehouseIntakes,
  warehousePackageItems,
  warehousePackages,
  warehouseSortingBatchPackages,
  warehouseSortingBatches,
  warehouseUserAssignments,
  warehouses,
} from "../../../drizzle/schema";
import { conflict, forbidden, invalidState, notFound, validationError } from "../../../shared/errors/appError";
import type { IntakeStatus, SortingBatchStatus, WarehousePackageStatus, WarehouseStatus } from "../../../shared/validation/warehouseSchemas";
import { recordAuditEvent, writeAuditEvent } from "../../audit/audit";
import { getDb } from "../../db";
import { getRequestId } from "../../logging/requestContext";
import { withTransaction } from "../../transactions/database";
import { emitWarehouseOperationalEvent } from "./events";

function insertId(result: unknown) {
  return Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value), 0);
}

async function database() {
  const db = await getDb();
  if (!db) throw invalidState("Warehouse services are temporarily unavailable.");
  return db;
}

async function isGlobalWarehouseOperator(db: any, userId: number, platformAdmin = false) {
  if (platformAdmin) return true;
  const rows = await db.select({ code: roles.code }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, userId));
  return rows.some((row: any) => ["super_admin", "marketplace_admin", "logistics_manager"].includes(row.code));
}

async function scopeWarehouseIds(db: any, userId: number, platformAdmin = false) {
  if (await isGlobalWarehouseOperator(db, userId, platformAdmin)) return null as number[] | null;
  const rows = await db.select({ warehouseId: warehouseUserAssignments.warehouseId }).from(warehouseUserAssignments).where(and(eq(warehouseUserAssignments.userId, userId), eq(warehouseUserAssignments.status, "active")));
  return rows.map((row: any) => row.warehouseId as number);
}

async function assertWarehouseAccess(db: any, userId: number, warehouseId: number, platformAdmin = false, requireActive = false) {
  const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
  if (!warehouse) throw notFound("Warehouse not found.");
  if (requireActive && warehouse.status !== "active") throw invalidState("Warehouse is not active for operations.");
  const global = await isGlobalWarehouseOperator(db, userId, platformAdmin);
  if (!global) {
    const [assignment] = await db.select({ id: warehouseUserAssignments.id }).from(warehouseUserAssignments).where(and(eq(warehouseUserAssignments.warehouseId, warehouseId), eq(warehouseUserAssignments.userId, userId), eq(warehouseUserAssignments.status, "active"))).limit(1);
    if (!assignment) throw forbidden("You are not assigned to this warehouse.");
  }
  return warehouse;
}

async function assertGlobalWarehouseManager(db: any, userId: number, platformAdmin = false) {
  if (!(await isGlobalWarehouseOperator(db, userId, platformAdmin))) throw forbidden("A logistics manager or administrator is required.");
}

async function writeWarehouseEvent(tx: any, input: { warehouseId: number; entityType: "intake" | "package" | "batch"; entityId: number; eventType: string; previousState?: string | null; newState?: string | null; actorUserId: number; note?: string | null }) {
  await tx.insert(warehouseEvents).values({ warehouseId: input.warehouseId, entityType: input.entityType, entityId: input.entityId, eventType: input.eventType, previousState: input.previousState ?? null, newState: input.newState ?? null, actorUserId: input.actorUserId, note: input.note ?? null });
}

async function hydratePackage(db: any, packageRow: any) {
  const [items, discrepancies, batch] = await Promise.all([
    db.select({ packageItem: warehousePackageItems, orderItem: orderItems }).from(warehousePackageItems).innerJoin(orderItems, eq(warehousePackageItems.orderItemId, orderItems.id)).where(eq(warehousePackageItems.packageId, packageRow.id)).orderBy(warehousePackageItems.id),
    db.select().from(warehouseDiscrepancies).where(eq(warehouseDiscrepancies.packageId, packageRow.id)).orderBy(desc(warehouseDiscrepancies.createdAt)),
    db.select({ batch: warehouseSortingBatches }).from(warehouseSortingBatchPackages).innerJoin(warehouseSortingBatches, eq(warehouseSortingBatchPackages.batchId, warehouseSortingBatches.id)).where(eq(warehouseSortingBatchPackages.packageId, packageRow.id)).limit(1),
  ]);
  return { package: packageRow, items, discrepancies, batch: batch[0]?.batch ?? null };
}

async function hydrateIntake(db: any, intakeRow: any) {
  const [packages, discrepancies, parent, seller, orderItemRows] = await Promise.all([
    db.select().from(warehousePackages).where(eq(warehousePackages.intakeId, intakeRow.id)).orderBy(warehousePackages.id),
    db.select().from(warehouseDiscrepancies).where(eq(warehouseDiscrepancies.intakeId, intakeRow.id)).orderBy(desc(warehouseDiscrepancies.createdAt)),
    db.select({ orderNumber: orders.orderNumber, address: orderAddressSnapshots }).from(orders).leftJoin(orderAddressSnapshots, eq(orderAddressSnapshots.orderId, orders.id)).where(eq(orders.id, intakeRow.parentOrderId)).limit(1),
    db.select({ storeName: sellers.storeName, storeSlug: sellers.storeSlug }).from(sellers).where(eq(sellers.id, intakeRow.sellerId)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.sellerOrderId, intakeRow.sellerOrderId)).orderBy(orderItems.id),
  ]);
  const packageDetails = await Promise.all(packages.map((row: any) => hydratePackage(db, row)));
  return { intake: intakeRow, orderNumber: parent[0]?.orderNumber ?? null, address: parent[0]?.address ?? null, seller: seller[0] ?? null, orderItems: orderItemRows, packages: packageDetails, discrepancies };
}

export async function listWarehouses(userId: number, input: { limit: number; offset: number; status?: WarehouseStatus }, platformAdmin = false) {
  const db = await database();
  const scope = await scopeWarehouseIds(db, userId, platformAdmin);
  if (scope && !scope.length) return [];
  const conditions: any[] = [];
  if (input.status) conditions.push(eq(warehouses.status, input.status));
  if (scope) conditions.push(inArray(warehouses.id, scope));
  return db.select().from(warehouses).where(conditions.length ? and(...conditions) : undefined).orderBy(warehouses.name).limit(input.limit).offset(input.offset);
}

export async function getWarehouse(userId: number, warehouseId: number, platformAdmin = false) {
  const db = await database();
  return assertWarehouseAccess(db, userId, warehouseId, platformAdmin);
}

export async function createWarehouse(userId: number, input: { name: string; code: string; country: string; county: string; town: string; address: string; status: WarehouseStatus }, platformAdmin = false) {
  const db = await database();
  await assertGlobalWarehouseManager(db, userId, platformAdmin);
  const result = await db.insert(warehouses).values(input);
  const warehouseId = insertId(result);
  await recordAuditEvent({ actorUserId: userId, action: "warehouse.created", entityType: "warehouse", entityId: String(warehouseId), afterState: input, requestId: getRequestId() });
  return getWarehouse(userId, warehouseId, platformAdmin);
}

export async function updateWarehouse(userId: number, warehouseId: number, input: Partial<{ name: string; code: string; country: string; county: string; town: string; address: string; status: WarehouseStatus }>, platformAdmin = false) {
  const db = await database();
  await assertGlobalWarehouseManager(db, userId, platformAdmin);
  const [before] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
  if (!before) throw notFound("Warehouse not found.");
  await db.update(warehouses).set({ ...input, updatedAt: new Date() }).where(eq(warehouses.id, warehouseId));
  await recordAuditEvent({ actorUserId: userId, action: "warehouse.updated", entityType: "warehouse", entityId: String(warehouseId), beforeState: { status: before.status }, afterState: input, requestId: getRequestId() });
  return getWarehouse(userId, warehouseId, platformAdmin);
}

export async function listAssignments(userId: number, warehouseId: number, platformAdmin = false) {
  const db = await database();
  await assertGlobalWarehouseManager(db, userId, platformAdmin);
  return db.select({ assignment: warehouseUserAssignments, user: { id: users.id, name: users.name, email: users.email, openId: users.openId } }).from(warehouseUserAssignments).innerJoin(users, eq(warehouseUserAssignments.userId, users.id)).where(eq(warehouseUserAssignments.warehouseId, warehouseId)).orderBy(desc(warehouseUserAssignments.createdAt));
}

export async function assignUser(userId: number, input: { warehouseId: number; assigneeUserId: number }, platformAdmin = false) {
  const db = await database();
  await assertGlobalWarehouseManager(db, userId, platformAdmin);
  await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin);
  const [assignee] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.assigneeUserId)).limit(1);
  if (!assignee) throw notFound("Assigned user not found.");
  const result = await db.insert(warehouseUserAssignments).values({ warehouseId: input.warehouseId, userId: input.assigneeUserId, assignedByUserId: userId, status: "active" }).onDuplicateKeyUpdate({ set: { status: "active", assignedByUserId: userId, updatedAt: new Date() } });
  await recordAuditEvent({ actorUserId: userId, action: "warehouse.user_assigned", entityType: "warehouse", entityId: String(input.warehouseId), afterState: { assigneeUserId: input.assigneeUserId }, requestId: getRequestId() });
  return { assignmentId: insertId(result) || null, warehouseId: input.warehouseId, userId: input.assigneeUserId, status: "active" as const };
}

export async function listEligibleHandoffs(userId: number, warehouseId: number | undefined, platformAdmin = false) {
  const db = await database();
  const scope = await scopeWarehouseIds(db, userId, platformAdmin);
  if (warehouseId) await assertWarehouseAccess(db, userId, warehouseId, platformAdmin);
  if (scope && !scope.length) return [];
  const sellerOrders = await db.select({ sellerOrder: orderSellerOrders, orderNumber: orders.orderNumber, address: orderAddressSnapshots, sellerName: sellers.storeName }).from(orderSellerOrders).innerJoin(orders, eq(orderSellerOrders.parentOrderId, orders.id)).leftJoin(orderAddressSnapshots, eq(orderAddressSnapshots.orderId, orders.id)).innerJoin(sellers, eq(orderSellerOrders.sellerId, sellers.id)).where(eq(orderSellerOrders.fulfilmentState, "handed_to_logistics")).orderBy(desc(orderSellerOrders.handedToLogisticsAt));
  const sellerOrderIds = sellerOrders.map((row: any) => row.sellerOrder.id);
  if (!sellerOrderIds.length) return [];
  const existing = await db.select({ sellerOrderId: warehouseIntakes.sellerOrderId }).from(warehouseIntakes).where(inArray(warehouseIntakes.sellerOrderId, sellerOrderIds));
  const existingIds = new Set(existing.map((row: any) => row.sellerOrderId));
  return sellerOrders.filter((row: any) => !existingIds.has(row.sellerOrder.id)).filter((row: any) => !scope || scope.length > 0).map((row: any) => ({ sellerOrder: row.sellerOrder, orderNumber: row.orderNumber, address: row.address, sellerName: row.sellerName, warehouseId: warehouseId ?? null }));
}

export async function receiveIntake(userId: number, input: { sellerOrderId: number; warehouseId: number; packageCount: number; receivedItemCount?: number; notes?: string }, platformAdmin = false) {
  const db = await database();
  await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin, true);
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM order_seller_orders WHERE id = ${Number(input.sellerOrderId)} FOR UPDATE`);
    const [existing] = await tx.select().from(warehouseIntakes).where(eq(warehouseIntakes.sellerOrderId, input.sellerOrderId)).limit(1);
    if (existing) {
      if (existing.warehouseId !== input.warehouseId) throw conflict("This seller handoff is already assigned to another warehouse.");
      return { intake: existing, changed: false };
    }
    const [sellerOrder] = await tx.select().from(orderSellerOrders).where(eq(orderSellerOrders.id, input.sellerOrderId)).limit(1);
    if (!sellerOrder) throw notFound("Seller order not found.");
    if (sellerOrder.fulfilmentState !== "handed_to_logistics") throw invalidState("Only seller orders handed to logistics can enter warehouse intake.");
    const items = await tx.select().from(orderItems).where(eq(orderItems.sellerOrderId, sellerOrder.id));
    if (!items.length) throw invalidState("The seller order has no order items.");
    const expectedItemCount = sum(items.map((item: any) => item.quantity));
    const receivedItemCount = input.receivedItemCount ?? expectedItemCount;
    const insert = await tx.insert(warehouseIntakes).values({ sellerOrderId: sellerOrder.id, parentOrderId: sellerOrder.parentOrderId, sellerId: sellerOrder.sellerId, warehouseId: input.warehouseId, status: "verification_required", expectedItemCount, receivedItemCount, packageCount: input.packageCount, notes: input.notes ?? null, receivedByUserId: userId, receivedAt: new Date() });
    const intakeId = insertId(insert);
    await writeWarehouseEvent(tx, { warehouseId: input.warehouseId, entityType: "intake", entityId: intakeId, eventType: "warehouse.intake.received", previousState: "awaiting_intake", newState: "verification_required", actorUserId: userId, note: input.notes });
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.intake.received", entityType: "warehouse_intake", entityId: String(intakeId), afterState: { sellerOrderId: sellerOrder.id, warehouseId: input.warehouseId, expectedItemCount, receivedItemCount, packageCount: input.packageCount }, requestId: getRequestId() });
    const [intake] = await tx.select().from(warehouseIntakes).where(eq(warehouseIntakes.id, intakeId)).limit(1);
    return { intake, changed: true };
  });
  if (result.changed) emitWarehouseOperationalEvent({ warehouseId: input.warehouseId, entityType: "intake", entityId: result.intake.id, eventType: "warehouse.intake.received", previousState: "awaiting_intake", newState: "verification_required" });
  return hydrateIntake(db, result.intake);
}

export async function listIntakes(userId: number, input: { limit: number; offset: number; warehouseId?: number; status?: IntakeStatus; orderNumber?: string; sellerOrderId?: number }, platformAdmin = false) {
  const db = await database();
  const scope = await scopeWarehouseIds(db, userId, platformAdmin);
  if (input.warehouseId) await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin);
  if (scope && !scope.length) return [];
  const conditions: any[] = [];
  if (input.warehouseId) conditions.push(eq(warehouseIntakes.warehouseId, input.warehouseId));
  else if (scope) conditions.push(inArray(warehouseIntakes.warehouseId, scope));
  if (input.status) conditions.push(eq(warehouseIntakes.status, input.status));
  if (input.sellerOrderId) conditions.push(eq(warehouseIntakes.sellerOrderId, input.sellerOrderId));
  if (input.orderNumber) conditions.push(like(orders.orderNumber, `%${input.orderNumber}%`));
  return db.select({ intake: warehouseIntakes, orderNumber: orders.orderNumber, sellerName: sellers.storeName, customerTown: orderAddressSnapshots.town, customerCounty: orderAddressSnapshots.county }).from(warehouseIntakes).innerJoin(orders, eq(warehouseIntakes.parentOrderId, orders.id)).innerJoin(sellers, eq(warehouseIntakes.sellerId, sellers.id)).leftJoin(orderAddressSnapshots, eq(orderAddressSnapshots.orderId, orders.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(warehouseIntakes.createdAt)).limit(input.limit).offset(input.offset);
}

export async function getIntake(userId: number, intakeId: number, platformAdmin = false) {
  const db = await database();
  const [intake] = await db.select().from(warehouseIntakes).where(eq(warehouseIntakes.id, intakeId)).limit(1);
  if (!intake) throw notFound("Warehouse intake not found.");
  await assertWarehouseAccess(db, userId, intake.warehouseId, platformAdmin);
  return hydrateIntake(db, intake);
}

export async function createPackage(userId: number, input: { intakeId: number; items: Array<{ orderItemId: number; quantity: number }>; weightGrams?: number; lengthMm?: number; widthMm?: number; heightMm?: number; notes?: string }, platformAdmin = false) {
  const db = await database();
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM warehouse_intakes WHERE id = ${Number(input.intakeId)} FOR UPDATE`);
    const [intake] = await tx.select().from(warehouseIntakes).where(eq(warehouseIntakes.id, input.intakeId)).limit(1);
    if (!intake) throw notFound("Warehouse intake not found.");
    await assertWarehouseAccess(db, userId, intake.warehouseId, platformAdmin);
    if (!["received", "verification_required", "discrepancy"].includes(intake.status)) throw invalidState("Packages can only be created for an active warehouse intake.");
    const orderRows = await tx.select().from(orderItems).where(eq(orderItems.sellerOrderId, intake.sellerOrderId));
    const orderById = new Map<number, any>(orderRows.map((row: any): [number, any] => [Number(row.id), row]));
    const requested = new Map<number, number>();
    for (const item of input.items) {
      if (!orderById.has(item.orderItemId)) throw validationError("Every package item must belong to the seller order.");
      if (requested.has(item.orderItemId)) throw validationError("A package cannot contain duplicate order-item rows.");
      requested.set(item.orderItemId, item.quantity);
    }
    const packageRows = await tx.select({ id: warehousePackages.id }).from(warehousePackages).where(eq(warehousePackages.sellerOrderId, intake.sellerOrderId));
    const packageIds = packageRows.map((row: any) => row.id);
    const alreadyPacked = packageIds.length ? await tx.select().from(warehousePackageItems).where(inArray(warehousePackageItems.packageId, packageIds)) : [];
    for (const [orderItemId, quantity] of Array.from(requested.entries())) {
      const prior = sum(alreadyPacked.filter((row: any) => row.orderItemId === orderItemId).map((row: any) => row.quantity));
      const ordered = Number(orderById.get(orderItemId).quantity);
      if (prior + quantity > ordered) throw conflict("Package quantity cannot exceed the ordered quantity.");
    }
    const [address] = await tx.select().from(orderAddressSnapshots).where(eq(orderAddressSnapshots.orderId, intake.parentOrderId)).limit(1);
    if (!address) throw invalidState("The immutable order address snapshot is missing.");
    const reference = `SM-PKG-${nanoid(8).toUpperCase()}`;
    const packageInsert = await tx.insert(warehousePackages).values({ packageReference: reference, intakeId: intake.id, sellerOrderId: intake.sellerOrderId, parentOrderId: intake.parentOrderId, sellerId: intake.sellerId, warehouseId: intake.warehouseId, status: "received", destinationCountry: address.country, destinationCounty: address.county, destinationTown: address.town, deliveryMethod: "standard", pickup: 0, weightGrams: input.weightGrams ?? null, lengthMm: input.lengthMm ?? null, widthMm: input.widthMm ?? null, heightMm: input.heightMm ?? null, receivedAt: new Date() });
    const packageId = insertId(packageInsert);
    await tx.insert(warehousePackageItems).values(input.items.map((item) => ({ packageId, orderItemId: item.orderItemId, quantity: item.quantity })));
    const packageCount = packageIds.length + 1;
    await tx.update(warehouseIntakes).set({ packageCount, updatedAt: new Date() }).where(eq(warehouseIntakes.id, intake.id));
    await writeWarehouseEvent(tx, { warehouseId: intake.warehouseId, entityType: "package", entityId: packageId, eventType: "warehouse.package.created", newState: "received", actorUserId: userId, note: input.notes });
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.package.created", entityType: "warehouse_package", entityId: String(packageId), afterState: { packageReference: reference, intakeId: intake.id, itemCount: input.items.length }, requestId: getRequestId() });
    const [row] = await tx.select().from(warehousePackages).where(eq(warehousePackages.id, packageId)).limit(1);
    return row;
  });
  emitWarehouseOperationalEvent({ warehouseId: result.warehouseId, entityType: "package", entityId: result.id, eventType: "warehouse.package.created", newState: "received" });
  return hydratePackage(db, result);
}

export async function listPackages(userId: number, input: { limit: number; offset: number; warehouseId?: number; status?: WarehousePackageStatus; packageReference?: string; sellerOrderId?: number; destinationCounty?: string }, platformAdmin = false) {
  const db = await database();
  const scope = await scopeWarehouseIds(db, userId, platformAdmin);
  if (input.warehouseId) await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin);
  if (scope && !scope.length) return [];
  const conditions: any[] = [];
  if (input.warehouseId) conditions.push(eq(warehousePackages.warehouseId, input.warehouseId));
  else if (scope) conditions.push(inArray(warehousePackages.warehouseId, scope));
  if (input.status) conditions.push(eq(warehousePackages.status, input.status));
  if (input.packageReference) conditions.push(like(warehousePackages.packageReference, `%${input.packageReference}%`));
  if (input.sellerOrderId) conditions.push(eq(warehousePackages.sellerOrderId, input.sellerOrderId));
  if (input.destinationCounty) conditions.push(eq(warehousePackages.destinationCounty, input.destinationCounty));
  return db.select({ package: warehousePackages, orderNumber: orders.orderNumber, sellerName: sellers.storeName }).from(warehousePackages).innerJoin(orders, eq(warehousePackages.parentOrderId, orders.id)).innerJoin(sellers, eq(warehousePackages.sellerId, sellers.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(warehousePackages.createdAt)).limit(input.limit).offset(input.offset);
}

export async function getPackage(userId: number, packageId: number, platformAdmin = false) {
  const db = await database();
  const [row] = await db.select().from(warehousePackages).where(eq(warehousePackages.id, packageId)).limit(1);
  if (!row) throw notFound("Warehouse package not found.");
  await assertWarehouseAccess(db, userId, row.warehouseId, platformAdmin);
  return hydratePackage(db, row);
}

export async function updatePackageMetadata(userId: number, input: { packageId: number; weightGrams?: number; lengthMm?: number; widthMm?: number; heightMm?: number }, platformAdmin = false) {
  const db = await database();
  const [row] = await db.select().from(warehousePackages).where(eq(warehousePackages.id, input.packageId)).limit(1);
  if (!row) throw notFound("Warehouse package not found.");
  await assertWarehouseAccess(db, userId, row.warehouseId, platformAdmin);
  if (["dispatch_ready"].includes(row.status)) throw invalidState("Dispatch-ready package metadata is immutable.");
  await db.update(warehousePackages).set({ weightGrams: input.weightGrams ?? row.weightGrams, lengthMm: input.lengthMm ?? row.lengthMm, widthMm: input.widthMm ?? row.widthMm, heightMm: input.heightMm ?? row.heightMm, updatedAt: new Date() }).where(eq(warehousePackages.id, input.packageId));
  await recordAuditEvent({ actorUserId: userId, action: "warehouse.package.metadata_updated", entityType: "warehouse_package", entityId: String(input.packageId), requestId: getRequestId() });
  return getPackage(userId, input.packageId, platformAdmin);
}

export async function verifyPackage(userId: number, packageId: number, platformAdmin = false) {
  const db = await database();
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM warehouse_packages WHERE id = ${Number(packageId)} FOR UPDATE`);
    const [row] = await tx.select().from(warehousePackages).where(eq(warehousePackages.id, packageId)).limit(1);
    if (!row) throw notFound("Warehouse package not found.");
    await assertWarehouseAccess(db, userId, row.warehouseId, platformAdmin);
    if (row.status === "verified" || row.status === "sorted" || row.status === "dispatch_ready") return { row, changed: false };
    if (row.status !== "received" && row.status !== "verification_required" && row.status !== "discrepancy") throw invalidState("Only received packages can be verified.");
    if (row.status === "discrepancy") {
      const [open] = await tx.select({ id: warehouseDiscrepancies.id }).from(warehouseDiscrepancies).where(and(eq(warehouseDiscrepancies.packageId, packageId), inArray(warehouseDiscrepancies.resolutionStatus, ["open", "in_review"]))).limit(1);
      if (open) throw invalidState("Resolve open package discrepancies before verification.");
    }
    const items = await tx.select().from(warehousePackageItems).where(eq(warehousePackageItems.packageId, packageId));
    if (!items.length) throw invalidState("A package must contain at least one order item before verification.");
    await tx.update(warehousePackages).set({ status: "verified", verifiedAt: new Date(), updatedAt: new Date() }).where(and(eq(warehousePackages.id, packageId), eq(warehousePackages.status, row.status)));
    await writeWarehouseEvent(tx, { warehouseId: row.warehouseId, entityType: "package", entityId: packageId, eventType: "warehouse.package.verified", previousState: row.status, newState: "verified", actorUserId: userId });
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.package.verified", entityType: "warehouse_package", entityId: String(packageId), beforeState: { status: row.status }, afterState: { status: "verified" }, requestId: getRequestId() });
    return { row: { ...row, status: "verified" }, changed: true };
  });
  if (result.changed) emitWarehouseOperationalEvent({ warehouseId: result.row.warehouseId, entityType: "package", entityId: packageId, eventType: "warehouse.package.verified", previousState: "received", newState: "verified" });
  return hydratePackage(db, result.row);
}

export async function verifyIntake(userId: number, intakeId: number, platformAdmin = false) {
  const db = await database();
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM warehouse_intakes WHERE id = ${Number(intakeId)} FOR UPDATE`);
    const [intake] = await tx.select().from(warehouseIntakes).where(eq(warehouseIntakes.id, intakeId)).limit(1);
    if (!intake) throw notFound("Warehouse intake not found.");
    await assertWarehouseAccess(db, userId, intake.warehouseId, platformAdmin);
    if (intake.status === "verified") return { intake, changed: false };
    if (intake.status !== "verification_required" && intake.status !== "discrepancy") throw invalidState("Only received intakes can be verified.");
    const openDiscrepancies = await tx.select().from(warehouseDiscrepancies).where(and(eq(warehouseDiscrepancies.intakeId, intakeId), inArray(warehouseDiscrepancies.resolutionStatus, ["open", "in_review"])));
    if (openDiscrepancies.length) throw invalidState("Resolve open warehouse discrepancies before verification.");
    const packages = await tx.select().from(warehousePackages).where(eq(warehousePackages.intakeId, intakeId));
    const packageItems = packages.length ? await tx.select().from(warehousePackageItems).where(inArray(warehousePackageItems.packageId, packages.map((row: any) => row.id))) : [];
    const orderRows = await tx.select().from(orderItems).where(eq(orderItems.sellerOrderId, intake.sellerOrderId));
    const expectedByItem = new Map<number, number>(orderRows.map((row: any): [number, number] => [Number(row.id), Number(row.quantity)]));
    const receivedByItem = new Map<number, number>();
    for (const row of packageItems) receivedByItem.set(row.orderItemId, (receivedByItem.get(row.orderItemId) ?? 0) + Number(row.quantity));
    const discrepancies: Array<{ type: "missing_item" | "excess_item" | "incomplete_shipment"; orderItemId?: number; quantity: number; description: string }> = [];
    for (const [itemId, expected] of Array.from(expectedByItem.entries())) {
      const received = receivedByItem.get(itemId) ?? 0;
      if (received < expected) discrepancies.push({ type: "missing_item", orderItemId: itemId, quantity: expected - received, description: `Order expected ${expected}; warehouse package contents total ${received}.` });
      if (received > expected) discrepancies.push({ type: "excess_item", orderItemId: itemId, quantity: received - expected, description: `Order expected ${expected}; warehouse package contents total ${received}.` });
    }
    const receivedTotal = sum(Array.from(receivedByItem.values()));
    if (receivedTotal !== intake.receivedItemCount) discrepancies.push({ type: "incomplete_shipment", quantity: Math.abs(receivedTotal - intake.receivedItemCount), description: `Intake recorded ${intake.receivedItemCount} received items; package contents total ${receivedTotal}.` });
    if (packages.length !== intake.packageCount) discrepancies.push({ type: "incomplete_shipment", quantity: Math.abs(packages.length - intake.packageCount), description: `Intake recorded ${intake.packageCount} packages; warehouse recorded ${packages.length}.` });
    if (discrepancies.length) {
      for (const item of discrepancies) await tx.insert(warehouseDiscrepancies).values({ intakeId, packageId: null, orderItemId: item.orderItemId ?? null, type: item.type, description: item.description, quantity: Math.max(item.quantity, 1), reportedByUserId: userId, resolutionStatus: "open" });
      await tx.update(warehouseIntakes).set({ status: "discrepancy", discrepancySummary: `${discrepancies.length} discrepancy record(s) require review.`, updatedAt: new Date() }).where(eq(warehouseIntakes.id, intakeId));
      await writeWarehouseEvent(tx, { warehouseId: intake.warehouseId, entityType: "intake", entityId: intakeId, eventType: "warehouse.intake.discrepancy", previousState: intake.status, newState: "discrepancy", actorUserId: userId });
      await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.intake.discrepancy", entityType: "warehouse_intake", entityId: String(intakeId), afterState: { discrepancyCount: discrepancies.length }, requestId: getRequestId() });
      return { intake: { ...intake, status: "discrepancy" }, changed: true, discrepancy: true };
    }
    await tx.update(warehouseIntakes).set({ status: "verified", verifiedAt: new Date(), updatedAt: new Date() }).where(and(eq(warehouseIntakes.id, intakeId), eq(warehouseIntakes.status, intake.status)));
    await writeWarehouseEvent(tx, { warehouseId: intake.warehouseId, entityType: "intake", entityId: intakeId, eventType: "warehouse.intake.verified", previousState: intake.status, newState: "verified", actorUserId: userId });
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.intake.verified", entityType: "warehouse_intake", entityId: String(intakeId), afterState: { receivedItemCount: receivedTotal }, requestId: getRequestId() });
    return { intake: { ...intake, status: "verified" }, changed: true, discrepancy: false };
  });
  if (result.changed) emitWarehouseOperationalEvent({ warehouseId: result.intake.warehouseId, entityType: "intake", entityId: intakeId, eventType: result.discrepancy ? "warehouse.intake.discrepancy" : "warehouse.intake.verified", previousState: "verification_required", newState: result.intake.status });
  return hydrateIntake(db, result.intake);
}

export async function recordDiscrepancy(userId: number, input: { intakeId: number; packageId?: number; orderItemId?: number; type: "missing_item" | "excess_item" | "damaged_package" | "wrong_item" | "incomplete_shipment" | "packaging_problem"; description: string; quantity: number }, platformAdmin = false) {
  const db = await database();
  const result = await withTransaction(async (tx) => {
    const [intake] = await tx.select().from(warehouseIntakes).where(eq(warehouseIntakes.id, input.intakeId)).limit(1);
    if (!intake) throw notFound("Warehouse intake not found.");
    await assertWarehouseAccess(db, userId, intake.warehouseId, platformAdmin);
    if (input.packageId) {
      const [pkg] = await tx.select().from(warehousePackages).where(and(eq(warehousePackages.id, input.packageId), eq(warehousePackages.intakeId, input.intakeId))).limit(1);
      if (!pkg) throw validationError("The package does not belong to this intake.");
    }
    if (input.orderItemId) {
      const [item] = await tx.select().from(orderItems).where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.sellerOrderId, intake.sellerOrderId))).limit(1);
      if (!item) throw validationError("The order item does not belong to this seller order.");
    }
    const insert = await tx.insert(warehouseDiscrepancies).values({ intakeId: input.intakeId, packageId: input.packageId ?? null, orderItemId: input.orderItemId ?? null, type: input.type, description: input.description, quantity: input.quantity, reportedByUserId: userId, resolutionStatus: "open" });
    const discrepancyId = insertId(insert);
    await tx.update(warehouseIntakes).set({ status: "discrepancy", discrepancySummary: input.description, updatedAt: new Date() }).where(eq(warehouseIntakes.id, input.intakeId));
    if (input.packageId) await tx.update(warehousePackages).set({ status: "discrepancy", updatedAt: new Date() }).where(eq(warehousePackages.id, input.packageId));
    await writeWarehouseEvent(tx, { warehouseId: intake.warehouseId, entityType: "intake", entityId: input.intakeId, eventType: "warehouse.discrepancy.reported", previousState: intake.status, newState: "discrepancy", actorUserId: userId, note: input.description });
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.discrepancy.reported", entityType: "warehouse_discrepancy", entityId: String(discrepancyId), afterState: input, requestId: getRequestId() });
    return { discrepancyId, warehouseId: intake.warehouseId };
  });
  emitWarehouseOperationalEvent({ warehouseId: result.warehouseId, entityType: "intake", entityId: input.intakeId, eventType: "warehouse.discrepancy.reported", newState: "discrepancy" });
  return db.select().from(warehouseDiscrepancies).where(eq(warehouseDiscrepancies.id, result.discrepancyId)).limit(1).then((rows: any[]) => rows[0]);
}

export async function resolveDiscrepancy(userId: number, input: { discrepancyId: number; resolutionStatus: "in_review" | "resolved" | "rejected"; resolutionNote?: string }, platformAdmin = false) {
  const db = await database();
  const [row] = await db.select().from(warehouseDiscrepancies).where(eq(warehouseDiscrepancies.id, input.discrepancyId)).limit(1);
  if (!row) throw notFound("Warehouse discrepancy not found.");
  const [intake] = await db.select().from(warehouseIntakes).where(eq(warehouseIntakes.id, row.intakeId)).limit(1);
  if (!intake) throw notFound("Warehouse intake not found.");
  await assertWarehouseAccess(db, userId, intake.warehouseId, platformAdmin);
  await db.update(warehouseDiscrepancies).set({ resolutionStatus: input.resolutionStatus, resolutionNote: input.resolutionNote ?? null, resolvedByUserId: input.resolutionStatus === "resolved" || input.resolutionStatus === "rejected" ? userId : null, resolvedAt: input.resolutionStatus === "resolved" || input.resolutionStatus === "rejected" ? new Date() : null, updatedAt: new Date() }).where(eq(warehouseDiscrepancies.id, input.discrepancyId));
  if (input.resolutionStatus === "resolved" || input.resolutionStatus === "rejected") {
    const [open] = await db.select({ id: warehouseDiscrepancies.id }).from(warehouseDiscrepancies).where(and(eq(warehouseDiscrepancies.intakeId, row.intakeId), inArray(warehouseDiscrepancies.resolutionStatus, ["open", "in_review"]))).limit(1);
    if (!open) {
      await db.update(warehouseIntakes).set({ status: "verification_required", discrepancySummary: null, updatedAt: new Date() }).where(eq(warehouseIntakes.id, row.intakeId));
      if (row.packageId) await db.update(warehousePackages).set({ status: "verification_required", updatedAt: new Date() }).where(and(eq(warehousePackages.id, row.packageId), eq(warehousePackages.status, "discrepancy")));
    }
  }
  await recordAuditEvent({ actorUserId: userId, action: "warehouse.discrepancy.resolution_changed", entityType: "warehouse_discrepancy", entityId: String(input.discrepancyId), beforeState: { resolutionStatus: row.resolutionStatus }, afterState: input, requestId: getRequestId() });
  return db.select().from(warehouseDiscrepancies).where(eq(warehouseDiscrepancies.id, input.discrepancyId)).limit(1).then((rows: any[]) => rows[0]);
}

export async function listDiscrepancies(userId: number, input: { limit: number; offset: number; warehouseId?: number; intakeId?: number; packageId?: number; resolutionStatus?: "open" | "in_review" | "resolved" | "rejected" }, platformAdmin = false) {
  const db = await database();
  const scope = await scopeWarehouseIds(db, userId, platformAdmin);
  if (input.warehouseId) await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin);
  if (scope && !scope.length) return [];
  const conditions: any[] = [];
  if (input.warehouseId) conditions.push(eq(warehouseIntakes.warehouseId, input.warehouseId)); else if (scope) conditions.push(inArray(warehouseIntakes.warehouseId, scope));
  if (input.intakeId) conditions.push(eq(warehouseDiscrepancies.intakeId, input.intakeId));
  if (input.packageId) conditions.push(eq(warehouseDiscrepancies.packageId, input.packageId));
  if (input.resolutionStatus) conditions.push(eq(warehouseDiscrepancies.resolutionStatus, input.resolutionStatus));
  return db.select({ discrepancy: warehouseDiscrepancies, warehouseId: warehouseIntakes.warehouseId, sellerOrderId: warehouseIntakes.sellerOrderId }).from(warehouseDiscrepancies).innerJoin(warehouseIntakes, eq(warehouseDiscrepancies.intakeId, warehouseIntakes.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(warehouseDiscrepancies.createdAt)).limit(input.limit).offset(input.offset);
}

export async function createSortingBatch(userId: number, input: { warehouseId: number; destinationCountry: string; destinationCounty: string; destinationTown: string; destinationZone?: string; deliveryMethod?: string }, platformAdmin = false) {
  const db = await database();
  await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin, true);
  const reference = `SM-SB-${nanoid(8).toUpperCase()}`;
  const result = await db.insert(warehouseSortingBatches).values({ ...input, batchReference: reference, status: "open", createdByUserId: userId });
  const batchId = insertId(result);
  await db.insert(warehouseEvents).values({ warehouseId: input.warehouseId, entityType: "batch", entityId: batchId, eventType: "warehouse.batch.created", previousState: null, newState: "open", actorUserId: userId });
  await recordAuditEvent({ actorUserId: userId, action: "warehouse.batch.created", entityType: "warehouse_sorting_batch", entityId: String(batchId), afterState: { batchReference: reference, ...input }, requestId: getRequestId() });
  return getSortingBatch(userId, batchId, platformAdmin);
}

export async function listSortablePackages(userId: number, input: { limit: number; offset: number; warehouseId?: number; status?: WarehousePackageStatus; packageReference?: string; sellerOrderId?: number; destinationCounty?: string }, platformAdmin = false) {
  return listPackages(userId, { ...input, status: input.status ?? "verified" }, platformAdmin);
}

export async function listSortingBatches(userId: number, input: { limit: number; offset: number; warehouseId?: number; status?: SortingBatchStatus; destinationCounty?: string }, platformAdmin = false) {
  const db = await database();
  const scope = await scopeWarehouseIds(db, userId, platformAdmin);
  if (input.warehouseId) await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin);
  if (scope && !scope.length) return [];
  const conditions: any[] = [];
  if (input.warehouseId) conditions.push(eq(warehouseSortingBatches.warehouseId, input.warehouseId)); else if (scope) conditions.push(inArray(warehouseSortingBatches.warehouseId, scope));
  if (input.status) conditions.push(eq(warehouseSortingBatches.status, input.status));
  if (input.destinationCounty) conditions.push(eq(warehouseSortingBatches.destinationCounty, input.destinationCounty));
  const rows = await db.select().from(warehouseSortingBatches).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(warehouseSortingBatches.createdAt)).limit(input.limit).offset(input.offset);
  return Promise.all(rows.map((row: any) => getSortingBatch(userId, row.id, platformAdmin)));
}

export async function getSortingBatch(userId: number, batchId: number, platformAdmin = false) {
  const db = await database();
  const [batch] = await db.select().from(warehouseSortingBatches).where(eq(warehouseSortingBatches.id, batchId)).limit(1);
  if (!batch) throw notFound("Sorting batch not found.");
  await assertWarehouseAccess(db, userId, batch.warehouseId, platformAdmin);
  const packages = await db.select({ link: warehouseSortingBatchPackages, package: warehousePackages }).from(warehouseSortingBatchPackages).innerJoin(warehousePackages, eq(warehouseSortingBatchPackages.packageId, warehousePackages.id)).where(eq(warehouseSortingBatchPackages.batchId, batchId)).orderBy(warehouseSortingBatchPackages.id);
  return { batch, packages };
}

export async function addPackageToBatch(userId: number, input: { batchId: number; packageId: number }, platformAdmin = false) {
  const db = await database();
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM warehouse_sorting_batches WHERE id = ${Number(input.batchId)} FOR UPDATE`);
    const [batch] = await tx.select().from(warehouseSortingBatches).where(eq(warehouseSortingBatches.id, input.batchId)).limit(1);
    if (!batch) throw notFound("Sorting batch not found.");
    await assertWarehouseAccess(db, userId, batch.warehouseId, platformAdmin, true);
    const [pkg] = await tx.select().from(warehousePackages).where(eq(warehousePackages.id, input.packageId)).limit(1);
    if (!pkg) throw notFound("Warehouse package not found.");
    if (pkg.warehouseId !== batch.warehouseId) throw conflict("Package and sorting batch belong to different warehouses.");
    if (pkg.status === "dispatch_ready") throw invalidState("Dispatch-ready packages cannot be added to a new batch.");
    if (pkg.status !== "verified" && pkg.status !== "sorted") throw invalidState("Only verified packages can be sorted.");
    const [existing] = await tx.select().from(warehouseSortingBatchPackages).where(eq(warehouseSortingBatchPackages.packageId, input.packageId)).limit(1);
    if (existing) {
      if (existing.batchId !== input.batchId) throw conflict("Package is already assigned to another sorting batch.");
      return { batch, pkg, changed: false };
    }
    if (batch.status === "dispatch_ready" || batch.status === "closed") throw invalidState("This sorting batch is no longer accepting packages.");
    await tx.insert(warehouseSortingBatchPackages).values({ batchId: input.batchId, packageId: input.packageId, addedByUserId: userId });
    const previous = pkg.status;
    await tx.update(warehousePackages).set({ status: "sorted", sortedAt: new Date(), updatedAt: new Date() }).where(and(eq(warehousePackages.id, input.packageId), eq(warehousePackages.status, previous)));
    await tx.update(warehouseSortingBatches).set({ status: "sorting", updatedAt: new Date() }).where(eq(warehouseSortingBatches.id, input.batchId));
    await writeWarehouseEvent(tx, { warehouseId: batch.warehouseId, entityType: "package", entityId: pkg.id, eventType: "warehouse.package.sorted", previousState: previous, newState: "sorted", actorUserId: userId });
    await writeWarehouseEvent(tx, { warehouseId: batch.warehouseId, entityType: "batch", entityId: batch.id, eventType: "warehouse.package.added_to_batch", previousState: batch.status, newState: "sorting", actorUserId: userId });
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.package.added_to_batch", entityType: "warehouse_sorting_batch", entityId: String(batch.id), afterState: { packageId: pkg.id }, requestId: getRequestId() });
    return { batch: { ...batch, status: "sorting" }, pkg: { ...pkg, status: "sorted" }, changed: true };
  });
  if (result.changed) emitWarehouseOperationalEvent({ warehouseId: result.batch.warehouseId, entityType: "package", entityId: input.packageId, eventType: "warehouse.package.sorted", previousState: "verified", newState: "sorted" });
  return getSortingBatch(userId, input.batchId, platformAdmin);
}

export async function removePackageFromBatch(userId: number, input: { batchId: number; packageId: number }, platformAdmin = false) {
  const db = await database();
  const [batch] = await db.select().from(warehouseSortingBatches).where(eq(warehouseSortingBatches.id, input.batchId)).limit(1);
  if (!batch) throw notFound("Sorting batch not found.");
  await assertWarehouseAccess(db, userId, batch.warehouseId, platformAdmin);
  if (!["open", "sorting", "sorted"].includes(batch.status)) throw invalidState("Packages cannot be removed from this sorting batch.");
  const [link] = await db.select().from(warehouseSortingBatchPackages).where(and(eq(warehouseSortingBatchPackages.batchId, input.batchId), eq(warehouseSortingBatchPackages.packageId, input.packageId))).limit(1);
  if (!link) throw notFound("Package is not assigned to this sorting batch.");
  const [pkg] = await db.select().from(warehousePackages).where(eq(warehousePackages.id, input.packageId)).limit(1);
  if (!pkg || pkg.status !== "sorted") throw invalidState("Only sorted packages can be removed from a batch.");
  await db.delete(warehouseSortingBatchPackages).where(eq(warehouseSortingBatchPackages.id, link.id));
  await db.update(warehousePackages).set({ status: "verified", sortedAt: null, updatedAt: new Date() }).where(eq(warehousePackages.id, pkg.id));
  const remaining = await db.select({ id: warehouseSortingBatchPackages.id }).from(warehouseSortingBatchPackages).where(eq(warehouseSortingBatchPackages.batchId, input.batchId));
  if (!remaining.length) await db.update(warehouseSortingBatches).set({ status: "open", updatedAt: new Date() }).where(eq(warehouseSortingBatches.id, input.batchId));
  await db.insert(warehouseEvents).values({ warehouseId: batch.warehouseId, entityType: "package", entityId: pkg.id, eventType: "warehouse.package.removed_from_batch", previousState: "sorted", newState: "verified", actorUserId: userId });
  await recordAuditEvent({ actorUserId: userId, action: "warehouse.package.removed_from_batch", entityType: "warehouse_sorting_batch", entityId: String(input.batchId), afterState: { packageId: pkg.id }, requestId: getRequestId() });
  return getSortingBatch(userId, input.batchId, platformAdmin);
}

export async function markPackageDispatchReady(userId: number, packageId: number, platformAdmin = false) {
  const db = await database();
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM warehouse_packages WHERE id = ${Number(packageId)} FOR UPDATE`);
    const [pkg] = await tx.select().from(warehousePackages).where(eq(warehousePackages.id, packageId)).limit(1);
    if (!pkg) throw notFound("Warehouse package not found.");
    await assertWarehouseAccess(db, userId, pkg.warehouseId, platformAdmin, true);
    if (pkg.status === "dispatch_ready") return { pkg, changed: false };
    if (pkg.status !== "sorted") throw invalidState("Only sorted packages can become dispatch-ready.");
    const [link] = await tx.select().from(warehouseSortingBatchPackages).where(eq(warehouseSortingBatchPackages.packageId, packageId)).limit(1);
    if (!link) throw invalidState("A package must belong to a sorting batch before dispatch readiness.");
    await tx.update(warehousePackages).set({ status: "dispatch_ready", dispatchReadyAt: new Date(), updatedAt: new Date() }).where(and(eq(warehousePackages.id, packageId), eq(warehousePackages.status, "sorted")));
    await writeWarehouseEvent(tx, { warehouseId: pkg.warehouseId, entityType: "package", entityId: packageId, eventType: "package.dispatch_ready", previousState: "sorted", newState: "dispatch_ready", actorUserId: userId });
    const packageLinks = await tx.select({ package: warehousePackages }).from(warehouseSortingBatchPackages).innerJoin(warehousePackages, eq(warehouseSortingBatchPackages.packageId, warehousePackages.id)).where(eq(warehouseSortingBatchPackages.batchId, link.batchId));
    if (packageLinks.length && packageLinks.every((row: any) => row.package.status === "dispatch_ready" || row.package.id === packageId)) {
      await tx.update(warehouseSortingBatches).set({ status: "dispatch_ready", readyAt: new Date(), updatedAt: new Date() }).where(eq(warehouseSortingBatches.id, link.batchId));
      await writeWarehouseEvent(tx, { warehouseId: pkg.warehouseId, entityType: "batch", entityId: link.batchId, eventType: "warehouse.batch.dispatch_ready", previousState: "sorting", newState: "dispatch_ready", actorUserId: userId });
    }
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.package.dispatch_ready", entityType: "warehouse_package", entityId: String(packageId), afterState: { packageReference: pkg.packageReference }, requestId: getRequestId() });
    return { pkg: { ...pkg, status: "dispatch_ready" }, changed: true };
  });
  if (result.changed) emitWarehouseOperationalEvent({ warehouseId: result.pkg.warehouseId, entityType: "package", entityId: packageId, eventType: "package.dispatch_ready", previousState: "sorted", newState: "dispatch_ready" });
  return hydratePackage(db, result.pkg);
}

export async function closeSortingBatch(userId: number, batchId: number, platformAdmin = false) {
  const db = await database();
  const result = await withTransaction(async (tx) => {
    await tx.execute(`SELECT id FROM warehouse_sorting_batches WHERE id = ${Number(batchId)} FOR UPDATE`);
    const [batch] = await tx.select().from(warehouseSortingBatches).where(eq(warehouseSortingBatches.id, batchId)).limit(1);
    if (!batch) throw notFound("Sorting batch not found.");
    await assertWarehouseAccess(db, userId, batch.warehouseId, platformAdmin, true);
    if (batch.status === "closed") return { batch, changed: false };
    if (batch.status !== "dispatch_ready") throw invalidState("Only a dispatch-ready batch can be closed.");
    const links = await tx.select({ package: warehousePackages }).from(warehouseSortingBatchPackages).innerJoin(warehousePackages, eq(warehouseSortingBatchPackages.packageId, warehousePackages.id)).where(eq(warehouseSortingBatchPackages.batchId, batchId));
    if (!links.length || links.some((row: any) => row.package.status !== "dispatch_ready")) throw invalidState("Every package must be dispatch-ready before the batch is closed.");
    await tx.update(warehouseSortingBatches).set({ status: "closed", closedAt: new Date(), updatedAt: new Date() }).where(and(eq(warehouseSortingBatches.id, batchId), eq(warehouseSortingBatches.status, "dispatch_ready")));
    await writeWarehouseEvent(tx, { warehouseId: batch.warehouseId, entityType: "batch", entityId: batchId, eventType: "warehouse.batch.closed", previousState: "dispatch_ready", newState: "closed", actorUserId: userId });
    await writeAuditEvent(tx, { actorUserId: userId, action: "warehouse.batch.closed", entityType: "warehouse_sorting_batch", entityId: String(batchId), requestId: getRequestId() });
    return { batch: { ...batch, status: "closed" }, changed: true };
  });
  if (result.changed) emitWarehouseOperationalEvent({ warehouseId: result.batch.warehouseId, entityType: "batch", entityId: batchId, eventType: "warehouse.batch.closed", previousState: "dispatch_ready", newState: "closed" });
  return getSortingBatch(userId, batchId, platformAdmin);
}

export async function listWarehouseEvents(userId: number, input: { warehouseId: number; limit: number; offset: number; entityType?: "intake" | "package" | "batch"; entityId?: number }, platformAdmin = false) {
  const db = await database();
  await assertWarehouseAccess(db, userId, input.warehouseId, platformAdmin);
  const conditions: any[] = [eq(warehouseEvents.warehouseId, input.warehouseId)];
  if (input.entityType) conditions.push(eq(warehouseEvents.entityType, input.entityType));
  if (input.entityId) conditions.push(eq(warehouseEvents.entityId, input.entityId));
  return db.select().from(warehouseEvents).where(and(...conditions)).orderBy(desc(warehouseEvents.createdAt)).limit(input.limit).offset(input.offset);
}

export async function dashboard(userId: number, warehouseId: number | undefined, platformAdmin = false) {
  const db = await database();
  const scope = await scopeWarehouseIds(db, userId, platformAdmin);
  if (warehouseId) await assertWarehouseAccess(db, userId, warehouseId, platformAdmin);
  const warehousesScope = warehouseId ? [warehouseId] : scope;
  if (warehousesScope && !warehousesScope.length) return { warehouses: [], counts: { awaitingIntake: 0, received: 0, verificationRequired: 0, discrepancies: 0, sortingQueue: 0, dispatchReadyPackages: 0, activeBatches: 0 } };
  const intakeConditions = warehousesScope ? inArray(warehouseIntakes.warehouseId, warehousesScope) : undefined;
  const packageConditions = warehousesScope ? inArray(warehousePackages.warehouseId, warehousesScope) : undefined;
  const batchConditions = warehousesScope ? inArray(warehouseSortingBatches.warehouseId, warehousesScope) : undefined;
  const [intakes, packages, batches] = await Promise.all([
    db.select().from(warehouseIntakes).where(intakeConditions),
    db.select().from(warehousePackages).where(packageConditions),
    db.select().from(warehouseSortingBatches).where(batchConditions),
  ]);
  return { warehouses: warehousesScope ?? [], counts: { awaitingIntake: intakes.filter((row: any) => row.status === "awaiting_intake").length, received: intakes.filter((row: any) => row.status === "received").length, verificationRequired: intakes.filter((row: any) => row.status === "verification_required").length, discrepancies: intakes.filter((row: any) => row.status === "discrepancy").length, sortingQueue: packages.filter((row: any) => row.status === "verified").length, dispatchReadyPackages: packages.filter((row: any) => row.status === "dispatch_ready").length, activeBatches: batches.filter((row: any) => ["open", "sorting", "sorted", "dispatch_ready"].includes(row.status)).length } };
}
