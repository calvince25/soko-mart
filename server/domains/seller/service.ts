import { and, desc, eq, sql } from "drizzle-orm";
import { sellerApplications, sellerMembers, sellerSlugHistory, sellerVerificationDocuments, sellers } from "../../../drizzle/schema";
import { conflict, forbidden, invalidState, notFound, validationError } from "../../../shared/errors/appError";
import type { SellerProfileInput } from "../../../shared/validation/sellerSchemas";
import { getDb } from "../../db";
import { writeAuditEvent } from "../../audit/audit";
import { withTransaction } from "../../transactions/database";

const transitions: Record<string, readonly string[]> = {
  draft: ["pending_verification"], pending_verification: ["under_review"], under_review: ["approved", "rejected"],
  rejected: ["draft", "pending_verification"], approved: ["suspended", "closed"], suspended: ["approved"], closed: [],
};

export function normalizeStoreSlug(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized.length < 3) throw validationError("Store name must produce a URL-safe slug with at least 3 characters.");
  return normalized.slice(0, 180);
}

export function canTransitionSeller(from: string, to: string): boolean { return transitions[from]?.includes(to) ?? false; }

async function uniqueSlug(tx: any, requested: string, sellerId?: number): Promise<string> {
  const base = normalizeStoreSlug(requested);
  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`.slice(0, 180);
    const rows = await tx.select({ id: sellers.id }).from(sellers).where(eq(sellers.storeSlug, candidate)).limit(1);
    if (!rows.length || rows[0].id === sellerId) return candidate;
  }
  throw conflict("That store name is already in use.");
}

async function membershipForUser(userId: number, sellerId?: number) {
  const db = await getDb(); if (!db) throw validationError("Seller services are temporarily unavailable.");
  const rows = await db.select({ seller: sellers, membership: sellerMembers }).from(sellerMembers).innerJoin(sellers, eq(sellerMembers.sellerId, sellers.id)).where(and(eq(sellerMembers.userId, userId), eq(sellerMembers.status, "active"), sellerId ? eq(sellerMembers.sellerId, sellerId) : undefined)).orderBy(desc(sellers.updatedAt));
  return rows[0];
}

export async function getSellerForUser(userId: number) { return membershipForUser(userId); }

export async function createSeller(userId: number, input: SellerProfileInput, legalRepresentativeName: string | null) {
  return withTransaction(async (tx: any) => {
    const existing = await tx.select({ sellerId: sellerMembers.sellerId }).from(sellerMembers).where(and(eq(sellerMembers.userId, userId), eq(sellerMembers.memberRole, "owner"), eq(sellerMembers.status, "active"))).limit(1);
    if (existing.length) throw conflict("You already have a seller application.");
    const storeSlug = await uniqueSlug(tx, input.storeSlug ?? input.storeName);
    const created = await tx.insert(sellers).values({ ...input, businessDescription: input.businessDescription ?? null, storeSlug, status: "draft", verificationStatus: "not_started" });
    const sellerId = Number(created.insertId);
    await tx.insert(sellerMembers).values({ sellerId, userId, memberRole: "owner", status: "active" });
    await tx.insert(sellerSlugHistory).values({ sellerId, slug: storeSlug, active: 1 });
    await tx.insert(sellerApplications).values({ sellerId, legalRepresentativeName: legalRepresentativeName?.trim() || input.legalBusinessName, status: "draft", applicationVersion: 1 });
    await writeAuditEvent(tx, { actorUserId: userId, action: "seller.profile.created", entityType: "seller", entityId: String(sellerId), afterState: { storeSlug, status: "draft" } });
    return getSellerForUser(userId);
  });
}

export async function updateSeller(userId: number, sellerId: number, input: SellerProfileInput) {
  const membership = await membershipForUser(userId, sellerId);
  if (!membership || membership.membership.memberRole !== "owner") throw forbidden();
  if (!["draft", "rejected"].includes(membership.seller.status)) throw invalidState("Submitted seller applications cannot be edited. Start a new review update instead.");
  return withTransaction(async (tx: any) => {
    const storeSlug = await uniqueSlug(tx, input.storeSlug ?? input.storeName, sellerId);
    const before = membership.seller;
    await tx.update(sellers).set({ ...input, businessDescription: input.businessDescription ?? null, storeSlug, status: membership.seller.status === "rejected" ? "draft" : "draft", rejectionReason: null, verificationStatus: "not_started" }).where(eq(sellers.id, sellerId));
    if (storeSlug !== before.storeSlug) {
      await tx.update(sellerSlugHistory).set({ active: 0 }).where(and(eq(sellerSlugHistory.sellerId, sellerId), eq(sellerSlugHistory.active, 1)));
      await tx.insert(sellerSlugHistory).values({ sellerId, slug: storeSlug, active: 1 });
    }
    await writeAuditEvent(tx, { actorUserId: userId, action: "seller.profile.changed", entityType: "seller", entityId: String(sellerId), beforeState: { storeSlug: before.storeSlug, status: before.status }, afterState: { storeSlug, status: "draft" } });
    return getSellerForUser(userId);
  });
}

export async function submitSeller(userId: number, sellerId: number, application: { businessRegistrationNumber?: string | null; taxIdentificationNumber?: string | null; legalRepresentativeName: string }) {
  const membership = await membershipForUser(userId, sellerId);
  if (!membership || membership.membership.memberRole !== "owner") throw forbidden();
  if (!canTransitionSeller(membership.seller.status, "pending_verification")) throw invalidState("This seller application cannot be submitted in its current state.");
  return withTransaction(async (tx: any) => {
    const latest = await tx.select().from(sellerApplications).where(eq(sellerApplications.sellerId, sellerId)).orderBy(desc(sellerApplications.applicationVersion)).limit(1);
    const version = latest.length && latest[0].status !== "rejected" ? latest[0].applicationVersion : (latest[0]?.applicationVersion ?? 0) + (latest.length ? 1 : 0);
    if (latest.length && latest[0].status === "draft") {
      await tx.update(sellerApplications).set({ ...application, status: "submitted", submittedAt: new Date(), rejectionReason: null }).where(eq(sellerApplications.id, latest[0].id));
    } else {
      await tx.insert(sellerApplications).values({ sellerId, applicationVersion: version, ...application, status: "submitted", submittedAt: new Date() });
    }
    await tx.update(sellers).set({ status: "pending_verification", verificationStatus: "pending", rejectionReason: null }).where(eq(sellers.id, sellerId));
    await writeAuditEvent(tx, { actorUserId: userId, action: "seller.submitted", entityType: "seller", entityId: String(sellerId), afterState: { status: "pending_verification" } });
    return getSellerForUser(userId);
  });
}

export async function addDocument(userId: number, input: { sellerId: number; applicationId: number; documentType: string; storageKey: string; originalFilename: string; mimeType: string; fileSize: number }) {
  const membership = await membershipForUser(userId, input.sellerId);
  if (!membership || membership.membership.memberRole !== "owner") throw forbidden();
  if (!["draft", "rejected", "pending_verification"].includes(membership.seller.status)) throw invalidState("Documents can only be added before review begins.");
  if (!input.storageKey.startsWith(`private/seller/${input.sellerId}/`)) throw validationError("Verification documents must use a private seller storage namespace.");
  const db = await getDb(); if (!db) throw validationError("Seller services are temporarily unavailable.");
  const result = await db.insert(sellerVerificationDocuments).values({ ...input, status: "pending" }) as unknown as { insertId: number };
  await writeAuditEvent({ insert: (table: typeof import("../../../drizzle/schema").auditLogs) => db.insert(table) }, { actorUserId: userId, action: "seller.verification_document.added", entityType: "seller_verification_document", entityId: String(result.insertId), afterState: { sellerId: input.sellerId, documentType: input.documentType } });
  return { id: Number(result.insertId), status: "pending" as const };
}

export async function getPublicStore(slug: string) {
  const db = await getDb(); if (!db) throw validationError("Seller services are temporarily unavailable.");
  const rows = await db.select().from(sellers).where(and(eq(sellers.storeSlug, slug), eq(sellers.status, "approved"), eq(sellers.verificationStatus, "approved"))).limit(1);
  if (!rows.length) throw notFound("Store not found.");
  const store = rows[0];
  return { id: store.id, storeName: store.storeName, storeSlug: store.storeSlug, description: store.businessDescription, country: store.country, county: store.county, town: store.town, logoKey: store.logoKey, bannerKey: store.bannerKey, verified: true };
}

export async function listApplications() {
  const db = await getDb(); if (!db) throw validationError("Seller services are temporarily unavailable.");
  return db.select({ seller: sellers, application: sellerApplications }).from(sellerApplications).innerJoin(sellers, eq(sellerApplications.sellerId, sellers.id)).where(sql`${sellerApplications.status} in ('submitted','under_review')`).orderBy(desc(sellerApplications.submittedAt));
}

async function adminSeller(sellerId: number) { const db = await getDb(); if (!db) throw validationError("Seller services are temporarily unavailable."); const rows = await db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1); if (!rows.length) throw notFound("Seller not found."); return rows[0]; }

export async function reviewSeller(adminUserId: number, sellerId: number) { const seller = await adminSeller(sellerId); if (!canTransitionSeller(seller.status, "under_review")) throw invalidState("This seller is not awaiting review."); const db = await getDb(); await db!.update(sellers).set({ status: "under_review" }).where(eq(sellers.id, sellerId)); await db!.update(sellerApplications).set({ status: "under_review" }).where(and(eq(sellerApplications.sellerId, sellerId), eq(sellerApplications.status, "submitted"))); await writeAuditEvent({ insert: (table: typeof import("../../../drizzle/schema").auditLogs) => db!.insert(table) }, { actorUserId: adminUserId, action: "seller.application.reviewed", entityType: "seller", entityId: String(sellerId), afterState: { status: "under_review" } }); return adminSeller(sellerId); }

export async function approveSeller(adminUserId: number, sellerId: number) { const seller = await adminSeller(sellerId); if (!canTransitionSeller(seller.status, "approved")) throw invalidState("Only sellers under review can be approved."); const db = await getDb(); const now = new Date(); await db!.update(sellers).set({ status: "approved", verificationStatus: "approved", approvedAt: now, rejectionReason: null }).where(eq(sellers.id, sellerId)); await db!.update(sellerApplications).set({ status: "approved", reviewedAt: now, reviewedByUserId: adminUserId, rejectionReason: null }).where(and(eq(sellerApplications.sellerId, sellerId), eq(sellerApplications.status, "under_review"))); await writeAuditEvent({ insert: (table: typeof import("../../../drizzle/schema").auditLogs) => db!.insert(table) }, { actorUserId: adminUserId, action: "seller.approved", entityType: "seller", entityId: String(sellerId), afterState: { status: "approved" } }); return adminSeller(sellerId); }

export async function rejectSeller(adminUserId: number, sellerId: number, reason: string) { const seller = await adminSeller(sellerId); if (!canTransitionSeller(seller.status, "rejected")) throw invalidState("Only sellers under review can be rejected."); const db = await getDb(); const now = new Date(); await db!.update(sellers).set({ status: "rejected", verificationStatus: "rejected", rejectionReason: reason }).where(eq(sellers.id, sellerId)); await db!.update(sellerApplications).set({ status: "rejected", reviewedAt: now, reviewedByUserId: adminUserId, rejectionReason: reason }).where(and(eq(sellerApplications.sellerId, sellerId), eq(sellerApplications.status, "under_review"))); await writeAuditEvent({ insert: (table: typeof import("../../../drizzle/schema").auditLogs) => db!.insert(table) }, { actorUserId: adminUserId, action: "seller.rejected", entityType: "seller", entityId: String(sellerId), reason, afterState: { status: "rejected" } }); return adminSeller(sellerId); }

export async function changeSuspension(adminUserId: number, sellerId: number, suspend: boolean, reason?: string | null) { const seller = await adminSeller(sellerId); const target = suspend ? "suspended" : "approved"; if (!canTransitionSeller(seller.status, target)) throw invalidState("This seller cannot be moved to the requested status."); const db = await getDb(); await db!.update(sellers).set(suspend ? { status: "suspended", suspendedAt: new Date(), suspensionReason: reason ?? "Administrative suspension" } : { status: "approved", suspendedAt: null, suspensionReason: null }).where(eq(sellers.id, sellerId)); await writeAuditEvent({ insert: (table: typeof import("../../../drizzle/schema").auditLogs) => db!.insert(table) }, { actorUserId: adminUserId, action: suspend ? "seller.suspended" : "seller.reactivated", entityType: "seller", entityId: String(sellerId), reason, afterState: { status: target } }); return adminSeller(sellerId); }
