import { adminProcedure, permissionProcedure, publicProcedure, router } from "../../_core/trpc";
import { adjustmentInputSchema, availabilityInputSchema, inventoryQuerySchema, locationIdSchema, locationInputSchema, reservationConversionSchema, reservationIdSchema, reservationInputSchema, reservationReleaseSchema, stockInputSchema, updateLocationSchema } from "../../../shared/validation/inventorySchemas";
import * as service from "./service";

export const inventoryRouter = router({
  availability: publicProcedure.input(availabilityInputSchema).query(({ input }) => service.publicAvailability(input.variantId)),
  locations: router({
    list: permissionProcedure("inventory.manage_locations").query(({ ctx }) => service.listSellerLocations({ id: ctx.user.id, role: ctx.user.role })),
    create: permissionProcedure("inventory.manage_locations").input(locationInputSchema).mutation(({ ctx, input }) => service.createSellerLocation({ id: ctx.user.id, role: ctx.user.role }, input)),
    update: permissionProcedure("inventory.manage_locations").input(updateLocationSchema).mutation(({ ctx, input }) => service.updateSellerLocation({ id: ctx.user.id, role: ctx.user.role }, input)),
    archive: permissionProcedure("inventory.manage_locations").input(locationIdSchema).mutation(({ ctx, input }) => service.archiveSellerLocation({ id: ctx.user.id, role: ctx.user.role }, input.id)),
  }),
  seller: router({
    list: permissionProcedure("inventory.view").input(inventoryQuerySchema).query(({ ctx, input }) => service.listInventory({ id: ctx.user.id, role: ctx.user.role }, input?.variantId, input?.locationId)),
    addInitialStock: permissionProcedure("inventory.manage").input(stockInputSchema).mutation(({ ctx, input }) => service.addInitialStock({ id: ctx.user.id, role: ctx.user.role }, input)),
    adjustStock: permissionProcedure("inventory.adjust").input(adjustmentInputSchema).mutation(({ ctx, input }) => service.adjustStock({ id: ctx.user.id, role: ctx.user.role }, input)),
    movements: permissionProcedure("inventory.view_movements").input(inventoryQuerySchema).query(({ ctx, input }) => service.listMovements({ id: ctx.user.id, role: ctx.user.role }, input)),
    reservations: router({
      list: permissionProcedure("inventory.view").query(({ ctx }) => service.listReservations({ id: ctx.user.id, role: ctx.user.role })),
      create: permissionProcedure("inventory.reserve").input(reservationInputSchema).mutation(({ ctx, input }) => service.createReservation({ id: ctx.user.id, role: ctx.user.role }, input)),
      release: permissionProcedure("inventory.release").input(reservationReleaseSchema).mutation(({ ctx, input }) => service.releaseReservation({ id: ctx.user.id, role: ctx.user.role }, input)),
      convert: permissionProcedure("inventory.reserve").input(reservationConversionSchema).mutation(({ ctx, input }) => service.convertReservation({ id: ctx.user.id, role: ctx.user.role }, input)),
    }),
    reconcile: permissionProcedure("inventory.reconcile").query(({ ctx }) => service.reconcileInventory({ id: ctx.user.id, role: ctx.user.role })),
  }),
  admin: router({
    locations: router({
      create: adminProcedure.input(locationInputSchema).mutation(({ ctx, input }) => service.createPlatformLocation({ id: ctx.user.id, role: ctx.user.role }, input)),
    }),
    list: adminProcedure.input(inventoryQuerySchema).query(({ ctx, input }) => service.listInventory({ id: ctx.user.id, role: ctx.user.role }, input?.variantId, input?.locationId)),
    reconcile: adminProcedure.query(({ ctx }) => service.reconcileInventory({ id: ctx.user.id, role: ctx.user.role })),
    expireReservations: adminProcedure.mutation(() => service.expireDueReservations()),
  }),
});
