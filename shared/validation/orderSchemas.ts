import { z } from "zod";

export const orderIdSchema = z.object({ orderId: z.number().int().positive() });
export const sellerOrderIdSchema = z.object({ sellerOrderId: z.number().int().positive() });
export const sellerOrderStatusSchema = z.enum(["processing", "ready_for_fulfilment", "completed"]);
export const updateSellerOrderStatusSchema = sellerOrderIdSchema.extend({ status: sellerOrderStatusSchema });
export const fulfilmentStateSchema = z.enum(["pending", "accepted", "processing", "packed", "ready_for_handoff", "handed_to_logistics", "rejected", "cancelled", "failed"]);
export type FulfilmentState = z.infer<typeof fulfilmentStateSchema>;
export const fulfilmentTransitionSchema = sellerOrderIdSchema.extend({
  targetState: fulfilmentStateSchema,
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(2000).optional(),
});
export const fulfilmentNoteSchema = sellerOrderIdSchema.extend({ note: z.string().trim().min(1).max(2000) });
export const fulfilmentHistorySchema = sellerOrderIdSchema;
export const sellerOrderCancellationSchema = sellerOrderIdSchema.extend({ reason: z.string().trim().min(3).max(500), note: z.string().trim().max(2000).optional() });
export const orderListSchema = z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).max(10000).default(0) });
export const adminOrderSearchSchema = orderListSchema.extend({
  orderNumber: z.string().trim().max(40).optional(),
  customerId: z.number().int().positive().optional(),
  sellerId: z.number().int().positive().optional(),
  paymentReference: z.string().trim().max(160).optional(),
  status: z.enum(["pending", "confirmed", "processing", "ready_for_fulfilment", "completed", "cancelled"]).optional(),
  fulfilmentState: fulfilmentStateSchema.optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});
export type AdminOrderSearchInput = z.infer<typeof adminOrderSearchSchema>;
