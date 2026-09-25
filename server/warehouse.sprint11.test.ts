import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { catalogCategories, catalogProductVariants, catalogProducts, checkoutSessions, commerceCarts, customerAddresses, inventoryMovements, orderAddressSnapshots, orderItems, orderSellerOrders, orders, paymentAttempts, sellers, users, warehouseDiscrepancies, warehouseEvents, warehouseIntakes, warehousePackageItems, warehousePackages, warehouseSortingBatchPackages, warehouseSortingBatches, warehouseUserAssignments, warehouses } from "../drizzle/schema";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
function insertId(result: unknown) { return Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0); }
function context(user: any, permissions: string[] = []) : TrpcContext { return { user, permissions: new Set(permissions), req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }
const warehousePermissions = ["warehouse.view", "warehouse.intake", "warehouse.sort", "warehouse.dispatch", "warehouse.manage"];

integration("warehouse Sprint 11", () => {
  let db: Db;
  let admin: any;
  let staff: any;
  let sellerUser: any;
  let sellerId: number;
  let categoryId: number;
  let productId: number;
  let variantId: number;
  let checkoutId: number;
  let paymentId: number;
  let orderId: number;
  let sellerOrderId: number;
  let orderItemId: number;
  let addressSnapshotId: number;
  let warehouseId: number;
  let secondWarehouseId: number;
  let intakeId: number;
  let packageOneId: number;
  let packageTwoId: number;
  let batchId: number;

  beforeAll(async () => {
    db = (await getDb())!;
    const now = Date.now();
    const adminOpenId = `warehouse-admin-${now}`;
    const staffOpenId = `warehouse-staff-${now}`;
    const sellerOpenId = `warehouse-seller-${now}`;
    const adminResult = await db.insert(users).values({ openId: adminOpenId, name: "Warehouse Admin", email: `warehouse-admin-${now}@example.com`, role: "admin" });
    const staffResult = await db.insert(users).values({ openId: staffOpenId, name: "Warehouse Staff", email: `warehouse-staff-${now}@example.com`, role: "user" });
    const sellerUserResult = await db.insert(users).values({ openId: sellerOpenId, name: "Warehouse Seller", email: `warehouse-seller-${now}@example.com`, role: "user" });
    admin = { id: insertId(adminResult), openId: adminOpenId, name: "Warehouse Admin", email: `warehouse-admin-${now}@example.com`, role: "admin" };
    staff = { id: insertId(staffResult), openId: staffOpenId, name: "Warehouse Staff", email: `warehouse-staff-${now}@example.com`, role: "user" };
    sellerUser = { id: insertId(sellerUserResult), openId: sellerOpenId, name: "Warehouse Seller", email: `warehouse-seller-${now}@example.com`, role: "user" };
    const sellerResult = await db.insert(sellers).values({ legalBusinessName: `Warehouse Seller ${now}`, storeName: `Warehouse Seller ${now}`, storeSlug: `warehouse-seller-${now}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Warehouse fixture address", businessPhone: "+254700000077", businessEmail: `warehouse-seller-${now}@example.com`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    sellerId = insertId(sellerResult);
    const categoryResult = await db.insert(catalogCategories).values({ name: `Warehouse Category ${now}`, slug: `warehouse-category-${now}`, status: "active" });
    categoryId = insertId(categoryResult);
    const productResult = await db.insert(catalogProducts).values({ sellerId, categoryId, name: `Warehouse Product ${now}`, slug: `warehouse-product-${now}`, status: "published", moderationStatus: "approved", publishedAt: new Date() });
    productId = insertId(productResult);
    const variantResult = await db.insert(catalogProductVariants).values({ productId, sku: `WH-${now}`, name: "Default", priceMinor: 45000, currency: "KES", status: "active" });
    variantId = insertId(variantResult);
    const warehouseResult = await db.insert(warehouses).values({ name: `Nairobi Fulfilment ${now}`, code: `NBO${String(now).slice(-5)}`, country: "Kenya", county: "Nairobi", town: "Nairobi", address: "Industrial Area", status: "active" });
    warehouseId = insertId(warehouseResult);
    const secondWarehouseResult = await db.insert(warehouses).values({ name: `Mombasa Fulfilment ${now}`, code: `MBA${String(now).slice(-5)}`, country: "Kenya", county: "Mombasa", town: "Mombasa", address: "Port area", status: "active" });
    secondWarehouseId = insertId(secondWarehouseResult);
    await db.insert(warehouseUserAssignments).values({ warehouseId, userId: staff.id, assignedByUserId: admin.id, status: "active" });
    const cartResult = await db.insert(commerceCarts).values({ userId: sellerUser.id, status: "converted", currency: "KES", activeKey: null });
    const cartId = insertId(cartResult);
    const checkoutResult = await db.insert(checkoutSessions).values({ userId: sellerUser.id, cartId, status: "completed", currency: "KES", shippingMethod: "standard", addressId: null, addressSnapshot: null, subtotalMinor: 90000, shippingMinor: 0, feeMinor: 0, taxMinor: 0, totalMinor: 90000, issues: [], idempotencyKey: `warehouse-checkout-${now}`, expiresAt: new Date(Date.now() + 3600000), validatedAt: new Date() });
    checkoutId = insertId(checkoutResult);
    const paymentResult = await db.insert(paymentAttempts).values({ userId: sellerUser.id, checkoutSessionId: checkoutId, provider: "mpesa", providerReference: `WH-PAY-${now}`, internalReference: `WH-INT-${now}`, idempotencyKey: `warehouse-payment-${now}`, amountMinor: 90000, currency: "KES", status: "successful", expiresAt: new Date(Date.now() + 3600000), completedAt: new Date() });
    paymentId = insertId(paymentResult);
    const orderResult = await db.insert(orders).values({ orderNumber: `SM-WH-${String(now).slice(-8)}`, userId: sellerUser.id, checkoutSessionId: checkoutId, paymentAttemptId: paymentId, currency: "KES", subtotalMinor: 90000, shippingMinor: 0, taxMinor: 0, feeMinor: 0, discountMinor: 0, totalMinor: 90000, status: "confirmed", paymentStatus: "paid", fulfilmentStatus: "handed_to_logistics" });
    orderId = insertId(orderResult);
    const sellerOrderResult = await db.insert(orderSellerOrders).values({ parentOrderId: orderId, sellerId, sellerName: `Warehouse Seller ${now}`, sellerSlug: `warehouse-seller-${now}`, sellerSubtotalMinor: 90000, shippingMinor: 0, taxMinor: 0, feeMinor: 0, totalMinor: 90000, status: "confirmed", fulfilmentStatus: "ready", fulfilmentState: "handed_to_logistics", handedToLogisticsAt: new Date() });
    sellerOrderId = insertId(sellerOrderResult);
    const itemResult = await db.insert(orderItems).values({ sellerOrderId, productId, variantId, sellerId, productName: `Warehouse Product ${now}`, variantName: "Default", sku: `WH-${now}`, quantity: 2, unitPriceMinor: 45000, lineSubtotalMinor: 90000, currency: "KES" });
    orderItemId = insertId(itemResult);
    const addressResult = await db.insert(orderAddressSnapshots).values({ orderId, recipientName: "Warehouse Customer", recipientPhone: "+254711111111", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Westlands", estateBuilding: "Test Towers", streetRoad: "Waiyaki Way", directions: "Near the mall" });
    addressSnapshotId = insertId(addressResult);
  });

  afterAll(async () => {
    if (!db) return;
    if (batchId) await db.delete(warehouseSortingBatchPackages).where(eq(warehouseSortingBatchPackages.batchId, batchId));
    if (batchId) await db.delete(warehouseSortingBatches).where(eq(warehouseSortingBatches.id, batchId));
    if (intakeId) await db.delete(warehouseEvents).where(and(eq(warehouseEvents.warehouseId, warehouseId), inArray(warehouseEvents.entityId, [intakeId, packageOneId ?? 0, packageTwoId ?? 0])));
    if (intakeId) await db.delete(warehouseDiscrepancies).where(eq(warehouseDiscrepancies.intakeId, intakeId));
    if (packageOneId || packageTwoId) await db.delete(warehousePackageItems).where(inArray(warehousePackageItems.packageId, [packageOneId, packageTwoId].filter(Boolean) as number[]));
    if (intakeId) await db.delete(warehousePackages).where(eq(warehousePackages.intakeId, intakeId));
    if (intakeId) await db.delete(warehouseIntakes).where(eq(warehouseIntakes.id, intakeId));
    await db.delete(warehouseUserAssignments).where(eq(warehouseUserAssignments.userId, staff.id));
    await db.delete(warehouses).where(inArray(warehouses.id, [warehouseId, secondWarehouseId]));
    if (addressSnapshotId) await db.delete(orderAddressSnapshots).where(eq(orderAddressSnapshots.id, addressSnapshotId));
    if (orderItemId) await db.delete(orderItems).where(eq(orderItems.id, orderItemId));
    if (sellerOrderId) await db.delete(orderSellerOrders).where(eq(orderSellerOrders.id, sellerOrderId));
    if (orderId) await db.delete(orders).where(eq(orders.id, orderId));
    if (paymentId) await db.delete(paymentAttempts).where(eq(paymentAttempts.id, paymentId));
    if (checkoutId) await db.delete(checkoutSessions).where(eq(checkoutSessions.id, checkoutId));
    await db.delete(commerceCarts).where(eq(commerceCarts.userId, sellerUser.id));
    await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
    await db.delete(catalogProductVariants).where(eq(catalogProductVariants.id, variantId));
    await db.delete(catalogProducts).where(eq(catalogProducts.id, productId));
    await db.delete(catalogCategories).where(eq(catalogCategories.id, categoryId));
    await db.delete(sellers).where(eq(sellers.id, sellerId));
    await db.delete(users).where(inArray(users.id, [admin.id, staff.id, sellerUser.id]));
  });

  it("enforces warehouse permissions and location scope", async () => {
    const sellerCaller = appRouter.createCaller(context(sellerUser));
    await expect(sellerCaller.commerce.warehouse.list({ limit: 20, offset: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const staffCaller = appRouter.createCaller(context(staff, warehousePermissions));
    expect((await staffCaller.commerce.warehouse.list({ limit: 20, offset: 0 })).map((row) => row.id)).toContain(warehouseId);
    await expect(staffCaller.commerce.warehouse.get({ warehouseId: secondWarehouseId })).rejects.toThrow("not assigned");
    const adminCaller = appRouter.createCaller(context(admin));
    expect((await adminCaller.commerce.warehouse.list({ limit: 20, offset: 0 })).map((row) => row.id)).toEqual(expect.arrayContaining([warehouseId, secondWarehouseId]));
  });

  it("receives one seller handoff exactly once, even when two workers retry it", async () => {
    const caller = appRouter.createCaller(context(staff, warehousePermissions));
    const results = await Promise.all([caller.commerce.warehouse.receiveIntake({ sellerOrderId, warehouseId, packageCount: 2, receivedItemCount: 2 }), caller.commerce.warehouse.receiveIntake({ sellerOrderId, warehouseId, packageCount: 2, receivedItemCount: 2 })]);
    expect(results[0].intake.id).toBe(results[1].intake.id);
    intakeId = results[0].intake.id;
    expect((await db.select().from(warehouseIntakes).where(eq(warehouseIntakes.sellerOrderId, sellerOrderId)))).toHaveLength(1);
  });

  it("supports split packages, quantity limits, verification, discrepancies, and resolution", async () => {
    const caller = appRouter.createCaller(context(staff, warehousePermissions));
    const first = await caller.commerce.warehouse.createPackage({ intakeId, items: [{ orderItemId, quantity: 1 }] });
    packageOneId = first.package.id;
    const second = await caller.commerce.warehouse.createPackage({ intakeId, items: [{ orderItemId, quantity: 1 }] });
    packageTwoId = second.package.id;
    await expect(caller.commerce.warehouse.createPackage({ intakeId, items: [{ orderItemId, quantity: 1 }] })).rejects.toThrow("exceed");
    await caller.commerce.warehouse.verifyPackage({ packageId: packageOneId });
    await caller.commerce.warehouse.verifyPackage({ packageId: packageTwoId });
    const verified = await caller.commerce.warehouse.verifyIntake({ intakeId });
    expect(verified.intake.status).toBe("verified");
    const discrepancy = await caller.commerce.warehouse.reportDiscrepancy({ intakeId, packageId: packageOneId, type: "damaged_package", description: "Outer carton dented during receiving", quantity: 1 });
    expect(discrepancy.resolutionStatus).toBe("open");
    await caller.commerce.warehouse.resolveDiscrepancy({ discrepancyId: discrepancy.id, resolutionStatus: "resolved", resolutionNote: "Contents checked and repacked." });
    await caller.commerce.warehouse.verifyPackage({ packageId: packageOneId });
    const final = await caller.commerce.warehouse.verifyIntake({ intakeId });
    expect(final.intake.status).toBe("verified");
  });

  it("groups verified packages into one sorting batch and creates a dispatch-ready handoff without inventory writes", async () => {
    const caller = appRouter.createCaller(context(staff, warehousePermissions));
    const beforeMovements = await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
    const batch = await caller.commerce.warehouse.createSortingBatch({ warehouseId, destinationCountry: "Kenya", destinationCounty: "Nairobi", destinationTown: "Nairobi", deliveryMethod: "standard" });
    batchId = batch.batch.id;
    await caller.commerce.warehouse.addPackageToBatch({ batchId, packageId: packageOneId });
    await caller.commerce.warehouse.addPackageToBatch({ batchId, packageId: packageTwoId });
    await caller.commerce.warehouse.addPackageToBatch({ batchId, packageId: packageTwoId });
    await caller.commerce.warehouse.markPackageDispatchReady({ packageId: packageOneId });
    await caller.commerce.warehouse.markPackageDispatchReady({ packageId: packageTwoId });
    const closed = await caller.commerce.warehouse.closeSortingBatch({ batchId });
    expect(closed.batch.status).toBe("closed");
    expect((await db.select().from(warehouseSortingBatchPackages).where(eq(warehouseSortingBatchPackages.batchId, batchId)))).toHaveLength(2);
    expect((await db.select().from(warehousePackages).where(inArray(warehousePackages.id, [packageOneId, packageTwoId]))).every((row) => row.status === "dispatch_ready")).toBe(true);
    expect((await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variantId)))).toHaveLength(beforeMovements.length);
    const events = await db.select().from(warehouseEvents).where(eq(warehouseEvents.warehouseId, warehouseId));
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining(["warehouse.intake.received", "warehouse.package.verified", "warehouse.discrepancy.reported", "warehouse.package.sorted", "warehouse.batch.created", "package.dispatch_ready", "warehouse.batch.closed"]));
  });

  it("prevents IDOR access to another warehouse package and keeps order traceability intact", async () => {
    const staffCaller = appRouter.createCaller(context(staff, warehousePermissions));
    const detail = await staffCaller.commerce.warehouse.getPackage({ packageId: packageOneId });
    expect(detail.package.sellerOrderId).toBe(sellerOrderId);
    expect(detail.items[0]?.orderItem.id).toBe(orderItemId);
    const otherUserResult = await db.insert(users).values({ openId: `warehouse-outsider-${Date.now()}`, name: "Warehouse Outsider", email: `warehouse-outsider-${Date.now()}@example.com`, role: "user" });
    const outsider = { id: insertId(otherUserResult), role: "user" };
    const outsiderCaller = appRouter.createCaller(context(outsider, warehousePermissions));
    await expect(outsiderCaller.commerce.warehouse.getPackage({ packageId: packageOneId })).rejects.toThrow("not assigned");
    await db.delete(users).where(eq(users.id, outsider.id));
  });
});
