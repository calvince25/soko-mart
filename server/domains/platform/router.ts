import { notifyOwner } from "../../_core/notification";
import { adminProcedure, publicProcedure, router } from "../../_core/trpc";
import { healthInputSchema, ownerNotificationSchema } from "../../../shared/validation/schemas";
import { recordAuditEvent } from "../../audit/audit";
import { getRequestId } from "../../logging/requestContext";

export const platformRouter = router({
  health: publicProcedure.input(healthInputSchema).query(() => ({ ok: true })),

  notifyOwner: adminProcedure.input(ownerNotificationSchema).mutation(async ({ ctx, input }) => {
    const success = await notifyOwner(input);
    if (success) {
      await recordAuditEvent({
        actorUserId: ctx.user.id,
        action: "PLATFORM_OWNER_NOTIFICATION_SENT",
        entityType: "owner_notification",
        afterState: { title: input.title },
        requestId: getRequestId(),
      });
    }
    return { success };
  }),
});

export const systemRouter = platformRouter;
