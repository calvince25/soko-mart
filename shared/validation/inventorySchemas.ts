import { z } from "zod";

const positiveQuantity = z.number().int().positive().max(1_000_000);
const nonZeroDelta = z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, "Quantity change cannot be zero.");
const referenceType = z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9_.-]*$/);
const referenceId = z.string().trim().min(1).max(160);

export const locationInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(["seller_location", "warehouse", "fulfillment_center"]),
  country: z.string().trim().min(2).max(80),
  county: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
});
export const locationIdSchema = z.object({ id: z.number().int().positive() });
export const updateLocationSchema = locationInputSchema.extend({ id: z.number().int().positive() });

export const stockInputSchema = z.object({
  variantId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  quantity: positiveQuantity,
  reason: z.string().trim().min(5).max(2000),
  referenceType: referenceType.nullable().optional(),
  referenceId: referenceId.nullable().optional(),
});

export const adjustmentInputSchema = z.object({
  variantId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  delta: nonZeroDelta,
  movementType: z.enum(["purchase_receipt", "manual_adjustment", "damage", "loss", "return", "correction"]),
  reason: z.string().trim().min(5).max(2000),
  referenceType: referenceType.nullable().optional(),
  referenceId: referenceId.nullable().optional(),
});

export const reservationInputSchema = z.object({
  variantId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  quantity: positiveQuantity,
  expiresAt: z.coerce.date(),
  referenceType,
  referenceId,
}).superRefine((value, ctx) => {
  const maxExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (value.expiresAt.getTime() <= Date.now()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Reservation expiry must be in the future." });
  if (value.expiresAt.getTime() > maxExpiry) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Reservation expiry cannot exceed seven days." });
});
export const reservationIdSchema = z.object({ id: z.number().int().positive() });
export const reservationConversionSchema = reservationIdSchema.extend({ referenceType, referenceId });
export const reservationReleaseSchema = reservationIdSchema.extend({ reason: z.string().trim().min(3).max(500).nullable().optional() });
export const availabilityInputSchema = z.object({ variantId: z.number().int().positive() });
export const inventoryQuerySchema = z.object({ variantId: z.number().int().positive().nullable().optional(), locationId: z.number().int().positive().nullable().optional() }).optional();

export type LocationInput = z.infer<typeof locationInputSchema>;
export type StockInput = z.infer<typeof stockInputSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentInputSchema>;
export type ReservationInput = z.infer<typeof reservationInputSchema>;
