import { protectedProcedure, router } from "../../_core/trpc";
import { addressIdSchema, addressInputSchema, phoneUpdateSchema, profileUpdateSchema } from "../../../shared/validation/schemas";
import { createAddress, deleteAddress, getMyAccount, getMyAddress, listMyAddresses, setDefaultAddress, updateAddress, updateMyPhone, updateMyProfile } from "./service";

export const accountRouter = router({
  get: protectedProcedure.query(({ ctx }) => getMyAccount(ctx.user.id)),
  updateProfile: protectedProcedure.input(profileUpdateSchema).mutation(({ ctx, input }) => updateMyProfile(ctx.user.id, input)),
  updatePhone: protectedProcedure.input(phoneUpdateSchema).mutation(({ ctx, input }) => updateMyPhone(ctx.user.id, input)),
  addresses: router({
    list: protectedProcedure.query(({ ctx }) => listMyAddresses(ctx.user.id)),
    get: protectedProcedure.input(addressIdSchema).query(({ ctx, input }) => getMyAddress(ctx.user.id, input.addressId)),
    create: protectedProcedure.input(addressInputSchema).mutation(({ ctx, input }) => createAddress(ctx.user.id, input)),
    update: protectedProcedure.input(addressIdSchema.merge(addressInputSchema)).mutation(({ ctx, input }) => updateAddress(ctx.user.id, input.addressId, input)),
    delete: protectedProcedure.input(addressIdSchema).mutation(({ ctx, input }) => deleteAddress(ctx.user.id, input.addressId)),
    setDefault: protectedProcedure.input(addressIdSchema).mutation(({ ctx, input }) => setDefaultAddress(ctx.user.id, input.addressId)),
  }),
});
