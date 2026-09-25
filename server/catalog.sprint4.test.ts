import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { normalizeCatalogSlug } from "./domains/catalog/service";
import { Money } from "../shared/money/money";
import { categoryInputSchema, mediaInputSchema, variantInputSchema } from "../shared/validation/catalogSchemas";
import { getDb } from "./db";
import { catalogAttributes, catalogBrands, catalogCategories, catalogProductMedia, catalogProductVariants, catalogProducts } from "../drizzle/schema";

const user = { id: 777, openId: "catalog-test-user", name: "Catalog Test", email: "catalog@example.com", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
function context(overrides: Partial<TrpcContext> = {}): TrpcContext { return { req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"], user: null, ...overrides }; }

describe("Sprint 4 catalog validation and security", () => {
  it("normalizes deterministic URL-safe slugs", () => expect(normalizeCatalogSlug("  Phones & Accessories  ")).toBe("phones-accessories"));
  it("rejects unsafe category slugs and self-invalid input", () => expect(() => categoryInputSchema.parse({ name: "Phones", slug: "Phones & More", parentId: null })).toThrow());
  it("rejects negative or invalid variant prices", () => {
    expect(() => variantInputSchema.parse({ productId: 1, sku: "SKU-1", name: "Black", priceMinor: -1, currency: "KES" })).toThrow();
    expect(() => variantInputSchema.parse({ productId: 1, sku: "SKU-1", name: "Black", priceMinor: 1000, compareAtPriceMinor: 900, currency: "KES" })).toThrow();
  });
  it("stores product prices as exact integer minor units", () => {
    expect(Money.fromMajor("1299.99", "KES").toJSON()).toEqual({ amountMinor: 129999, currency: "KES" });
  });
  it("rejects oversized and unapproved media formats", () => {
    const base = { productId: 1, storageKey: "catalog/seller/1/item.jpg", originalFilename: "item.jpg", altText: null, displayOrder: 0, isPrimary: false };
    expect(() => mediaInputSchema.parse({ ...base, mimeType: "application/pdf", fileSize: 100 })).toThrow();
    expect(() => mediaInputSchema.parse({ ...base, mimeType: "image/jpeg", fileSize: 10 * 1024 * 1024 + 1 })).toThrow();
  });
  it("does not allow anonymous catalog administration or seller product access", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.catalog.admin.reviewProducts()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.catalog.seller.products()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("does not allow a user without catalog permissions to approve or manage another seller's catalog", async () => {
    const caller = appRouter.createCaller(context({ user, permissions: new Set() }));
    await expect(caller.catalog.admin.approveProduct({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.catalog.seller.updateProduct({ id: 1, categoryId: 1, brandId: null, name: "IDOR attempt", slug: "idor-attempt", shortDescription: null, fullDescription: null, metaTitle: null, metaDescription: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Sprint 4 catalog persistence and public safety", () => {
  it("has persistent catalog tables after migration", async () => {
    if (!process.env.DATABASE_URL) return;
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const [categories, brands, attributes, products, variants, media] = await Promise.all([
      db.select({ id: catalogCategories.id }).from(catalogCategories), db.select({ id: catalogBrands.id }).from(catalogBrands), db.select({ id: catalogAttributes.id }).from(catalogAttributes), db.select({ id: catalogProducts.id }).from(catalogProducts), db.select({ id: catalogProductVariants.id }).from(catalogProductVariants), db.select({ id: catalogProductMedia.id }).from(catalogProductMedia),
    ]);
    expect(categories).toBeDefined(); expect(brands).toBeDefined(); expect(attributes).toBeDefined(); expect(products).toBeDefined(); expect(variants).toBeDefined(); expect(media).toBeDefined();
  });
  it("returns only intentionally public product fields", async () => {
    const caller = appRouter.createCaller(context());
    const products = await caller.catalog.public.products();
    for (const item of products) {
      expect(item).not.toHaveProperty("sellerId");
      expect(item).not.toHaveProperty("moderationStatus");
      expect(item).not.toHaveProperty("rejectionReason");
      expect(item).not.toHaveProperty("storageKey");
    }
  });
});
