import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { canTransitionBeneficiary, fingerprintBeneficiaryDestination, maskBeneficiaryDestination } from "./domains/finance/beneficiaries";

const user = { id: 991801, openId: "beneficiary-test", name: "Beneficiary Test", email: "beneficiary@test.local", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
function ctx(permissions: string[] = [], currentUser: any = user): TrpcContext {
  return { user: currentUser, permissions: new Set(permissions), req: { protocol: "https", headers: {} } as any, res: {} as any };
}

describe("Sprint 18 payout beneficiaries", () => {
  it("normalizes the public representation without exposing a destination", () => {
    const masked = maskBeneficiaryDestination("+254712345678");
    const fingerprint = fingerprintBeneficiaryDestination("+254712345678");
    expect(masked).toBe("+254******5678");
    expect(masked).not.toContain("712345");
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("+254712345678");
  });

  it("allows only server-controlled lifecycle transitions", () => {
    expect(canTransitionBeneficiary("DRAFT", "PENDING_VERIFICATION")).toBe(true);
    expect(canTransitionBeneficiary("PENDING_VERIFICATION", "VERIFIED")).toBe(true);
    expect(canTransitionBeneficiary("VERIFIED", "SUSPENDED")).toBe(true);
    expect(canTransitionBeneficiary("DEACTIVATED", "VERIFIED")).toBe(false);
    expect(canTransitionBeneficiary("DRAFT", "VERIFIED")).toBe(false);
  });

  it("requires authentication and dedicated permissions for seller onboarding", async () => {
    const unauthenticated = appRouter.createCaller({ ...ctx(), user: null });
    await expect(unauthenticated.finance.beneficiaries.listMine({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const noPermission = appRouter.createCaller(ctx());
    await expect(noPermission.finance.beneficiaries.create({ sellerId: 1, provider: "mpesa", accountType: "mobile_money", phone: "0712345678" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(noPermission.finance.beneficiaries.review({ beneficiaryId: 1, status: "VERIFIED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("exposes the additive beneficiary API without replacing finance procedures", () => {
    for (const key of ["listMine", "events", "create", "submit", "setPrimary", "deactivate", "review"]) {
      expect(appRouter._def.procedures[`finance.beneficiaries.${key}`]).toBeDefined();
    }
    expect(appRouter._def.procedures["finance.ledger"]).toBeDefined();
    expect(appRouter._def.procedures["finance.mySummary"]).toBeDefined();
  });
});
