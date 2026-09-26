import { permissionProcedure, protectedProcedure, router } from "../../_core/trpc";
import { createRefund, createReturn, decideReturn, eligibleItems, getEligibility, getReturn, inspectReturn, listMyReturns, listOperationalReturns, listSellerReturns, processRefund, updateReturnStatus } from "./service";
import { inspectionSchema, refundCreateSchema, refundIdSchema, returnCreateSchema, returnDecisionSchema, returnEligibilitySchema, returnIdSchema, returnListSchema, returnStatusSchema } from "../../../shared/validation/returnSchemas";
export const returnsRouter = router({
  eligibility: permissionProcedure("return.read_own").input(returnEligibilitySchema).query(({ ctx, input }) => getEligibility(ctx.user.id, input.sellerOrderId, input.orderItemId)),
  eligibleItems: permissionProcedure("return.read_own").query(({ ctx }) => eligibleItems(ctx.user.id)),
  listMine: permissionProcedure("return.read_own").input(returnListSchema).query(({ ctx, input }) => listMyReturns(ctx.user.id, input)),
  get: permissionProcedure("return.read_own").input(returnIdSchema).query(({ ctx, input }) => getReturn(ctx.user.id, input.returnId)),
  create: permissionProcedure("return.create_own").input(returnCreateSchema).mutation(({ ctx, input }) => createReturn(ctx.user.id, input)),
  operations: permissionProcedure("return.process").input(returnListSchema).query(({ ctx, input }) => listOperationalReturns(ctx.user.id, input)),
  sellerList: permissionProcedure("return.read_seller").input(returnListSchema).query(({ ctx, input }) => listSellerReturns(ctx.user.id, input)),
  decide: permissionProcedure("return.process").input(returnDecisionSchema).mutation(({ ctx, input }) => decideReturn(ctx.user.id, input)),
  updateStatus: permissionProcedure("return.process").input(returnStatusSchema).mutation(({ ctx, input }) => updateReturnStatus(ctx.user.id, input)),
  inspect: permissionProcedure("return.inspect").input(inspectionSchema).mutation(({ ctx, input }) => inspectReturn(ctx.user.id, input)),
  approveRefund: permissionProcedure("refund.approve").input(refundCreateSchema).mutation(({ ctx, input }) => createRefund(ctx.user.id, input)),
  processRefund: permissionProcedure("refund.process").input(refundIdSchema).mutation(({ ctx, input }) => processRefund(ctx.user.id, input.refundId)),
});
