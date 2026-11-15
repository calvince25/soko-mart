import { and, eq } from "drizzle-orm";
import { sellerPayoutAttempts, sellerPayouts, sellerSettlements } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { payoutProvider } from "./payouts";
import { decryptPayoutDestination } from "./destinationCrypto";

export async function submitPayout(payoutId: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not configured");
  const [payout] = await db.select().from(sellerPayouts).where(eq(sellerPayouts.id, payoutId)).limit(1);
  if (!payout) throw new Error("Payout not found");
  if (!["ready", "queued", "processing"].includes(payout.status)) return payout;
  const attemptNumber = payout.attemptCount + 1;
  await db.update(sellerPayouts).set({ status: "processing", attemptCount: attemptNumber, lastAttemptAt: new Date(), updatedAt: new Date() }).where(eq(sellerPayouts.id, payoutId));
  const startedAt = new Date();
  try {
    const result = await payoutProvider().createPayout({ internalReference: payout.payoutReference, amountMinor: payout.amountMinor, currency: payout.currency, destination: decryptPayoutDestination(payout.beneficiarySnapshotEncrypted), remarks: `SokoMart ${payout.payoutReference}` });
    await db.insert(sellerPayoutAttempts).values({ payoutId, attemptNumber, requestReference: payout.payoutReference, providerReference: result.providerReference ?? null, status: result.status, safeResponse: result.safeMetadata ?? {}, startedAt, completedAt: new Date() });
    const nextStatus = result.status === "successful" ? "confirmed" : result.status === "failed" ? "failed" : result.status === "submitted" || result.status === "pending" ? "pending_confirmation" : "reconciliation_required";
    await db.update(sellerPayouts).set({ status: nextStatus, providerReference: result.providerReference ?? null, failureReason: result.failureReason ?? null, failureClass: result.failureClass ?? null, submittedAt: ["pending_confirmation", "confirmed"].includes(nextStatus) ? new Date() : null, confirmedAt: nextStatus === "confirmed" ? new Date() : null, failedAt: nextStatus === "failed" ? new Date() : null, updatedAt: new Date() }).where(eq(sellerPayouts.id, payoutId));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payout submission failed";
    await db.insert(sellerPayoutAttempts).values({ payoutId, attemptNumber, requestReference: payout.payoutReference, status: "failed", safeResponse: { error: "provider_submission_failed" }, startedAt, completedAt: new Date() });
    await db.update(sellerPayouts).set({ status: "failed", failureClass: "transient", failureReason: message.slice(0, 240), failedAt: new Date(), updatedAt: new Date() }).where(eq(sellerPayouts.id, payoutId));
    throw error;
  }
}

export async function reconcilePayout(payoutId: number, forceQuery = false) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const [payout] = await db.select().from(sellerPayouts).where(eq(sellerPayouts.id, payoutId)).limit(1); if (!payout) throw new Error("Payout not found"); if (!payout.providerReference) { await db.update(sellerPayouts).set({ status: "reconciliation_required", lastReconciledAt: new Date(), updatedAt: new Date() }).where(eq(sellerPayouts.id, payoutId)); return payout; } const result = await payoutProvider().getPayoutStatus(payout.providerReference); if (result.status === "successful") { await db.update(sellerPayouts).set({ status: "confirmed", confirmedAt: new Date(), lastReconciledAt: new Date(), updatedAt: new Date() }).where(eq(sellerPayouts.id, payoutId)); await db.update(sellerSettlements).set({ status: "completed", processedAt: new Date() }).where(and(eq(sellerSettlements.id, payout.settlementId), eq(sellerSettlements.status, "approved"))); } else if (result.status === "failed") { await db.update(sellerPayouts).set({ status: "failed", failureReason: result.failureReason ?? "Provider failed", failureClass: result.failureClass ?? "permanent", failedAt: new Date(), lastReconciledAt: new Date(), updatedAt: new Date() }).where(eq(sellerPayouts.id, payoutId)); } else if (forceQuery || result.status === "unknown") { await db.update(sellerPayouts).set({ status: "reconciliation_required", failureReason: result.failureReason ?? "Provider outcome remains unresolved", lastReconciledAt: new Date(), updatedAt: new Date() }).where(eq(sellerPayouts.id, payoutId)); } return result; }
