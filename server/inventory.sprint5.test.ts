import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { catalogCategories, catalogProductVariants, catalogProducts, inventoryBalances, inventoryLocations, inventoryMovements, inventoryReservations, auditLogs, sellerMembers, sellers, users } from "../drizzle/schema";
import { adjustmentInputSchema, reservationInputSchema, stockInputSchema } from "../shared/validation/inventorySchemas";
import { addInitialStock, adjustStock, convertReservation, createReservation, createSellerLocation, expireDueReservations, listInventory, listMovements, releaseReservation, reconcileInventory } from "./domains/inventory/service";
import type { TrpcContext } from "./_core/context";

const hasDatabase = Boolean(process.env.DATABASE_URL);

function insertId(result: unknown): number { const candidate = (result as any)?.[0]?.insertId ?? (result as any)?.insertId; const id = Number(candidate); if (!Number.isInteger(id) || id <= 0) throw new Error("Expected a valid insert id."); return id; }
describe.skipIf(!hasDatabase)("Sprint 5 inventory and stock control", () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const actorA = { id: 0, role: "user" as const };
  const actorB = { id: 0, role: "user" as const };
  let sellerA = 0;
  let sellerB = 0;
  let variantA = 0;
  let variantB = 0;
  let concurrencyVariant = 0;
  let locationA = 0;
  let locationA2 = 0;
  let locationB = 0;
  let reservationForRelease = 0;
  let reservationForExpiry = 0;
  let reservationForConversion = 0;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is required for Sprint 5 integration tests.");
    const userAResult = await db.insert(users).values({ openId: `inventory-a-${suffix}`, name: "Inventory Seller A", email: `inventory-a-${suffix}@test.local`, loginMethod: "test" });
    const userBResult = await db.insert(users).values({ openId: `inventory-b-${suffix}`, name: "Inventory Seller B", email: `inventory-b-${suffix}@test.local`, loginMethod: "test" });
    actorA.id = insertId(userAResult);
    actorB.id = insertId(userBResult);
    const sellerAResult = await db.insert(sellers).values({ legalBusinessName: `Inventory A ${suffix}`, storeName: `Inventory A ${suffix}`, storeSlug: `inventory-a-${suffix}`, businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "Test address A", businessPhone: "+254700000001", businessEmail: `seller-a-${suffix}@test.local`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    const sellerBResult = await db.insert(sellers).values({ legalBusinessName: `Inventory B ${suffix}`, storeName: `Inventory B ${suffix}`, storeSlug: `inventory-b-${suffix}`, businessType: "retail", country: "Kenya", county: "Mombasa", town: "Mombasa", businessAddress: "Test address B", businessPhone: "+254700000002", businessEmail: `seller-b-${suffix}@test.local`, status: "approved", verificationStatus: "approved", approvedAt: new Date() });
    sellerA = insertId(sellerAResult);
    sellerB = insertId(sellerBResult);
    await db.insert(sellerMembers).values([{ sellerId: sellerA, userId: actorA.id, memberRole: "owner", status: "active" }, { sellerId: sellerB, userId: actorB.id, memberRole: "owner", status: "active" }]);
    const categoryResult = await db.insert(catalogCategories).values({ name: `Inventory Category ${suffix}`, slug: `inventory-category-${suffix}`, status: "active" });
    const categoryId = insertId(categoryResult);
    const productAResult = await db.insert(catalogProducts).values({ sellerId: sellerA, categoryId, name: `Inventory Product A ${suffix}`, slug: `inventory-product-a-${suffix}`, status: "published", moderationStatus: "approved" });
    const productBResult = await db.insert(catalogProducts).values({ sellerId: sellerB, categoryId, name: `Inventory Product B ${suffix}`, slug: `inventory-product-b-${suffix}`, status: "published", moderationStatus: "approved" });
    const productA = insertId(productAResult);
    const productB = insertId(productBResult);
    const variantAResult = await db.insert(catalogProductVariants).values({ productId: productA, sku: `INV-A-${suffix}`, name: "Default", priceMinor: 1000, currency: "KES", status: "active" });
    const variantBResult = await db.insert(catalogProductVariants).values({ productId: productB, sku: `INV-B-${suffix}`, name: "Default", priceMinor: 1000, currency: "KES", status: "active" });
    const concurrencyProductResult = await db.insert(catalogProducts).values({ sellerId: sellerA, categoryId, name: `Inventory Concurrency ${suffix}`, slug: `inventory-concurrency-${suffix}`, status: "published", moderationStatus: "approved" });
    const concurrencyProduct = insertId(concurrencyProductResult);
    const concurrencyVariantResult = await db.insert(catalogProductVariants).values({ productId: concurrencyProduct, sku: `INV-C-${suffix}`, name: "Default", priceMinor: 1000, currency: "KES", status: "active" });
    variantA = insertId(variantAResult);
    variantB = insertId(variantBResult);
    concurrencyVariant = insertId(concurrencyVariantResult);
    const createdA = await createSellerLocation(actorA, { name: `Nairobi warehouse ${suffix}`, type: "warehouse", country: "Kenya", county: "Nairobi", city: "Nairobi", address: "A warehouse" });
    const createdA2 = await createSellerLocation(actorA, { name: `Mombasa store ${suffix}`, type: "seller_location", country: "Kenya", county: "Mombasa", city: "Mombasa", address: "A store" });
    const createdB = await createSellerLocation(actorB, { name: `B warehouse ${suffix}`, type: "warehouse", country: "Kenya", county: "Mombasa", city: "Mombasa", address: "B warehouse" });
    locationA = createdA.id; locationA2 = createdA2.id; locationB = createdB.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const sellerIds = [sellerA, sellerB].filter(Boolean);
    const userIds = [actorA.id, actorB.id].filter(Boolean);
    if (sellerIds.length) {
      await db.delete(inventoryMovements).where(inArray(inventoryMovements.sellerId, sellerIds));
      await db.delete(inventoryReservations).where(inArray(inventoryReservations.sellerId, sellerIds));
      await db.delete(inventoryBalances).where(inArray(inventoryBalances.sellerId, sellerIds));
      await db.delete(inventoryLocations).where(inArray(inventoryLocations.sellerId, sellerIds));
      await db.delete(sellerMembers).where(inArray(sellerMembers.sellerId, sellerIds));
      await db.delete(catalogProductVariants).where(inArray(catalogProductVariants.id, [variantA, variantB, concurrencyVariant]));
      const productRows = await db.select({ id: catalogProducts.id, categoryId: catalogProducts.categoryId }).from(catalogProducts).where(inArray(catalogProducts.sellerId, sellerIds));
      if (productRows.length) await db.delete(catalogProducts).where(inArray(catalogProducts.id, productRows.map((row) => row.id)));
      const categoryIds = [...new Set(productRows.map((row) => row.categoryId))];
      if (categoryIds.length) await db.delete(catalogCategories).where(inArray(catalogCategories.id, categoryIds));
      await db.delete(sellers).where(inArray(sellers.id, sellerIds));
    }
    if (userIds.length) { await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, userIds)); await db.delete(users).where(inArray(users.id, userIds)); }
  });

  it("rejects fractional, zero, and expired quantities at the validation boundary", () => {
    expect(() => stockInputSchema.parse({ variantId: 1, locationId: 1, quantity: 1.5, reason: "receive" })).toThrow();
    expect(() => adjustmentInputSchema.parse({ variantId: 1, locationId: 1, delta: 0, movementType: "correction", reason: "fix" })).toThrow();
    expect(() => reservationInputSchema.parse({ variantId: 1, locationId: 1, quantity: 1, expiresAt: new Date(Date.now() - 1000), referenceType: "checkout", referenceId: "x" })).toThrow();
  });

  it("creates balances and immutable movements for initial stock and adjustments", async () => {
    await addInitialStock(actorA, { variantId: variantA, locationId: locationA, quantity: 10, reason: "Opening receiving" });
    await adjustStock(actorA, { variantId: variantA, locationId: locationA, delta: 5, movementType: "purchase_receipt", reason: "Supplier delivery" });
    await adjustStock(actorA, { variantId: variantA, locationId: locationA, delta: -2, movementType: "damage", reason: "Damaged packaging" });
    const rows = await listInventory(actorA, variantA, locationA);
    expect(rows[0].balance.onHand).toBe(13);
    expect(rows[0].balance.damaged).toBe(2);
    expect(rows[0].available).toBe(13);
    const movements = await listMovements(actorA, { variantId: variantA, locationId: locationA });
    expect(movements.filter((movement) => movement.variantId === variantA).length).toBe(4);
    await expect(adjustStock(actorA, { variantId: variantA, locationId: locationA, delta: -30, movementType: "loss", reason: "Invalid loss" })).rejects.toThrow("reserved");
  });

  it("keeps SKU balances separate across locations", async () => {
    await addInitialStock(actorA, { variantId: variantA, locationId: locationA2, quantity: 20, reason: "Second location receiving" });
    const rows = await listInventory(actorA, variantA);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.balance.locationId).sort()).toEqual([locationA, locationA2].sort());
    expect(rows.find((row) => row.balance.locationId === locationA2)?.available).toBe(20);
  });

  it("prevents seller IDOR across SKUs, locations, movements, and reservations", async () => {
    await addInitialStock(actorB, { variantId: variantB, locationId: locationB, quantity: 5, reason: "Seller B receiving" });
    await expect(addInitialStock(actorA, { variantId: variantB, locationId: locationB, quantity: 1, reason: "Cross seller attempt" })).rejects.toThrow("membership");
    await expect(addInitialStock(actorA, { variantId: variantA, locationId: locationB, quantity: 1, reason: "Wrong location attempt" })).rejects.toThrow("another seller");
    await expect(listMovements(actorA, { variantId: variantB })).rejects.toThrow("membership");
    const bReservation = await createReservation(actorB, { variantId: variantB, locationId: locationB, quantity: 1, expiresAt: new Date(Date.now() + 60_000), referenceType: "test", referenceId: `b-${suffix}` });
    await expect(releaseReservation(actorA, { id: bReservation.reservationId, reason: "IDOR" })).rejects.toThrow("membership");
    await releaseReservation(actorB, { id: bReservation.reservationId, reason: "cleanup" });
  });

  it("reserves only available units and makes release idempotent", async () => {
    const reservation = await createReservation(actorA, { variantId: variantA, locationId: locationA, quantity: 7, expiresAt: new Date(Date.now() + 120_000), referenceType: "test", referenceId: `reserve-${suffix}` });
    reservationForRelease = reservation.reservationId;
    const rows = await listInventory(actorA, variantA, locationA);
    expect(rows[0].balance.reserved).toBe(7);
    await expect(createReservation(actorA, { variantId: variantA, locationId: locationA, quantity: 7, expiresAt: new Date(Date.now() + 120_000), referenceType: "test", referenceId: `too-many-${suffix}` })).rejects.toThrow("Insufficient");
    const released = await releaseReservation(actorA, { id: reservation.reservationId, reason: "Test release" });
    expect(released.alreadyReleased).toBe(false);
    const repeated = await releaseReservation(actorA, { id: reservation.reservationId, reason: "Repeated release" });
    expect(repeated.alreadyReleased).toBe(true);
    const after = await listInventory(actorA, variantA, locationA);
    expect(after[0].balance.reserved).toBe(0);
  });

  it("expires due reservations through the backend service and blocks converted release", async () => {
    const expiry = await createReservation(actorA, { variantId: variantA, locationId: locationA, quantity: 1, expiresAt: new Date(Date.now() + 120_000), referenceType: "test", referenceId: `expiry-${suffix}` });
    reservationForExpiry = expiry.reservationId;
    const db = await getDb(); if (!db) throw new Error("Database unavailable");
    await db.update(inventoryReservations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(inventoryReservations.id, expiry.reservationId));
    const result = await expireDueReservations();
    expect(result.expired).toBeGreaterThanOrEqual(1);
    const expiredRows = await db.select().from(inventoryReservations).where(eq(inventoryReservations.id, expiry.reservationId));
    expect(expiredRows[0].status).toBe("expired");
    const converted = await createReservation(actorA, { variantId: variantA, locationId: locationA, quantity: 1, expiresAt: new Date(Date.now() + 120_000), referenceType: "test", referenceId: `converted-${suffix}` });
    reservationForConversion = converted.reservationId;
    await convertReservation(actorA, { id: converted.reservationId, referenceType: "future_order", referenceId: `order-ref-${suffix}` });
    await expect(releaseReservation(actorA, { id: converted.reservationId, reason: "Invalid release" })).rejects.toThrow("Converted");
  });

  it("keeps simultaneous reservation attempts within available stock", async () => {
    await addInitialStock(actorA, { variantId: concurrencyVariant, locationId: locationA, quantity: 10, reason: "Concurrency fixture" });
    const attempts = await Promise.allSettled([
      createReservation(actorA, { variantId: concurrencyVariant, locationId: locationA, quantity: 7, expiresAt: new Date(Date.now() + 120_000), referenceType: "concurrency", referenceId: `a-${suffix}` }),
      createReservation(actorA, { variantId: concurrencyVariant, locationId: locationA, quantity: 6, expiresAt: new Date(Date.now() + 120_000), referenceType: "concurrency", referenceId: `b-${suffix}` }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rows = await listInventory(actorA, concurrencyVariant, locationA);
    expect(rows[0].balance.reserved).toBeLessThanOrEqual(10);
    expect(rows[0].available).toBeGreaterThanOrEqual(0);
  });

  it("reconciles a correct ledger and detects an intentional balance inconsistency", async () => {
    const clean = await reconcileInventory(actorA);
    expect(clean.consistent).toBe(true);
    const db = await getDb(); if (!db) throw new Error("Database unavailable");
    const rows = await db.select().from(inventoryBalances).where(and(eq(inventoryBalances.sellerId, sellerA), eq(inventoryBalances.variantId, variantA), eq(inventoryBalances.locationId, locationA))).limit(1);
    const before = rows[0];
    await db.update(inventoryBalances).set({ onHand: before.onHand + 1 }).where(eq(inventoryBalances.id, before.id));
    const inconsistent = await reconcileInventory(actorA);
    expect(inconsistent.consistent).toBe(false);
    expect(inconsistent.findings.some((finding) => finding.balanceId === before.id)).toBe(true);
    await db.update(inventoryBalances).set({ onHand: before.onHand }).where(eq(inventoryBalances.id, before.id));
  });

  it("does not expose internal warehouse quantities through public availability", async () => {
    const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.inventory.availability({ variantId: variantA });
    expect(result).toMatchObject({ variantId: variantA, available: true });
    expect(result).not.toHaveProperty("availableUnits");
    expect(result).not.toHaveProperty("locations");
  });
});
