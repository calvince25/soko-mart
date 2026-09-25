import { protectedProcedure, permissionProcedure, publicProcedure, router } from "../../_core/trpc";
import { sellerApplicationInputSchema, sellerDocumentInputSchema, sellerIdSchema, sellerProfileInputSchema, sellerReviewSchema, publicStoreSlugSchema } from "../../../shared/validation/schemas";
import { createSeller, getSellerForUser, updateSeller, submitSeller, addDocument, getPublicStore, listApplications, reviewSeller, approveSeller, rejectSeller, changeSuspension } from "./service";
import { z } from "zod";

export const sellerRouter = router({
  mine: protectedProcedure.query(({ ctx }) => getSellerForUser(ctx.user.id)),
  create: protectedProcedure.input(sellerProfileInputSchema).mutation(({ ctx, input }) => createSeller(ctx.user.id, input, ctx.user.name)),
  update: protectedProcedure.input(sellerProfileInputSchema.extend({ sellerId: z.number().int().positive() })).mutation(({ ctx, input }) => { const { sellerId, ...profile } = input; return updateSeller(ctx.user.id, sellerId, profile); }),
  submit: protectedProcedure.input(sellerIdSchema.extend(sellerApplicationInputSchema.shape)).mutation(({ ctx, input }) => { const { sellerId, ...application } = input; return submitSeller(ctx.user.id, sellerId, application); }),
  addDocument: protectedProcedure.input(sellerDocumentInputSchema).mutation(({ ctx, input }) => addDocument(ctx.user.id, input)),
  publicStore: publicProcedure.input(publicStoreSlugSchema).query(({ input }) => getPublicStore(input.slug)),
  admin: router({
    list: permissionProcedure("seller.application.review").query(() => listApplications()),
    startReview: permissionProcedure("seller.application.review").input(sellerIdSchema).mutation(({ ctx, input }) => reviewSeller(ctx.user.id, input.sellerId)),
    approve: permissionProcedure("seller.application.approve").input(sellerIdSchema).mutation(({ ctx, input }) => approveSeller(ctx.user.id, input.sellerId)),
    reject: permissionProcedure("seller.application.approve").input(sellerReviewSchema.extend({ reason: z.string().trim().min(3).max(2000) })).mutation(({ ctx, input }) => rejectSeller(ctx.user.id, input.sellerId, input.reason)),
    suspend: permissionProcedure("seller.application.suspend").input(sellerReviewSchema).mutation(({ ctx, input }) => changeSuspension(ctx.user.id, input.sellerId, true, input.reason)),
    reactivate: permissionProcedure("seller.application.suspend").input(sellerIdSchema).mutation(({ ctx, input }) => changeSuspension(ctx.user.id, input.sellerId, false)),
  }),
});
