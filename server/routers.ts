import { router } from "./_core/trpc";
import { identityRouter } from "./domains/identity/router";
import { platformRouter } from "./domains/platform/router";

export const appRouter = router({
  identity: identityRouter,
  // Keep auth as a compatibility alias for the scaffold's existing client contract.
  auth: identityRouter,
  platform: platformRouter,
  // Future domains are intentionally not exposed until their procedures exist.
});

export type AppRouter = typeof appRouter;
