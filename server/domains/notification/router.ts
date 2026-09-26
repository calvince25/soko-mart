import { permissionProcedure, router } from "../../_core/trpc";
import { notificationIdSchema, notificationListSchema, notificationMonitoringSchema, notificationPreferenceSchema } from "../../../shared/validation/notificationSchemas";
import { getPreferences, listMyNotifications, listOperational, markAllRead, markRead, retryNotification, unreadCount, updatePreference } from "./service";

const read = permissionProcedure("notification.read");
const preferences = permissionProcedure("notification.preferences.update");
const manage = permissionProcedure("notification.manage");
const retry = permissionProcedure("notification.retry");
const isAdmin = (role: string) => role === "admin";

export const notificationRouter = router({
  list: read.input(notificationListSchema).query(({ ctx, input }) => listMyNotifications(ctx.user.id, input)),
  unreadCount: read.query(({ ctx }) => unreadCount(ctx.user.id)),
  markRead: read.input(notificationIdSchema).mutation(({ ctx, input }) => markRead(ctx.user.id, input.notificationId)),
  markAllRead: read.mutation(({ ctx }) => markAllRead(ctx.user.id)),
  preferences: preferences.query(({ ctx }) => getPreferences(ctx.user.id)),
  updatePreference: preferences.input(notificationPreferenceSchema).mutation(({ ctx, input }) => updatePreference(ctx.user.id, input)),
  monitoring: manage.input(notificationMonitoringSchema).query(({ ctx, input }) => listOperational(ctx.user.id, input, isAdmin(ctx.user.role))),
  retry: retry.input(notificationIdSchema).mutation(({ ctx, input }) => retryNotification(ctx.user.id, input.notificationId, isAdmin(ctx.user.role) || Boolean(ctx.permissions?.has("notification.retry")))),
});
