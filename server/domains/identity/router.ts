import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../../_core/trpc";
import { revokeAllUserSessions, revokeSessionByToken } from "../../auth/sessionService";
import { getUserPermissionCodes } from "../../permissions/authorization";
import { parse as parseCookieHeader } from "cookie";

function clearSession(ctx: { req: any; res: any }) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
}

async function revokeCurrentSession(req: any) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (token) await revokeSessionByToken(token);
}

export const identityRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await revokeCurrentSession(ctx.req);
    clearSession(ctx);
    return { success: true } as const;
  }),

  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    await revokeAllUserSessions(ctx.user.id);
    clearSession(ctx);
    return { success: true } as const;
  }),

  permissions: protectedProcedure.query(async ({ ctx }) => ({
    codes: Array.from(await getUserPermissionCodes(ctx.user.id)).sort(),
  })),
});
