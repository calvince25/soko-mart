import { z } from "zod";

const id = z.number().int().positive();

export const beneficiaryIdSchema = z.object({ beneficiaryId: id });

export const beneficiaryCreateSchema = z.object({
  sellerId: id,
  provider: z.literal("mpesa"),
  accountType: z.literal("mobile_money"),
  phone: z.string().trim().min(7).max(32),
  displayLabel: z.string().trim().min(2).max(120).optional().nullable(),
});

export const beneficiaryReviewSchema = z.object({
  beneficiaryId: id,
  status: z.enum(["VERIFIED", "SUSPENDED", "REJECTED"]),
  reason: z.string().trim().min(3).max(1000).optional().nullable(),
});

export const beneficiaryListSchema = z.object({
  sellerId: id.optional(),
});
