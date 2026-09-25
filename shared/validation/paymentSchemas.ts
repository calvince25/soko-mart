import { z } from "zod";

export const paymentProviderSchema = z.enum(["mpesa"]);
export const paymentInitiateSchema = z.object({
  checkoutSessionId: z.number().int().positive(),
  provider: paymentProviderSchema.default("mpesa"),
  phone: z.string().trim().min(7).max(32),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});
export const paymentIdSchema = z.object({ paymentId: z.number().int().positive() });
export const paymentCancelSchema = paymentIdSchema.extend({ reason: z.string().trim().min(3).max(240).optional() });
export type PaymentInitiateInput = z.infer<typeof paymentInitiateSchema>;
