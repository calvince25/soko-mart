import { permissionProcedure, protectedProcedure, publicProcedure, router } from "../../_core/trpc";
import { z } from "zod";
import { categoryInputSchema, categoryUpdateSchema, brandInputSchema, brandUpdateSchema, productInputSchema, productUpdateSchema, variantInputSchema, variantUpdateSchema, attributeInputSchema, attributeValueInputSchema, categoryAttributeInputSchema, variantAttributeInputSchema, mediaInputSchema, categoryIdSchema, brandIdSchema, productIdSchema, variantIdSchema, moderationDecisionSchema } from "../../../shared/validation/catalogSchemas";
import { addAttributeValue, addProductMedia, archiveBrand, archiveCategory, archiveOwnProduct, approveProduct, attachCategoryAttribute, createAttribute, createBrand, createCategory, createProduct, createVariant, getPublicBrand, getPublicCategory, getPublicProduct, listOwnMedia, listOwnProducts, listProductsForReview, listPublicBrands, listPublicCategories, listPublicProducts, publishProduct, rejectProduct, restoreProduct, setVariantAttribute, submitProduct, suspendProduct, updateBrand, updateCategory, updateProduct, updateVariant } from "./service";

const slugInput = z.object({ slug: z.string().trim().min(3).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });

export const catalogRouter = router({
  public: router({
    categories: publicProcedure.query(() => listPublicCategories()),
    category: publicProcedure.input(slugInput).query(({ input }) => getPublicCategory(input.slug)),
    brands: publicProcedure.query(() => listPublicBrands()),
    brand: publicProcedure.input(slugInput).query(({ input }) => getPublicBrand(input.slug)),
    products: publicProcedure.query(() => listPublicProducts()),
    product: publicProcedure.input(slugInput).query(({ input }) => getPublicProduct(input.slug)),
  }),
  seller: router({
    products: permissionProcedure("seller.product.update_own").query(({ ctx }) => listOwnProducts(ctx.user.id)),
    createProduct: permissionProcedure("seller.product.create_own").input(productInputSchema).mutation(({ ctx, input }) => createProduct(ctx.user.id, input)),
    updateProduct: permissionProcedure("seller.product.update_own").input(productUpdateSchema).mutation(({ ctx, input }) => updateProduct(ctx.user.id, input)),
    submitProduct: permissionProcedure("seller.product.submit_own").input(productIdSchema).mutation(({ ctx, input }) => submitProduct(ctx.user.id, input.id)),
    archiveProduct: permissionProcedure("seller.product.update_own").input(productIdSchema).mutation(({ ctx, input }) => archiveOwnProduct(ctx.user.id, input.id)),
    createVariant: permissionProcedure("seller.variant.manage_own").input(variantInputSchema).mutation(({ ctx, input }) => createVariant(ctx.user.id, input)),
    updateVariant: permissionProcedure("seller.variant.manage_own").input(variantUpdateSchema).mutation(({ ctx, input }) => updateVariant(ctx.user.id, input)),
    setVariantAttribute: permissionProcedure("seller.variant.manage_own").input(variantAttributeInputSchema).mutation(({ ctx, input }) => setVariantAttribute(ctx.user.id, input)),
    addMedia: permissionProcedure("seller.product.media_manage_own").input(mediaInputSchema).mutation(({ ctx, input }) => addProductMedia(ctx.user.id, input)),
    media: permissionProcedure("seller.product.media_manage_own").input(productIdSchema).query(({ ctx, input }) => listOwnMedia(ctx.user.id, input.id)),
  }),
  admin: router({
    createCategory: permissionProcedure("catalog.category.manage").input(categoryInputSchema).mutation(({ ctx, input }) => createCategory(ctx.user.id, input)),
    updateCategory: permissionProcedure("catalog.category.manage").input(categoryUpdateSchema).mutation(({ ctx, input }) => updateCategory(ctx.user.id, input)),
    archiveCategory: permissionProcedure("catalog.category.manage").input(categoryIdSchema).mutation(({ ctx, input }) => archiveCategory(ctx.user.id, input.id)),
    createBrand: permissionProcedure("catalog.category.manage").input(brandInputSchema).mutation(({ ctx, input }) => createBrand(ctx.user.id, input)),
    updateBrand: permissionProcedure("catalog.category.manage").input(brandUpdateSchema).mutation(({ ctx, input }) => updateBrand(ctx.user.id, input)),
    archiveBrand: permissionProcedure("catalog.category.manage").input(brandIdSchema).mutation(({ ctx, input }) => archiveBrand(ctx.user.id, input.id)),
    createAttribute: permissionProcedure("catalog.category.manage").input(attributeInputSchema).mutation(({ ctx, input }) => createAttribute(ctx.user.id, input)),
    addAttributeValue: permissionProcedure("catalog.category.manage").input(attributeValueInputSchema).mutation(({ ctx, input }) => addAttributeValue(ctx.user.id, input)),
    attachCategoryAttribute: permissionProcedure("catalog.category.manage").input(categoryAttributeInputSchema).mutation(({ ctx, input }) => attachCategoryAttribute(ctx.user.id, input)),
    reviewProducts: permissionProcedure("catalog.product.approve").query(() => listProductsForReview()),
    approveProduct: permissionProcedure("catalog.product.approve").input(productIdSchema).mutation(({ ctx, input }) => approveProduct(ctx.user.id, input.id)),
    publishProduct: permissionProcedure("catalog.product.approve").input(productIdSchema).mutation(({ ctx, input }) => publishProduct(ctx.user.id, input.id)),
    rejectProduct: permissionProcedure("catalog.product.approve").input(moderationDecisionSchema.extend({ reason: z.string().trim().min(5).max(2000) })).mutation(({ ctx, input }) => rejectProduct(ctx.user.id, input.id, input.reason)),
    suspendProduct: permissionProcedure("catalog.product.approve").input(moderationDecisionSchema).mutation(({ ctx, input }) => suspendProduct(ctx.user.id, input.id, input.reason)),
    restoreProduct: permissionProcedure("catalog.product.approve").input(productIdSchema).mutation(({ ctx, input }) => restoreProduct(ctx.user.id, input.id)),
  }),
});
