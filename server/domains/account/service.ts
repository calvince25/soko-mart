import { and, desc, eq, sql } from "drizzle-orm";
import { customerAddresses, customerPhones, customerProfiles } from "../../../drizzle/schema";
import { conflict, notFound, validationError } from "../../../shared/errors/appError";
import { normalizePhone } from "../../../shared/validation/phone";
import type { AddressInput, PhoneUpdateInput, ProfileUpdateInput } from "../../../shared/validation/accountSchemas";
import { recordAuditEvent, writeAuditEvent } from "../../audit/audit";
import { getDb } from "../../db";
import { getRequestId } from "../../logging/requestContext";
import { withTransaction } from "../../transactions/database";

function parseDateOfBirth(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) {
    throw validationError("Date of birth must be a valid date in the past.");
  }
  return date;
}

async function getOrCreateProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");
  const [existing] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(customerProfiles).values({ userId }).onDuplicateKeyUpdate({ set: { userId: sql`userId` } });
  const [created] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
  if (!created) throw new Error("Customer profile could not be created.");
  return created;
}

export async function getMyAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");
  const profile = await getOrCreateProfile(userId);
  const [phone] = await db.select().from(customerPhones).where(eq(customerPhones.userId, userId)).limit(1);
  const addresses = await db.select().from(customerAddresses)
    .where(and(eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active")))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
  return { profile, phone: phone ?? null, addresses };
}

export async function updateMyProfile(userId: number, input: ProfileUpdateInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");
  const before = await getOrCreateProfile(userId);
  await db.update(customerProfiles).set({
    firstName: input.firstName === undefined ? before.firstName : input.firstName,
    lastName: input.lastName === undefined ? before.lastName : input.lastName,
    displayName: input.displayName === undefined ? before.displayName : input.displayName,
    avatarUrl: input.avatarUrl === undefined ? before.avatarUrl : input.avatarUrl,
    dateOfBirth: input.dateOfBirth === undefined ? before.dateOfBirth : parseDateOfBirth(input.dateOfBirth),
    preferredLanguage: input.preferredLanguage ?? before.preferredLanguage,
    preferredCurrency: input.preferredCurrency ?? before.preferredCurrency,
  }).where(and(eq(customerProfiles.userId, userId), eq(customerProfiles.status, "active")));
  const after = await getOrCreateProfile(userId);
  await recordAuditEvent({ actorUserId: userId, action: "CUSTOMER_PROFILE_UPDATED", entityType: "customer_profile", entityId: String(after.id), beforeState: before, afterState: after, requestId: getRequestId() });
  return after;
}

export async function updateMyPhone(userId: number, input: PhoneUpdateInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");
  const normalized = normalizePhone(input.phone, input.countryCode);
  const [claimed] = await db.select().from(customerPhones).where(eq(customerPhones.normalizedPhone, normalized.normalizedPhone)).limit(1);
  if (claimed && claimed.userId !== userId) throw conflict("That phone number is already associated with another account.");
  const [before] = await db.select().from(customerPhones).where(eq(customerPhones.userId, userId)).limit(1);
  if (before) {
    await db.update(customerPhones).set({ ...normalized }).where(eq(customerPhones.userId, userId));
  } else {
    await db.insert(customerPhones).values({ userId, ...normalized });
  }
  const [after] = await db.select().from(customerPhones).where(eq(customerPhones.userId, userId)).limit(1);
  if (!after) throw new Error("Phone number could not be saved.");
  await recordAuditEvent({ actorUserId: userId, action: "CUSTOMER_PHONE_UPDATED", entityType: "customer_phone", entityId: String(after.id), beforeState: before, afterState: after, requestId: getRequestId() });
  return after;
}

function addressValues(userId: number, input: AddressInput) {
  const countryCode = input.country.trim().toLowerCase() === "kenya" ? "KE" : "ZZ";
  const recipient = normalizePhone(input.recipientPhone, countryCode);
  return {
    userId,
    recipientName: input.recipientName,
    recipientPhone: recipient.normalizedPhone,
    label: input.label,
    country: input.country,
    county: input.county,
    town: input.town,
    neighborhood: input.neighborhood,
    estateBuilding: input.estateBuilding ?? null,
    apartmentHouse: input.apartmentHouse ?? null,
    streetRoad: input.streetRoad ?? null,
    directions: input.directions ?? null,
    postalCode: input.postalCode ?? null,
    latitude: input.latitude === null || input.latitude === undefined ? null : String(input.latitude),
    longitude: input.longitude === null || input.longitude === undefined ? null : String(input.longitude),
    isDefault: input.isDefault ? 1 : 0,
    status: "active" as const,
  };
}

async function clearDefaults(tx: any, userId: number) {
  await tx.update(customerAddresses).set({ isDefault: 0 }).where(and(eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active")));
}

async function lockCustomer(tx: any, userId: number) {
  await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
}

async function promoteLatestAddress(tx: any, userId: number) {
  const [replacement] = await tx.select().from(customerAddresses)
    .where(and(eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active")))
    .orderBy(desc(customerAddresses.updatedAt), desc(customerAddresses.id)).limit(1);
  if (replacement) await tx.update(customerAddresses).set({ isDefault: 1 }).where(eq(customerAddresses.id, replacement.id));
}

export async function listMyAddresses(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");
  return db.select().from(customerAddresses)
    .where(and(eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active")))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
}

export async function getMyAddress(userId: number, addressId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");
  const [address] = await db.select().from(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active"))).limit(1);
  if (!address) throw notFound("Address not found.");
  return address;
}

export async function createAddress(userId: number, input: AddressInput) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId);
    const [existing] = await tx.select({ id: customerAddresses.id }).from(customerAddresses)
      .where(and(eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active"))).limit(1);
    const values = addressValues(userId, input);
    if (input.isDefault || !existing) await clearDefaults(tx, userId);
    await tx.insert(customerAddresses).values({ ...values, isDefault: input.isDefault || !existing ? 1 : 0 });
    const [created] = await tx.select().from(customerAddresses).where(eq(customerAddresses.userId, userId)).orderBy(desc(customerAddresses.id)).limit(1);
    if (!created) throw new Error("Address could not be created.");
    await writeAuditEvent(tx, { actorUserId: userId, action: "CUSTOMER_ADDRESS_CREATED", entityType: "customer_address", entityId: String(created.id), afterState: created, requestId: getRequestId() });
    return created;
  });
}

export async function updateAddress(userId: number, addressId: number, input: AddressInput) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId);
    const [before] = await tx.select().from(customerAddresses).where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active"))).limit(1);
    if (!before) throw notFound("Address not found.");
    const values = addressValues(userId, input);
    if (input.isDefault) await clearDefaults(tx, userId);
    await tx.update(customerAddresses).set({ ...values, userId: undefined, isDefault: input.isDefault ? 1 : 0 }).where(eq(customerAddresses.id, addressId));
    const [after] = await tx.select().from(customerAddresses).where(eq(customerAddresses.id, addressId)).limit(1);
    await writeAuditEvent(tx, { actorUserId: userId, action: "CUSTOMER_ADDRESS_UPDATED", entityType: "customer_address", entityId: String(addressId), beforeState: before, afterState: after, requestId: getRequestId() });
    return after;
  });
}

export async function deleteAddress(userId: number, addressId: number) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId);
    const [before] = await tx.select().from(customerAddresses).where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active"))).limit(1);
    if (!before) throw notFound("Address not found.");
    await tx.update(customerAddresses).set({ status: "inactive", isDefault: 0 }).where(eq(customerAddresses.id, addressId));
    if (before.isDefault) await promoteLatestAddress(tx, userId);
    await writeAuditEvent(tx, { actorUserId: userId, action: "CUSTOMER_ADDRESS_DEACTIVATED", entityType: "customer_address", entityId: String(addressId), beforeState: before, afterState: { status: "inactive" }, requestId: getRequestId() });
    return { success: true as const };
  });
}

export async function setDefaultAddress(userId: number, addressId: number) {
  return withTransaction(async (tx) => {
    await lockCustomer(tx, userId);
    const [address] = await tx.select().from(customerAddresses).where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId), eq(customerAddresses.status, "active"))).limit(1);
    if (!address) throw notFound("Address not found.");
    await clearDefaults(tx, userId);
    await tx.update(customerAddresses).set({ isDefault: 1 }).where(eq(customerAddresses.id, addressId));
    const [updated] = await tx.select().from(customerAddresses).where(eq(customerAddresses.id, addressId)).limit(1);
    await writeAuditEvent(tx, { actorUserId: userId, action: "CUSTOMER_ADDRESS_DEFAULT_SET", entityType: "customer_address", entityId: String(addressId), beforeState: address, afterState: updated, requestId: getRequestId() });
    return updated;
  });
}

export function toAddressSnapshot(address: { recipientName: string; recipientPhone: string; country: string; county: string; town: string; neighborhood: string; estateBuilding?: string | null; apartmentHouse?: string | null; streetRoad?: string | null; directions?: string | null; postalCode?: string | null; latitude?: string | null; longitude?: string | null }) {
  return Object.freeze({
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    country: address.country,
    county: address.county,
    town: address.town,
    neighborhood: address.neighborhood,
    estateBuilding: address.estateBuilding ?? null,
    apartmentHouse: address.apartmentHouse ?? null,
    streetRoad: address.streetRoad ?? null,
    directions: address.directions ?? null,
    postalCode: address.postalCode ?? null,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
  });
}
