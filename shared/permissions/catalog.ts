export const ROLE_CODES = [
  "super_admin",
  "marketplace_admin",
  "product_manager",
  "finance",
  "customer_support",
  "logistics_manager",
  "warehouse_staff",
  "seller",
  "courier",
  "customer",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_DEFINITIONS: Record<RoleCode, { name: string; description: string }> = {
  super_admin: { name: "Super Admin", description: "Full platform governance and emergency controls." },
  marketplace_admin: { name: "Marketplace Admin", description: "Marketplace operations, moderation, and escalations." },
  product_manager: { name: "Product Manager", description: "Catalog taxonomy, product content, and merchandising." },
  finance: { name: "Finance", description: "Payments, refunds, commissions, ledger, and payouts." },
  customer_support: { name: "Customer Support", description: "Customer cases, order context, and support operations." },
  logistics_manager: { name: "Logistics Manager", description: "Warehouses, shipping rules, couriers, and delivery exceptions." },
  warehouse_staff: { name: "Warehouse Staff", description: "Assigned warehouse receiving, picking, packing, and handover." },
  seller: { name: "Seller", description: "Own store, catalog, inventory, seller orders, and earnings." },
  courier: { name: "Courier", description: "Assigned shipments and delivery event updates." },
  customer: { name: "Customer", description: "Own profile, orders, reviews, returns, and support." },
};

export const PERMISSION_CODES = [
  "identity.profile.read",
  "identity.profile.update",
  "identity.role.assign",
  "catalog.product.read",
  "catalog.product.create",
  "catalog.product.update",
  "catalog.product.delete",
  "catalog.product.approve",
  "catalog.category.manage",
  "seller.store.read_own",
  "seller.store.update_own",
  "seller.application.submit_own",
  "seller.application.review",
  "seller.application.approve",
  "seller.application.suspend",
  "seller.product.create_own",
  "seller.product.update_own",
  "seller.order.read_own",
  "seller.order.fulfill_own",
  "order.read_own",
  "order.manage_any",
  "finance.payment.read",
  "finance.refund.approve",
  "finance.payout.approve",
  "logistics.shipment.read",
  "logistics.shipment.update",
  "support.ticket.read",
  "support.ticket.assign",
  "platform.audit.read",
  "platform.settings.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const PERMISSION_DEFINITIONS: Record<PermissionCode, { name: string; description: string }> = {
  "identity.profile.read": { name: "Read profile", description: "Read an allowed user profile." },
  "identity.profile.update": { name: "Update profile", description: "Update an allowed user profile." },
  "identity.role.assign": { name: "Assign roles", description: "Assign or revoke platform roles." },
  "catalog.product.read": { name: "Read products", description: "Read approved catalog products." },
  "catalog.product.create": { name: "Create products", description: "Create catalog product records." },
  "catalog.product.update": { name: "Update products", description: "Update catalog product records." },
  "catalog.product.delete": { name: "Delete products", description: "Delete or archive catalog products." },
  "catalog.product.approve": { name: "Approve products", description: "Moderate and approve catalog products." },
  "catalog.category.manage": { name: "Manage categories", description: "Manage catalog taxonomy." },
  "seller.store.read_own": { name: "Read own store", description: "Read the seller's own store." },
  "seller.store.update_own": { name: "Update own store", description: "Update the seller's own store." },
  "seller.application.submit_own": { name: "Submit own seller application", description: "Submit the authenticated user's seller application for review." },
  "seller.application.review": { name: "Review seller applications", description: "Review seller applications and verification documents." },
  "seller.application.approve": { name: "Approve seller applications", description: "Approve a seller application after review." },
  "seller.application.suspend": { name: "Suspend sellers", description: "Suspend or reactivate approved sellers." },
  "seller.product.create_own": { name: "Create own products", description: "Create products for the seller's own store." },
  "seller.product.update_own": { name: "Update own products", description: "Update products owned by the seller." },
  "seller.order.read_own": { name: "Read own seller orders", description: "Read seller orders belonging to the seller." },
  "seller.order.fulfill_own": { name: "Fulfill own seller orders", description: "Advance fulfilment for seller-owned orders." },
  "order.read_own": { name: "Read own orders", description: "Read orders belonging to the customer." },
  "order.manage_any": { name: "Manage any order", description: "Manage marketplace orders across sellers." },
  "finance.payment.read": { name: "Read payments", description: "Read payment and transaction records." },
  "finance.refund.approve": { name: "Approve refunds", description: "Approve refund operations." },
  "finance.payout.approve": { name: "Approve payouts", description: "Approve seller payout operations." },
  "logistics.shipment.read": { name: "Read shipments", description: "Read shipment and tracking records." },
  "logistics.shipment.update": { name: "Update shipments", description: "Update allowed shipment events." },
  "support.ticket.read": { name: "Read support tickets", description: "Read support cases in allowed scope." },
  "support.ticket.assign": { name: "Assign support tickets", description: "Assign and route support cases." },
  "platform.audit.read": { name: "Read audit logs", description: "Read audit records." },
  "platform.settings.manage": { name: "Manage platform settings", description: "Manage platform-level configuration." },
};

const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  super_admin: PERMISSION_CODES,
  marketplace_admin: [
    "identity.profile.read",
    "catalog.product.read",
    "catalog.product.create",
    "catalog.product.update",
    "catalog.product.delete",
    "catalog.product.approve",
    "catalog.category.manage",
    "seller.application.review",
    "seller.application.approve",
    "seller.application.suspend",
    "order.manage_any",
    "support.ticket.read",
    "support.ticket.assign",
    "platform.audit.read",
  ],
  product_manager: [
    "catalog.product.read",
    "catalog.product.create",
    "catalog.product.update",
    "catalog.product.delete",
    "catalog.product.approve",
    "catalog.category.manage",
  ],
  finance: ["finance.payment.read", "finance.refund.approve", "finance.payout.approve", "platform.audit.read"],
  customer_support: ["identity.profile.read", "order.manage_any", "support.ticket.read", "support.ticket.assign"],
  logistics_manager: ["logistics.shipment.read", "logistics.shipment.update", "platform.audit.read"],
  warehouse_staff: ["logistics.shipment.read", "logistics.shipment.update"],
  seller: [
    "identity.profile.read",
    "identity.profile.update",
    "seller.store.read_own",
    "seller.store.update_own",
    "seller.application.submit_own",
    "seller.product.create_own",
    "seller.product.update_own",
    "seller.order.read_own",
    "seller.order.fulfill_own",
  ],
  courier: ["logistics.shipment.read", "logistics.shipment.update"],
  customer: ["identity.profile.read", "identity.profile.update", "order.read_own"],
};

export function permissionsForRole(role: RoleCode): readonly PermissionCode[] {
  return ROLE_PERMISSIONS[role];
}

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}
