import { permissionProcedure, router } from "../../_core/trpc";
import { assignShipmentSchema, courierCreateSchema, courierIdSchema, courierShipmentListSchema, courierStatusSchema, deliveryAttemptSchema, shipmentCreateSchema, shipmentEventListSchema, shipmentIdSchema, shipmentListSchema, transitionShipmentSchema } from "../../../shared/validation/deliverySchemas";
import { assignShipment, confirmPickup, createCourier, createShipment, getShipment, issueDeliveryOtp, listCouriers, listShipments, markInTransit, markOutForDelivery, recordDeliveryAttempt, setCourierStatus } from "./service";
const read = permissionProcedure("logistics.shipment.read");
const update = permissionProcedure("logistics.shipment.update");
const manageCouriers = permissionProcedure("logistics.courier.manage");
const assign = permissionProcedure("logistics.shipment.assign");
const deliver = permissionProcedure("logistics.shipment.deliver");
const admin = (role: string) => role === "admin";
export const deliveryRouter = router({
  couriers: read.query(({ ctx }) => listCouriers(ctx.user.id, admin(ctx.user.role))),
  createCourier: manageCouriers.input(courierCreateSchema).mutation(({ ctx, input }) => createCourier(ctx.user.id, input, admin(ctx.user.role))),
  setCourierStatus: manageCouriers.input(courierStatusSchema).mutation(({ ctx, input }) => setCourierStatus(ctx.user.id, input, admin(ctx.user.role))),
  createShipment: assign.input(shipmentCreateSchema).mutation(({ ctx, input }) => createShipment(ctx.user.id, input.packageId, admin(ctx.user.role))),
  assignShipment: assign.input(assignShipmentSchema).mutation(({ ctx, input }) => assignShipment(ctx.user.id, input, admin(ctx.user.role))),
  list: read.input(shipmentListSchema).query(({ ctx, input }) => listShipments(ctx.user.id, input, admin(ctx.user.role))),
  get: read.input(shipmentIdSchema).query(({ ctx, input }) => getShipment(ctx.user.id, input.shipmentId, admin(ctx.user.role))),
  pickup: deliver.input(transitionShipmentSchema).mutation(({ ctx, input }) => confirmPickup(ctx.user.id, input.shipmentId, input.note, admin(ctx.user.role))),
  inTransit: deliver.input(transitionShipmentSchema).mutation(({ ctx, input }) => markInTransit(ctx.user.id, input.shipmentId, input.note, admin(ctx.user.role))),
  outForDelivery: deliver.input(transitionShipmentSchema).mutation(({ ctx, input }) => markOutForDelivery(ctx.user.id, input.shipmentId, input.note, admin(ctx.user.role))),
  issueOtp: read.input(shipmentIdSchema).mutation(({ ctx, input }) => issueDeliveryOtp(ctx.user.id, input.shipmentId)),
  attempt: deliver.input(deliveryAttemptSchema).mutation(({ ctx, input }) => recordDeliveryAttempt(ctx.user.id, input, admin(ctx.user.role))),
});
