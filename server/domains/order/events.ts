import { logger } from "../../logging/logger";
import { enqueueNotificationEvent } from "../notification/service";

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
  enqueueNotificationEvent({ eventType: "order.created", entityType: "order", entityId: event.orderId, eventKey: `order.created:order:${event.orderId}`, payload: { orderId: event.orderId, orderNumber: event.orderNumber, customerUserId: event.userId } });
  for (const sellerOrderId of event.sellerOrderIds) enqueueNotificationEvent({ eventType: "seller_order.created", entityType: "seller_order", entityId: sellerOrderId, eventKey: `seller_order.created:seller_order:${sellerOrderId}`, payload: { sellerOrderId, orderId: event.orderId, orderNumber: event.orderNumber } });
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
  enqueueNotificationEvent({ eventType: `seller_order.fulfilment.${event.newState}`, entityType: "seller_order", entityId: event.sellerOrderId, eventKey: `seller_order.fulfilment.${event.newState}:seller_order:${event.sellerOrderId}`, payload: { sellerOrderId: event.sellerOrderId, orderId: event.parentOrderId, status: event.newState } });
}
