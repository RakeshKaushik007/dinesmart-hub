import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/useAuth";
import { PosSessionProvider } from "@/hooks/usePosSession";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RequirePosSession from "@/components/auth/RequirePosSession";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import PosStartPage from "@/pages/PosStartPage";
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
import AdminUsersPage from "@/pages/AdminUsersPage";
import AggregatorOrdersPage from "@/pages/AggregatorOrdersPage";
import SettingsPage from "@/pages/SettingsPage";
import KioskPage from "@/pages/KioskPage";
import CustomerOrderPage from "@/pages/public/CustomerOrderPage";
import MenuManagementPage from "@/pages/MenuManagementPage";
import AuditLogPage from "@/pages/AuditLogPage";
import DataImportPage from "@/pages/DataImportPage";
import VoidNCLogPage from "@/pages/VoidNCLogPage";
import IngredientConsumptionPage from "@/pages/IngredientConsumptionPage";
import PaymentMethodsPage from "@/pages/PaymentMethodsPage";
import PendingAggregatorSettlementPage from "@/pages/PendingAggregatorSettlementPage";
import StaffPage from "@/pages/StaffPage";
import RestaurantsPage from "@/pages/RestaurantsPage";
import BranchesPage from "@/pages/BranchesPage";
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
            <PosSessionProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/order/:tableId" element={<CustomerOrderPage />} />
              <Route path="/kiosk" element={<KioskPage />} />

              {/* POS session gate (after login, before POS pages) */}
              <Route path="/pos/start" element={<ProtectedRoute><PosStartPage /></ProtectedRoute>} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              {/* All roles */}
                <Route path="/" element={<Index />} />
                <Route path="/billing" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><RequirePosSession><BillingPage /></RequirePosSession></ProtectedRoute>} />
                <Route path="/tables" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><RequirePosSession><TablesPage /></RequirePosSession></ProtectedRoute>} />
                <Route path="/active-orders" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><RequirePosSession><ActiveOrdersPage /></RequirePosSession></ProtectedRoute>} />
                <Route path="/kitchen-display" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><RequirePosSession><KitchenDisplayPage /></RequirePosSession></ProtectedRoute>} />
                <Route path="/aggregator-orders" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><RequirePosSession><AggregatorOrdersPage /></RequirePosSession></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><AlertsPage /></ProtectedRoute>} />

                {/* Branch Manager+ */}
                <Route path="/ingredients" element={<ProtectedRoute requiredRole="branch_manager"><IngredientsPage /></ProtectedRoute>} />
                <Route path="/purchase-orders" element={<ProtectedRoute requiredRole="branch_manager"><PurchaseOrdersPage /></ProtectedRoute>} />
                <Route path="/wastage" element={<ProtectedRoute requiredRole="branch_manager"><WastagePage /></ProtectedRoute>} />
                <Route path="/order-history" element={<ProtectedRoute requiredRole="branch_manager"><OrderHistoryPage /></ProtectedRoute>} />
                <Route path="/eod-summary" element={<ProtectedRoute requiredRole="branch_manager"><EODSummaryPage /></ProtectedRoute>} />
                <Route path="/bestsellers" element={<ProtectedRoute requiredRole="branch_manager"><BestsellersPage /></ProtectedRoute>} />
                <Route path="/audit-log" element={<ProtectedRoute requiredRole="branch_manager"><AuditLogPage /></ProtectedRoute>} />
                <Route path="/void-nc-log" element={<ProtectedRoute requiredRole="branch_manager"><VoidNCLogPage /></ProtectedRoute>} />
                <Route path="/recipes" element={<ProtectedRoute requiredRole="branch_manager"><RecipesPage /></ProtectedRoute>} />

                {/* Owner+ */}
                <Route path="/dynamic-pricing" element={<ProtectedRoute requiredRole="owner"><DynamicPricingPage /></ProtectedRoute>} />
                <Route path="/branches" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "owner"]}><BranchesPage /></ProtectedRoute>} />
                <Route path="/profitability" element={<ProtectedRoute requiredRole="owner"><ProfitabilityPage /></ProtectedRoute>} />
                <Route path="/ai-assistant" element={<ProtectedRoute requiredRole="owner"><AIAssistantPage /></ProtectedRoute>} />
                <Route path="/multi-branch" element={<ProtectedRoute requiredRole="owner"><MultiBranchPage /></ProtectedRoute>} />
                <Route path="/menu-management" element={<ProtectedRoute requiredRole="owner"><MenuManagementPage /></ProtectedRoute>} />
                <Route path="/data-import" element={<ProtectedRoute requiredRole="owner"><DataImportPage /></ProtectedRoute>} />
                <Route path="/ingredient-consumption" element={<ProtectedRoute requiredRole="owner"><IngredientConsumptionPage /></ProtectedRoute>} />

                {/* Settings - all roles */}
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/payment-methods" element={<ProtectedRoute requiredRole="branch_manager"><PaymentMethodsPage /></ProtectedRoute>} />
                <Route path="/pending-settlements" element={<ProtectedRoute requiredRole="branch_manager"><PendingAggregatorSettlementPage /></ProtectedRoute>} />
                <Route path="/staff" element={<ProtectedRoute requiredRole="branch_manager"><StaffPage /></ProtectedRoute>} />

                {/* Super Admin only */}
                <Route path="/admin/restaurants" element={<ProtectedRoute allowedRoles={["super_admin","admin"]}><RestaurantsPage /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "owner", "branch_manager"]}><AdminUsersPage /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </PosSessionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
