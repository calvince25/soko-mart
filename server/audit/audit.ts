import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { logger } from "../logging/logger";
import { getRequestId } from "../logging/requestContext";

export type AuditEvent = {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string | null;
  requestId?: string | null;
};

export function sanitizeAuditValue(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { unavailable: true };
  }
}

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  const db = await getDb();
  if (!db) {
    logger.warn("audit.write.skipped", { action: event.action, entityType: event.entityType });
    return;
  }

  await writeAuditEvent(db, event);
}

export async function writeAuditEvent(db: { insert: (table: typeof auditLogs) => any }, event: AuditEvent): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: event.actorUserId ?? null,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    beforeState: sanitizeAuditValue(event.beforeState) as any,
    afterState: sanitizeAuditValue(event.afterState) as any,
    reason: event.reason ?? null,
    requestId: event.requestId ?? getRequestId() ?? null,
  });
}
