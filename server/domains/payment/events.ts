import { logger } from "../../logging/logger";
import { enqueueNotificationEvent } from "../notification/service";

export function emitPaymentResult(event: { paymentId: number; userId: number; status: "successful" | "failed" | "cancelled" }) {
  const eventType = event.status === "successful" ? "payment.successful" : "payment.failed";
  logger.info(eventType, { paymentId: event.paymentId, userId: event.userId, status: event.status });
  enqueueNotificationEvent({ eventType, entityType: "payment_attempt", entityId: event.paymentId, eventKey: `${eventType}:payment_attempt:${event.paymentId}`, payload: { paymentId: event.paymentId, customerUserId: event.userId, status: event.status } });
}
