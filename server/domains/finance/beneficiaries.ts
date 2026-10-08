import { createHmac } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  sellerMembers,
  sellerPayoutBeneficiaries,
  sellerPayoutBeneficiaryEvents,
  sellers,
} from "../../../drizzle/schema";
import { conflict, forbidden, invalidState, notFound, validationError } from "../../../shared/errors/appError";
import { normalizePhone } from "../../../shared/validation/phone";
import { ENV } from "../../config/env";
import { getDb } from "../../db";
import { writeAuditEvent } from "../../audit/audit";
import { withTransaction } from "../../transactions/database";
import { enqueueNotificationEvent } from "../notification/service";

export type BeneficiaryStatus = "DRAFT" | "PENDING_VERIFICATION" | "VERIFIED" | "SUSPENDED" | "DEACTIVATED" | "REJECTED";

const transitions: Record<BeneficiaryStatus, readonly BeneficiaryStatus[]> = {
  DRAFT: ["PENDING_VERIFICATION", "DEACTIVATED"],
  PENDING_VERIFICATION: ["VERIFIED", "REJECTED", "DEACTIVATED"],
  VERIFIED: ["SUSPENDED", "DEACTIVATED"],
  SUSPENDED: ["VERIFIED", "DEACTIVATED"],
  REJECTED: ["DRAFT", "PENDING_VERIFICATION", "DEACTIVATED"],
  DEACTIVATED: [],
};

export function canTransitionBeneficiary(from: string, to: BeneficiaryStatus): boolean {
  return transitions[from as BeneficiaryStatus]?.includes(to) ?? false;
}

export function maskBeneficiaryDestination(normalizedPhone: string): string {
  return `${normalizedPhone.slice(0, 4)}******${normalizedPhone.slice(-4)}`;
}

export function fingerprintBeneficiaryDestination(normalizedPhone: string): string {
  return createHmac("sha256", ENV.cookieSecret || "sokomart-beneficiary-fingerprint-dev").update(normalizedPhone).digest("hex");
}

function safeBeneficiary(row: any) {
  const { destinationFingerprint: _fingerprint, ...safe } = row;
  return safe;
}

async function database() {
  const db = await getDb();
  if (!db) throw invalidState("Beneficiary services are temporarily unavailable.");
  return db;
}

async function sellerMembership(userId: number, sellerId: number) {
  const db = await database();
  const [membership] = await db
    .select({ seller: sellers, membership: sellerMembers })
    .from(sellerMembers)
    .innerJoin(sellers, eq(sellerMembers.sellerId, sellers.id))
    .where(and(eq(sellerMembers.userId, userId), eq(sellerMembers.sellerId, sellerId), eq(sellerMembers.status, "active")))
    .limit(1);
  if (!membership || !["owner", "finance_staff"].includes(membership.membership.memberRole)) throw forbidden("Seller payout-account access denied.");
  if (membership.seller.status !== "approved" || membership.seller.verificationStatus !== "approved") throw invalidState("An approved and verified seller is required before adding a payout account.");
  return membership;
}

async function ownedBeneficiary(userId: number, beneficiaryId: number) {
  const db = await database();
  const [row] = await db
    .select({ beneficiary: sellerPayoutBeneficiaries, membership: sellerMembers })
    .from(sellerPayoutBeneficiaries)
    .innerJoin(sellerMembers, and(eq(sellerPayoutBeneficiaries.sellerId, sellerMembers.sellerId), eq(sellerMembers.userId, userId), eq(sellerMembers.status, "active")))
    .where(eq(sellerPayoutBeneficiaries.id, beneficiaryId))
    .limit(1);
  if (!row || !["owner", "finance_staff"].includes(row.membership.memberRole)) throw forbidden("Seller payout-account access denied.");
  return row.beneficiary;
}

function notifySeller(userId: number, beneficiaryId: number, status: BeneficiaryStatus, maskedDestination: string) {
  enqueueNotificationEvent({
    eventType: "beneficiary.status_changed",
    entityType: "seller_payout_beneficiary",
    entityId: beneficiaryId,
    eventKey: `beneficiary:${beneficiaryId}:${status}`,
    payload: { recipientUserIds: [userId], recipientType: "seller", status, maskedDestination },
  });
}

export async function listMyBeneficiaries(userId: number, sellerId?: number) {
  const db = await database();
  const memberships = await db
    .select({ sellerId: sellerMembers.sellerId, memberRole: sellerMembers.memberRole })
    .from(sellerMembers)
    .where(and(eq(sellerMembers.userId, userId), eq(sellerMembers.status, "active")));
  const sellerIds = memberships.filter((row) => ["owner", "finance_staff"].includes(row.memberRole) && (sellerId === undefined || row.sellerId === sellerId)).map((row) => row.sellerId);
  if (!sellerIds.length) throw forbidden("Seller payout-account access denied.");
  const rows = await db.select().from(sellerPayoutBeneficiaries).where(inArray(sellerPayoutBeneficiaries.sellerId, sellerIds)).orderBy(desc(sellerPayoutBeneficiaries.createdAt));
  const result = [];
  for (const row of rows) {
    const events = await db.select().from(sellerPayoutBeneficiaryEvents).where(eq(sellerPayoutBeneficiaryEvents.beneficiaryId, row.id)).orderBy(desc(sellerPayoutBeneficiaryEvents.createdAt));
    result.push({ beneficiary: safeBeneficiary(row), events });
  }
  return result;
}

export async function createBeneficiary(userId: number, input: { sellerId: number; provider: "mpesa"; accountType: "mobile_money"; phone: string; displayLabel?: string | null }) {
  await sellerMembership(userId, input.sellerId);
  const normalized = normalizePhone(input.phone, "KE").normalizedPhone;
  const fingerprint = fingerprintBeneficiaryDestination(normalized);
  const created = await withTransaction(async (tx: any) => {
    const existing = await tx.select({ id: sellerPayoutBeneficiaries.id }).from(sellerPayoutBeneficiaries).where(and(eq(sellerPayoutBeneficiaries.sellerId, input.sellerId), eq(sellerPayoutBeneficiaries.destinationFingerprint, fingerprint), ne(sellerPayoutBeneficiaries.status, "DEACTIVATED"))).limit(1);
    if (existing.length) throw conflict("That payout destination is already registered for this seller.");
    const inserted = await tx.insert(sellerPayoutBeneficiaries).values({ sellerId: input.sellerId, provider: input.provider, accountType: input.accountType, maskedDestination: maskBeneficiaryDestination(normalized), destinationFingerprint: fingerprint, displayLabel: input.displayLabel?.trim() || null, status: "DRAFT", isPrimary: null, createdByUserId: userId });
    const beneficiaryId = Number(inserted.insertId);
    await tx.insert(sellerPayoutBeneficiaryEvents).values({ beneficiaryId, sellerId: input.sellerId, actorUserId: userId, eventType: "created", previousStatus: null, newStatus: "DRAFT", isPrimary: 0, reason: "Seller payout destination created." });
    await writeAuditEvent(tx, { actorUserId: userId, action: "finance.beneficiary.created", entityType: "seller_payout_beneficiary", entityId: String(beneficiaryId), afterState: { sellerId: input.sellerId, provider: input.provider, accountType: input.accountType, maskedDestination: maskBeneficiaryDestination(normalized), status: "DRAFT" } });
    const [row] = await tx.select().from(sellerPayoutBeneficiaries).where(eq(sellerPayoutBeneficiaries.id, beneficiaryId)).limit(1);
    return row;
  });
  return safeBeneficiary(created);
}

export async function submitBeneficiary(userId: number, beneficiaryId: number) {
  const current = await ownedBeneficiary(userId, beneficiaryId);
  if (!canTransitionBeneficiary(current.status, "PENDING_VERIFICATION")) throw invalidState("This payout account cannot be submitted in its current state.");
  const updated = await withTransaction(async (tx: any) => {
    await tx.update(sellerPayoutBeneficiaries).set({ status: "PENDING_VERIFICATION", statusReason: null, rejectionReason: null, updatedAt: new Date() }).where(eq(sellerPayoutBeneficiaries.id, beneficiaryId));
    await tx.insert(sellerPayoutBeneficiaryEvents).values({ beneficiaryId, sellerId: current.sellerId, actorUserId: userId, eventType: "status_changed", previousStatus: current.status, newStatus: "PENDING_VERIFICATION", isPrimary: 0, reason: "Seller submitted payout account for verification." });
    await writeAuditEvent(tx, { actorUserId: userId, action: "finance.beneficiary.submitted", entityType: "seller_payout_beneficiary", entityId: String(beneficiaryId), beforeState: { status: current.status }, afterState: { status: "PENDING_VERIFICATION" } });
    const [row] = await tx.select().from(sellerPayoutBeneficiaries).where(eq(sellerPayoutBeneficiaries.id, beneficiaryId)).limit(1);
    return row;
  });
  notifySeller(userId, beneficiaryId, "PENDING_VERIFICATION", updated.maskedDestination);
  return safeBeneficiary(updated);
}

export async function setPrimaryBeneficiary(userId: number, beneficiaryId: number) {
  const current = await ownedBeneficiary(userId, beneficiaryId);
  if (current.status !== "VERIFIED") throw invalidState("Only a verified payout account can be primary.");
  const updated = await withTransaction(async (tx: any) => {
    const [old] = await tx.select().from(sellerPayoutBeneficiaries).where(and(eq(sellerPayoutBeneficiaries.sellerId, current.sellerId), eq(sellerPayoutBeneficiaries.isPrimary, 1), ne(sellerPayoutBeneficiaries.id, beneficiaryId))).limit(1);
    if (old) {
      await tx.update(sellerPayoutBeneficiaries).set({ isPrimary: null, updatedAt: new Date() }).where(eq(sellerPayoutBeneficiaries.id, old.id));
      await tx.insert(sellerPayoutBeneficiaryEvents).values({ beneficiaryId: old.id, sellerId: current.sellerId, actorUserId: userId, eventType: "primary_unset", previousStatus: old.status, newStatus: old.status, isPrimary: 0, reason: "Another verified payout account was selected as primary." });
    }
    await tx.update(sellerPayoutBeneficiaries).set({ isPrimary: 1, updatedAt: new Date() }).where(eq(sellerPayoutBeneficiaries.id, beneficiaryId));
    await tx.insert(sellerPayoutBeneficiaryEvents).values({ beneficiaryId, sellerId: current.sellerId, actorUserId: userId, eventType: "primary_set", previousStatus: current.status, newStatus: current.status, isPrimary: 1, reason: "Seller selected the verified payout account as primary." });
    await writeAuditEvent(tx, { actorUserId: userId, action: "finance.beneficiary.primary_changed", entityType: "seller_payout_beneficiary", entityId: String(beneficiaryId), afterState: { sellerId: current.sellerId, isPrimary: 1 } });
    const [row] = await tx.select().from(sellerPayoutBeneficiaries).where(eq(sellerPayoutBeneficiaries.id, beneficiaryId)).limit(1);
    return row;
  });
  return safeBeneficiary(updated);
}

export async function deactivateBeneficiary(userId: number, beneficiaryId: number) {
  const current = await ownedBeneficiary(userId, beneficiaryId);
  if (!canTransitionBeneficiary(current.status, "DEACTIVATED")) throw invalidState("This payout account cannot be deactivated in its current state.");
  const updated = await withTransaction(async (tx: any) => {
    await tx.update(sellerPayoutBeneficiaries).set({ status: "DEACTIVATED", isPrimary: null, deactivatedAt: new Date(), statusReason: "Deactivated by seller.", updatedAt: new Date() }).where(eq(sellerPayoutBeneficiaries.id, beneficiaryId));
    await tx.insert(sellerPayoutBeneficiaryEvents).values({ beneficiaryId, sellerId: current.sellerId, actorUserId: userId, eventType: "status_changed", previousStatus: current.status, newStatus: "DEACTIVATED", isPrimary: 0, reason: "Seller deactivated payout account." });
    await writeAuditEvent(tx, { actorUserId: userId, action: "finance.beneficiary.deactivated", entityType: "seller_payout_beneficiary", entityId: String(beneficiaryId), beforeState: { status: current.status, isPrimary: current.isPrimary }, afterState: { status: "DEACTIVATED", isPrimary: 0 } });
    const [row] = await tx.select().from(sellerPayoutBeneficiaries).where(eq(sellerPayoutBeneficiaries.id, beneficiaryId)).limit(1);
    return row;
  });
  notifySeller(userId, beneficiaryId, "DEACTIVATED", updated.maskedDestination);
  return safeBeneficiary(updated);
}

export async function reviewBeneficiary(adminUserId: number, input: { beneficiaryId: number; status: "VERIFIED" | "SUSPENDED" | "REJECTED"; reason?: string | null }) {
  const db = await database();
  const [current] = await db.select().from(sellerPayoutBeneficiaries).where(eq(sellerPayoutBeneficiaries.id, input.beneficiaryId)).limit(1);
  if (!current) throw notFound("Payout account not found.");
  if (!canTransitionBeneficiary(current.status, input.status)) throw invalidState(`Payout account cannot transition from ${current.status} to ${input.status}.`);
  if (["SUSPENDED", "REJECTED"].includes(input.status) && !input.reason?.trim()) throw validationError("A reason is required for suspension or rejection.");
  const updated = await withTransaction(async (tx: any) => {
    const nextPrimary = input.status === "VERIFIED" ? current.isPrimary : null;
    if (!nextPrimary) await tx.update(sellerPayoutBeneficiaries).set({ isPrimary: null, updatedAt: new Date() }).where(eq(sellerPayoutBeneficiaries.id, current.id));
    await tx.update(sellerPayoutBeneficiaries).set({ status: input.status, isPrimary: nextPrimary, statusReason: input.reason?.trim() || null, rejectionReason: input.status === "REJECTED" ? input.reason?.trim() || null : null, verifiedByUserId: input.status === "VERIFIED" ? adminUserId : current.verifiedByUserId, verifiedAt: input.status === "VERIFIED" ? new Date() : current.verifiedAt, updatedAt: new Date() }).where(eq(sellerPayoutBeneficiaries.id, current.id));
    await tx.insert(sellerPayoutBeneficiaryEvents).values({ beneficiaryId: current.id, sellerId: current.sellerId, actorUserId: adminUserId, eventType: "status_changed", previousStatus: current.status, newStatus: input.status, isPrimary: nextPrimary, reason: input.reason?.trim() || null });
    await writeAuditEvent(tx, { actorUserId: adminUserId, action: "finance.beneficiary.reviewed", entityType: "seller_payout_beneficiary", entityId: String(current.id), beforeState: { status: current.status, isPrimary: current.isPrimary }, afterState: { status: input.status, isPrimary: nextPrimary }, reason: input.reason?.trim() || null });
    const [row] = await tx.select().from(sellerPayoutBeneficiaries).where(eq(sellerPayoutBeneficiaries.id, current.id)).limit(1);
    return row;
  });
  const owner = await db.select({ userId: sellerMembers.userId }).from(sellerMembers).where(and(eq(sellerMembers.sellerId, current.sellerId), eq(sellerMembers.memberRole, "owner"), eq(sellerMembers.status, "active"))).limit(1);
  if (owner[0]) notifySeller(owner[0].userId, updated.id, updated.status, updated.maskedDestination);
  return safeBeneficiary(updated);
}

export async function listBeneficiaryEvents(userId: number, beneficiaryId: number) {
  const current = await ownedBeneficiary(userId, beneficiaryId);
  const db = await database();
  return db.select().from(sellerPayoutBeneficiaryEvents).where(eq(sellerPayoutBeneficiaryEvents.beneficiaryId, current.id)).orderBy(desc(sellerPayoutBeneficiaryEvents.createdAt));
}
