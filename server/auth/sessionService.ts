import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { sessions } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../config/env";
import { internalError } from "../../shared/errors/appError";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type CreateSessionInput = {
  userId: number;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt?: Date;
};

export async function createSessionRecord(input: CreateSessionInput): Promise<void> {
  const db = await getDb();
  if (!db) throw internalError("Database is not configured.");
  await db.insert(sessions).values({
    userId: input.userId,
    tokenHash: hashSessionToken(input.token),
    userAgent: input.userAgent?.slice(0, 512) ?? null,
    ipAddress: input.ipAddress?.slice(0, 64) ?? null,
    expiresAt: input.expiresAt ?? new Date(Date.now() + ENV.sessionTtlMs),
    lastUsedAt: new Date(),
  }).onDuplicateKeyUpdate({ set: { lastUsedAt: new Date() } });
}

export function isSessionActive(session: Pick<NonNullable<Awaited<ReturnType<typeof getSessionRecordByToken>>>, "expiresAt" | "revokedAt">, now = new Date()): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}

export async function getActiveSessionByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (session) await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, session.id));
  return session;
}

export async function getSessionRecordByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)))
    .limit(1);
  return session;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.tokenHash, hashSessionToken(token)), isNull(sessions.revokedAt)));
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + ENV.sessionTtlMs);
}
