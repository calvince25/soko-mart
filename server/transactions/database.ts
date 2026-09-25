import { getDb } from "../db";
import { internalError } from "../../shared/errors/appError";

/**
 * Domain services should use this wrapper for multi-write operations. The
 * callback receives Drizzle's transaction client and must not perform external
 * side effects before the transaction commits.
 */
export async function withTransaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
  const db = await getDb();
  if (!db) throw internalError("Database is not configured.");
  return db.transaction(work);
}
