import { z } from "zod";
export const payoutCreateSchema = z.object({ settlementId: z.number().int().positive(), beneficiaryId: z.number().int().positive(), idempotencyKey: z.string().trim().min(8).max(180) });
export const payoutIdSchema = z.object({ payoutId: z.number().int().positive() });
export const payoutListSchema = z.object({ sellerId: z.number().int().positive().optional() });
export const payoutPauseSchema = z.object({ paused: z.boolean(), reason: z.string().trim().max(240).nullable().optional() });
