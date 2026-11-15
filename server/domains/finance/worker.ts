import { and, eq, inArray, lte } from "drizzle-orm";
import { financeWorkerJobs, sellerPayouts } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { reconcilePayout, submitPayout } from "./workerActions";

export async function runFinanceWorkerOnce(workerId = `finance-worker-${process.pid}`) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const stale = new Date(Date.now() - 10 * 60_000);
  await db.update(financeWorkerJobs).set({ status: "reconciliation_required", lockedAt: null, lockedBy: null, lastError: "Recovered stale claim; reconcile before retry", updatedAt: new Date() }).where(and(eq(financeWorkerJobs.status, "processing"), lte(financeWorkerJobs.lockedAt, stale)));
  const [job] = await db.select().from(financeWorkerJobs).where(and(inArray(financeWorkerJobs.status, ["queued", "retryable", "reconciliation_required"]), lte(financeWorkerJobs.availableAt, new Date()))).limit(1);
  if (!job) return { processed: false, reason: "empty" };
  const claim = await db.update(financeWorkerJobs).set({ status: "processing", attempts: job.attempts + 1, lockedAt: new Date(), lockedBy: workerId, startedAt: new Date(), updatedAt: new Date() }).where(and(eq(financeWorkerJobs.id, job.id), inArray(financeWorkerJobs.status, ["queued", "retryable", "reconciliation_required"])));
  if (!(claim as any).affectedRows) return { processed: false, reason: "claim_lost" };
  try {
    const [payout] = await db.select().from(sellerPayouts).where(eq(sellerPayouts.id, job.resourceId)).limit(1);
    if (!payout) throw new Error("Payout resource not found");
    if (job.status === "reconciliation_required" || !["ready", "queued", "processing"].includes(payout.status)) await reconcilePayout(payout.id, job.status === "reconciliation_required");
    else await submitPayout(payout.id);
    await db.update(financeWorkerJobs).set({ status: "completed", lockedAt: null, lockedBy: null, completedAt: new Date(), updatedAt: new Date() }).where(eq(financeWorkerJobs.id, job.id));
    return { processed: true, jobId: job.id, payoutId: payout.id };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : "Worker failed";
    const terminal = job.attempts + 1 >= job.maxAttempts;
    await db.update(financeWorkerJobs).set({ status: terminal ? "failed" : "retryable", lastError: message, availableAt: new Date(Date.now() + (terminal ? 3_600_000 : Math.min(3_600_000, 30_000 * 2 ** job.attempts))), lockedAt: null, lockedBy: null, updatedAt: new Date() }).where(eq(financeWorkerJobs.id, job.id));
    return { processed: true, jobId: job.id, error: message, terminal };
  }
}
