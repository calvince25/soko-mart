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

export type SellerOrderFulfilmentEvent = {
  sellerOrderId: number;
  parentOrderId: number;
  previousState: string;
  newState: string;
  actorUserId: number;
  reason?: string;
};

export function emitSellerOrderFulfilmentEvent(event: SellerOrderFulfilmentEvent) {
  logger.info(`seller_order.${event.newState}`, event);
}
