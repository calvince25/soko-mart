import { z } from "zod";

/** Cart quantities are intentionally configurable in one place; checkout will revalidate availability. */
export const CART_MIN_LINE_QUANTITY = 1;
export const CART_MAX_LINE_QUANTITY = 99;

export const variantIdInputSchema = z.object({
  variantId: z.number().int().positive(),
});

export const cartQuantitySchema = z.number().int().min(CART_MIN_LINE_QUANTITY).max(CART_MAX_LINE_QUANTITY);

export const addCartItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: cartQuantitySchema,
});

export const setCartItemQuantitySchema = z.object({
  itemId: z.number().int().positive(),
  quantity: cartQuantitySchema,
});

export const cartItemIdSchema = z.object({
  itemId: z.number().int().positive(),
});

export const cartValidationSchema = z.object({});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type SetCartItemQuantityInput = z.infer<typeof setCartItemQuantitySchema>;
