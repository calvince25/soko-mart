import { z } from "zod";

const safeName = z.string().trim().min(1).max(80).regex(/^[A-Za-z][A-Za-z .'-]*$/);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
const coordinate = z.number().finite().min(-180).max(180).optional().nullable();

export const profileUpdateSchema = z.object({
  firstName: safeName.optional().nullable(),
  lastName: safeName.optional().nullable(),
  displayName: z.string().trim().min(1).max(160).optional().nullable(),
  avatarUrl: z.string().url().max(1024).optional().nullable(),
  dateOfBirth: isoDate,
  preferredLanguage: z.string().trim().min(2).max(16).regex(/^[a-zA-Z-]+$/).optional(),
  preferredCurrency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).optional(),
}).strict();

export const phoneUpdateSchema = z.object({
  phone: z.string().trim().min(7).max(32).regex(/^[+0-9 ()-]+$/),
  countryCode: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).default("KE").transform((value) => value.toUpperCase()),
}).strict();

export const addressLabelSchema = z.enum(["home", "work", "other"]);

export const addressInputSchema = z.object({
  recipientName: z.string().trim().min(2).max(160),
  recipientPhone: z.string().trim().min(7).max(32).regex(/^[+0-9 ()-]+$/),
  label: addressLabelSchema.default("home"),
  country: z.string().trim().min(2).max(80).regex(/^[A-Za-z .'-]+$/),
  county: z.string().trim().min(2).max(100).regex(/^[A-Za-z .'-]+$/),
  town: z.string().trim().min(2).max(100).regex(/^[A-Za-z .'-]+$/),
  neighborhood: z.string().trim().min(2).max(160),
  estateBuilding: optionalText(160),
  apartmentHouse: optionalText(120),
  streetRoad: optionalText(160),
  directions: optionalText(2000),
  postalCode: z.string().trim().max(24).regex(/^[A-Za-z0-9 -]+$/).optional().nullable(),
  latitude: coordinate,
  longitude: coordinate,
  isDefault: z.boolean().default(false),
}).strict();

export const addressIdSchema = z.object({ addressId: z.number().int().positive() });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PhoneUpdateInput = z.infer<typeof phoneUpdateSchema>;
export type AddressInput = z.infer<typeof addressInputSchema>;
