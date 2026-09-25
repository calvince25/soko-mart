import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const slug = z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const sellerProfileInputSchema = z.object({
  legalBusinessName: text(200), storeName: text(160), businessDescription: z.string().trim().max(5000).nullable().optional(),
  businessType: text(80), country: text(80), county: text(100), town: text(100), businessAddress: text(1000),
  businessPhone: text(32), businessEmail: z.string().trim().email().max(320),
  storeSlug: slug.optional(), logoKey: z.string().trim().max(1024).nullable().optional(), bannerKey: z.string().trim().max(1024).nullable().optional(),
});
export type SellerProfileInput = z.infer<typeof sellerProfileInputSchema>;

export const sellerApplicationInputSchema = z.object({
  businessRegistrationNumber: z.string().trim().max(120).nullable().optional(),
  taxIdentificationNumber: z.string().trim().max(120).nullable().optional(),
  legalRepresentativeName: text(160),
});
export const sellerIdSchema = z.object({ sellerId: z.number().int().positive() });
export const sellerReviewSchema = sellerIdSchema.extend({ reason: z.string().trim().max(2000).nullable().optional() });
export const sellerDocumentInputSchema = sellerIdSchema.extend({
  applicationId: z.number().int().positive(), documentType: text(80), storageKey: z.string().trim().min(8).max(1024).regex(/^private\/seller\/[a-z0-9_-]+\//),
  originalFilename: text(255), mimeType: z.string().trim().min(3).max(120), fileSize: z.number().int().positive().max(25 * 1024 * 1024),
});
export const publicStoreSlugSchema = z.object({ slug });
export const sellerStatusSchema = z.enum(["draft", "pending_verification", "under_review", "approved", "rejected", "suspended", "closed"]);
