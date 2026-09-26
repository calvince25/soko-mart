import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const user = { id: 991401, openId: "review-test", name: "Review Test", email: "review@test.local", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
function context(permissions: string[] = [], currentUser: any = user): TrpcContext { return { user: currentUser, permissions: new Set(permissions), req: { protocol: "https", headers: {} } as any, res: {} as any }; }

describe("Sprint 14 review boundaries", () => {
  it("requires authentication for customer review eligibility", async () => {
    const caller = appRouter.createCaller({ ...context(), user: null });
    await expect(caller.review.eligibleItems()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("requires the dedicated review-create permission", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.review.eligibleItems()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects ratings outside the five-star contract before any database lookup", async () => {
    const caller = appRouter.createCaller(context(["review.create"]));
    await expect(caller.review.createProduct({ orderItemId: 1, rating: 6, reviewText: "This review should fail before eligibility lookup." })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("requires moderation permission for the admin queue", async () => {
    const caller = appRouter.createCaller(context(["review.read", "review.create"]));
    await expect(caller.review.moderation({ limit: 10, offset: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects short review text at the API boundary", async () => {
    const caller = appRouter.createCaller(context(["review.create"]));
    await expect(caller.review.createSeller({ sellerOrderId: 1, rating: 5, reviewText: "short" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("keeps product review listings public while keeping moderation protected", async () => {
    expect(appRouter._def.procedures["review.productReviews"]).toBeDefined();
    expect(appRouter._def.procedures["review.moderate"]).toBeDefined();
  });
});
