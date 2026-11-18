import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { PermissionCode } from "../../shared/permissions/catalog";
import { isAppError } from "../../shared/errors/appError";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const appCode = isAppError(error.cause) ? error.cause.code : error.code === "UNAUTHORIZED" ? "AUTHENTICATION_REQUIRED" : error.code === "FORBIDDEN" ? "FORBIDDEN" : error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code === "CONFLICT" ? "CONFLICT" : error.code === "TOO_MANY_REQUESTS" ? "RATE_LIMITED" : "INTERNAL_ERROR";
    const safeMessage = appCode === "INTERNAL_ERROR" && !isAppError(error.cause) ? "An unexpected error occurred." : shape.message;
    return {
      ...shape,
      message: safeMessage,
      data: {
        ...shape.data,
        appCode,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const permissionProcedure = (permission: PermissionCode) =>
  t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      if (!ctx.permissions?.has(permission)) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${permission}` });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
