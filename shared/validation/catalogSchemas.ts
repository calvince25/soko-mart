import { z } from "zod";

const name = z.string().trim().min(2).max(240);
const slug = z.string().trim().min(3).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe lowercase slug.");
const seoTitle = z.string().trim().max(180).nullable().optional();
const seoDescription = z.string().trim().max(320).nullable().optional();

export const categoryInputSchema = z.object({
  name: name.max(160), slug, description: z.string().trim().max(2000).nullable().optional(), parentId: z.number().int().positive().nullable().optional(), imageKey: z.string().trim().max(1024).nullable().optional(), displayOrder: z.number().int().min(0).max(100000).default(0), seoTitle, seoDescription,
});
export const categoryUpdateSchema = categoryInputSchema.extend({ id: z.number().int().positive() });
export const categoryIdSchema = z.object({ id: z.number().int().positive() });

export const brandInputSchema = z.object({ name: name.max(160), slug, description: z.string().trim().max(2000).nullable().optional(), logoKey: z.string().trim().max(1024).nullable().optional(), seoTitle, seoDescription });
export const brandUpdateSchema = brandInputSchema.extend({ id: z.number().int().positive() });
export const brandIdSchema = z.object({ id: z.number().int().positive() });

export const productInputSchema = z.object({
  categoryId: z.number().int().positive(), brandId: z.number().int().positive().nullable().optional(), name, slug, shortDescription: z.string().trim().max(500).nullable().optional(), fullDescription: z.string().trim().max(20000).nullable().optional(), metaTitle: seoTitle, metaDescription: seoDescription,
});
export const productUpdateSchema = productInputSchema.extend({ id: z.number().int().positive() });
export const productIdSchema = z.object({ id: z.number().int().positive() });

export const variantInputSchema = z.object({ productId: z.number().int().positive(), sku: z.string().trim().min(2).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/), name: name.max(180), priceMinor: z.number().int().nonnegative().safe(), compareAtPriceMinor: z.number().int().nonnegative().safe().nullable().optional(), currency: z.string().regex(/^[A-Z]{3}$/).default("KES") }).superRefine((value, ctx) => { if (value.compareAtPriceMinor !== null && value.compareAtPriceMinor !== undefined && value.compareAtPriceMinor < value.priceMinor) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["compareAtPriceMinor"], message: "Compare-at price cannot be below selling price." }); });
export const variantUpdateSchema = variantInputSchema.omit({ productId: true }).extend({ id: z.number().int().positive() });
export const variantIdSchema = z.object({ id: z.number().int().positive() });

export const attributeInputSchema = z.object({ name: z.string().trim().min(2).max(100), code: z.string().trim().min(2).max(100).regex(/^[a-z0-9_]+$/), type: z.enum(["text", "number", "boolean", "select", "multi_select"]) });
export const attributeValueInputSchema = z.object({ attributeId: z.number().int().positive(), value: z.string().trim().min(1).max(160), label: z.string().trim().min(1).max(160) });
export const categoryAttributeInputSchema = z.object({ categoryId: z.number().int().positive(), attributeId: z.number().int().positive(), required: z.boolean().default(false), displayOrder: z.number().int().min(0).max(100000).default(0) });
export const variantAttributeInputSchema = z.object({ variantId: z.number().int().positive(), attributeId: z.number().int().positive(), attributeValueId: z.number().int().positive().nullable().optional(), valueText: z.string().trim().max(240).nullable().optional(), valueNumber: z.string().trim().max(64).nullable().optional(), valueBoolean: z.boolean().nullable().optional() });

export const mediaInputSchema = z.object({ productId: z.number().int().positive(), variantId: z.number().int().positive().nullable().optional(), storageKey: z.string().trim().min(1).max(1024), originalFilename: z.string().trim().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4"]), fileSize: z.number().int().positive().max(10 * 1024 * 1024), altText: z.string().trim().max(240).nullable().optional(), displayOrder: z.number().int().min(0).max(100000).default(0), isPrimary: z.boolean().default(false) });
export const moderationDecisionSchema = z.object({ id: z.number().int().positive(), reason: z.string().trim().min(5).max(2000).nullable().optional() });

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
