import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { deliveryAttemptSchema } from "../shared/validation/deliverySchemas";

const user = { id: 991201, openId: "delivery-test", name: "Delivery Test", email: "delivery@test.local", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
function context(permissions: string[] = []): TrpcContext { return { user, permissions: new Set(permissions), req: { protocol: "https", headers: {} } as any, res: {} as any }; }

describe("Sprint 12 delivery boundaries", () => {
  it("requires authentication for shipment tracking", async () => {
    const caller = appRouter.createCaller({ ...context(), user: null });
    await expect(caller.delivery.get({ shipmentId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("requires shipment read permission for courier workspace", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.delivery.list({ limit: 10, offset: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not let a courier with read-only access perform delivery actions", async () => {
    const caller = appRouter.createCaller(context(["logistics.shipment.read"]));
    await expect(caller.delivery.pickup({ shipmentId: 999999, note: "test" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects invalid delivery OTP shape before reaching the service", async () => {
    const caller = appRouter.createCaller(context(["logistics.shipment.deliver"]));
    await expect(caller.delivery.attempt({ shipmentId: 1, outcome: "delivered", otp: "12" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("accepts storage references but rejects arbitrary proof URLs", () => {
    expect(() => deliveryAttemptSchema.parse({ shipmentId: 1, outcome: "delivered", otp: "1234", proofRef: "proofs/ship-1.jpg" })).not.toThrow();
    expect(() => deliveryAttemptSchema.parse({ shipmentId: 1, outcome: "delivered", otp: "1234", proofRef: "https://example.com/proof.jpg" })).toThrow();
  });
  it("requires courier management permission to create identities", async () => {
    const caller = appRouter.createCaller(context(["logistics.shipment.read"]));
    await expect(caller.delivery.createCourier({ userId: 1, fullName: "Test Courier", phone: "+254700000001" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
