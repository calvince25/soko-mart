import { and, eq } from "drizzle-orm";
import { permissions, rolePermissions, roles, userRoles, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { forbidden } from "../../shared/errors/appError";
import type { PermissionCode } from "../../shared/permissions/catalog";

export async function getUserPermissionCodes(userId: number): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));
  return new Set(rows.map((row) => row.code));
}

export async function hasPermission(user: User, permission: PermissionCode, supplied?: ReadonlySet<string>): Promise<boolean> {
  // Compatibility for existing users while role assignments are being adopted.
  if (user.role === "admin") return true;
  const permissionCodes = supplied ?? (await getUserPermissionCodes(user.id));
  return permissionCodes.has(permission);
}

export async function requirePermission(user: User, permission: PermissionCode, supplied?: ReadonlySet<string>): Promise<void> {
  if (!(await hasPermission(user, permission, supplied))) throw forbidden("You do not have the required permission.");
}

export function permissionSet(values: readonly string[]): Set<string> {
  return new Set(values);
}

export function roleAssignmentKey(userId: number, roleId: number): string {
  return `${userId}:${roleId}`;
}

export async function userHasRole(userId: number, roleCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.code, roleCode)))
    .limit(1);
  return rows.length > 0;
}
