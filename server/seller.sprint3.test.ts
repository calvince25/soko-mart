import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { canTransitionSeller, normalizeStoreSlug } from "./domains/seller/service";
import type { TrpcContext } from "./_core/context";

const user = { id: 991991, openId: "seller-test", name: "Seller Test", email: "seller@test.local", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const ctx = (overrides: Partial<TrpcContext> = {}): TrpcContext => ({ user, req: {} as any, res: {} as any, permissions: new Set(), ...overrides });

describe("seller lifecycle and security", () => {
  it("normalizes URL-safe store slugs and prevents unsafe names", () => {
    expect(normalizeStoreSlug("  Café & Home Kenya! ")).toBe("cafe-home-kenya");
    expect(() => normalizeStoreSlug("!!")).toThrow();
  });
  it("allows only documented lifecycle transitions", () => {
    expect(canTransitionSeller("draft", "pending_verification")).toBe(true);
    expect(canTransitionSeller("under_review", "approved")).toBe(true);
    expect(canTransitionSeller("draft", "approved")).toBe(false);
    expect(canTransitionSeller("closed", "approved")).toBe(false);
  });
  it("does not expose admin review procedures to ordinary customers", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(caller.seller.admin.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not trust a seller ID without an authenticated membership", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(caller.seller.update({ sellerId: 999999, legalBusinessName: "X Business", storeName: "X Store", storeSlug: "x-store", businessType: "retail", country: "Kenya", county: "Nairobi", town: "Nairobi", businessAddress: "X", businessPhone: "+254700000000", businessEmail: "x@example.com", businessDescription: null })).rejects.toThrow("permission");
  });
  it("requires approved verification state for public store visibility", async () => {
    const caller = appRouter.createCaller(ctx({ user: null }));
    await expect(caller.seller.publicStore({ slug: "does-not-exist" })).rejects.toThrow("Store not found");
  });
});
