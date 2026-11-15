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

export const sellerPayoutBeneficiaries = mysqlTable(
  "seller_payout_beneficiaries",
  {
    id: int("id").autoincrement().primaryKey(),
    sellerId: int("sellerId").notNull(),
    provider: mysqlEnum("provider", ["mpesa"]).notNull(),
    accountType: mysqlEnum("accountType", ["mobile_money"]).notNull(),
    maskedDestination: varchar("maskedDestination", { length: 40 }).notNull(),
    encryptedDestination: text("encryptedDestination"),
    destinationFingerprint: varchar("destinationFingerprint", { length: 128 }).notNull(),
    displayLabel: varchar("displayLabel", { length: 120 }),
    status: mysqlEnum("status", ["DRAFT", "PENDING_VERIFICATION", "VERIFIED", "SUSPENDED", "DEACTIVATED", "REJECTED"]).default("DRAFT").notNull(),
    isPrimary: int("isPrimary"),
    rejectionReason: text("rejectionReason"),
    statusReason: text("statusReason"),
    createdByUserId: int("createdByUserId").notNull(),
    verifiedByUserId: int("verifiedByUserId"),
    verifiedAt: timestamp("verifiedAt"),
    deactivatedAt: timestamp("deactivatedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    sellerStatusIdx: index("idx_payout_beneficiary_seller_status").on(table.sellerId, table.status, table.createdAt),
    sellerPrimaryUq: uniqueIndex("uq_payout_beneficiary_seller_primary").on(table.sellerId, table.isPrimary),
    fingerprintIdx: index("idx_payout_beneficiary_fingerprint").on(table.destinationFingerprint),
    creatorIdx: index("idx_payout_beneficiary_creator").on(table.createdByUserId),
    sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_payout_beneficiary_seller" }).onDelete("restrict"),
    creatorFk: foreignKey({ columns: [table.createdByUserId], foreignColumns: [users.id], name: "fk_payout_beneficiary_creator" }).onDelete("restrict"),
    verifierFk: foreignKey({ columns: [table.verifiedByUserId], foreignColumns: [users.id], name: "fk_payout_beneficiary_verifier" }).onDelete("set null"),
  }),
);

export const sellerPayoutBeneficiaryEvents = mysqlTable(
  "seller_payout_beneficiary_events",
  {
    id: int("id").autoincrement().primaryKey(),
    beneficiaryId: int("beneficiaryId").notNull(),
    sellerId: int("sellerId").notNull(),
    actorUserId: int("actorUserId"),
    eventType: varchar("eventType", { length: 100 }).notNull(),
    previousStatus: varchar("previousStatus", { length: 40 }),
    newStatus: varchar("newStatus", { length: 40 }).notNull(),
    isPrimary: int("isPrimary").notNull(),
    reason: text("reason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    beneficiaryIdx: index("idx_payout_beneficiary_event_history").on(table.beneficiaryId, table.createdAt),
    sellerIdx: index("idx_payout_beneficiary_event_seller").on(table.sellerId, table.createdAt),
    actorIdx: index("idx_payout_beneficiary_event_actor").on(table.actorUserId),
    beneficiaryFk: foreignKey({ columns: [table.beneficiaryId], foreignColumns: [sellerPayoutBeneficiaries.id], name: "fk_payout_beneficiary_event_beneficiary" }).onDelete("restrict"),
    sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_payout_beneficiary_event_seller" }).onDelete("restrict"),
    actorFk: foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "fk_payout_beneficiary_event_actor" }).onDelete("set null"),
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

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 32 }).notNull(),
  country: varchar("country", { length: 80 }).notNull().default("Kenya"),
  county: varchar("county", { length: 120 }).notNull(),
  town: varchar("town", { length: 120 }).notNull(),
  address: text("address").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "maintenance"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ codeUq: uniqueIndex("uq_warehouses_code").on(table.code), statusIdx: index("idx_warehouses_status").on(table.status) }));

export const warehouseUserAssignments = mysqlTable("warehouse_user_assignments", {
  id: int("id").autoincrement().primaryKey(),
  warehouseId: int("warehouseId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  assignedByUserId: int("assignedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ warehouseUserUq: uniqueIndex("uq_warehouse_user_assignment").on(table.warehouseId, table.userId), warehouseIdx: index("idx_warehouse_assignments_warehouse_status").on(table.warehouseId, table.status), userIdx: index("idx_warehouse_assignments_user_status").on(table.userId, table.status), warehouseFk: foreignKey({ columns: [table.warehouseId], foreignColumns: [warehouses.id], name: "fk_wh_assignment_warehouse" }).onDelete("cascade"), userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "fk_wh_assignment_user" }).onDelete("cascade"), assignedByFk: foreignKey({ columns: [table.assignedByUserId], foreignColumns: [users.id], name: "fk_wh_assignment_actor" }).onDelete("restrict") }));

export const warehouseIntakes = mysqlTable("warehouse_intakes", {
  id: int("id").autoincrement().primaryKey(),
  sellerOrderId: int("sellerOrderId").notNull(),
  parentOrderId: int("parentOrderId").notNull(),
  sellerId: int("sellerId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  receivedByUserId: int("receivedByUserId"),
  status: mysqlEnum("status", ["awaiting_intake", "received", "verification_required", "verified", "discrepancy", "rejected"]).default("awaiting_intake").notNull(),
  expectedItemCount: int("expectedItemCount").notNull(),
  receivedItemCount: int("receivedItemCount").default(0).notNull(),
  packageCount: int("packageCount").default(0).notNull(),
  discrepancySummary: text("discrepancySummary"),
  notes: text("notes"),
  receivedAt: timestamp("receivedAt"),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ sellerOrderUq: uniqueIndex("uq_warehouse_intakes_seller_order").on(table.sellerOrderId), warehouseStatusIdx: index("idx_warehouse_intakes_warehouse_status").on(table.warehouseId, table.status, table.createdAt), sellerIdx: index("idx_warehouse_intakes_seller").on(table.sellerId), sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_wh_intake_seller_order" }).onDelete("restrict"), parentFk: foreignKey({ columns: [table.parentOrderId], foreignColumns: [orders.id], name: "fk_wh_intake_parent" }).onDelete("restrict"), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_wh_intake_seller" }).onDelete("restrict"), warehouseFk: foreignKey({ columns: [table.warehouseId], foreignColumns: [warehouses.id], name: "fk_wh_intake_warehouse" }).onDelete("restrict"), receivedByFk: foreignKey({ columns: [table.receivedByUserId], foreignColumns: [users.id], name: "fk_wh_intake_receiver" }).onDelete("set null") }));

export const warehousePackages = mysqlTable("warehouse_packages", {
  id: int("id").autoincrement().primaryKey(),
  packageReference: varchar("packageReference", { length: 32 }).notNull(),
  intakeId: int("intakeId").notNull(),
  sellerOrderId: int("sellerOrderId").notNull(),
  parentOrderId: int("parentOrderId").notNull(),
  sellerId: int("sellerId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  status: mysqlEnum("status", ["received", "verification_required", "verified", "discrepancy", "rejected", "sorted", "dispatch_ready"]).default("received").notNull(),
  destinationCountry: varchar("destinationCountry", { length: 80 }).notNull(),
  destinationCounty: varchar("destinationCounty", { length: 120 }).notNull(),
  destinationTown: varchar("destinationTown", { length: 120 }).notNull(),
  destinationZone: varchar("destinationZone", { length: 120 }),
  deliveryMethod: varchar("deliveryMethod", { length: 80 }),
  pickup: int("pickup").default(0).notNull(),
  weightGrams: int("weightGrams"),
  lengthMm: int("lengthMm"),
  widthMm: int("widthMm"),
  heightMm: int("heightMm"),
  receivedAt: timestamp("receivedAt"),
  verifiedAt: timestamp("verifiedAt"),
  sortedAt: timestamp("sortedAt"),
  dispatchReadyAt: timestamp("dispatchReadyAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ referenceUq: uniqueIndex("uq_warehouse_packages_reference").on(table.packageReference), intakeIdx: index("idx_warehouse_packages_intake").on(table.intakeId), warehouseStatusIdx: index("idx_warehouse_packages_warehouse_status").on(table.warehouseId, table.status, table.createdAt), sellerOrderIdx: index("idx_warehouse_packages_seller_order").on(table.sellerOrderId), intakeFk: foreignKey({ columns: [table.intakeId], foreignColumns: [warehouseIntakes.id], name: "fk_wh_package_intake" }).onDelete("cascade"), sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_wh_package_seller_order" }).onDelete("restrict"), parentFk: foreignKey({ columns: [table.parentOrderId], foreignColumns: [orders.id], name: "fk_wh_package_parent" }).onDelete("restrict"), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_wh_package_seller" }).onDelete("restrict"), warehouseFk: foreignKey({ columns: [table.warehouseId], foreignColumns: [warehouses.id], name: "fk_wh_package_warehouse" }).onDelete("restrict") }));

export const warehousePackageItems = mysqlTable("warehouse_package_items", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  orderItemId: int("orderItemId").notNull(),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ packageItemUq: uniqueIndex("uq_warehouse_package_item").on(table.packageId, table.orderItemId), itemIdx: index("idx_warehouse_package_items_order_item").on(table.orderItemId), packageFk: foreignKey({ columns: [table.packageId], foreignColumns: [warehousePackages.id], name: "fk_wh_package_item_package" }).onDelete("cascade"), orderItemFk: foreignKey({ columns: [table.orderItemId], foreignColumns: [orderItems.id], name: "fk_wh_package_item_order" }).onDelete("restrict") }));

export const warehouseDiscrepancies = mysqlTable("warehouse_discrepancies", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  packageId: int("packageId"),
  orderItemId: int("orderItemId"),
  type: mysqlEnum("type", ["missing_item", "excess_item", "damaged_package", "wrong_item", "incomplete_shipment", "packaging_problem"]).notNull(),
  description: text("description").notNull(),
  quantity: int("quantity").default(1).notNull(),
  reportedByUserId: int("reportedByUserId").notNull(),
  resolutionStatus: mysqlEnum("resolutionStatus", ["open", "in_review", "resolved", "rejected"]).default("open").notNull(),
  resolutionNote: text("resolutionNote"),
  resolvedByUserId: int("resolvedByUserId"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ intakeIdx: index("idx_warehouse_discrepancies_intake").on(table.intakeId, table.resolutionStatus), packageIdx: index("idx_warehouse_discrepancies_package").on(table.packageId), statusIdx: index("idx_warehouse_discrepancies_status").on(table.resolutionStatus, table.createdAt), intakeFk: foreignKey({ columns: [table.intakeId], foreignColumns: [warehouseIntakes.id], name: "fk_wh_discrepancy_intake" }).onDelete("cascade"), packageFk: foreignKey({ columns: [table.packageId], foreignColumns: [warehousePackages.id], name: "fk_wh_discrepancy_package" }).onDelete("set null"), orderItemFk: foreignKey({ columns: [table.orderItemId], foreignColumns: [orderItems.id], name: "fk_wh_discrepancy_item" }).onDelete("set null"), reportedByFk: foreignKey({ columns: [table.reportedByUserId], foreignColumns: [users.id], name: "fk_wh_discrepancy_reporter" }).onDelete("restrict"), resolvedByFk: foreignKey({ columns: [table.resolvedByUserId], foreignColumns: [users.id], name: "fk_wh_discrepancy_resolver" }).onDelete("set null") }));

export const warehouseSortingBatches = mysqlTable("warehouse_sorting_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchReference: varchar("batchReference", { length: 32 }).notNull(),
  warehouseId: int("warehouseId").notNull(),
  destinationCountry: varchar("destinationCountry", { length: 80 }).notNull(),
  destinationCounty: varchar("destinationCounty", { length: 120 }).notNull(),
  destinationTown: varchar("destinationTown", { length: 120 }).notNull(),
  destinationZone: varchar("destinationZone", { length: 120 }),
  deliveryMethod: varchar("deliveryMethod", { length: 80 }),
  status: mysqlEnum("status", ["open", "sorting", "sorted", "dispatch_ready", "closed"]).default("open").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  readyAt: timestamp("readyAt"),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ referenceUq: uniqueIndex("uq_warehouse_sorting_batches_reference").on(table.batchReference), warehouseStatusIdx: index("idx_warehouse_sorting_batches_warehouse_status").on(table.warehouseId, table.status, table.createdAt), warehouseFk: foreignKey({ columns: [table.warehouseId], foreignColumns: [warehouses.id], name: "fk_wh_batch_warehouse" }).onDelete("restrict"), createdByFk: foreignKey({ columns: [table.createdByUserId], foreignColumns: [users.id], name: "fk_wh_batch_creator" }).onDelete("restrict") }));

export const warehouseSortingBatchPackages = mysqlTable("warehouse_sorting_batch_packages", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  packageId: int("packageId").notNull(),
  addedByUserId: int("addedByUserId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (table) => ({ batchPackageUq: uniqueIndex("uq_warehouse_batch_package").on(table.batchId, table.packageId), packageUq: uniqueIndex("uq_warehouse_package_batch").on(table.packageId), batchIdx: index("idx_warehouse_batch_packages_batch").on(table.batchId), batchFk: foreignKey({ columns: [table.batchId], foreignColumns: [warehouseSortingBatches.id], name: "fk_wh_batch_package_batch" }).onDelete("cascade"), packageFk: foreignKey({ columns: [table.packageId], foreignColumns: [warehousePackages.id], name: "fk_wh_batch_package_package" }).onDelete("restrict"), addedByFk: foreignKey({ columns: [table.addedByUserId], foreignColumns: [users.id], name: "fk_wh_batch_package_actor" }).onDelete("restrict") }));

export const warehouseEvents = mysqlTable("warehouse_events", {
  id: int("id").autoincrement().primaryKey(),
  warehouseId: int("warehouseId").notNull(),
  entityType: mysqlEnum("entityType", ["intake", "package", "batch"]).notNull(),
  entityId: int("entityId").notNull(),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  previousState: varchar("previousState", { length: 64 }),
  newState: varchar("newState", { length: 64 }),
  actorUserId: int("actorUserId").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ entityIdx: index("idx_warehouse_events_entity_created").on(table.entityType, table.entityId, table.createdAt), warehouseIdx: index("idx_warehouse_events_warehouse_created").on(table.warehouseId, table.createdAt), warehouseFk: foreignKey({ columns: [table.warehouseId], foreignColumns: [warehouses.id], name: "fk_wh_event_warehouse" }).onDelete("restrict"), actorFk: foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "fk_wh_event_actor" }).onDelete("restrict") }));

export const couriers = mysqlTable("couriers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  email: varchar("email", { length: 320 }),
  photoRef: varchar("photoRef", { length: 512 }),
  status: mysqlEnum("status", ["pending", "active", "inactive", "suspended", "terminated"]).default("pending").notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["unverified", "pending", "verified", "rejected"]).default("unverified").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userUq: uniqueIndex("uq_couriers_user").on(table.userId), phoneIdx: index("idx_couriers_phone").on(table.phone), statusIdx: index("idx_couriers_status").on(table.status), userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "fk_courier_user" }).onDelete("restrict") }));

export const shipments = mysqlTable("shipments", {
  id: int("id").autoincrement().primaryKey(),
  trackingNumber: varchar("trackingNumber", { length: 40 }).notNull(),
  parentOrderId: int("parentOrderId").notNull(),
  sellerOrderId: int("sellerOrderId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  sortingBatchId: int("sortingBatchId"),
  courierId: int("courierId"),
  status: mysqlEnum("status", ["shipment_created", "awaiting_assignment", "assigned", "pickup_pending", "picked_up", "in_transit", "out_for_delivery", "delivery_attempted", "delivered", "assignment_failed", "pickup_failed", "delivery_failed", "cancelled", "returned_to_warehouse"]).default("shipment_created").notNull(),
  deliveryMethod: varchar("deliveryMethod", { length: 80 }),
  destinationSnapshot: json("destinationSnapshot").notNull(),
  packageCount: int("packageCount").default(0).notNull(),
  deliveryNotes: text("deliveryNotes"),
  otpHash: varchar("otpHash", { length: 128 }),
  otpExpiresAt: timestamp("otpExpiresAt"),
  assignedAt: timestamp("assignedAt"),
  pickedUpAt: timestamp("pickedUpAt"),
  deliveredAt: timestamp("deliveredAt"),
  failedAt: timestamp("failedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ trackingUq: uniqueIndex("uq_shipments_tracking").on(table.trackingNumber), sellerOrderIdx: index("idx_shipments_seller_order").on(table.sellerOrderId), parentIdx: index("idx_shipments_parent_order").on(table.parentOrderId), courierStatusIdx: index("idx_shipments_courier_status").on(table.courierId, table.status), statusIdx: index("idx_shipments_status_created").on(table.status, table.createdAt), parentFk: foreignKey({ columns: [table.parentOrderId], foreignColumns: [orders.id], name: "fk_shipment_parent" }).onDelete("restrict"), sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_shipment_seller_order" }).onDelete("restrict"), warehouseFk: foreignKey({ columns: [table.warehouseId], foreignColumns: [warehouses.id], name: "fk_shipment_warehouse" }).onDelete("restrict"), batchFk: foreignKey({ columns: [table.sortingBatchId], foreignColumns: [warehouseSortingBatches.id], name: "fk_shipment_batch" }).onDelete("set null"), courierFk: foreignKey({ columns: [table.courierId], foreignColumns: [couriers.id], name: "fk_shipment_courier" }).onDelete("set null") }));

export const shipmentPackages = mysqlTable("shipment_packages", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId").notNull(),
  packageId: int("packageId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ shipmentPackageUq: uniqueIndex("uq_shipment_package").on(table.shipmentId, table.packageId), packageActiveUq: uniqueIndex("uq_package_active_shipment").on(table.packageId), shipmentIdx: index("idx_shipment_packages_shipment").on(table.shipmentId), shipmentFk: foreignKey({ columns: [table.shipmentId], foreignColumns: [shipments.id], name: "fk_shipment_package_shipment" }).onDelete("cascade"), packageFk: foreignKey({ columns: [table.packageId], foreignColumns: [warehousePackages.id], name: "fk_shipment_package_package" }).onDelete("restrict") }));

export const shipmentEvents = mysqlTable("shipment_events", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId").notNull(),
  courierId: int("courierId"),
  actorUserId: int("actorUserId").notNull(),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  previousState: varchar("previousState", { length: 64 }),
  newState: varchar("newState", { length: 64 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ shipmentIdx: index("idx_shipment_events_shipment_created").on(table.shipmentId, table.createdAt), courierIdx: index("idx_shipment_events_courier_created").on(table.courierId, table.createdAt), shipmentFk: foreignKey({ columns: [table.shipmentId], foreignColumns: [shipments.id], name: "fk_shipment_event_shipment" }).onDelete("cascade"), courierFk: foreignKey({ columns: [table.courierId], foreignColumns: [couriers.id], name: "fk_shipment_event_courier" }).onDelete("set null"), actorFk: foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "fk_shipment_event_actor" }).onDelete("restrict") }));

export const deliveryAttempts = mysqlTable("delivery_attempts", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId").notNull(),
  courierId: int("courierId").notNull(),
  attemptNumber: int("attemptNumber").notNull(),
  outcome: mysqlEnum("outcome", ["delivered", "customer_unavailable", "incorrect_address", "customer_refused", "damaged_package", "other"]).notNull(),
  failureReason: text("failureReason"),
  notes: text("notes"),
  verificationMethod: varchar("verificationMethod", { length: 40 }),
  proofRef: varchar("proofRef", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ attemptUq: uniqueIndex("uq_delivery_attempt_number").on(table.shipmentId, table.attemptNumber), shipmentIdx: index("idx_delivery_attempts_shipment_created").on(table.shipmentId, table.createdAt), shipmentFk: foreignKey({ columns: [table.shipmentId], foreignColumns: [shipments.id], name: "fk_delivery_attempt_shipment" }).onDelete("cascade"), courierFk: foreignKey({ columns: [table.courierId], foreignColumns: [couriers.id], name: "fk_delivery_attempt_courier" }).onDelete("restrict") }));

export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 120 }).notNull(),
  version: int("version").default(1).notNull(),
  category: mysqlEnum("category", ["transactional", "promotional", "security", "operational"]).notNull(),
  channel: mysqlEnum("channel", ["in_app", "email", "sms", "whatsapp"]).notNull(),
  titleTemplate: varchar("titleTemplate", { length: 240 }).notNull(),
  bodyTemplate: text("bodyTemplate").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ codeVersionUq: uniqueIndex("uq_notification_template_code_version").on(table.code, table.version), activeIdx: index("idx_notification_templates_active").on(table.code, table.isActive) }));

export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  channel: mysqlEnum("channel", ["email", "sms", "whatsapp"]).notNull(),
  category: mysqlEnum("category", ["transactional", "promotional", "security", "operational"]).notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userChannelCategoryUq: uniqueIndex("uq_notification_preference_user_channel_category").on(table.userId, table.channel, table.category), userIdx: index("idx_notification_preferences_user").on(table.userId), userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "fk_notification_preference_user" }).onDelete("cascade") }));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recipientType: mysqlEnum("recipientType", ["customer", "seller", "courier", "staff", "admin"]).notNull(),
  eventType: varchar("eventType", { length: 120 }).notNull(),
  category: mysqlEnum("category", ["transactional", "promotional", "security", "operational"]).notNull(),
  channel: mysqlEnum("channel", ["in_app", "email", "sms", "whatsapp"]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "sent", "failed", "retrying"]).default("queued").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  body: text("body").notNull(),
  templateCode: varchar("templateCode", { length: 120 }).notNull(),
  templateVersion: int("templateVersion").default(1).notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 80 }),
  relatedEntityId: int("relatedEntityId"),
  navigationPath: varchar("navigationPath", { length: 240 }),
  idempotencyKey: varchar("idempotencyKey", { length: 240 }).notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  maxRetries: int("maxRetries").default(3).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt"),
  sentAt: timestamp("sentAt"),
  readAt: timestamp("readAt"),
  failureReason: text("failureReason"),
  providerMessageId: varchar("providerMessageId", { length: 240 }),
  providerStatus: varchar("providerStatus", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ idempotencyUq: uniqueIndex("uq_notifications_idempotency").on(table.idempotencyKey), recipientUnreadIdx: index("idx_notifications_recipient_read_created").on(table.userId, table.readAt, table.createdAt), recipientCreatedIdx: index("idx_notifications_recipient_created").on(table.userId, table.createdAt), statusRetryIdx: index("idx_notifications_status_next_attempt").on(table.status, table.nextAttemptAt), eventIdx: index("idx_notifications_event").on(table.eventType), relatedIdx: index("idx_notifications_related_entity").on(table.relatedEntityType, table.relatedEntityId), channelIdx: index("idx_notifications_channel_status").on(table.channel, table.status), userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "fk_notification_user" }).onDelete("cascade") }));

export const notificationOutbox = mysqlTable("notification_outbox", {
  id: int("id").autoincrement().primaryKey(),
  eventKey: varchar("eventKey", { length: 240 }).notNull(),
  eventType: varchar("eventType", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: int("entityId").notNull(),
  payload: json("payload").notNull(),
  status: mysqlEnum("status", ["queued", "processing", "processed", "failed", "retrying"]).default("queued").notNull(),
  attempts: int("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt"),
  lastError: text("lastError"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ eventKeyUq: uniqueIndex("uq_notification_outbox_event_key").on(table.eventKey), statusRetryIdx: index("idx_notification_outbox_status_retry").on(table.status, table.nextAttemptAt), eventTypeIdx: index("idx_notification_outbox_event_type").on(table.eventType) }));

export const notificationDeliveryAttempts = mysqlTable("notification_delivery_attempts", {
  id: int("id").autoincrement().primaryKey(),
  notificationId: int("notificationId").notNull(),
  channel: mysqlEnum("channel", ["in_app", "email", "sms", "whatsapp"]).notNull(),
  provider: varchar("provider", { length: 80 }),
  attemptNumber: int("attemptNumber").notNull(),
  result: mysqlEnum("result", ["sent", "failed", "retryable"]).notNull(),
  providerMessageId: varchar("providerMessageId", { length: 240 }),
  providerStatus: varchar("providerStatus", { length: 80 }),
  failureReason: text("failureReason"),
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
}, (table) => ({ attemptUq: uniqueIndex("uq_notification_delivery_attempt").on(table.notificationId, table.attemptNumber), notificationIdx: index("idx_notification_delivery_attempts_notification").on(table.notificationId, table.attemptedAt), notificationFk: foreignKey({ columns: [table.notificationId], foreignColumns: [notifications.id], name: "fk_notification_delivery_attempt_notification" }).onDelete("cascade") }));

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  targetType: mysqlEnum("targetType", ["product", "seller"]).notNull(),
  productId: int("productId"),
  sellerId: int("sellerId").notNull(),
  orderId: int("orderId").notNull(),
  sellerOrderId: int("sellerOrderId").notNull(),
  orderItemId: int("orderItemId"),
  purchaseKey: varchar("purchaseKey", { length: 180 }).notNull(),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 180 }),
  reviewText: text("reviewText").notNull(),
  status: mysqlEnum("status", ["pending", "published", "rejected", "hidden", "removed"]).default("pending").notNull(),
  verifiedPurchase: int("verifiedPurchase").default(1).notNull(),
  publishedAt: timestamp("publishedAt"),
  moderatedAt: timestamp("moderatedAt"),
  moderatedBy: int("moderatedBy"),
  moderationReason: text("moderationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  purchaseUq: uniqueIndex("uq_reviews_purchase_key").on(table.purchaseKey),
  customerIdx: index("idx_reviews_customer_created").on(table.customerId, table.createdAt),
  productIdx: index("idx_reviews_product_status_created").on(table.productId, table.status, table.createdAt),
  sellerIdx: index("idx_reviews_seller_status_created").on(table.sellerId, table.status, table.createdAt),
  orderIdx: index("idx_reviews_order_item").on(table.orderId, table.orderItemId),
  customerFk: foreignKey({ columns: [table.customerId], foreignColumns: [users.id], name: "fk_review_customer" }).onDelete("restrict"),
  productFk: foreignKey({ columns: [table.productId], foreignColumns: [catalogProducts.id], name: "fk_review_product" }).onDelete("restrict"),
  sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_review_seller" }).onDelete("restrict"),
  orderFk: foreignKey({ columns: [table.orderId], foreignColumns: [orders.id], name: "fk_review_order" }).onDelete("restrict"),
  sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_review_seller_order" }).onDelete("restrict"),
  orderItemFk: foreignKey({ columns: [table.orderItemId], foreignColumns: [orderItems.id], name: "fk_review_order_item" }).onDelete("restrict"),
  moderatorFk: foreignKey({ columns: [table.moderatedBy], foreignColumns: [users.id], name: "fk_review_moderator" }).onDelete("set null"),
}));

export const reviewMedia = mysqlTable("review_media", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  storageKey: varchar("storageKey", { length: 1024 }).notNull(),
  mediaType: mysqlEnum("mediaType", ["image", "video"]).default("image").notNull(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  fileSize: int("fileSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ reviewIdx: index("idx_review_media_review").on(table.reviewId, table.createdAt), reviewFk: foreignKey({ columns: [table.reviewId], foreignColumns: [reviews.id], name: "fk_review_media_review" }).onDelete("cascade") }));

export const returnPolicies = mysqlTable("return_policies", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId"),
  returnWindowDays: int("returnWindowDays").notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ scopeUq: uniqueIndex("uq_return_policy_seller_scope").on(table.sellerId), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_return_policy_seller" }).onDelete("cascade") }));

export const returnRequests = mysqlTable("return_requests", {
  id: int("id").autoincrement().primaryKey(),
  returnNumber: varchar("returnNumber", { length: 40 }).notNull(),
  customerId: int("customerId").notNull(),
  orderId: int("orderId").notNull(),
  sellerOrderId: int("sellerOrderId").notNull(),
  status: mysqlEnum("status", ["requested", "approved", "rejected", "in_transit", "received", "inspected", "refund_approved", "refund_processing", "refunded", "closed", "cancelled"]).default("requested").notNull(),
  reason: mysqlEnum("reason", ["wrong_item", "wrong_size", "damaged", "defective", "not_as_described", "missing_parts", "changed_mind", "duplicate_order", "other"]).notNull(),
  customerNote: text("customerNote"),
  rejectionReason: text("rejectionReason"),
  instructions: text("instructions"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  rejectedAt: timestamp("rejectedAt"),
  receivedAt: timestamp("receivedAt"),
  inspectedAt: timestamp("inspectedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ numberUq: uniqueIndex("uq_return_requests_number").on(table.returnNumber), customerIdx: index("idx_return_requests_customer_created").on(table.customerId, table.createdAt), sellerIdx: index("idx_return_requests_seller_status").on(table.sellerOrderId, table.status, table.createdAt), orderIdx: index("idx_return_requests_order").on(table.orderId), customerFk: foreignKey({ columns: [table.customerId], foreignColumns: [users.id], name: "fk_return_request_customer" }).onDelete("restrict"), orderFk: foreignKey({ columns: [table.orderId], foreignColumns: [orders.id], name: "fk_return_request_order" }).onDelete("restrict"), sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_return_request_seller_order" }).onDelete("restrict") }));

export const returnItems = mysqlTable("return_items", {
  id: int("id").autoincrement().primaryKey(),
  returnRequestId: int("returnRequestId").notNull(),
  orderItemId: int("orderItemId").notNull(),
  orderedQuantity: int("orderedQuantity").notNull(),
  requestedQuantity: int("requestedQuantity").notNull(),
  approvedQuantity: int("approvedQuantity").default(0).notNull(),
  receivedQuantity: int("receivedQuantity").default(0).notNull(),
  refundedQuantity: int("refundedQuantity").default(0).notNull(),
  disposition: mysqlEnum("disposition", ["pending", "restock", "damaged", "quarantine", "discard"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ requestItemUq: uniqueIndex("uq_return_items_request_item").on(table.returnRequestId, table.orderItemId), itemIdx: index("idx_return_items_order_item").on(table.orderItemId), requestFk: foreignKey({ columns: [table.returnRequestId], foreignColumns: [returnRequests.id], name: "fk_return_item_request" }).onDelete("cascade"), orderItemFk: foreignKey({ columns: [table.orderItemId], foreignColumns: [orderItems.id], name: "fk_return_item_order_item" }).onDelete("restrict") }));

export const returnInspections = mysqlTable("return_inspections", {
  id: int("id").autoincrement().primaryKey(),
  returnRequestId: int("returnRequestId").notNull(),
  inspectedByUserId: int("inspectedByUserId").notNull(),
  outcome: mysqlEnum("outcome", ["approved", "partial", "rejected"]).notNull(),
  condition: mysqlEnum("condition", ["resalable", "damaged", "defective", "incomplete", "wrong_item", "unusable"]).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ requestIdx: index("idx_return_inspections_request_created").on(table.returnRequestId, table.createdAt), requestFk: foreignKey({ columns: [table.returnRequestId], foreignColumns: [returnRequests.id], name: "fk_return_inspection_request" }).onDelete("cascade"), inspectorFk: foreignKey({ columns: [table.inspectedByUserId], foreignColumns: [users.id], name: "fk_return_inspection_user" }).onDelete("restrict") }));

export const refunds = mysqlTable("refunds", {
  id: int("id").autoincrement().primaryKey(),
  refundNumber: varchar("refundNumber", { length: 40 }).notNull(),
  returnRequestId: int("returnRequestId").notNull(),
  paymentAttemptId: int("paymentAttemptId").notNull(),
  customerId: int("customerId").notNull(),
  amountMinor: int("amountMinor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("status", ["approved", "processing", "successful", "failed", "cancelled"]).default("approved").notNull(),
  provider: mysqlEnum("provider", ["mpesa", "card", "other"]).notNull(),
  providerReference: varchar("providerReference", { length: 200 }),
  failureReason: text("failureReason"),
  idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ numberUq: uniqueIndex("uq_refunds_number").on(table.refundNumber), keyUq: uniqueIndex("uq_refunds_idempotency").on(table.idempotencyKey), requestUq: uniqueIndex("uq_refunds_return_request").on(table.returnRequestId), requestFk: foreignKey({ columns: [table.returnRequestId], foreignColumns: [returnRequests.id], name: "fk_refund_return_request" }).onDelete("restrict"), paymentFk: foreignKey({ columns: [table.paymentAttemptId], foreignColumns: [paymentAttempts.id], name: "fk_refund_payment_attempt" }).onDelete("restrict"), customerFk: foreignKey({ columns: [table.customerId], foreignColumns: [users.id], name: "fk_refund_customer" }).onDelete("restrict"), statusIdx: index("idx_refunds_status_created").on(table.status, table.createdAt) }));

export const returnEvents = mysqlTable("return_events", {
  id: int("id").autoincrement().primaryKey(),
  returnRequestId: int("returnRequestId").notNull(),
  actorUserId: int("actorUserId"),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  previousState: varchar("previousState", { length: 64 }),
  newState: varchar("newState", { length: 64 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ requestIdx: index("idx_return_events_request_created").on(table.returnRequestId, table.createdAt), requestFk: foreignKey({ columns: [table.returnRequestId], foreignColumns: [returnRequests.id], name: "fk_return_event_request" }).onDelete("cascade"), actorFk: foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "fk_return_event_actor" }).onDelete("set null") }));

export const supportTickets = mysqlTable("support_tickets", { id: int("id").autoincrement().primaryKey(), ticketNumber: varchar("ticketNumber", { length: 40 }).notNull(), customerId: int("customerId").notNull(), category: mysqlEnum("category", ["order_issue", "payment_issue", "delivery_issue", "product_issue", "seller_issue", "return_issue", "refund_issue", "account_issue", "technical_issue", "other"]).notNull(), priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(), status: mysqlEnum("status", ["open", "pending_customer", "pending_seller", "in_progress", "escalated", "resolved", "closed", "reopened"]).default("open").notNull(), subject: varchar("subject", { length: 240 }).notNull(), description: text("description").notNull(), orderId: int("orderId"), sellerOrderId: int("sellerOrderId"), shipmentId: int("shipmentId"), returnRequestId: int("returnRequestId"), refundId: int("refundId"), assignedAgentId: int("assignedAgentId"), assignedTeam: varchar("assignedTeam", { length: 80 }), idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(), dueAt: timestamp("dueAt"), firstResponseAt: timestamp("firstResponseAt"), resolvedAt: timestamp("resolvedAt"), closedAt: timestamp("closedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => ({ numberUq: uniqueIndex("uq_support_ticket_number").on(table.ticketNumber), idemUq: uniqueIndex("uq_support_ticket_customer_idem").on(table.customerId, table.idempotencyKey), customerIdx: index("idx_support_ticket_customer_status").on(table.customerId, table.status, table.createdAt), queueIdx: index("idx_support_ticket_queue").on(table.status, table.priority, table.updatedAt), customerFk: foreignKey({ columns: [table.customerId], foreignColumns: [users.id], name: "fk_support_ticket_customer" }).onDelete("restrict"), orderFk: foreignKey({ columns: [table.orderId], foreignColumns: [orders.id], name: "fk_support_ticket_order" }).onDelete("set null"), sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_support_ticket_seller_order" }).onDelete("set null"), shipmentFk: foreignKey({ columns: [table.shipmentId], foreignColumns: [shipments.id], name: "fk_support_ticket_shipment" }).onDelete("set null"), returnFk: foreignKey({ columns: [table.returnRequestId], foreignColumns: [returnRequests.id], name: "fk_support_ticket_return" }).onDelete("set null"), refundFk: foreignKey({ columns: [table.refundId], foreignColumns: [refunds.id], name: "fk_support_ticket_refund" }).onDelete("set null"), agentFk: foreignKey({ columns: [table.assignedAgentId], foreignColumns: [users.id], name: "fk_support_ticket_agent" }).onDelete("set null") }));
export const supportMessages = mysqlTable("support_messages", { id: int("id").autoincrement().primaryKey(), ticketId: int("ticketId").notNull(), authorUserId: int("authorUserId").notNull(), authorType: mysqlEnum("authorType", ["customer", "support", "seller", "system"]).notNull(), body: text("body").notNull(), isInternal: int("isInternal").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ ticketIdx: index("idx_support_message_ticket").on(table.ticketId, table.createdAt), ticketFk: foreignKey({ columns: [table.ticketId], foreignColumns: [supportTickets.id], name: "fk_support_message_ticket" }).onDelete("cascade"), authorFk: foreignKey({ columns: [table.authorUserId], foreignColumns: [users.id], name: "fk_support_message_author" }).onDelete("restrict") }));
export const supportEvents = mysqlTable("support_events", { id: int("id").autoincrement().primaryKey(), ticketId: int("ticketId").notNull(), actorUserId: int("actorUserId"), eventType: varchar("eventType", { length: 100 }).notNull(), previousStatus: varchar("previousStatus", { length: 64 }), newStatus: varchar("newStatus", { length: 64 }), note: text("note"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ ticketIdx: index("idx_support_event_ticket").on(table.ticketId, table.createdAt), ticketFk: foreignKey({ columns: [table.ticketId], foreignColumns: [supportTickets.id], name: "fk_support_event_ticket" }).onDelete("cascade"), actorFk: foreignKey({ columns: [table.actorUserId], foreignColumns: [users.id], name: "fk_support_event_actor" }).onDelete("set null") }));
export const supportAssignments = mysqlTable("support_assignments", { id: int("id").autoincrement().primaryKey(), ticketId: int("ticketId").notNull(), agentUserId: int("agentUserId"), team: varchar("team", { length: 80 }), assignedByUserId: int("assignedByUserId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ ticketFk: foreignKey({ columns: [table.ticketId], foreignColumns: [supportTickets.id], name: "fk_support_assignment_ticket" }).onDelete("cascade"), agentFk: foreignKey({ columns: [table.agentUserId], foreignColumns: [users.id], name: "fk_support_assignment_agent" }).onDelete("set null"), actorFk: foreignKey({ columns: [table.assignedByUserId], foreignColumns: [users.id], name: "fk_support_assignment_actor" }).onDelete("restrict") }));
export const supportEvidence = mysqlTable("support_evidence", { id: int("id").autoincrement().primaryKey(), ticketId: int("ticketId").notNull(), uploadedByUserId: int("uploadedByUserId").notNull(), storageKey: varchar("storageKey", { length: 500 }).notNull(), url: varchar("url", { length: 700 }).notNull(), fileName: varchar("fileName", { length: 240 }).notNull(), mimeType: varchar("mimeType", { length: 120 }).notNull(), sizeBytes: int("sizeBytes").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ ticketIdx: index("idx_support_evidence_ticket").on(table.ticketId, table.createdAt), ticketFk: foreignKey({ columns: [table.ticketId], foreignColumns: [supportTickets.id], name: "fk_support_evidence_ticket" }).onDelete("cascade"), uploaderFk: foreignKey({ columns: [table.uploadedByUserId], foreignColumns: [users.id], name: "fk_support_evidence_uploader" }).onDelete("restrict") }));
export const supportSlaPolicies = mysqlTable("support_sla_policies", { id: int("id").autoincrement().primaryKey(), priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).notNull(), firstResponseMinutes: int("firstResponseMinutes").notNull(), resolutionMinutes: int("resolutionMinutes").notNull(), isActive: int("isActive").default(1).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ priorityUq: uniqueIndex("uq_support_sla_priority").on(table.priority) }));

export const financeAccounts = mysqlTable("finance_accounts", { id: int("id").autoincrement().primaryKey(), accountCode: varchar("accountCode", { length: 80 }).notNull(), accountType: mysqlEnum("accountType", ["platform", "seller", "clearing", "commission", "receivable"]).notNull(), sellerId: int("sellerId"), currency: varchar("currency", { length: 3 }).notNull(), status: mysqlEnum("status", ["active", "suspended", "closed"]).default("active").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ codeUq: uniqueIndex("uq_finance_account_code").on(table.accountCode), sellerCurrencyUq: uniqueIndex("uq_finance_account_seller_currency").on(table.sellerId, table.currency), sellerIdx: index("idx_finance_account_seller").on(table.sellerId), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_finance_account_seller" }).onDelete("restrict") }));
export const financeTransactions = mysqlTable("finance_transactions", { id: int("id").autoincrement().primaryKey(), transactionNumber: varchar("transactionNumber", { length: 48 }).notNull(), idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(), eventType: varchar("eventType", { length: 100 }).notNull(), referenceType: varchar("referenceType", { length: 80 }).notNull(), referenceId: int("referenceId").notNull(), currency: varchar("currency", { length: 3 }).notNull(), description: text("description").notNull(), status: mysqlEnum("status", ["draft", "posted", "reversed"]).default("draft").notNull(), postedAt: timestamp("postedAt"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ numberUq: uniqueIndex("uq_finance_transaction_number").on(table.transactionNumber), idemUq: uniqueIndex("uq_finance_transaction_idempotency").on(table.idempotencyKey), refIdx: index("idx_finance_transaction_reference").on(table.referenceType, table.referenceId), statusIdx: index("idx_finance_transaction_status").on(table.status, table.createdAt) }));
export const financeEntries = mysqlTable("finance_entries", { id: int("id").autoincrement().primaryKey(), transactionId: int("transactionId").notNull(), accountId: int("accountId").notNull(), debitMinor: int("debitMinor").default(0).notNull(), creditMinor: int("creditMinor").default(0).notNull(), currency: varchar("currency", { length: 3 }).notNull(), lineType: varchar("lineType", { length: 80 }).notNull(), description: text("description"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ transactionIdx: index("idx_finance_entry_transaction").on(table.transactionId), accountIdx: index("idx_finance_entry_account_created").on(table.accountId, table.createdAt), transactionFk: foreignKey({ columns: [table.transactionId], foreignColumns: [financeTransactions.id], name: "fk_finance_entry_transaction" }).onDelete("restrict"), accountFk: foreignKey({ columns: [table.accountId], foreignColumns: [financeAccounts.id], name: "fk_finance_entry_account" }).onDelete("restrict") }));
export const financeCommissionRules = mysqlTable("finance_commission_rules", { id: int("id").autoincrement().primaryKey(), sellerId: int("sellerId"), categoryId: int("categoryId"), productId: int("productId"), rateBasisPoints: int("rateBasisPoints").notNull(), currency: varchar("currency", { length: 3 }).notNull().default("KES"), priority: int("priority").notNull(), active: int("active").default(1).notNull(), effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(), effectiveTo: timestamp("effectiveTo"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ lookupIdx: index("idx_finance_commission_lookup").on(table.sellerId, table.categoryId, table.productId, table.active, table.priority), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_finance_commission_seller" }).onDelete("restrict"), categoryFk: foreignKey({ columns: [table.categoryId], foreignColumns: [catalogCategories.id], name: "fk_finance_commission_category" }).onDelete("restrict"), productFk: foreignKey({ columns: [table.productId], foreignColumns: [catalogProducts.id], name: "fk_finance_commission_product" }).onDelete("restrict") }));
export const financeSnapshots = mysqlTable("finance_snapshots", { id: int("id").autoincrement().primaryKey(), transactionId: int("transactionId").notNull(), sellerOrderId: int("sellerOrderId"), orderItemId: int("orderItemId"), sellerId: int("sellerId").notNull(), grossMinor: int("grossMinor").notNull(), commissionMinor: int("commissionMinor").notNull(), sellerNetMinor: int("sellerNetMinor").notNull(), rateBasisPoints: int("rateBasisPoints").notNull(), ruleId: int("ruleId"), currency: varchar("currency", { length: 3 }).notNull(), calculationVersion: varchar("calculationVersion", { length: 40 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ transactionUq: uniqueIndex("uq_finance_snapshot_transaction_item").on(table.transactionId, table.orderItemId), sellerIdx: index("idx_finance_snapshot_seller").on(table.sellerId, table.createdAt), transactionFk: foreignKey({ columns: [table.transactionId], foreignColumns: [financeTransactions.id], name: "fk_finance_snapshot_transaction" }).onDelete("restrict"), sellerOrderFk: foreignKey({ columns: [table.sellerOrderId], foreignColumns: [orderSellerOrders.id], name: "fk_finance_snapshot_seller_order" }).onDelete("restrict"), orderItemFk: foreignKey({ columns: [table.orderItemId], foreignColumns: [orderItems.id], name: "fk_finance_snapshot_order_item" }).onDelete("restrict"), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_finance_snapshot_seller" }).onDelete("restrict"), ruleFk: foreignKey({ columns: [table.ruleId], foreignColumns: [financeCommissionRules.id], name: "fk_finance_snapshot_rule" }).onDelete("set null") }));
export const financeHolds = mysqlTable("finance_holds", { id: int("id").autoincrement().primaryKey(), sellerId: int("sellerId").notNull(), amountMinor: int("amountMinor").notNull(), currency: varchar("currency", { length: 3 }).notNull(), reason: varchar("reason", { length: 160 }).notNull(), referenceType: varchar("referenceType", { length: 80 }).notNull(), referenceId: int("referenceId").notNull(), status: mysqlEnum("status", ["active", "released", "cancelled"]).default("active").notNull(), createdByUserId: int("createdByUserId").notNull(), releasedByUserId: int("releasedByUserId"), releasedAt: timestamp("releasedAt"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ sellerIdx: index("idx_finance_hold_seller_status").on(table.sellerId, table.status), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_finance_hold_seller" }).onDelete("restrict"), creatorFk: foreignKey({ columns: [table.createdByUserId], foreignColumns: [users.id], name: "fk_finance_hold_creator" }).onDelete("restrict") }));
export const financeAdjustments = mysqlTable("finance_adjustments", { id: int("id").autoincrement().primaryKey(), transactionId: int("transactionId").notNull(), sellerId: int("sellerId").notNull(), amountMinor: int("amountMinor").notNull(), currency: varchar("currency", { length: 3 }).notNull(), reason: text("reason").notNull(), reference: text("reference").notNull(), createdByUserId: int("createdByUserId").notNull(), idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ idemUq: uniqueIndex("uq_finance_adjustment_idempotency").on(table.idempotencyKey), transactionFk: foreignKey({ columns: [table.transactionId], foreignColumns: [financeTransactions.id], name: "fk_finance_adjustment_transaction" }).onDelete("restrict"), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_finance_adjustment_seller" }).onDelete("restrict"), creatorFk: foreignKey({ columns: [table.createdByUserId], foreignColumns: [users.id], name: "fk_finance_adjustment_creator" }).onDelete("restrict") }));
export const settlementPeriods = mysqlTable("settlement_periods", { id: int("id").autoincrement().primaryKey(), periodNumber: varchar("periodNumber", { length: 40 }).notNull(), startsAt: timestamp("startsAt").notNull(), endsAt: timestamp("endsAt").notNull(), status: mysqlEnum("status", ["open", "calculating", "review", "approved", "processing", "completed", "failed", "cancelled"]).default("open").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ numberUq: uniqueIndex("uq_settlement_period_number").on(table.periodNumber), statusIdx: index("idx_settlement_period_status").on(table.status, table.endsAt) }));
export const sellerSettlements = mysqlTable("seller_settlements", { id: int("id").autoincrement().primaryKey(), settlementNumber: varchar("settlementNumber", { length: 48 }).notNull(), periodId: int("periodId").notNull(), sellerId: int("sellerId").notNull(), grossMinor: int("grossMinor").notNull(), commissionMinor: int("commissionMinor").notNull(), refundsMinor: int("refundsMinor").notNull(), adjustmentsMinor: int("adjustmentsMinor").notNull(), holdsMinor: int("holdsMinor").notNull(), netMinor: int("netMinor").notNull(), currency: varchar("currency", { length: 3 }).notNull(), status: mysqlEnum("status", ["draft", "approved", "processing", "completed", "failed", "cancelled"]).default("draft").notNull(), idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(), approvedAt: timestamp("approvedAt"), processedAt: timestamp("processedAt"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ numberUq: uniqueIndex("uq_seller_settlement_number").on(table.settlementNumber), idemUq: uniqueIndex("uq_seller_settlement_idempotency").on(table.idempotencyKey), sellerPeriodUq: uniqueIndex("uq_seller_settlement_seller_period").on(table.sellerId, table.periodId), periodFk: foreignKey({ columns: [table.periodId], foreignColumns: [settlementPeriods.id], name: "fk_seller_settlement_period" }).onDelete("restrict"), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_seller_settlement_seller" }).onDelete("restrict") }));

export const sellerPayouts = mysqlTable("seller_payouts", { id: int("id").autoincrement().primaryKey(), payoutReference: varchar("payoutReference", { length: 64 }).notNull(), settlementId: int("settlementId").notNull(), sellerId: int("sellerId").notNull(), beneficiaryId: int("beneficiaryId").notNull(), beneficiarySnapshotMasked: varchar("beneficiarySnapshotMasked", { length: 40 }).notNull(), beneficiarySnapshotFingerprint: varchar("beneficiarySnapshotFingerprint", { length: 128 }).notNull(), beneficiarySnapshotEncrypted: text("beneficiarySnapshotEncrypted").notNull(), provider: varchar("provider", { length: 40 }).notNull(), amountMinor: int("amountMinor").notNull(), currency: varchar("currency", { length: 3 }).notNull(), status: mysqlEnum("status", ["ready", "queued", "processing", "submitted", "pending_confirmation", "confirmed", "failed", "reconciliation_required", "cancelled"]).default("ready").notNull(), providerReference: varchar("providerReference", { length: 160 }), failureClass: mysqlEnum("failureClass", ["transient", "permanent", "ambiguous"]), failureReason: text("failureReason"), attemptCount: int("attemptCount").default(0).notNull(), idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(), lastAttemptAt: timestamp("lastAttemptAt"), submittedAt: timestamp("submittedAt"), confirmedAt: timestamp("confirmedAt"), failedAt: timestamp("failedAt"), lastReconciledAt: timestamp("lastReconciledAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => ({ referenceUq: uniqueIndex("uq_seller_payout_reference").on(table.payoutReference), settlementUq: uniqueIndex("uq_seller_payout_settlement").on(table.settlementId), idemUq: uniqueIndex("uq_seller_payout_idempotency").on(table.idempotencyKey), sellerIdx: index("idx_seller_payout_seller_status").on(table.sellerId, table.status, table.createdAt), settlementFk: foreignKey({ columns: [table.settlementId], foreignColumns: [sellerSettlements.id], name: "fk_seller_payout_settlement" }).onDelete("restrict"), sellerFk: foreignKey({ columns: [table.sellerId], foreignColumns: [sellers.id], name: "fk_seller_payout_seller" }).onDelete("restrict"), beneficiaryFk: foreignKey({ columns: [table.beneficiaryId], foreignColumns: [sellerPayoutBeneficiaries.id], name: "fk_seller_payout_beneficiary" }).onDelete("restrict") }));
export const sellerPayoutAttempts = mysqlTable("seller_payout_attempts", { id: int("id").autoincrement().primaryKey(), payoutId: int("payoutId").notNull(), attemptNumber: int("attemptNumber").notNull(), requestReference: varchar("requestReference", { length: 100 }).notNull(), providerReference: varchar("providerReference", { length: 160 }), status: varchar("status", { length: 40 }).notNull(), safeResponse: json("safeResponse"), startedAt: timestamp("startedAt").notNull(), completedAt: timestamp("completedAt"), createdAt: timestamp("createdAt").defaultNow().notNull() }, (table) => ({ uq: uniqueIndex("uq_seller_payout_attempt").on(table.payoutId, table.attemptNumber), fk: foreignKey({ columns: [table.payoutId], foreignColumns: [sellerPayouts.id], name: "fk_seller_payout_attempt_payout" }).onDelete("restrict") }));
export const sellerPayoutEvents = mysqlTable("seller_payout_events", { id: int("id").autoincrement().primaryKey(), payoutId: int("payoutId").notNull(), provider: varchar("provider", { length: 40 }).notNull(), providerEventId: varchar("providerEventId", { length: 180 }).notNull(), providerReference: varchar("providerReference", { length: 160 }), normalizedStatus: varchar("normalizedStatus", { length: 40 }).notNull(), processingStatus: mysqlEnum("processingStatus", ["received", "processed", "ignored", "rejected", "reconciliation_required"]).default("received").notNull(), safePayload: json("safePayload"), errorMessage: text("errorMessage"), receivedAt: timestamp("receivedAt").defaultNow().notNull(), processedAt: timestamp("processedAt") }, (table) => ({ eventUq: uniqueIndex("uq_seller_payout_provider_event").on(table.provider, table.providerEventId), fk: foreignKey({ columns: [table.payoutId], foreignColumns: [sellerPayouts.id], name: "fk_seller_payout_event_payout" }).onDelete("restrict") }));
export const financePayoutControls = mysqlTable("finance_payout_controls", { id: int("id").primaryKey(), paused: int("paused").default(0).notNull(), reason: text("reason"), updatedByUserId: int("updatedByUserId"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => ({ fk: foreignKey({ columns: [table.updatedByUserId], foreignColumns: [users.id], name: "fk_finance_payout_control_updater" }).onDelete("set null") }));
export const financeWorkerJobs = mysqlTable("finance_worker_jobs", { id: int("id").autoincrement().primaryKey(), jobKey: varchar("jobKey", { length: 180 }).notNull(), jobType: varchar("jobType", { length: 80 }).notNull(), resourceId: int("resourceId").notNull(), status: mysqlEnum("status", ["queued", "processing", "completed", "failed", "retryable", "reconciliation_required"]).default("queued").notNull(), attempts: int("attempts").default(0).notNull(), maxAttempts: int("maxAttempts").default(5).notNull(), availableAt: timestamp("availableAt").defaultNow().notNull(), lockedAt: timestamp("lockedAt"), lockedBy: varchar("lockedBy", { length: 120 }), lastError: text("lastError"), startedAt: timestamp("startedAt"), completedAt: timestamp("completedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => ({ uq: uniqueIndex("uq_finance_worker_job_key").on(table.jobKey), idx: index("idx_finance_worker_queue").on(table.status, table.availableAt) }));

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
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NotificationOutbox = typeof notificationOutbox.$inferSelect;
export type NotificationDeliveryAttempt = typeof notificationDeliveryAttempts.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ReviewMedia = typeof reviewMedia.$inferSelect;
export type ReturnPolicy = typeof returnPolicies.$inferSelect;
export type ReturnRequest = typeof returnRequests.$inferSelect;
export type ReturnItem = typeof returnItems.$inferSelect;
export type ReturnInspection = typeof returnInspections.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type ReturnEvent = typeof returnEvents.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type SupportEvent = typeof supportEvents.$inferSelect;
export type SupportAssignment = typeof supportAssignments.$inferSelect;
export type SupportEvidence = typeof supportEvidence.$inferSelect;
export type SupportSlaPolicy = typeof supportSlaPolicies.$inferSelect;
export type FinanceAccount = typeof financeAccounts.$inferSelect;
export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type FinanceCommissionRule = typeof financeCommissionRules.$inferSelect;
export type FinanceSnapshot = typeof financeSnapshots.$inferSelect;
export type FinanceHold = typeof financeHolds.$inferSelect;
export type FinanceAdjustment = typeof financeAdjustments.$inferSelect;
export type SettlementPeriod = typeof settlementPeriods.$inferSelect;
export type SellerSettlement = typeof sellerSettlements.$inferSelect;

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

export const sellerPayoutBeneficiariesRelations = relations(sellerPayoutBeneficiaries, ({ one, many }) => ({
  seller: one(sellers, { fields: [sellerPayoutBeneficiaries.sellerId], references: [sellers.id] }),
  createdBy: one(users, { fields: [sellerPayoutBeneficiaries.createdByUserId], references: [users.id] }),
  verifiedBy: one(users, { fields: [sellerPayoutBeneficiaries.verifiedByUserId], references: [users.id] }),
  events: many(sellerPayoutBeneficiaryEvents),
}));

export const sellerPayoutBeneficiaryEventsRelations = relations(sellerPayoutBeneficiaryEvents, ({ one }) => ({
  beneficiary: one(sellerPayoutBeneficiaries, { fields: [sellerPayoutBeneficiaryEvents.beneficiaryId], references: [sellerPayoutBeneficiaries.id] }),
  seller: one(sellers, { fields: [sellerPayoutBeneficiaryEvents.sellerId], references: [sellers.id] }),
  actor: one(users, { fields: [sellerPayoutBeneficiaryEvents.actorUserId], references: [users.id] }),
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
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({ user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }) }));
export const notificationsRelations = relations(notifications, ({ one, many }) => ({ user: one(users, { fields: [notifications.userId], references: [users.id] }), deliveryAttempts: many(notificationDeliveryAttempts) }));
export const notificationDeliveryAttemptsRelations = relations(notificationDeliveryAttempts, ({ one }) => ({ notification: one(notifications, { fields: [notificationDeliveryAttempts.notificationId], references: [notifications.id] }) }));
export const reviewsRelations = relations(reviews, ({ one, many }) => ({ customer: one(users, { fields: [reviews.customerId], references: [users.id] }), product: one(catalogProducts, { fields: [reviews.productId], references: [catalogProducts.id] }), seller: one(sellers, { fields: [reviews.sellerId], references: [sellers.id] }), order: one(orders, { fields: [reviews.orderId], references: [orders.id] }), sellerOrder: one(orderSellerOrders, { fields: [reviews.sellerOrderId], references: [orderSellerOrders.id] }), orderItem: one(orderItems, { fields: [reviews.orderItemId], references: [orderItems.id] }), moderator: one(users, { fields: [reviews.moderatedBy], references: [users.id] }), media: many(reviewMedia) }));
export const reviewMediaRelations = relations(reviewMedia, ({ one }) => ({ review: one(reviews, { fields: [reviewMedia.reviewId], references: [reviews.id] }) }));
