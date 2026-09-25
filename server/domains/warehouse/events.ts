import { logger } from "../../logging/logger";

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
}
