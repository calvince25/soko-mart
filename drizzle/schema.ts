import { relations } from "drizzle-orm";
import {
  index,
  foreignKey,
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

export const catalogCategories = mysqlTable("catalog_categories", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parentId"), name: varchar("name", { length: 160 }).notNull(), slug: varchar("slug", { length: 180 }).notNull(), description: text("description"), imageKey: varchar("imageKey", { length: 1024 }), displayOrder: int("displayOrder").default(0).notNull(), status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(), seoTitle: varchar("seoTitle", { length: 180 }), seoDescription: varchar("seoDescription", { length: 320 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ slugUq: uniqueIndex("uq_catalog_categories_slug").on(table.slug), parentIdx: index("idx_catalog_categories_parent_status").on(table.parentId, table.status), orderIdx: index("idx_catalog_categories_order").on(table.displayOrder) }));

export const catalogBrands = mysqlTable("catalog_brands", {
  id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 160 }).notNull(), slug: varchar("slug", { length: 180 }).notNull(), description: text("description"), logoKey: varchar("logoKey", { length: 1024 }), status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(), seoTitle: varchar("seoTitle", { length: 180 }), seoDescription: varchar("seoDescription", { length: 320 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ slugUq: uniqueIndex("uq_catalog_brands_slug").on(table.slug), statusIdx: index("idx_catalog_brands_status").on(table.status) }));

export const catalogAttributes = mysqlTable("catalog_attributes", {
  id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 100 }).notNull(), code: varchar("code", { length: 100 }).notNull(), type: mysqlEnum("type", ["text", "number", "boolean", "select", "multi_select"]).notNull(), status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ codeUq: uniqueIndex("uq_catalog_attributes_code").on(table.code) }));

export const catalogAttributeValues = mysqlTable("catalog_attribute_values", {
  id: int("id").autoincrement().primaryKey(), attributeId: int("attributeId").notNull().references(() => catalogAttributes.id, { onDelete: "cascade" }), value: varchar("value", { length: 160 }).notNull(), label: varchar("label", { length: 160 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ valueUq: uniqueIndex("uq_catalog_attribute_value").on(table.attributeId, table.value), attributeIdx: index("idx_catalog_attribute_values_attribute").on(table.attributeId) }));

export const catalogCategoryAttributes = mysqlTable("catalog_category_attributes", {
  id: int("id").autoincrement().primaryKey(), categoryId: int("categoryId").notNull().references(() => catalogCategories.id, { onDelete: "cascade" }), attributeId: int("attributeId").notNull().references(() => catalogAttributes.id, { onDelete: "cascade" }), required: int("required").default(0).notNull(), displayOrder: int("displayOrder").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ relationUq: uniqueIndex("uq_catalog_category_attribute").on(table.categoryId, table.attributeId) }));

export const catalogProducts = mysqlTable("catalog_products", {
  id: int("id").autoincrement().primaryKey(), sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }), categoryId: int("categoryId").notNull().references(() => catalogCategories.id, { onDelete: "restrict" }), brandId: int("brandId").references(() => catalogBrands.id, { onDelete: "set null" }), name: varchar("name", { length: 240 }).notNull(), slug: varchar("slug", { length: 220 }).notNull(), shortDescription: varchar("shortDescription", { length: 500 }), fullDescription: text("fullDescription"), status: mysqlEnum("status", ["draft", "pending_review", "approved", "published", "rejected", "suspended", "archived"]).default("draft").notNull(), moderationStatus: mysqlEnum("moderationStatus", ["not_submitted", "pending", "approved", "rejected"]).default("not_submitted").notNull(), rejectionReason: text("rejectionReason"), metaTitle: varchar("metaTitle", { length: 180 }), metaDescription: varchar("metaDescription", { length: 320 }), publishedAt: timestamp("publishedAt"), archivedAt: timestamp("archivedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ slugUq: uniqueIndex("uq_catalog_products_slug").on(table.slug), sellerIdx: index("idx_catalog_products_seller_status").on(table.sellerId, table.status), categoryIdx: index("idx_catalog_products_category_status").on(table.categoryId, table.status), brandIdx: index("idx_catalog_products_brand_status").on(table.brandId, table.status), publicIdx: index("idx_catalog_products_public").on(table.status, table.moderationStatus) }));

export const catalogProductSlugHistory = mysqlTable("catalog_product_slug_history", {
  id: int("id").autoincrement().primaryKey(), productId: int("productId").notNull().references(() => catalogProducts.id, { onDelete: "cascade" }), slug: varchar("slug", { length: 220 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ slugUq: uniqueIndex("uq_catalog_product_slug_history").on(table.slug), productIdx: index("idx_catalog_product_slug_history_product").on(table.productId) }));

export const catalogProductVariants = mysqlTable("catalog_product_variants", {
  id: int("id").autoincrement().primaryKey(), productId: int("productId").notNull().references(() => catalogProducts.id, { onDelete: "cascade" }), sku: varchar("sku", { length: 120 }).notNull(), name: varchar("name", { length: 180 }).notNull(), priceMinor: int("priceMinor").notNull(), compareAtPriceMinor: int("compareAtPriceMinor"), currency: varchar("currency", { length: 3 }).default("KES").notNull(), status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ skuUq: uniqueIndex("uq_catalog_variants_sku").on(table.sku), productIdx: index("idx_catalog_variants_product_status").on(table.productId, table.status) }));

export const catalogVariantAttributeValues = mysqlTable("catalog_variant_attribute_values", {
  id: int("id").autoincrement().primaryKey(), variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "cascade" }), attributeId: int("attributeId").notNull().references(() => catalogAttributes.id, { onDelete: "restrict" }), attributeValueId: int("attributeValueId").references(() => catalogAttributeValues.id, { onDelete: "set null" }), valueText: varchar("valueText", { length: 240 }), valueNumber: varchar("valueNumber", { length: 64 }), valueBoolean: int("valueBoolean"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ valueUq: uniqueIndex("uq_catalog_variant_attribute").on(table.variantId, table.attributeId), variantIdx: index("idx_catalog_variant_attributes_variant").on(table.variantId) }));

export const catalogProductMedia = mysqlTable("catalog_product_media", {
  id: int("id").autoincrement().primaryKey(), productId: int("productId").notNull().references(() => catalogProducts.id, { onDelete: "cascade" }), variantId: int("variantId").references(() => catalogProductVariants.id, { onDelete: "set null" }), storageKey: varchar("storageKey", { length: 1024 }).notNull(), mediaType: mysqlEnum("mediaType", ["image", "video"]).default("image").notNull(), originalFilename: varchar("originalFilename", { length: 255 }).notNull(), mimeType: varchar("mimeType", { length: 120 }).notNull(), fileSize: int("fileSize").notNull(), altText: varchar("altText", { length: 240 }), displayOrder: int("displayOrder").default(0).notNull(), isPrimary: int("isPrimary").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ productIdx: index("idx_catalog_product_media_product_order").on(table.productId, table.displayOrder), variantIdx: index("idx_catalog_product_media_variant").on(table.variantId) }));

export const inventoryLocations = mysqlTable("inventory_locations", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").references(() => sellers.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  type: mysqlEnum("type", ["seller_location", "warehouse", "fulfillment_center"]).notNull(),
  country: varchar("country", { length: 80 }).notNull(),
  county: varchar("county", { length: 100 }),
  city: varchar("city", { length: 100 }),
  address: text("address"),
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ sellerIdx: index("idx_inventory_locations_seller_status").on(table.sellerId, table.status), typeIdx: index("idx_inventory_locations_type_status").on(table.type, table.status) }));

export const inventoryBalances = mysqlTable("inventory_balances", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }),
  variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "restrict" }),
  locationId: int("locationId").notNull().references(() => inventoryLocations.id, { onDelete: "restrict" }),
  onHand: int("onHand").default(0).notNull(),
  reserved: int("reserved").default(0).notNull(),
  damaged: int("damaged").default(0).notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ balanceUq: uniqueIndex("uq_inventory_balance_sku_location").on(table.sellerId, table.variantId, table.locationId), sellerIdx: index("idx_inventory_balances_seller").on(table.sellerId, table.status), variantIdx: index("idx_inventory_balances_variant").on(table.variantId), locationIdx: index("idx_inventory_balances_location").on(table.locationId) }));

export const inventoryReservations = mysqlTable("inventory_reservations", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }),
  variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "restrict" }),
  locationId: int("locationId").notNull().references(() => inventoryLocations.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  status: mysqlEnum("status", ["active", "released", "expired", "converted", "cancelled"]).default("active").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  referenceType: varchar("referenceType", { length: 80 }).notNull(),
  referenceId: varchar("referenceId", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  releasedAt: timestamp("releasedAt"),
  convertedAt: timestamp("convertedAt"),
  releaseReason: text("releaseReason"),
}, (table) => ({ sellerIdx: index("idx_inventory_reservations_seller_status").on(table.sellerId, table.status), balanceIdx: index("idx_inventory_reservations_variant_location").on(table.variantId, table.locationId), expiryIdx: index("idx_inventory_reservations_active_expiry").on(table.status, table.expiresAt), referenceIdx: index("idx_inventory_reservations_reference").on(table.referenceType, table.referenceId) }));

export const inventoryMovements = mysqlTable("inventory_movements", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }),
  variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "restrict" }),
  locationId: int("locationId").notNull().references(() => inventoryLocations.id, { onDelete: "restrict" }),
  reservationId: int("reservationId").references(() => inventoryReservations.id, { onDelete: "set null" }),
  movementType: mysqlEnum("movementType", ["initial_stock", "purchase_receipt", "manual_adjustment", "transfer_out", "transfer_in", "damage", "loss", "return", "correction", "reservation", "reservation_release", "sale"]).notNull(),
  balanceType: mysqlEnum("balanceType", ["on_hand", "reserved", "damaged"]).notNull(),
  direction: mysqlEnum("direction", ["in", "out"]).notNull(),
  quantity: int("quantity").notNull(),
  referenceType: varchar("referenceType", { length: 80 }),
  referenceId: varchar("referenceId", { length: 160 }),
  reason: text("reason"),
  actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
  requestId: varchar("requestId", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ balanceIdx: index("idx_inventory_movements_balance_created").on(table.sellerId, table.variantId, table.locationId, table.balanceType, table.createdAt), actorIdx: index("idx_inventory_movements_actor_created").on(table.actorUserId, table.createdAt), reservationIdx: index("idx_inventory_movements_reservation").on(table.reservationId), referenceIdx: index("idx_inventory_movements_reference").on(table.referenceType, table.referenceId) }));

export const commerceCarts = mysqlTable("commerce_carts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["active", "converted", "abandoned"]).default("active").notNull(),
  currency: varchar("currency", { length: 3 }).default("KES").notNull(),
  activeKey: varchar("activeKey", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ activeKeyUq: uniqueIndex("uq_commerce_carts_active_key").on(table.activeKey), userStatusIdx: index("idx_commerce_carts_user_status").on(table.userId, table.status) }));

export const commerceCartItems = mysqlTable("commerce_cart_items", {
  id: int("id").autoincrement().primaryKey(),
  cartId: int("cartId").notNull().references(() => commerceCarts.id, { onDelete: "cascade" }),
  variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  addedPriceMinor: int("addedPriceMinor").notNull(),
  addedCurrency: varchar("addedCurrency", { length: 3 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ cartVariantUq: uniqueIndex("uq_commerce_cart_items_cart_variant").on(table.cartId, table.variantId), cartIdx: index("idx_commerce_cart_items_cart_updated").on(table.cartId, table.updatedAt), variantIdx: index("idx_commerce_cart_items_variant").on(table.variantId) }));

export const commerceWishlistItems = mysqlTable("commerce_wishlist_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userVariantUq: uniqueIndex("uq_commerce_wishlist_user_variant").on(table.userId, table.variantId), userIdx: index("idx_commerce_wishlist_user_created").on(table.userId, table.createdAt), variantIdx: index("idx_commerce_wishlist_variant").on(table.variantId) }));

export const checkoutSessions = mysqlTable("checkout_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cartId: int("cartId").notNull().references(() => commerceCarts.id, { onDelete: "restrict" }),
  status: mysqlEnum("status", ["active", "validated", "ready_for_payment", "expired", "cancelled", "completed"]).default("active").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  shippingMethod: varchar("shippingMethod", { length: 48 }).notNull(),
  addressId: int("addressId").references(() => customerAddresses.id, { onDelete: "set null" }),
  addressSnapshot: json("addressSnapshot"),
  subtotalMinor: int("subtotalMinor").notNull(),
  shippingMinor: int("shippingMinor").notNull(),
  feeMinor: int("feeMinor").notNull(),
  taxMinor: int("taxMinor").notNull(),
  totalMinor: int("totalMinor").notNull(),
  issues: json("issues"),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }),
  expiresAt: timestamp("expiresAt").notNull(),
  validatedAt: timestamp("validatedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userStatusIdx: index("idx_checkout_sessions_user_status").on(table.userId, table.status), expiryIdx: index("idx_checkout_sessions_status_expiry").on(table.status, table.expiresAt), idempotencyUq: uniqueIndex("uq_checkout_sessions_user_idempotency").on(table.userId, table.idempotencyKey) }));

export const checkoutSessionGroups = mysqlTable("checkout_session_groups", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().references(() => checkoutSessions.id, { onDelete: "cascade" }),
  sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }),
  sellerName: varchar("sellerName", { length: 160 }).notNull(),
  subtotalMinor: int("subtotalMinor").notNull(),
  shippingMinor: int("shippingMinor").notNull(),
  feeMinor: int("feeMinor").notNull(),
  taxMinor: int("taxMinor").notNull(),
  totalMinor: int("totalMinor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ sessionSellerUq: uniqueIndex("uq_checkout_session_group_seller").on(table.sessionId, table.sellerId), sessionIdx: index("idx_checkout_session_groups_session").on(table.sessionId) }));

export const checkoutSessionItems = mysqlTable("checkout_session_items", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().references(() => checkoutSessions.id, { onDelete: "cascade" }),
  sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }),
  productId: int("productId").notNull().references(() => catalogProducts.id, { onDelete: "restrict" }),
  variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "restrict" }),
  productName: varchar("productName", { length: 240 }).notNull(),
  variantName: varchar("variantName", { length: 180 }).notNull(),
  sku: varchar("sku", { length: 120 }).notNull(),
  sellerName: varchar("sellerName", { length: 160 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPriceMinor: int("unitPriceMinor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  lineSubtotalMinor: int("lineSubtotalMinor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ sessionIdx: index("idx_checkout_session_items_session").on(table.sessionId), sellerIdx: index("idx_checkout_session_items_seller").on(table.sessionId, table.sellerId) }));

export const paymentAttempts = mysqlTable("payment_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  checkoutSessionId: int("checkoutSessionId").notNull(),
  provider: mysqlEnum("provider", ["mpesa", "card", "other"]).notNull(),
  providerReference: varchar("providerReference", { length: 160 }),
  internalReference: varchar("internalReference", { length: 160 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }),
  amountMinor: int("amountMinor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("status", ["created", "pending", "processing", "successful", "failed", "cancelled", "expired", "refunded", "partially_refunded"]).default("created").notNull(),
  phone: varchar("phone", { length: 32 }),
  failureCode: varchar("failureCode", { length: 80 }),
  failureMessage: text("failureMessage"),
  metadata: json("metadata"),
  expiresAt: timestamp("expiresAt").notNull(),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "fk_payment_attempt_user" }).onDelete("cascade"), checkoutFk: foreignKey({ columns: [table.checkoutSessionId], foreignColumns: [checkoutSessions.id], name: "fk_payment_attempt_checkout" }).onDelete("restrict"), userIdx: index("idx_payment_attempts_user_created").on(table.userId, table.createdAt), checkoutIdx: index("idx_payment_attempts_checkout_status").on(table.checkoutSessionId, table.status), providerRefUq: uniqueIndex("uq_payment_attempts_provider_reference").on(table.provider, table.providerReference), internalRefUq: uniqueIndex("uq_payment_attempts_internal_reference").on(table.internalReference), idempotencyUq: uniqueIndex("uq_payment_attempts_user_idempotency").on(table.userId, table.idempotencyKey) }));

export const paymentCallbackEvents = mysqlTable("payment_callback_events", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["mpesa", "card", "other"]).notNull(),
  providerEventId: varchar("providerEventId", { length: 200 }).notNull(),
  paymentAttemptId: int("paymentAttemptId"),
  payload: json("payload"),
  status: mysqlEnum("status", ["received", "processed", "ignored", "failed"]).default("received").notNull(),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ paymentFk: foreignKey({ columns: [table.paymentAttemptId], foreignColumns: [paymentAttempts.id], name: "fk_payment_callback_attempt" }).onDelete("set null"), providerEventUq: uniqueIndex("uq_payment_callback_provider_event").on(table.provider, table.providerEventId), paymentIdx: index("idx_payment_callback_payment").on(table.paymentAttemptId) }));

export const paymentReservations = mysqlTable("payment_reservations", {
  id: int("id").autoincrement().primaryKey(),
  paymentAttemptId: int("paymentAttemptId").notNull(),
  inventoryReservationId: int("inventoryReservationId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ paymentFk: foreignKey({ columns: [table.paymentAttemptId], foreignColumns: [paymentAttempts.id], name: "fk_payment_reservation_attempt" }).onDelete("cascade"), inventoryFk: foreignKey({ columns: [table.inventoryReservationId], foreignColumns: [inventoryReservations.id], name: "fk_payment_reservation_inventory" }).onDelete("restrict"), paymentIdx: index("idx_payment_reservation_payment").on(table.paymentAttemptId), inventoryUq: uniqueIndex("uq_payment_reservation_inventory").on(table.inventoryReservationId) }));

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 40 }).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
  checkoutSessionId: int("checkoutSessionId").notNull().references(() => checkoutSessions.id, { onDelete: "restrict" }),
  paymentAttemptId: int("paymentAttemptId").notNull().references(() => paymentAttempts.id, { onDelete: "restrict" }),
  currency: varchar("currency", { length: 3 }).notNull(),
  subtotalMinor: int("subtotalMinor").notNull(),
  shippingMinor: int("shippingMinor").notNull(),
  taxMinor: int("taxMinor").notNull(),
  feeMinor: int("feeMinor").notNull(),
  discountMinor: int("discountMinor").default(0).notNull(),
  totalMinor: int("totalMinor").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "processing", "ready_for_fulfilment", "completed", "cancelled"]).default("confirmed").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["paid", "refunded", "partially_refunded"]).default("paid").notNull(),
  fulfilmentStatus: mysqlEnum("fulfilmentStatus", ["unfulfilled", "accepted", "processing", "packed", "ready_for_handoff", "handed_to_logistics", "partially_fulfilled", "exception"]).default("unfulfilled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ orderNumberUq: uniqueIndex("uq_orders_order_number").on(table.orderNumber), paymentUq: uniqueIndex("uq_orders_payment_attempt").on(table.paymentAttemptId), checkoutUq: uniqueIndex("uq_orders_checkout_session").on(table.checkoutSessionId), userIdx: index("idx_orders_user_created").on(table.userId, table.createdAt), statusIdx: index("idx_orders_status_created").on(table.status, table.createdAt) }));

export const orderSellerOrders = mysqlTable("order_seller_orders", {
  id: int("id").autoincrement().primaryKey(),
  parentOrderId: int("parentOrderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }),
  sellerName: varchar("sellerName", { length: 160 }).notNull(),
  sellerSlug: varchar("sellerSlug", { length: 180 }).notNull(),
  sellerSubtotalMinor: int("sellerSubtotalMinor").notNull(),
  shippingMinor: int("shippingMinor").notNull(),
  taxMinor: int("taxMinor").notNull(),
  feeMinor: int("feeMinor").notNull(),
  totalMinor: int("totalMinor").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "processing", "ready_for_fulfilment", "completed", "cancelled"]).default("confirmed").notNull(),
  fulfilmentStatus: mysqlEnum("fulfilmentStatus", ["unfulfilled", "processing", "ready", "completed"]).default("unfulfilled").notNull(),
  fulfilmentState: mysqlEnum("fulfilmentState", ["pending", "accepted", "processing", "packed", "ready_for_handoff", "handed_to_logistics", "rejected", "cancelled", "failed"]).default("pending").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  processingAt: timestamp("processingAt"),
  packedAt: timestamp("packedAt"),
  readyForHandoffAt: timestamp("readyForHandoffAt"),
  handedToLogisticsAt: timestamp("handedToLogisticsAt"),
  cancellationReason: text("cancellationReason"),
  cancelledByUserId: int("cancelledByUserId"),
  cancelledAt: timestamp("cancelledAt"),
  refundRequired: int("refundRequired").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ parentSellerUq: uniqueIndex("uq_order_seller_orders_parent_seller").on(table.parentOrderId, table.sellerId), sellerIdx: index("idx_order_seller_orders_seller_created").on(table.sellerId, table.createdAt), sellerFulfilmentIdx: index("idx_order_seller_orders_seller_fulfilment").on(table.sellerId, table.fulfilmentState, table.createdAt), parentIdx: index("idx_order_seller_orders_parent").on(table.parentOrderId), cancelledByFk: foreignKey({ columns: [table.cancelledByUserId], foreignColumns: [users.id], name: "fk_order_seller_cancelled_by" }).onDelete("set null") }));

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  sellerOrderId: int("sellerOrderId").notNull().references(() => orderSellerOrders.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => catalogProducts.id, { onDelete: "restrict" }),
  variantId: int("variantId").notNull().references(() => catalogProductVariants.id, { onDelete: "restrict" }),
  sellerId: int("sellerId").notNull().references(() => sellers.id, { onDelete: "restrict" }),
  productName: varchar("productName", { length: 240 }).notNull(),
  variantName: varchar("variantName", { length: 180 }).notNull(),
  sku: varchar("sku", { length: 120 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPriceMinor: int("unitPriceMinor").notNull(),
  lineSubtotalMinor: int("lineSubtotalMinor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ sellerOrderIdx: index("idx_order_items_seller_order").on(table.sellerOrderId), variantIdx: index("idx_order_items_variant").on(table.variantId), sellerIdx: index("idx_order_items_seller").on(table.sellerId) }));

export const orderAddressSnapshots = mysqlTable("order_address_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  recipientName: varchar("recipientName", { length: 160 }).notNull(),
  recipientPhone: varchar("recipientPhone", { length: 48 }).notNull(),
  country: varchar("country", { length: 80 }).notNull(),
  county: varchar("county", { length: 120 }).notNull(),
  town: varchar("town", { length: 120 }).notNull(),
  neighborhood: varchar("neighborhood", { length: 160 }).notNull(),
  estateBuilding: varchar("estateBuilding", { length: 160 }),
  apartmentHouse: varchar("apartmentHouse", { length: 160 }),
  streetRoad: varchar("streetRoad", { length: 160 }),
  directions: text("directions"),
  postalCode: varchar("postalCode", { length: 32 }),
  latitude: varchar("latitude", { length: 40 }),
  longitude: varchar("longitude", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ orderUq: uniqueIndex("uq_order_address_snapshots_order").on(table.orderId) }));

export const orderReservationLinks = mysqlTable("order_reservation_links", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  sellerOrderId: int("sellerOrderId").notNull(),
  orderItemId: int("orderItemId").notNull(),
  inventoryReservationId: int("inventoryReservationId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ orderFk: foreignKey({ columns: [table.orderId], foreignColumns: [orders.id], name: "fk_order_reservation_order" }).onDelete("cascade"), sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_order_reservation_seller_order" }).onDelete("cascade"), itemFk: foreignKey({ columns: [table.orderItemId], foreignColumns: [orderItems.id], name: "fk_order_reservation_item" }).onDelete("cascade"), reservationFk: foreignKey({ columns: [table.inventoryReservationId], foreignColumns: [inventoryReservations.id], name: "fk_order_reservation_inventory" }).onDelete("restrict"), reservationUq: uniqueIndex("uq_order_reservation_links_reservation").on(table.inventoryReservationId), itemIdx: index("idx_order_reservation_links_item").on(table.orderItemId), orderIdx: index("idx_order_reservation_links_order").on(table.orderId) }));

export const sellerOrderFulfilmentEvents = mysqlTable("seller_order_fulfilment_events", {
  id: int("id").autoincrement().primaryKey(),
  sellerOrderId: int("sellerOrderId").notNull(),
  previousState: mysqlEnum("previousState", ["pending", "accepted", "processing", "packed", "ready_for_handoff", "handed_to_logistics", "rejected", "cancelled", "failed"]),
  newState: mysqlEnum("newState", ["pending", "accepted", "processing", "packed", "ready_for_handoff", "handed_to_logistics", "rejected", "cancelled", "failed"]).notNull(),
  actorUserId: int("actorUserId"),
  reason: text("reason"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_fulfilment_event_seller_order" }).onDelete("cascade"), actorFk: foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "fk_fulfilment_event_actor" }).onDelete("set null"), sellerOrderIdx: index("idx_seller_order_fulfilment_events_order_created").on(table.sellerOrderId, table.createdAt), stateIdx: index("idx_seller_order_fulfilment_events_state").on(table.newState, table.createdAt) }));

export const sellerOrderFulfilmentNotes = mysqlTable("seller_order_fulfilment_notes", {
  id: int("id").autoincrement().primaryKey(),
  sellerOrderId: int("sellerOrderId").notNull(),
  actorUserId: int("actorUserId").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_fulfilment_note_seller_order" }).onDelete("cascade"), actorFk: foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "fk_fulfilment_note_actor" }).onDelete("restrict"), sellerOrderIdx: index("idx_seller_order_fulfilment_notes_order_created").on(table.sellerOrderId, table.createdAt) }));

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
export type CatalogCategory = typeof catalogCategories.$inferSelect;
export type CatalogBrand = typeof catalogBrands.$inferSelect;
export type CatalogAttribute = typeof catalogAttributes.$inferSelect;
export type CatalogAttributeValue = typeof catalogAttributeValues.$inferSelect;
export type CatalogProduct = typeof catalogProducts.$inferSelect;
export type CatalogProductVariant = typeof catalogProductVariants.$inferSelect;
export type CatalogProductMedia = typeof catalogProductMedia.$inferSelect;
export type InventoryLocation = typeof inventoryLocations.$inferSelect;
export type InventoryBalance = typeof inventoryBalances.$inferSelect;
export type InventoryReservation = typeof inventoryReservations.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type CommerceCart = typeof commerceCarts.$inferSelect;
export type CommerceCartItem = typeof commerceCartItems.$inferSelect;
export type CommerceWishlistItem = typeof commerceWishlistItems.$inferSelect;
export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type CheckoutSessionGroup = typeof checkoutSessionGroups.$inferSelect;
export type CheckoutSessionItem = typeof checkoutSessionItems.$inferSelect;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type PaymentCallbackEvent = typeof paymentCallbackEvents.$inferSelect;
export type PaymentReservation = typeof paymentReservations.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderSellerOrder = typeof orderSellerOrders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderAddressSnapshot = typeof orderAddressSnapshots.$inferSelect;
export type OrderReservationLink = typeof orderReservationLinks.$inferSelect;
export type SellerOrderFulfilmentEvent = typeof sellerOrderFulfilmentEvents.$inferSelect;
export type SellerOrderFulfilmentNote = typeof sellerOrderFulfilmentNotes.$inferSelect;

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

export const catalogCategoriesRelations = relations(catalogCategories, ({ one, many }) => ({
  parent: one(catalogCategories, { fields: [catalogCategories.parentId], references: [catalogCategories.id], relationName: "category_parent" }),
  children: many(catalogCategories, { relationName: "category_parent" }),
  products: many(catalogProducts), attributes: many(catalogCategoryAttributes),
}));
export const catalogBrandsRelations = relations(catalogBrands, ({ many }) => ({ products: many(catalogProducts) }));
export const catalogAttributesRelations = relations(catalogAttributes, ({ many }) => ({ values: many(catalogAttributeValues), categories: many(catalogCategoryAttributes), variants: many(catalogVariantAttributeValues) }));
export const catalogAttributeValuesRelations = relations(catalogAttributeValues, ({ one }) => ({ attribute: one(catalogAttributes, { fields: [catalogAttributeValues.attributeId], references: [catalogAttributes.id] }) }));
export const catalogCategoryAttributesRelations = relations(catalogCategoryAttributes, ({ one }) => ({ category: one(catalogCategories, { fields: [catalogCategoryAttributes.categoryId], references: [catalogCategories.id] }), attribute: one(catalogAttributes, { fields: [catalogCategoryAttributes.attributeId], references: [catalogAttributes.id] }) }));
export const catalogProductsRelations = relations(catalogProducts, ({ one, many }) => ({ seller: one(sellers, { fields: [catalogProducts.sellerId], references: [sellers.id] }), category: one(catalogCategories, { fields: [catalogProducts.categoryId], references: [catalogCategories.id] }), brand: one(catalogBrands, { fields: [catalogProducts.brandId], references: [catalogBrands.id] }), variants: many(catalogProductVariants), media: many(catalogProductMedia), slugs: many(catalogProductSlugHistory) }));
export const catalogProductVariantsRelations = relations(catalogProductVariants, ({ one, many }) => ({ product: one(catalogProducts, { fields: [catalogProductVariants.productId], references: [catalogProducts.id] }), attributes: many(catalogVariantAttributeValues), media: many(catalogProductMedia) }));
export const catalogVariantAttributeValuesRelations = relations(catalogVariantAttributeValues, ({ one }) => ({ variant: one(catalogProductVariants, { fields: [catalogVariantAttributeValues.variantId], references: [catalogProductVariants.id] }), attribute: one(catalogAttributes, { fields: [catalogVariantAttributeValues.attributeId], references: [catalogAttributes.id] }), attributeValue: one(catalogAttributeValues, { fields: [catalogVariantAttributeValues.attributeValueId], references: [catalogAttributeValues.id] }) }));
export const catalogProductMediaRelations = relations(catalogProductMedia, ({ one }) => ({ product: one(catalogProducts, { fields: [catalogProductMedia.productId], references: [catalogProducts.id] }), variant: one(catalogProductVariants, { fields: [catalogProductMedia.variantId], references: [catalogProductVariants.id] }) }));
export const catalogProductSlugHistoryRelations = relations(catalogProductSlugHistory, ({ one }) => ({ product: one(catalogProducts, { fields: [catalogProductSlugHistory.productId], references: [catalogProducts.id] }) }));
export const inventoryLocationsRelations = relations(inventoryLocations, ({ one, many }) => ({ seller: one(sellers, { fields: [inventoryLocations.sellerId], references: [sellers.id] }), balances: many(inventoryBalances), movements: many(inventoryMovements), reservations: many(inventoryReservations) }));
export const inventoryBalancesRelations = relations(inventoryBalances, ({ one }) => ({ seller: one(sellers, { fields: [inventoryBalances.sellerId], references: [sellers.id] }), variant: one(catalogProductVariants, { fields: [inventoryBalances.variantId], references: [catalogProductVariants.id] }), location: one(inventoryLocations, { fields: [inventoryBalances.locationId], references: [inventoryLocations.id] }) }));
export const inventoryReservationsRelations = relations(inventoryReservations, ({ one, many }) => ({ seller: one(sellers, { fields: [inventoryReservations.sellerId], references: [sellers.id] }), variant: one(catalogProductVariants, { fields: [inventoryReservations.variantId], references: [catalogProductVariants.id] }), location: one(inventoryLocations, { fields: [inventoryReservations.locationId], references: [inventoryLocations.id] }), movements: many(inventoryMovements) }));
export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({ seller: one(sellers, { fields: [inventoryMovements.sellerId], references: [sellers.id] }), variant: one(catalogProductVariants, { fields: [inventoryMovements.variantId], references: [catalogProductVariants.id] }), location: one(inventoryLocations, { fields: [inventoryMovements.locationId], references: [inventoryLocations.id] }), reservation: one(inventoryReservations, { fields: [inventoryMovements.reservationId], references: [inventoryReservations.id] }), actor: one(users, { fields: [inventoryMovements.actorUserId], references: [users.id] }) }));
export const commerceCartsRelations = relations(commerceCarts, ({ one, many }) => ({ user: one(users, { fields: [commerceCarts.userId], references: [users.id] }), items: many(commerceCartItems) }));
export const commerceCartItemsRelations = relations(commerceCartItems, ({ one }) => ({ cart: one(commerceCarts, { fields: [commerceCartItems.cartId], references: [commerceCarts.id] }), variant: one(catalogProductVariants, { fields: [commerceCartItems.variantId], references: [catalogProductVariants.id] }) }));
export const commerceWishlistItemsRelations = relations(commerceWishlistItems, ({ one }) => ({ user: one(users, { fields: [commerceWishlistItems.userId], references: [users.id] }), variant: one(catalogProductVariants, { fields: [commerceWishlistItems.variantId], references: [catalogProductVariants.id] }) }));
export const checkoutSessionsRelations = relations(checkoutSessions, ({ one, many }) => ({ user: one(users, { fields: [checkoutSessions.userId], references: [users.id] }), cart: one(commerceCarts, { fields: [checkoutSessions.cartId], references: [commerceCarts.id] }), address: one(customerAddresses, { fields: [checkoutSessions.addressId], references: [customerAddresses.id] }), groups: many(checkoutSessionGroups), items: many(checkoutSessionItems) }));
export const checkoutSessionGroupsRelations = relations(checkoutSessionGroups, ({ one }) => ({ session: one(checkoutSessions, { fields: [checkoutSessionGroups.sessionId], references: [checkoutSessions.id] }), seller: one(sellers, { fields: [checkoutSessionGroups.sellerId], references: [sellers.id] }) }));
export const checkoutSessionItemsRelations = relations(checkoutSessionItems, ({ one }) => ({ session: one(checkoutSessions, { fields: [checkoutSessionItems.sessionId], references: [checkoutSessions.id] }), seller: one(sellers, { fields: [checkoutSessionItems.sellerId], references: [sellers.id] }), product: one(catalogProducts, { fields: [checkoutSessionItems.productId], references: [catalogProducts.id] }), variant: one(catalogProductVariants, { fields: [checkoutSessionItems.variantId], references: [catalogProductVariants.id] }) }));
export const paymentAttemptsRelations = relations(paymentAttempts, ({ one, many }) => ({ user: one(users, { fields: [paymentAttempts.userId], references: [users.id] }), checkoutSession: one(checkoutSessions, { fields: [paymentAttempts.checkoutSessionId], references: [checkoutSessions.id] }), callbacks: many(paymentCallbackEvents), reservations: many(paymentReservations) }));
export const paymentCallbackEventsRelations = relations(paymentCallbackEvents, ({ one }) => ({ paymentAttempt: one(paymentAttempts, { fields: [paymentCallbackEvents.paymentAttemptId], references: [paymentAttempts.id] }) }));
export const paymentReservationsRelations = relations(paymentReservations, ({ one }) => ({ paymentAttempt: one(paymentAttempts, { fields: [paymentReservations.paymentAttemptId], references: [paymentAttempts.id] }), inventoryReservation: one(inventoryReservations, { fields: [paymentReservations.inventoryReservationId], references: [inventoryReservations.id] }) }));
