import { logger } from "../../logging/logger";
import { enqueueNotificationEvent } from "../notification/service";

export type WarehouseOperationalEvent = {
  warehouseId: number;
  entityType: "intake" | "package" | "batch";
  entityId: number;
  eventType: string;
  previousState?: string | null;
  newState?: string | null;
};

export function emitWarehouseOperationalEvent(event: WarehouseOperationalEvent) {
  logger.info(event.eventType, event);
  enqueueNotificationEvent({ eventType: event.eventType, entityType: event.entityType, entityId: event.entityId, eventKey: `${event.eventType}:${event.entityType}:${event.entityId}`, payload: { warehouseId: event.warehouseId, status: event.newState ?? event.eventType.split(".").pop() ?? "updated", packageReference: `${event.entityType}-${event.entityId}`, adminAlert: event.eventType.includes("discrepancy") || event.eventType.includes("dispatch") } });
}
