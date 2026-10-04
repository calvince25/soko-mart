import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { couriers, notificationDeliveryAttempts, notificationOutbox, notificationPreferences, notifications, notificationTemplates, orderSellerOrders, orders, sellerMembers, userRoles, users, warehouseUserAssignments, roles } from "../../../drizzle/schema";
import { forbidden, invalidState, notFound, validationError } from "../../../shared/errors/appError";
import { getDb } from "../../db";
import { logger } from "../../logging/logger";
import { recordAuditEvent } from "../../audit/audit";
import { channelAdapter } from "./channels";

export type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp";
export type NotificationCategory = "transactional" | "promotional" | "security" | "operational";
export type NotificationEvent = { eventType: string; entityType: string; entityId: number; eventKey?: string; payload?: Record<string, unknown> };

type Template = { code: string; category: NotificationCategory; title: string; body: string; path?: string };
const templates: Record<string, Template> = {
  payment_successful_customer: { code: "payment_successful_customer", category: "transactional", title: "Payment received", body: "Payment received for order {{orderNumber}}.", path: "/orders/{{orderId}}" },
  payment_failed_customer: { code: "payment_failed_customer", category: "transactional", title: "Payment needs attention", body: "Your payment for order {{orderNumber}} could not be completed.", path: "/orders" },
  order_created_customer: { code: "order_created_customer", category: "transactional", title: "Order confirmed", body: "Your order {{orderNumber}} has been confirmed.", path: "/orders/{{orderId}}" },
  new_order_seller: { code: "new_order_seller", category: "operational", title: "New order to fulfil", body: "Order {{orderNumber}} requires fulfilment.", path: "/seller/orders/{{sellerOrderId}}" },
  seller_order_status_seller: { code: "seller_order_status_seller", category: "operational", title: "Order fulfilment updated", body: "Order {{orderNumber}} is now {{status}}.", path: "/seller/orders/{{sellerOrderId}}" },
  package_update_staff: { code: "package_update_staff", category: "operational", title: "Warehouse package update", body: "Package {{packageReference}} is now {{status}}.", path: "/warehouse" },
  shipment_created_customer: { code: "shipment_created_customer", category: "transactional", title: "Shipment created", body: "Your order {{orderNumber}} has been prepared for delivery.", path: "/track/{{shipmentId}}" },
  shipment_assigned_courier: { code: "shipment_assigned_courier", category: "operational", title: "Delivery task assigned", body: "Shipment {{trackingNumber}} has been assigned to you.", path: "/delivery" },
  shipment_status_customer: { code: "shipment_status_customer", category: "transactional", title: "Delivery update", body: "Your order {{orderNumber}} is now {{status}}.", path: "/track/{{shipmentId}}" },
  delivery_failed_logistics: { code: "delivery_failed_logistics", category: "operational", title: "Delivery exception", body: "Delivery for shipment {{trackingNumber}} needs attention.", path: "/delivery" },
  delivery_otp_customer: { code: "delivery_otp_customer", category: "security", title: "Your SokoMart delivery PIN", body: "Use your delivery PIN to confirm handover. It expires soon.", path: "/track/{{shipmentId}}" },
  review_published_customer: { code: "review_published_customer", category: "transactional", title: "Your review is live", body: "Thanks for sharing your verified SokoMart experience.", path: "/reviews" },
  return_status_customer: { code: "return_status_customer", category: "transactional", title: "Return update", body: "Your return {{returnNumber}} is now {{status}}.", path: "/returns" },
  refund_status_customer: { code: "refund_status_customer", category: "transactional", title: "Refund update", body: "Your refund for return {{returnNumber}} is now {{status}}.", path: "/returns" },
  support_ticket_staff: { code: "support_ticket_staff", category: "operational", title: "New support case", body: "Support case {{ticketNumber}} needs attention.", path: "/admin/support" },
  support_message_customer: { code: "support_message_customer", category: "transactional", title: "Support case updated", body: "There is a new message on support case {{ticketNumber}}.", path: "/support/{{ticketId}}" },
  support_status_customer: { code: "support_status_customer", category: "transactional", title: "Support case update", body: "Support case {{ticketNumber}} is now {{status}}.", path: "/support/{{ticketId}}" },
};

async function getDatabase() { const db = await getDb(); if (!db) throw invalidState("Notification services are temporarily unavailable."); return db; }
function interpolate(value: string, vars: Record<string, unknown>) { return value.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? "")); }
function templateFor(eventType: string, recipientType: string): Template | null {
  if (eventType === "payment.successful") return templates.payment_successful_customer;
  if (eventType === "payment.failed") return templates.payment_failed_customer;
  if (eventType === "order.created") return recipientType === "customer" ? templates.order_created_customer : null;
  if (eventType === "seller_order.created") return templates.new_order_seller;
  if (eventType.startsWith("seller_order.fulfilment.")) return templates.seller_order_status_seller;
  if (eventType.startsWith("warehouse.") || eventType.startsWith("package.")) return ["staff", "admin"].includes(recipientType) ? templates.package_update_staff : null;
  if (eventType === "shipment.created") return recipientType === "customer" ? templates.shipment_created_customer : null;
  if (eventType === "shipment.assigned") return recipientType === "courier" ? templates.shipment_assigned_courier : null;
  if (eventType === "shipment.picked_up" || eventType === "shipment.in_transit" || eventType === "shipment.out_for_delivery" || eventType === "shipment.delivered" || eventType === "shipment.delivery_attempted") return recipientType === "customer" ? templates.shipment_status_customer : null;
  if (eventType === "shipment.delivery_failed" || eventType === "shipment.returned_to_warehouse") return ["staff", "admin", "courier"].includes(recipientType) ? templates.delivery_failed_logistics : null;
  if (eventType === "delivery.otp_issued") return recipientType === "customer" ? templates.delivery_otp_customer : null;
  if (eventType === "review.published") return recipientType === "customer" ? templates.review_published_customer : null;
  if (eventType.startsWith("return.")) return recipientType === "customer" ? templates.return_status_customer : null;
  if (eventType.startsWith("refund.")) return recipientType === "customer" ? templates.refund_status_customer : null;
  if (eventType === "support.ticket.created") return ["staff", "admin"].includes(recipientType) ? templates.support_ticket_staff : null;
  if (eventType === "support.message.added") return recipientType === "customer" ? templates.support_message_customer : ["staff", "admin"].includes(recipientType) ? templates.support_ticket_staff : null;
  if (eventType.startsWith("support.ticket.")) return recipientType === "customer" ? templates.support_status_customer : ["staff", "admin"].includes(recipientType) ? templates.support_ticket_staff : null;
  return null;
}

async function recipientUsers(database: any, event: NotificationEvent) {
  const payload: any = event.payload ?? {};
  const recipients: Array<{ userId: number; type: "customer" | "seller" | "courier" | "staff" | "admin" }> = [];
  const add = (userId: number | undefined, type: any) => { if (userId && !recipients.some((r) => r.userId === userId && r.type === type)) recipients.push({ userId, type }); };
  if (Array.isArray(payload.recipientUserIds)) payload.recipientUserIds.forEach((id: unknown) => add(Number(id), payload.recipientType ?? "staff"));
  if (payload.customerUserId) add(Number(payload.customerUserId), "customer");
  if (payload.sellerOrderId) {
    const [row] = await database.select({ sellerId: orderSellerOrders.sellerId, orderId: orderSellerOrders.parentOrderId }).from(orderSellerOrders).where(eq(orderSellerOrders.id, Number(payload.sellerOrderId))).limit(1);
    if (row) { const members = await database.select({ userId: sellerMembers.userId }).from(sellerMembers).where(and(eq(sellerMembers.sellerId, row.sellerId), eq(sellerMembers.status, "active"))); members.forEach((m: any) => add(m.userId, "seller")); }
  }
  if (payload.courierId) { const [courier] = await database.select({ userId: couriers.userId }).from(couriers).where(eq(couriers.id, Number(payload.courierId))).limit(1); if (courier) add(courier.userId, "courier"); }
  if (payload.warehouseId) { const rows = await database.select({ userId: warehouseUserAssignments.userId }).from(warehouseUserAssignments).where(and(eq(warehouseUserAssignments.warehouseId, Number(payload.warehouseId)), eq(warehouseUserAssignments.status, "active"))); rows.forEach((r: any) => add(r.userId, "staff")); }
  if (payload.orderId && !payload.customerUserId) { const [order] = await database.select({ userId: orders.userId }).from(orders).where(eq(orders.id, Number(payload.orderId))).limit(1); if (order) add(order.userId, "customer"); }
  if (payload.adminAlert) { const admins = await database.select({ userId: userRoles.userId }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(or(eq(roles.code, "super_admin"), eq(roles.code, "marketplace_admin"), eq(roles.code, "customer_support"), eq(roles.code, "logistics_manager"))); admins.forEach((r: any) => add(r.userId, "admin")); }
  return recipients;
}

async function ensureTemplate(database: any, template: Template) {
  const [existing] = await database.select().from(notificationTemplates).where(and(eq(notificationTemplates.code, template.code), eq(notificationTemplates.version, 1))).limit(1);
  if (existing) return existing;
  await database.insert(notificationTemplates).values({ code: template.code, version: 1, category: template.category, channel: "in_app", titleTemplate: template.title, bodyTemplate: template.body, isActive: 1 }).catch(() => undefined);
  const [created] = await database.select().from(notificationTemplates).where(and(eq(notificationTemplates.code, template.code), eq(notificationTemplates.version, 1))).limit(1);
  return created;
}

async function preferenceEnabled(database: any, userId: number, channel: NotificationChannel, category: NotificationCategory) {
  if (channel === "in_app" || category === "security") return true;
  const [preference] = await database.select({ enabled: notificationPreferences.enabled }).from(notificationPreferences).where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.channel, channel), eq(notificationPreferences.category, category))).limit(1);
  return preference ? preference.enabled === 1 : false;
}

async function createNotification(database: any, event: NotificationEvent, recipient: { userId: number; type: any }, channel: NotificationChannel, vars: Record<string, unknown>) {
  const template = templateFor(event.eventType, recipient.type); if (!template) return null;
  const storedTemplate = await ensureTemplate(database, template);
  if (!await preferenceEnabled(database, recipient.userId, channel, template.category)) return null;
  const renderedTitle = interpolate(template.title, vars); const renderedBody = interpolate(template.body, vars); const key = `${event.eventKey ?? `${event.eventType}:${event.entityType}:${event.entityId}`}:${recipient.userId}:${recipient.type}:${channel}:${template.code}`;
  const renderedPath = template.path ? interpolate(template.path, vars) : null;
  const inserted = await database.insert(notifications).values({ userId: recipient.userId, recipientType: recipient.type, eventType: event.eventType, category: template.category, channel, status: "queued", title: renderedTitle, body: renderedBody, templateCode: template.code, templateVersion: storedTemplate?.version ?? 1, relatedEntityType: event.entityType, relatedEntityId: event.entityId, navigationPath: renderedPath, idempotencyKey: key, nextAttemptAt: new Date() }).catch(() => null);
  if (!inserted) return null;
  const result = inserted as any; const id = Number(result.insertId ?? result[0]?.insertId ?? 0); return id || null;
}

export async function deliverNotification(notificationId: number) {
  const database = await getDatabase(); const [notification] = await database.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1); if (!notification) throw notFound("Notification not found.");
  const attemptNumber = notification.retryCount + 1; const started = Date.now(); await database.update(notifications).set({ status: "processing", updatedAt: new Date() }).where(eq(notifications.id, notificationId)); const result = await channelAdapter(notification.channel).deliver({ notificationId, recipientUserId: notification.userId, title: notification.title, body: notification.body });
  await database.insert(notificationDeliveryAttempts).values({ notificationId, channel: notification.channel, provider: result.provider ?? null, attemptNumber, result: result.result, providerMessageId: result.providerMessageId ?? null, providerStatus: result.result, failureReason: result.failureReason ?? null });
  const retryable = result.result === "retryable" && attemptNumber < notification.maxRetries; const status = result.result === "sent" ? "sent" : retryable ? "retrying" : "failed"; const nextAttemptAt = retryable ? new Date(Date.now() + Math.min(60 * 60_000, 2 ** attemptNumber * 30_000)) : null;
  await database.update(notifications).set({ status, retryCount: attemptNumber, nextAttemptAt, sentAt: result.result === "sent" ? new Date() : null, failureReason: result.failureReason ?? null, providerMessageId: result.providerMessageId ?? null, providerStatus: result.provider ?? null, updatedAt: new Date() }).where(eq(notifications.id, notificationId));
  logger.info("notification.delivery.completed", { notificationId, eventType: notification.eventType, channel: notification.channel, provider: result.provider, attemptNumber, result: result.result, latencyMs: Date.now() - started, failureReason: result.failureReason }); return status;
}

export async function processOutbox(outboxId: number) {
  const database = await getDatabase(); const [row] = await database.select().from(notificationOutbox).where(eq(notificationOutbox.id, outboxId)).limit(1); if (!row || row.status === "processed") return { processed: false };
  await database.update(notificationOutbox).set({ status: "processing", attempts: row.attempts + 1, updatedAt: new Date() }).where(eq(notificationOutbox.id, outboxId));
  try { const event = { eventType: row.eventType, entityType: row.entityType, entityId: row.entityId, eventKey: row.eventKey, payload: (row.payload ?? {}) as Record<string, unknown> }; const recipients = await recipientUsers(database, event); const vars: any = { ...event.payload, status: String((event.payload as any)?.status ?? (event.payload as any)?.newState ?? "updated") }; const channels: NotificationChannel[] = ["in_app", "email", "sms", "whatsapp"]; for (const recipient of recipients) { for (const channel of channels) { const id = await createNotification(database, event, recipient, channel, vars); if (id) await deliverNotification(id); } } await database.update(notificationOutbox).set({ status: "processed", processedAt: new Date(), updatedAt: new Date(), lastError: null }).where(eq(notificationOutbox.id, outboxId)); return { processed: true, recipientCount: recipients.length }; } catch (error) { const message = error instanceof Error ? error.message : "Notification processing failed."; await database.update(notificationOutbox).set({ status: row.attempts + 1 < 4 ? "retrying" : "failed", nextAttemptAt: row.attempts + 1 < 4 ? new Date(Date.now() + 2 ** row.attempts * 30_000) : null, lastError: message, updatedAt: new Date() }).where(eq(notificationOutbox.id, outboxId)); logger.error("notification.outbox.failed", { notificationId: outboxId, eventType: row.eventType, attemptNumber: row.attempts + 1, failureReason: message }, error); return { processed: false, error: message }; }
}

export function enqueueNotificationEvent(event: NotificationEvent) { void (async () => { try { const database = await getDatabase(); const eventKey = event.eventKey ?? `${event.eventType}:${event.entityType}:${event.entityId}`; const inserted = await database.insert(notificationOutbox).values({ eventKey, eventType: event.eventType, entityType: event.entityType, entityId: event.entityId, payload: event.payload ?? {}, status: "queued", nextAttemptAt: new Date() }).catch(() => null); if (inserted) { const id = Number((inserted as any).insertId ?? (inserted as any)[0]?.insertId ?? 0); if (id) await processOutbox(id); } } catch (error) { logger.error("notification.enqueue.failed", { eventType: event.eventType, entityType: event.entityType, entityId: event.entityId }, error); } })(); }

export async function listMyNotifications(userId: number, input: { limit: number; offset: number; unreadOnly?: boolean }) { const database = await getDatabase(); const where = input.unreadOnly ? and(eq(notifications.userId, userId), isNull(notifications.readAt)) : eq(notifications.userId, userId); return database.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(input.limit).offset(input.offset); }
export async function unreadCount(userId: number) { const database = await getDatabase(); const [row] = await database.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))); return Number(row?.value ?? 0); }
export async function markRead(userId: number, notificationId: number) { const database = await getDatabase(); await database.update(notifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId))); return { marked: true }; }
export async function markAllRead(userId: number) { const database = await getDatabase(); await database.update(notifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))); return { marked: true }; }
export async function getPreferences(userId: number) { const database = await getDatabase(); return database.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).orderBy(notificationPreferences.channel, notificationPreferences.category); }
export async function updatePreference(userId: number, input: { channel: "email" | "sms" | "whatsapp"; category: NotificationCategory; enabled: boolean }) { if (input.category === "security") throw validationError("Security notifications cannot be disabled."); const database = await getDatabase(); const existing = await database.select({ id: notificationPreferences.id }).from(notificationPreferences).where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.channel, input.channel), eq(notificationPreferences.category, input.category))).limit(1); if (existing.length) await database.update(notificationPreferences).set({ enabled: input.enabled ? 1 : 0, updatedAt: new Date() }).where(eq(notificationPreferences.id, existing[0].id)); else await database.insert(notificationPreferences).values({ userId, channel: input.channel, category: input.category, enabled: input.enabled ? 1 : 0 }); return getPreferences(userId); }
export async function listOperational(userId: number, input: any, admin = false) { const database = await getDatabase(); if (!admin) { const rows = await database.select({ code: roles.code }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, userId)); if (!rows.some((r: any) => ["logistics_manager", "super_admin", "marketplace_admin"].includes(r.code))) throw forbidden("Notification monitoring access denied."); } const conditions: any[] = []; if (input.status) conditions.push(eq(notifications.status, input.status)); if (input.channel) conditions.push(eq(notifications.channel, input.channel)); if (input.eventType) conditions.push(eq(notifications.eventType, input.eventType)); return database.select({ id: notifications.id, recipientType: notifications.recipientType, eventType: notifications.eventType, category: notifications.category, channel: notifications.channel, status: notifications.status, relatedEntityType: notifications.relatedEntityType, relatedEntityId: notifications.relatedEntityId, retryCount: notifications.retryCount, failureReason: notifications.failureReason, createdAt: notifications.createdAt, sentAt: notifications.sentAt }).from(notifications).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(notifications.createdAt)).limit(input.limit).offset(input.offset); }
export async function retryNotification(userId: number, notificationId: number, admin = false) { const database = await getDatabase(); if (!admin) throw forbidden("Only administrators may retry notifications."); const [notification] = await database.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1); if (!notification) throw notFound("Notification not found."); if (notification.status !== "failed" && notification.status !== "retrying") throw validationError("Only failed or retrying notifications can be retried."); await recordAuditEvent({ actorUserId: userId, action: "notification.retry", entityType: "notification", entityId: String(notificationId), afterState: { channel: notification.channel } }); return deliverNotification(notificationId); }
