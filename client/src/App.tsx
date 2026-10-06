import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Account from "./pages/Account";
import SellerPortal from "./pages/SellerPortal";
import Catalog from "./pages/Catalog";
import Inventory from "./pages/Inventory";
import Orders, { OrderConfirmation } from "./pages/Orders";
import SellerOrders from "./pages/SellerOrders";
import AdminFulfilment from "./pages/AdminFulfilment";
import WarehouseWorkspace from "./pages/WarehouseWorkspace";
import DeliveryWorkspace, { Tracking } from "./pages/Delivery";
import Notifications from "./pages/Notifications";
import NotificationAdmin from "./pages/NotificationAdmin";
import Reviews from "./pages/Reviews";
import ReviewAdmin from "./pages/ReviewAdmin";
import Returns from "./pages/Returns";
import ReturnDetail from "./pages/ReturnDetail";
import ReturnAdmin from "./pages/ReturnAdmin";
import SellerReturns from "./pages/SellerReturns";
import Support from "./pages/Support";
import SupportAdmin from "./pages/SupportAdmin";
import SellerSupport from "./pages/SellerSupport";
import Finance from "./pages/Finance";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/account" component={Account} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:orderId" component={OrderConfirmation} />
      <Route path="/seller" component={SellerPortal} />
      <Route path="/seller/orders" component={SellerOrders} />
      <Route path="/seller/orders/:sellerOrderId" component={SellerOrders} />
      <Route path="/admin/fulfilment" component={AdminFulfilment} />
      <Route path="/admin/fulfilment/:sellerOrderId" component={AdminFulfilment} />
      <Route path="/warehouse" component={WarehouseWorkspace} />
      <Route path="/delivery" component={DeliveryWorkspace} />
      <Route path="/track/:shipmentId" component={Tracking} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/admin/notifications" component={NotificationAdmin} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/admin/reviews" component={ReviewAdmin} />
      <Route path="/returns" component={Returns} />
      <Route path="/returns/:returnId" component={ReturnDetail} />
      <Route path="/admin/returns" component={ReturnAdmin} />
      <Route path="/seller/returns" component={SellerReturns} />
      <Route path="/support" component={Support} />
      <Route path="/support/:ticketId" component={Support} />
      <Route path="/admin/support" component={SupportAdmin} />
      <Route path="/seller/support" component={SellerSupport} />
      <Route path="/seller/finance" component={Finance} />
      <Route path="/seller/catalog" component={Catalog} />
      <Route path="/seller/inventory" component={Inventory} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
