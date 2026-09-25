import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { permissions, rolePermissions, roles, userRoles, users } from "../drizzle/schema";
import { PERMISSION_DEFINITIONS, PERMISSION_CODES, ROLE_DEFINITIONS, ROLE_CODES, permissionsForRole } from "../shared/permissions/catalog";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const db = drizzle(databaseUrl);

for (const code of ROLE_CODES) {
  const definition = ROLE_DEFINITIONS[code];
  await db.insert(roles).values({ code, name: definition.name, description: definition.description, isSystem: 1 })
    .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)`, description: sql`VALUES(description)`, isSystem: 1 } });
}

for (const code of PERMISSION_CODES) {
  const definition = PERMISSION_DEFINITIONS[code];
  await db.insert(permissions).values({ code, name: definition.name, description: definition.description })
    .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)`, description: sql`VALUES(description)` } });
}

const roleRows = await db.select().from(roles);
const permissionRows = await db.select().from(permissions);
const roleIdByCode = new Map(roleRows.map((row) => [row.code, row.id]));
const permissionIdByCode = new Map(permissionRows.map((row) => [row.code, row.id]));

for (const roleCode of ROLE_CODES) {
  const roleId = roleIdByCode.get(roleCode);
  if (!roleId) throw new Error(`Missing seeded role ${roleCode}`);
  for (const permissionCode of permissionsForRole(roleCode)) {
    const permissionId = permissionIdByCode.get(permissionCode);
    if (!permissionId) throw new Error(`Missing seeded permission ${permissionCode}`);
    await db.insert(rolePermissions).values({ roleId, permissionId })
      .onDuplicateKeyUpdate({ set: { roleId: sql`roleId` } });
  }
}

const currentUsers = await db.select().from(users);
const customerRoleId = roleIdByCode.get("customer");
const adminRoleId = roleIdByCode.get("marketplace_admin");
if (!customerRoleId || !adminRoleId) throw new Error("Compatibility roles were not seeded");

for (const user of currentUsers) {
  const roleId = user.role === "admin" ? adminRoleId : customerRoleId;
  await db.insert(userRoles).values({ userId: user.id, roleId })
    .onDuplicateKeyUpdate({ set: { userId: sql`userId` } });
}

console.log(JSON.stringify({ seededRoles: ROLE_CODES.length, seededPermissions: PERMISSION_CODES.length, assignedExistingUsers: currentUsers.length }));
process.exit(0);
