import { router } from "./_core/trpc";
import { identityRouter } from "./domains/identity/router";
import { platformRouter } from "./domains/platform/router";
import { accountRouter } from "./domains/account/router";
import { sellerRouter } from "./domains/seller/router";
import { catalogRouter } from "./domains/catalog/router";
import { inventoryRouter } from "./domains/inventory/router";
import { commerceRouter } from "./domains/commerce/router";
import { deliveryRouter } from "./domains/delivery/router";
import { notificationRouter } from "./domains/notification/router";
import { reviewRouter } from "./domains/review/router";

export const appRouter = router({
  identity: identityRouter,
  // Keep auth as a compatibility alias for the scaffold's existing client contract.
  auth: identityRouter,
  platform: platformRouter,
  account: accountRouter,
  seller: sellerRouter,
  catalog: catalogRouter,
  inventory: inventoryRouter,
  commerce: commerceRouter,
  delivery: deliveryRouter,
  notification: notificationRouter,
  review: reviewRouter,
});

export type AppRouter = typeof appRouter;
