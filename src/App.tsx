import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import Index from "@/pages/Index";
import IngredientsPage from "@/pages/IngredientsPage";
import RecipesPage from "@/pages/RecipesPage";
import AlertsPage from "@/pages/AlertsPage";
import BillingPage from "@/pages/BillingPage";
import TablesPage from "@/pages/TablesPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import WastagePage from "@/pages/WastagePage";
import DynamicPricingPage from "@/pages/DynamicPricingPage";
import ActiveOrdersPage from "@/pages/ActiveOrdersPage";
import KitchenDisplayPage from "@/pages/KitchenDisplayPage";
import OrderHistoryPage from "@/pages/OrderHistoryPage";
import EODSummaryPage from "@/pages/EODSummaryPage";
import ProfitabilityPage from "@/pages/ProfitabilityPage";
import BestsellersPage from "@/pages/BestsellersPage";
import AIAssistantPage from "@/pages/AIAssistantPage";
import MultiBranchPage from "@/pages/MultiBranchPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Index />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/tables" element={<TablesPage />} />
                <Route path="/ingredients" element={<IngredientsPage />} />
                <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="/wastage" element={<WastagePage />} />
                <Route path="/dynamic-pricing" element={<DynamicPricingPage />} />
                <Route path="/active-orders" element={<ActiveOrdersPage />} />
                <Route path="/kitchen-display" element={<KitchenDisplayPage />} />
                <Route path="/order-history" element={<OrderHistoryPage />} />
                <Route path="/eod-summary" element={<EODSummaryPage />} />
                <Route path="/profitability" element={<ProfitabilityPage />} />
                <Route path="/bestsellers" element={<BestsellersPage />} />
                <Route path="/recipes" element={<RecipesPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/ai-assistant" element={<AIAssistantPage />} />
                <Route path="/multi-branch" element={<MultiBranchPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
