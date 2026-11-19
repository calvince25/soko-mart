import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";
import type { RateLimitStore } from "./limiter";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * A small transactional MySQL store. The row lock makes the increment
 * atomic across application replicas; the migration must be applied before
 * selecting RATE_LIMIT_STORE=mysql.
 */
export function createMysqlRateLimitStore(databaseUrl: string): RateLimitStore {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for RATE_LIMIT_STORE=mysql");
  const pool: Pool = createPool({ uri: databaseUrl, connectionLimit: 5 });

  return {
    async consume(bucketKey, windowMs, max, now = Date.now()): Promise<RateLimitResult> {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const resetAt = now + windowMs;
        const [rows] = await connection.query<(RowDataPacket & { count: number; resetAt: number })[]>(
          "SELECT `count`, `resetAt` FROM `rate_limit_buckets` WHERE `bucketKey` = ? FOR UPDATE",
          [bucketKey],
        );
        const existing = rows[0];
        const active = existing && Number(existing.resetAt) > now;
        const count = active ? Number(existing.count) + 1 : 1;
        const nextResetAt = active ? Number(existing.resetAt) : resetAt;

        await connection.query(
          "INSERT INTO `rate_limit_buckets` (`bucketKey`, `count`, `resetAt`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `count` = VALUES(`count`), `resetAt` = VALUES(`resetAt`)",
          [bucketKey, count, nextResetAt],
        );
        await connection.commit();
        return {
          allowed: count <= max,
          remaining: Math.max(0, max - count),
          retryAfterSeconds: Math.max(1, Math.ceil((nextResetAt - now) / 1000)),
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
