import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { channelAdapter } from "./domains/notification/channels";

const user = { id: 991301, openId: "notification-test", name: "Notification Test", email: "notification@test.local", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
function context(permissions: string[] = [], currentUser: any = user): TrpcContext { return { user: currentUser, permissions: new Set(permissions), req: { protocol: "https", headers: {} } as any, res: {} as any }; }

describe("Sprint 13 notification boundaries", () => {
  it("requires authentication for the notification center", async () => {
    const caller = appRouter.createCaller({ ...context(), user: null });
    await expect(caller.notification.list({ limit: 10, offset: 0 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("requires notification read permission", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.notification.unreadCount()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not allow security notifications to be disabled", async () => {
    const caller = appRouter.createCaller(context(["notification.preferences.update"]));
    await expect(caller.notification.updatePreference({ channel: "sms", category: "security", enabled: false })).rejects.toThrow("Security notifications cannot be disabled.");
  });
  it("does not report an unconfigured email provider as successful", async () => {
    const result = await channelAdapter("email").deliver({ notificationId: 7, recipientUserId: user.id, title: "Test", body: "Test" });
    expect(result.result).toBe("failed");
    expect(result.provider).toBe("unconfigured");
  });
  it("does not allow non-admin users to retry a failed delivery", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.notification.retry({ notificationId: 999999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
