import { relations } from "drizzle-orm";
import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing Manus OAuth. Existing columns and the legacy role
 * enum are preserved for compatibility; roles/userRoles are the long-term RBAC
 * boundary introduced by Sprint 1.
 */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
    roleIdx: index("idx_users_role").on(table.role),
  }),
);

export const roles = mysqlTable(
  "roles",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isSystem: int("isSystem").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    codeUq: uniqueIndex("uq_roles_code").on(table.code),
  }),
);

export const permissions = mysqlTable(
  "permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 160 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    codeUq: uniqueIndex("uq_permissions_code").on(table.code),
  }),
);

export const userRoles = mysqlTable(
  "user_roles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: int("roleId").notNull().references(() => roles.id, { onDelete: "cascade" }),
    assignedByUserId: int("assignedByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userRoleUq: uniqueIndex("uq_user_roles_user_role").on(table.userId, table.roleId),
    userIdx: index("idx_user_roles_user").on(table.userId),
    roleIdx: index("idx_user_roles_role").on(table.roleId),
  }),
);

export const rolePermissions = mysqlTable(
  "role_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    roleId: int("roleId").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: int("permissionId").notNull().references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    rolePermissionUq: uniqueIndex("uq_role_permissions_role_permission").on(table.roleId, table.permissionId),
    roleIdx: index("idx_role_permissions_role").on(table.roleId),
    permissionIdx: index("idx_role_permissions_permission").on(table.permissionId),
  }),
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
    deviceLabel: varchar("deviceLabel", { length: 160 }),
    userAgent: varchar("userAgent", { length: 512 }),
    ipAddress: varchar("ipAddress", { length: 64 }),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    lastUsedAt: timestamp("lastUsedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tokenUq: uniqueIndex("uq_sessions_token_hash").on(table.tokenHash),
    userIdx: index("idx_sessions_user").on(table.userId),
    activeIdx: index("idx_sessions_user_revoked_expires").on(table.userId, table.revokedAt, table.expiresAt),
  }),
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entityType", { length: 96 }).notNull(),
    entityId: varchar("entityId", { length: 128 }),
    beforeState: json("beforeState"),
    afterState: json("afterState"),
    reason: text("reason"),
    requestId: varchar("requestId", { length: 96 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("idx_audit_logs_actor_created").on(table.actorUserId, table.createdAt),
    entityIdx: index("idx_audit_logs_entity").on(table.entityType, table.entityId, table.createdAt),
    requestIdx: index("idx_audit_logs_request").on(table.requestId),
    actionIdx: index("idx_audit_logs_action_created").on(table.action, table.createdAt),
  }),
);

export const customerProfiles = mysqlTable(
  "customer_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    firstName: varchar("firstName", { length: 80 }),
    lastName: varchar("lastName", { length: 80 }),
    displayName: varchar("displayName", { length: 160 }),
    avatarUrl: varchar("avatarUrl", { length: 1024 }),
    dateOfBirth: timestamp("dateOfBirth"),
    preferredLanguage: varchar("preferredLanguage", { length: 16 }).default("en").notNull(),
    preferredCurrency: varchar("preferredCurrency", { length: 3 }).default("KES").notNull(),
    status: mysqlEnum("status", ["active", "suspended", "closed"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userUq: uniqueIndex("uq_customer_profiles_user").on(table.userId),
    statusIdx: index("idx_customer_profiles_status").on(table.status),
  }),
);

export const customerPhones = mysqlTable(
  "customer_phones",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    normalizedPhone: varchar("normalizedPhone", { length: 32 }).notNull(),
    displayPhone: varchar("displayPhone", { length: 48 }).notNull(),
    countryCode: varchar("countryCode", { length: 2 }).default("KE").notNull(),
    verifiedAt: timestamp("verifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userUq: uniqueIndex("uq_customer_phones_user").on(table.userId),
    phoneUq: uniqueIndex("uq_customer_phones_normalized").on(table.normalizedPhone),
    verifiedIdx: index("idx_customer_phones_verified").on(table.verifiedAt),
  }),
);

export const customerAddresses = mysqlTable(
  "customer_addresses",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientName: varchar("recipientName", { length: 160 }).notNull(),
    recipientPhone: varchar("recipientPhone", { length: 32 }).notNull(),
    label: mysqlEnum("label", ["home", "work", "other"]).default("home").notNull(),
    country: varchar("country", { length: 80 }).notNull(),
    county: varchar("county", { length: 100 }).notNull(),
    town: varchar("town", { length: 100 }).notNull(),
    neighborhood: varchar("neighborhood", { length: 160 }).notNull(),
    estateBuilding: varchar("estateBuilding", { length: 160 }),
    apartmentHouse: varchar("apartmentHouse", { length: 120 }),
    streetRoad: varchar("streetRoad", { length: 160 }),
    directions: text("directions"),
    postalCode: varchar("postalCode", { length: 24 }),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    isDefault: int("isDefault").default(0).notNull(),
    status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_customer_addresses_user_status").on(table.userId, table.status),
    defaultIdx: index("idx_customer_addresses_user_default").on(table.userId, table.isDefault),
    locationIdx: index("idx_customer_addresses_country_county_town").on(table.country, table.county, table.town),
  }),
);

export const sellers = mysqlTable(
  "sellers",
  {
    id: int("id").autoincrement().primaryKey(),
    legalBusinessName: varchar("legalBusinessName", { length: 200 }).notNull(),
    storeName: varchar("storeName", { length: 160 }).notNull(),
    storeSlug: varchar("storeSlug", { length: 180 }).notNull(),
    businessDescription: text("businessDescription"),
    businessType: varchar("businessType", { length: 80 }).notNull(),
    country: varchar("country", { length: 80 }).notNull(),
    county: varchar("county", { length: 100 }).notNull(),
    town: varchar("town", { length: 100 }).notNull(),
    businessAddress: text("businessAddress").notNull(),
    businessPhone: varchar("businessPhone", { length: 32 }).notNull(),
    businessEmail: varchar("businessEmail", { length: 320 }).notNull(),
    logoKey: varchar("logoKey", { length: 1024 }),
    bannerKey: varchar("bannerKey", { length: 1024 }),
    status: mysqlEnum("status", ["draft", "pending_verification", "under_review", "approved", "rejected", "suspended", "closed"]).default("draft").notNull(),
    verificationStatus: mysqlEnum("verificationStatus", ["not_started", "pending", "approved", "rejected"]).default("not_started").notNull(),
    approvedAt: timestamp("approvedAt"),
    suspendedAt: timestamp("suspendedAt"),
    rejectionReason: text("rejectionReason"),
    suspensionReason: text("suspensionReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugUq: uniqueIndex("uq_sellers_store_slug").on(table.storeSlug),
    statusIdx: index("idx_sellers_status_verification").on(table.status, table.verificationStatus),
    countryIdx: index("idx_sellers_country_county_town").on(table.country, table.county, table.town),
  }),
);

export const sellerMembers = mysqlTable(
  "seller_members",
  {
    id: int("id").autoincrement().primaryKey(),
    sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    memberRole: mysqlEnum("memberRole", ["owner", "manager", "catalog_staff", "fulfilment_staff", "finance_staff"]).default("owner").notNull(),
    status: mysqlEnum("status", ["active", "invited", "removed"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    membershipUq: uniqueIndex("uq_seller_members_seller_user").on(table.sellerId, table.userId),
    userIdx: index("idx_seller_members_user_status").on(table.userId, table.status),
    sellerIdx: index("idx_seller_members_seller_role").on(table.sellerId, table.memberRole),
  }),
);

export const sellerApplications = mysqlTable(
  "seller_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "cascade" }),
    applicationVersion: int("applicationVersion").default(1).notNull(),
    businessRegistrationNumber: varchar("businessRegistrationNumber", { length: 120 }),
    taxIdentificationNumber: varchar("taxIdentificationNumber", { length: 120 }),
    legalRepresentativeName: varchar("legalRepresentativeName", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["draft", "submitted", "under_review", "approved", "rejected", "withdrawn"]).default("draft").notNull(),
    submittedAt: timestamp("submittedAt"),
    reviewedAt: timestamp("reviewedAt"),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id, { onDelete: "set null" }),
    rejectionReason: text("rejectionReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    sellerVersionUq: uniqueIndex("uq_seller_applications_seller_version").on(table.sellerId, table.applicationVersion),
    sellerStatusIdx: index("idx_seller_applications_seller_status").on(table.sellerId, table.status),
    reviewIdx: index("idx_seller_applications_status_submitted").on(table.status, table.submittedAt),
    reviewerIdx: index("idx_seller_applications_reviewer").on(table.reviewedByUserId),
  }),
);

export const sellerVerificationDocuments = mysqlTable(
  "seller_verification_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "cascade" }),
    applicationId: int("applicationId").notNull().references(() => sellerApplications.id, { onDelete: "cascade" }),
    documentType: varchar("documentType", { length: 80 }).notNull(),
    storageKey: varchar("storageKey", { length: 1024 }).notNull(),
    originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    fileSize: int("fileSize").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewedAt"),
    rejectionReason: text("rejectionReason"),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  },
  (table) => ({
    sellerIdx: index("idx_seller_documents_seller_status").on(table.sellerId, table.status),
    applicationIdx: index("idx_seller_documents_application").on(table.applicationId),
    reviewerIdx: index("idx_seller_documents_reviewer").on(table.reviewedByUserId),
  }),
);

export const sellerSlugHistory = mysqlTable(
  "seller_slug_history",
  {
    id: int("id").autoincrement().primaryKey(),
    sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 180 }).notNull(),
    active: int("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    slugUq: uniqueIndex("uq_seller_slug_history_slug").on(table.slug),
    sellerIdx: index("idx_seller_slug_history_seller_active").on(table.sellerId, table.active),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type CustomerPhone = typeof customerPhones.$inferSelect;
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type Seller = typeof sellers.$inferSelect;
export type SellerMember = typeof sellerMembers.$inferSelect;
export type SellerApplication = typeof sellerApplications.$inferSelect;
export type SellerVerificationDocument = typeof sellerVerificationDocuments.$inferSelect;
export type SellerSlugHistory = typeof sellerSlugHistory.$inferSelect;

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  sessions: many(sessions),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  permissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  assignedBy: one(users, { fields: [userRoles.assignedByUserId], references: [users.id] }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id] }),
}));

export const customerProfilesRelations = relations(customerProfiles, ({ one }) => ({
  user: one(users, { fields: [customerProfiles.userId], references: [users.id] }),
}));

export const customerPhonesRelations = relations(customerPhones, ({ one }) => ({
  user: one(users, { fields: [customerPhones.userId], references: [users.id] }),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  user: one(users, { fields: [customerAddresses.userId], references: [users.id] }),
}));

export const sellersRelations = relations(sellers, ({ many }) => ({
  members: many(sellerMembers),
  applications: many(sellerApplications),
  documents: many(sellerVerificationDocuments),
  slugHistory: many(sellerSlugHistory),
}));

export const sellerMembersRelations = relations(sellerMembers, ({ one }) => ({
  seller: one(sellers, { fields: [sellerMembers.sellerId], references: [sellers.id] }),
  user: one(users, { fields: [sellerMembers.userId], references: [users.id] }),
}));

export const sellerApplicationsRelations = relations(sellerApplications, ({ one, many }) => ({
  seller: one(sellers, { fields: [sellerApplications.sellerId], references: [sellers.id] }),
  reviewer: one(users, { fields: [sellerApplications.reviewedByUserId], references: [users.id] }),
  documents: many(sellerVerificationDocuments),
}));

export const sellerVerificationDocumentsRelations = relations(sellerVerificationDocuments, ({ one }) => ({
  seller: one(sellers, { fields: [sellerVerificationDocuments.sellerId], references: [sellers.id] }),
  application: one(sellerApplications, { fields: [sellerVerificationDocuments.applicationId], references: [sellerApplications.id] }),
  reviewer: one(users, { fields: [sellerVerificationDocuments.reviewedByUserId], references: [users.id] }),
}));

export const sellerSlugHistoryRelations = relations(sellerSlugHistory, ({ one }) => ({
  seller: one(sellers, { fields: [sellerSlugHistory.sellerId], references: [sellers.id] }),
}));
