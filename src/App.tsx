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
import AdminUsersPage from "@/pages/AdminUsersPage";
import AggregatorOrdersPage from "@/pages/AggregatorOrdersPage";
import SettingsPage from "@/pages/SettingsPage";
import KioskPage from "@/pages/KioskPage";
import CustomerOrderPage from "@/pages/public/CustomerOrderPage";
import MenuManagementPage from "@/pages/MenuManagementPage";
import AuditLogPage from "@/pages/AuditLogPage";
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
              <Route path="/order/:tableId" element={<CustomerOrderPage />} />
              <Route path="/kiosk" element={<KioskPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              {/* All roles */}
                <Route path="/" element={<Index />} />
                <Route path="/billing" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><BillingPage /></ProtectedRoute>} />
                <Route path="/tables" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><TablesPage /></ProtectedRoute>} />
                <Route path="/active-orders" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><ActiveOrdersPage /></ProtectedRoute>} />
                <Route path="/kitchen-display" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><KitchenDisplayPage /></ProtectedRoute>} />
                <Route path="/aggregator-orders" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><AggregatorOrdersPage /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute allowedRoles={["super_admin","admin","owner","branch_manager","employee"]}><AlertsPage /></ProtectedRoute>} />

                {/* Branch Manager+ */}
                <Route path="/ingredients" element={<ProtectedRoute requiredRole="branch_manager"><IngredientsPage /></ProtectedRoute>} />
                <Route path="/purchase-orders" element={<ProtectedRoute requiredRole="branch_manager"><PurchaseOrdersPage /></ProtectedRoute>} />
                <Route path="/wastage" element={<ProtectedRoute requiredRole="branch_manager"><WastagePage /></ProtectedRoute>} />
                <Route path="/order-history" element={<ProtectedRoute requiredRole="branch_manager"><OrderHistoryPage /></ProtectedRoute>} />
                <Route path="/eod-summary" element={<ProtectedRoute requiredRole="branch_manager"><EODSummaryPage /></ProtectedRoute>} />
                <Route path="/bestsellers" element={<ProtectedRoute requiredRole="branch_manager"><BestsellersPage /></ProtectedRoute>} />
                <Route path="/audit-log" element={<ProtectedRoute requiredRole="branch_manager"><AuditLogPage /></ProtectedRoute>} />
                <Route path="/recipes" element={<ProtectedRoute requiredRole="branch_manager"><RecipesPage /></ProtectedRoute>} />

                {/* Owner+ */}
                <Route path="/dynamic-pricing" element={<ProtectedRoute requiredRole="owner"><DynamicPricingPage /></ProtectedRoute>} />
                <Route path="/profitability" element={<ProtectedRoute requiredRole="owner"><ProfitabilityPage /></ProtectedRoute>} />
                <Route path="/ai-assistant" element={<ProtectedRoute requiredRole="owner"><AIAssistantPage /></ProtectedRoute>} />
                <Route path="/multi-branch" element={<ProtectedRoute requiredRole="owner"><MultiBranchPage /></ProtectedRoute>} />
                <Route path="/menu-management" element={<ProtectedRoute requiredRole="owner"><MenuManagementPage /></ProtectedRoute>} />

                {/* Settings - all roles */}
                <Route path="/settings" element={<SettingsPage />} />

                {/* Super Admin only */}
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["super_admin"]}><AdminUsersPage /></ProtectedRoute>} />
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
