import { z } from "zod";

export const checkoutShippingMethodSchema = z.enum(["standard"]);

export const checkoutCreateSchema = z.object({
  addressId: z.number().int().positive().optional(),
  shippingMethod: checkoutShippingMethodSchema.default("standard"),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

export const checkoutSessionIdSchema = z.object({
  sessionId: z.number().int().positive(),
});

export const checkoutAddressSchema = checkoutSessionIdSchema.extend({
  addressId: z.number().int().positive(),
});

export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;
export type CheckoutShippingMethod = z.infer<typeof checkoutShippingMethodSchema>;
