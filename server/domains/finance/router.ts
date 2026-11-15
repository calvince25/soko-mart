import { permissionProcedure, router } from "../../_core/trpc";
import { createAdjustment, createCommissionRule, createHold, createSettlement, listLedger, mySellerSummary, sellerLedger, sellerSummary } from "./service";
import { adjustmentSchema, commissionRuleSchema, financeListSchema, holdSchema, sellerInputSchema, settlementSchema } from "../../../shared/validation/financeSchemas";
import { beneficiaryRouter } from "./beneficiaryRouter";
import { payoutRouter } from "./payoutRouter";
export const financeRouter=router({
 beneficiaries: beneficiaryRouter,
 payouts: payoutRouter,
  ledger:permissionProcedure("finance.ledger.read").input(financeListSchema).query(({ctx,input})=>listLedger(ctx.user.id,input)),
  myLedger:permissionProcedure("finance.settlement.read_own").input(financeListSchema).query(({ctx,input})=>sellerLedger(ctx.user.id,input)),
  sellerSummary:permissionProcedure("finance.settlement.read_own").input(sellerInputSchema).query(({ctx,input})=>sellerSummary(ctx.user.id,input.sellerId)),
  mySummary:permissionProcedure("finance.settlement.read_own").query(({ctx})=>mySellerSummary(ctx.user.id)),
 createCommissionRule:permissionProcedure("finance.commission.manage").input(commissionRuleSchema).mutation(({ctx,input})=>createCommissionRule(ctx.user.id,input)),
 createHold:permissionProcedure("finance.hold.manage").input(holdSchema).mutation(({ctx,input})=>createHold(ctx.user.id,input)),
 createAdjustment:permissionProcedure("finance.adjustment.create").input(adjustmentSchema).mutation(({ctx,input})=>createAdjustment(ctx.user.id,input)),
 createSettlement:permissionProcedure("finance.settlement.manage").input(settlementSchema).mutation(({ctx,input})=>createSettlement(ctx.user.id,input)),
});
