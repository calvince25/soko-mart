import { protectedProcedure, router } from "../../_core/trpc";
import { addCartItemSchema, cartItemIdSchema, cartValidationSchema, setCartItemQuantitySchema, variantIdInputSchema } from "../../../shared/validation/commerceSchemas";
import { addItem, clearCart, decreaseItem, getCart, increaseItem, removeItem, setItemQuantity, validateCart } from "./cart/service";
import { addWishlistItem, clearWishlist, getWishlist, removeWishlistItem } from "./wishlist/service";
import { checkoutRouter } from "../checkout/router";
import { paymentRouter } from "../payment/router";
import { orderRouter } from "../order/router";
import { warehouseRouter } from "../warehouse/router";

export const cartRouter = router({
  get: protectedProcedure.query(({ ctx }) => getCart(ctx.user.id)),
  addItem: protectedProcedure.input(addCartItemSchema).mutation(({ ctx, input }) => addItem(ctx.user.id, input)),
  setItemQuantity: protectedProcedure.input(setCartItemQuantitySchema).mutation(({ ctx, input }) => setItemQuantity(ctx.user.id, input.itemId, input.quantity)),
  increaseItem: protectedProcedure.input(cartItemIdSchema).mutation(({ ctx, input }) => increaseItem(ctx.user.id, input.itemId)),
  decreaseItem: protectedProcedure.input(cartItemIdSchema).mutation(({ ctx, input }) => decreaseItem(ctx.user.id, input.itemId)),
  removeItem: protectedProcedure.input(cartItemIdSchema).mutation(({ ctx, input }) => removeItem(ctx.user.id, input.itemId)),
  clear: protectedProcedure.mutation(({ ctx }) => clearCart(ctx.user.id)),
  validate: protectedProcedure.input(cartValidationSchema).query(({ ctx }) => validateCart(ctx.user.id)),
});

export const wishlistRouter = router({
  get: protectedProcedure.query(({ ctx }) => getWishlist(ctx.user.id)),
  addItem: protectedProcedure.input(variantIdInputSchema).mutation(({ ctx, input }) => addWishlistItem(ctx.user.id, input.variantId)),
  removeItem: protectedProcedure.input(variantIdInputSchema).mutation(({ ctx, input }) => removeWishlistItem(ctx.user.id, input.variantId)),
  clear: protectedProcedure.mutation(({ ctx }) => clearWishlist(ctx.user.id)),
});

export const commerceRouter = router({ cart: cartRouter, wishlist: wishlistRouter, checkout: checkoutRouter, payment: paymentRouter, order: orderRouter, warehouse: warehouseRouter });
