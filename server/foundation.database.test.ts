import { describe, expect, it } from "vitest";
import { getDb } from "./db";
import { permissions, roles, sessions, userRoles, users, auditLogs } from "../drizzle/schema";

describe("Sprint 1 database foundation", () => {
  it("has applied foundation tables and preserved existing users", async () => {
    if (!process.env.DATABASE_URL) return;
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const [userRows, roleRows, permissionRows, userRoleRows, sessionRows, auditRows] = await Promise.all([
      db.select({ id: users.id }).from(users),
      db.select({ id: roles.id }).from(roles),
      db.select({ id: permissions.id }).from(permissions),
      db.select({ id: userRoles.id }).from(userRoles),
      db.select({ id: sessions.id }).from(sessions),
      db.select({ id: auditLogs.id }).from(auditLogs),
    ]);

    expect(userRows.length).toBeGreaterThan(0);
    expect(roleRows.length).toBe(10);
    expect(permissionRows.length).toBe(26);
    expect(userRoleRows.length).toBeGreaterThanOrEqual(userRows.length);
    expect(sessionRows).toBeDefined();
    expect(auditRows).toBeDefined();
  });
});
