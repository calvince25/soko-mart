import { z } from "zod";

export const notificationListSchema = z.object({ limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0), unreadOnly: z.boolean().optional() });
export const notificationIdSchema = z.object({ notificationId: z.number().int().positive() });
export const notificationPreferenceSchema = z.object({ channel: z.enum(["email", "sms", "whatsapp"]), category: z.enum(["transactional", "promotional", "security", "operational"]), enabled: z.boolean() });
export const notificationMonitoringSchema = z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0), status: z.enum(["queued", "processing", "sent", "failed", "retrying"]).optional(), channel: z.enum(["in_app", "email", "sms", "whatsapp"]).optional(), eventType: z.string().trim().max(120).optional() });
