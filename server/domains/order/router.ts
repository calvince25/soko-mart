import { permissionProcedure, protectedProcedure, router } from "../../_core/trpc";
import { adminOrderSearchSchema, fulfilmentHistorySchema, fulfilmentNoteSchema, fulfilmentTransitionSchema, orderIdSchema, orderListSchema, sellerOrderIdSchema, sellerOrderCancellationSchema, updateSellerOrderStatusSchema } from "../../../shared/validation/orderSchemas";
import { addSellerFulfilmentNote, getAdminFulfilmentHistory, getSellerFulfilmentHistory, listAdminFulfilmentOrders, transitionSellerFulfilment } from "./fulfilment";
import { createOrderFromSuccessfulPayment, getAdminOrder, getAdminSellerOrder, getMyOrder, getMyOrderByNumber, getSellerOrder, listMyOrders, listSellerOrders, searchOrders, updateSellerOrderStatus } from "./service";
import { z } from "zod";

export const orderRouter = router({
  createFromPayment: protectedProcedure.input(z.object({ paymentId: z.number().int().positive() })).mutation(({ ctx, input }) => createOrderFromSuccessfulPayment(ctx.user.id, input.paymentId)),
  myList: permissionProcedure("order.read_own").input(orderListSchema).query(({ ctx, input }) => listMyOrders(ctx.user.id, input.limit, input.offset)),
  myGet: permissionProcedure("order.read_own").input(orderIdSchema).query(({ ctx, input }) => getMyOrder(ctx.user.id, input.orderId)),
  myGetByNumber: permissionProcedure("order.read_own").input(z.object({ orderNumber: z.string().trim().min(5).max(40) })).query(({ ctx, input }) => getMyOrderByNumber(ctx.user.id, input.orderNumber)),
  sellerList: permissionProcedure("seller.order.read_own").input(orderListSchema).query(({ ctx, input }) => listSellerOrders(ctx.user.id, input.limit, input.offset)),
  sellerGet: permissionProcedure("seller.order.read_own").input(sellerOrderIdSchema).query(({ ctx, input }) => getSellerOrder(ctx.user.id, input.sellerOrderId)),
  sellerUpdateStatus: permissionProcedure("seller.order.fulfill_own").input(updateSellerOrderStatusSchema).mutation(({ ctx, input }) => updateSellerOrderStatus(ctx.user.id, input.sellerOrderId, input.status)),
  sellerTransitionFulfilment: permissionProcedure("seller.order.fulfill_own").input(fulfilmentTransitionSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, input.targetState, input.reason, input.note)),
  sellerAccept: permissionProcedure("seller.order.fulfill_own").input(sellerOrderIdSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, "accepted")),
  sellerStartProcessing: permissionProcedure("seller.order.fulfill_own").input(sellerOrderIdSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, "processing")),
  sellerMarkPacked: permissionProcedure("seller.order.fulfill_own").input(sellerOrderIdSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, "packed")),
  sellerReadyForHandoff: permissionProcedure("seller.order.fulfill_own").input(sellerOrderIdSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, "ready_for_handoff")),
  sellerHandToLogistics: permissionProcedure("seller.order.fulfill_own").input(sellerOrderIdSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, "handed_to_logistics")),
  sellerReject: permissionProcedure("seller.order.fulfill_own").input(sellerOrderCancellationSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, "rejected", input.reason, input.note)),
  sellerCancel: permissionProcedure("seller.order.fulfill_own").input(sellerOrderCancellationSchema).mutation(({ ctx, input }) => transitionSellerFulfilment(ctx.user.id, input.sellerOrderId, "cancelled", input.reason, input.note)),
  sellerFulfilmentHistory: permissionProcedure("seller.order.read_own").input(fulfilmentHistorySchema).query(({ ctx, input }) => getSellerFulfilmentHistory(ctx.user.id, input.sellerOrderId)),
  sellerAddFulfilmentNote: permissionProcedure("seller.order.fulfill_own").input(fulfilmentNoteSchema).mutation(({ ctx, input }) => addSellerFulfilmentNote(ctx.user.id, input.sellerOrderId, input.note)),
  adminSearch: permissionProcedure("order.manage_any").input(adminOrderSearchSchema).query(({ input }) => searchOrders(input)),
  adminFulfilmentList: permissionProcedure("order.manage_any").input(adminOrderSearchSchema).query(({ input }) => listAdminFulfilmentOrders(input)),
  adminFulfilmentHistory: permissionProcedure("order.manage_any").input(fulfilmentHistorySchema).query(({ input }) => getAdminFulfilmentHistory(input.sellerOrderId)),
  adminGet: permissionProcedure("order.manage_any").input(orderIdSchema).query(({ input }) => getAdminOrder(input.orderId)),
  adminSellerGet: permissionProcedure("order.manage_any").input(sellerOrderIdSchema).query(({ input }) => getAdminSellerOrder(input.sellerOrderId)),
});
