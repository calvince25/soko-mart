import { z } from "zod";

const positiveId = z.number().int().positive();
export const courierIdSchema = z.object({ courierId: positiveId });
export const courierCreateSchema = z.object({ userId: positiveId, fullName: z.string().trim().min(2).max(160), phone: z.string().trim().min(7).max(40), email: z.string().email().max(320).optional(), notes: z.string().trim().max(2000).optional() });
export const courierStatusSchema = z.object({ courierId: positiveId, status: z.enum(["active", "inactive", "suspended", "terminated"]) });
export const shipmentIdSchema = z.object({ shipmentId: positiveId });
export const shipmentCreateSchema = z.object({ packageId: positiveId });
export const shipmentListSchema = z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0), status: z.string().optional(), trackingNumber: z.string().trim().max(40).optional() });
export const assignShipmentSchema = z.object({ shipmentId: positiveId, courierId: positiveId, reason: z.string().trim().max(500).optional() });
export const transitionShipmentSchema = z.object({ shipmentId: positiveId, note: z.string().trim().max(1000).optional() });
export const deliveryAttemptSchema = z.object({ shipmentId: positiveId, outcome: z.enum(["delivered", "customer_unavailable", "incorrect_address", "customer_refused", "damaged_package", "other"]), failureReason: z.string().trim().max(1000).optional(), notes: z.string().trim().max(1000).optional(), otp: z.string().regex(/^\d{4,8}$/).optional(), proofRef: z.string().trim().min(1).max(512).regex(/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/, "Proof must be a storage object reference.").optional() });
export const shipmentEventListSchema = z.object({ shipmentId: positiveId, limit: z.number().int().min(1).max(100).default(100) });
export const courierShipmentListSchema = z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(100).default(50) });
