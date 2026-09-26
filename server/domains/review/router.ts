import { permissionProcedure, publicProcedure, router } from "../../_core/trpc";
import { addReviewMedia, checkProductEligibility, checkSellerEligibility, createProductReview, createSellerReview, eligibleItems, getReview, listModeration, listProductReviews, listSellerReviews, moderateReview, removeOwnReview, summary, updateOwnReview } from "./service";
import { addReviewMediaSchema, moderateReviewSchema, moderationListSchema, productEligibilitySchema, productReviewCreateSchema, publicReviewListSchema, publicSellerReviewListSchema, reviewIdSchema, reviewSummarySchema, reviewUpdateSchema, sellerEligibilitySchema, sellerReviewCreateSchema } from "../../../shared/validation/reviewSchemas";

export const reviewRouter = router({
  productReviews: publicProcedure.input(publicReviewListSchema).query(({ input }) => listProductReviews(input.productId, input)),
  sellerReviews: publicProcedure.input(publicSellerReviewListSchema).query(({ input }) => listSellerReviews(input.sellerId, input)),
  summary: publicProcedure.input(reviewSummarySchema).query(({ input }) => summary(input.targetType, input.targetId)),
  eligibility: permissionProcedure("review.create").input(productEligibilitySchema).query(({ ctx, input }) => checkProductEligibility(ctx.user.id, input.orderItemId)),
  sellerEligibility: permissionProcedure("review.create").input(sellerEligibilitySchema).query(({ ctx, input }) => checkSellerEligibility(ctx.user.id, input.sellerOrderId)),
  eligibleItems: permissionProcedure("review.create").query(({ ctx }) => eligibleItems(ctx.user.id)),
  createProduct: permissionProcedure("review.create").input(productReviewCreateSchema).mutation(({ ctx, input }) => createProductReview(ctx.user.id, input)),
  createSeller: permissionProcedure("review.create").input(sellerReviewCreateSchema).mutation(({ ctx, input }) => createSellerReview(ctx.user.id, input)),
  updateOwn: permissionProcedure("review.update_own").input(reviewUpdateSchema).mutation(({ ctx, input }) => updateOwnReview(ctx.user.id, input.reviewId, input)),
  addMedia: permissionProcedure("review.update_own").input(addReviewMediaSchema).mutation(({ ctx, input }) => addReviewMedia(ctx.user.id, input)),
  removeOwn: permissionProcedure("review.update_own").input(reviewIdSchema).mutation(({ ctx, input }) => removeOwnReview(ctx.user.id, input.reviewId)),
  getOwn: permissionProcedure("review.read").input(reviewIdSchema).query(({ ctx, input }) => getReview(ctx.user.id, input.reviewId)),
  moderation: permissionProcedure("review.moderate").input(moderationListSchema).query(({ ctx, input }) => listModeration(ctx.user.id, input)),
  moderate: permissionProcedure("review.moderate").input(moderateReviewSchema).mutation(({ ctx, input }) => moderateReview(ctx.user.id, input)),
});
