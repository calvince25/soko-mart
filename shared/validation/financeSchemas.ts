import { z } from "zod";
const id=z.number().int().positive();
export const financeListSchema=z.object({limit:z.number().int().min(1).max(100).default(50),offset:z.number().int().min(0).default(0)});
export const sellerInputSchema=z.object({sellerId:id});
export const commissionRuleSchema=z.object({sellerId:id.optional().nullable(),categoryId:id.optional().nullable(),productId:id.optional().nullable(),rateBasisPoints:z.number().int().min(0).max(10000),priority:z.number().int().min(1).max(100),currency:z.string().length(3).default("KES")});
export const holdSchema=z.object({sellerId:id,amountMinor:z.number().int().positive(),currency:z.string().length(3).default("KES"),reason:z.string().trim().min(3).max(160),referenceType:z.string().trim().min(2).max(80),referenceId:id});
export const adjustmentSchema=z.object({sellerId:id,amountMinor:z.number().int().refine(v=>v!==0),currency:z.string().length(3).default("KES"),reason:z.string().trim().min(3).max(1000),reference:z.string().trim().min(2).max(1000),idempotencyKey:z.string().trim().min(8).max(180)});
export const settlementSchema=z.object({sellerId:id,periodId:id,idempotencyKey:z.string().trim().min(8).max(180)});
export const periodSchema=z.object({startsAt:z.coerce.date(),endsAt:z.coerce.date()});
