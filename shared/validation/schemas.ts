import { z } from "zod";

export const idSchema = z.number().int().positive();
export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export const sortDirectionSchema = z.enum(["asc", "desc"]).default("asc");
export const requestIdSchema = z.string().trim().min(8).max(96);
export const nonEmptyTextSchema = z.string().trim().min(1).max(500);

export const healthInputSchema = z.object({
  timestamp: z.number().int().nonnegative(),
});

export const ownerNotificationSchema = z.object({
  title: z.string().trim().min(1).max(1200),
  content: z.string().trim().min(1).max(20000),
});

export const roleCodeSchema = z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/);
export const permissionCodeSchema = z.string().trim().min(3).max(160).regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);

export { addressIdSchema, addressInputSchema, addressLabelSchema, phoneUpdateSchema, profileUpdateSchema } from "./accountSchemas";
export type { AddressInput, PhoneUpdateInput, ProfileUpdateInput } from "./accountSchemas";
export { publicStoreSlugSchema, sellerApplicationInputSchema, sellerDocumentInputSchema, sellerIdSchema, sellerProfileInputSchema, sellerReviewSchema, sellerStatusSchema } from "./sellerSchemas";
export type { SellerProfileInput } from "./sellerSchemas";
export * from "./catalogSchemas";
export * from "./inventorySchemas";
