import { protectedProcedure, router } from "../../_core/trpc";
import { checkoutAddressSchema, checkoutCreateSchema, checkoutSessionIdSchema } from "../../../shared/validation/checkoutSchemas";
import { cancelCheckoutSession, createCheckoutSession, getCheckoutSession, refreshCheckoutSession, setCheckoutAddress } from "./service";

export const checkoutRouter = router({
  create: protectedProcedure.input(checkoutCreateSchema).mutation(({ ctx, input }) => createCheckoutSession(ctx.user.id, input)),
  get: protectedProcedure.input(checkoutSessionIdSchema).query(({ ctx, input }) => getCheckoutSession(ctx.user.id, input.sessionId)),
  refresh: protectedProcedure.input(checkoutSessionIdSchema).mutation(({ ctx, input }) => refreshCheckoutSession(ctx.user.id, input.sessionId)),
  setAddress: protectedProcedure.input(checkoutAddressSchema).mutation(({ ctx, input }) => setCheckoutAddress(ctx.user.id, input.sessionId, input.addressId)),
  cancel: protectedProcedure.input(checkoutSessionIdSchema).mutation(({ ctx, input }) => cancelCheckoutSession(ctx.user.id, input.sessionId)),
});
