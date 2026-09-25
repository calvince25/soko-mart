import { router } from "./_core/trpc";
import { identityRouter } from "./domains/identity/router";
import { platformRouter } from "./domains/platform/router";
import { accountRouter } from "./domains/account/router";
import { sellerRouter } from "./domains/seller/router";

export const appRouter = router({
  identity: identityRouter,
  // Keep auth as a compatibility alias for the scaffold's existing client contract.
  auth: identityRouter,
  platform: platformRouter,
  account: accountRouter,
  seller: sellerRouter,
  // Future domains are intentionally not exposed until their procedures exist.
});

export type AppRouter = typeof appRouter;
