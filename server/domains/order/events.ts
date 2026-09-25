import { logger } from "../../logging/logger";

export type OrderCreatedEvent = {
  orderId: number;
  orderNumber: string;
  userId: number;
  paymentAttemptId: number;
  sellerOrderIds: number[];
};

export function emitOrderCreated(event: OrderCreatedEvent) {
  logger.info("order.created", { ...event, sellerOrderIds: event.sellerOrderIds.join(",") });
  logger.info("order.confirmed", { orderId: event.orderId, orderNumber: event.orderNumber, userId: event.userId });
}
