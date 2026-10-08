import { permissionProcedure, router } from "../../_core/trpc";
import { beneficiaryCreateSchema, beneficiaryIdSchema, beneficiaryListSchema, beneficiaryReviewSchema } from "../../../shared/validation/beneficiarySchemas";
import { createBeneficiary, deactivateBeneficiary, listBeneficiaryEvents, listMyBeneficiaries, reviewBeneficiary, setPrimaryBeneficiary, submitBeneficiary } from "./beneficiaries";

export const beneficiaryRouter = router({
  listMine: permissionProcedure("finance.payout_account.read_own").input(beneficiaryListSchema).query(({ ctx, input }) => listMyBeneficiaries(ctx.user.id, input.sellerId)),
  events: permissionProcedure("finance.payout_account.read_own").input(beneficiaryIdSchema).query(({ ctx, input }) => listBeneficiaryEvents(ctx.user.id, input.beneficiaryId)),
  create: permissionProcedure("finance.payout_account.manage_own").input(beneficiaryCreateSchema).mutation(({ ctx, input }) => createBeneficiary(ctx.user.id, input)),
  submit: permissionProcedure("finance.payout_account.manage_own").input(beneficiaryIdSchema).mutation(({ ctx, input }) => submitBeneficiary(ctx.user.id, input.beneficiaryId)),
  setPrimary: permissionProcedure("finance.payout_account.manage_own").input(beneficiaryIdSchema).mutation(({ ctx, input }) => setPrimaryBeneficiary(ctx.user.id, input.beneficiaryId)),
  deactivate: permissionProcedure("finance.payout_account.manage_own").input(beneficiaryIdSchema).mutation(({ ctx, input }) => deactivateBeneficiary(ctx.user.id, input.beneficiaryId)),
  review: permissionProcedure("finance.payout_account.review").input(beneficiaryReviewSchema).mutation(({ ctx, input }) => reviewBeneficiary(ctx.user.id, input)),
});
