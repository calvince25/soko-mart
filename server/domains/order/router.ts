import { permissionProcedure, protectedProcedure, router } from "../../_core/trpc";
import { adminOrderSearchSchema, orderIdSchema, orderListSchema, sellerOrderIdSchema, updateSellerOrderStatusSchema } from "../../../shared/validation/orderSchemas";
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
  adminSearch: permissionProcedure("order.manage_any").input(adminOrderSearchSchema).query(({ input }) => searchOrders(input)),
  adminGet: permissionProcedure("order.manage_any").input(orderIdSchema).query(({ input }) => getAdminOrder(input.orderId)),
  adminSellerGet: permissionProcedure("order.manage_any").input(sellerOrderIdSchema).query(({ input }) => getAdminSellerOrder(input.sellerOrderId)),
});
