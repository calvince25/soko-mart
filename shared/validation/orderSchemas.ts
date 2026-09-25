import { z } from "zod";

export const orderIdSchema = z.object({ orderId: z.number().int().positive() });
export const sellerOrderIdSchema = z.object({ sellerOrderId: z.number().int().positive() });
export const sellerOrderStatusSchema = z.enum(["processing", "ready_for_fulfilment", "completed"]);
export const updateSellerOrderStatusSchema = sellerOrderIdSchema.extend({ status: sellerOrderStatusSchema });
export const orderListSchema = z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).max(10000).default(0) });
export const adminOrderSearchSchema = orderListSchema.extend({
  orderNumber: z.string().trim().max(40).optional(),
  customerId: z.number().int().positive().optional(),
  sellerId: z.number().int().positive().optional(),
  paymentReference: z.string().trim().max(160).optional(),
  status: z.enum(["pending", "confirmed", "processing", "ready_for_fulfilment", "completed", "cancelled"]).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});
export type AdminOrderSearchInput = z.infer<typeof adminOrderSearchSchema>;
