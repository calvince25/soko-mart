import { permissionProcedure, router } from "../../_core/trpc";
import { payoutCreateSchema, payoutIdSchema, payoutListSchema, payoutPauseSchema } from "../../../shared/validation/payoutSchemas";
import { createPayoutInstruction, listPayoutEvents, listPayoutQueue, listPayouts, payoutOperationalStatus, processPayoutCallback, setPayoutPause } from "./payoutService";
export const payoutRouter = router({
  myList: permissionProcedure("finance.settlement.read_own").input(payoutListSchema).query(({ ctx, input }) => listPayouts(ctx.user.id, input.sellerId)),
  createInstruction: permissionProcedure("finance.payout.initiate").input(payoutCreateSchema).mutation(({ ctx, input }) => createPayoutInstruction(ctx.user.id, input)),
  status: permissionProcedure("finance.payout.read").query(() => payoutOperationalStatus()),
  queue: permissionProcedure("finance.payout.read").input(payoutListSchema).query(({ input }) => listPayoutQueue(input.sellerId)),
  events: permissionProcedure("finance.payout.events.read").input(payoutIdSchema).query(({ ctx, input }) => listPayoutEvents(ctx.user.id, input.payoutId)),
  setPause: permissionProcedure("finance.payout.pause").input(payoutPauseSchema).mutation(({ ctx, input }) => setPayoutPause(ctx.user.id, input.paused, input.reason)),
  callbackPreview: permissionProcedure("finance.payout.reconcile").mutation(({ input }: any) => processPayoutCallback(input)),
});
