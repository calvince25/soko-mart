import { protectedProcedure, router } from "../../_core/trpc";
import { paymentCancelSchema, paymentIdSchema, paymentInitiateSchema } from "../../../shared/validation/paymentSchemas";
import { cancelPayment, getPayment, initiatePayment, reconcilePayment } from "./service";

export const paymentRouter = router({
  initiate: protectedProcedure.input(paymentInitiateSchema).mutation(({ ctx, input }) => initiatePayment(ctx.user.id, input)),
  get: protectedProcedure.input(paymentIdSchema).query(({ ctx, input }) => getPayment(ctx.user.id, input.paymentId)),
  cancel: protectedProcedure.input(paymentCancelSchema).mutation(({ ctx, input }) => cancelPayment(ctx.user.id, input.paymentId, input.reason)),
  reconcile: protectedProcedure.input(paymentIdSchema).mutation(({ ctx, input }) => reconcilePayment(ctx.user.id, input.paymentId)),
});
