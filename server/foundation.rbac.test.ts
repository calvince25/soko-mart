import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { permissionProcedure, router } from "./_core/trpc";

const user = {
  id: 42,
  openId: "foundation-user",
  name: "Foundation User",
  email: "user@example.com",
  loginMethod: "test",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function context(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
    user: null,
    ...overrides,
  };
}

const financeProcedureRouter = router({
  read: permissionProcedure("finance.payment.read").query(({ ctx }) => ctx.user.id),
});

describe("Sprint 1 authentication and RBAC foundation", () => {
  it("rejects unauthenticated protected procedures", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.auth.logoutAll()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("enforces permissions on the server", async () => {
    const caller = financeProcedureRouter.createCaller(context({ user, permissions: new Set(["order.read_own"]) }));
    await expect(caller.read()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an assigned permission", async () => {
    const caller = financeProcedureRouter.createCaller(context({ user, permissions: new Set(["finance.payment.read"]) }));
    await expect(caller.read()).resolves.toBe(42);
  });

  it("does not grant legacy admin users every permission", async () => {
    const admin = { ...user, role: "admin" as const };
    const caller = financeProcedureRouter.createCaller(context({ user: admin, permissions: new Set() }));
    await expect(caller.read()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the public auth.me procedure available", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.auth.me()).resolves.toBeNull();
  });
});
