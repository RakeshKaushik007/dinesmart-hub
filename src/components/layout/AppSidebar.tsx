import { NavLink, useLocation } from "react-router-dom";
import {
  ChefHat,
  AlertTriangle,
  LayoutDashboard,
  UtensilsCrossed,
  Settings,
  Package,
  CreditCard,
  Armchair,
  Truck,
  ClipboardList,
  Trash2,
  TrendingUp,
  ShoppingBag,
  Clock,
  CalendarDays,
  Target,
  Trophy,
  Bot,
  Building2,
  Sun,
  Moon,
  LogOut,
  Shield,
  Bike,
  FileSpreadsheet,
} from "lucide-react";
import blennixLogo from "/blennix-logo.png";
import { useTheme } from "@/hooks/use-theme";
import { useAuth, AppRole } from "@/hooks/useAuth";

interface NavItem {
  to: string;
  icon: any;
  label: string;
  minRole: AppRole; // minimum role level required
}

interface NavGroup {
  label: string;
  minRole: AppRole;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Dashboard",
    minRole: "employee",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Overview", minRole: "employee" },
    ],
  },
  {
    label: "Operations",
    minRole: "employee",
    items: [
      { to: "/billing", icon: CreditCard, label: "Billing", minRole: "employee" },
      { to: "/tables", icon: Armchair, label: "Tables", minRole: "employee" },
      { to: "/active-orders", icon: ShoppingBag, label: "Active Orders", minRole: "employee" },
      { to: "/kitchen-display", icon: ChefHat, label: "Kitchen Orders", minRole: "employee" },
      { to: "/aggregator-orders", icon: Bike, label: "Online Orders", minRole: "employee" },
    ],
  },
  {
    label: "Reports",
    minRole: "branch_manager",
    items: [
      { to: "/eod-summary", icon: CalendarDays, label: "EOD Summary", minRole: "branch_manager" },
      { to: "/bestsellers", icon: Trophy, label: "Bestsellers", minRole: "branch_manager" },
      { to: "/order-history", icon: Clock, label: "Order History", minRole: "branch_manager" },
    ],
  },
  {
    label: "Monitoring",
    minRole: "branch_manager",
    items: [
      { to: "/audit-log", icon: ClipboardList, label: "Audit Log", minRole: "branch_manager" },
      { to: "/wastage", icon: Trash2, label: "Wastage Logs", minRole: "branch_manager" },
      { to: "/alerts", icon: AlertTriangle, label: "Alerts", minRole: "employee" },
    ],
  },
  {
    label: "Transactions",
    minRole: "branch_manager",
    items: [
      { to: "/void-nc-log", icon: Ban, label: "Voids & NC", minRole: "branch_manager" },
    ],
  },
  {
    label: "Menu",
    minRole: "branch_manager",
    items: [
      { to: "/recipes", icon: ChefHat, label: "Recipes", minRole: "branch_manager" },
      { to: "/menu-management", icon: UtensilsCrossed, label: "Menu Management", minRole: "owner" },
    ],
  },
  {
    label: "Inventory",
    minRole: "branch_manager",
    items: [
      { to: "/ingredients", icon: Package, label: "Stock & Alerts", minRole: "branch_manager" },
      { to: "/purchase-orders", icon: Truck, label: "Purchase Orders", minRole: "branch_manager" },
      { to: "/dynamic-pricing", icon: TrendingUp, label: "Dynamic Pricing", minRole: "owner" },
    ],
  },
  {
    label: "Analytics",
    minRole: "owner",
    items: [
      { to: "/profitability", icon: Target, label: "Profitability", minRole: "owner" },
      { to: "/ai-assistant", icon: Bot, label: "AI Assistant", minRole: "owner" },
      { to: "/multi-branch", icon: Building2, label: "Multi-Branch", minRole: "owner" },
    ],
  },
  {
    label: "System",
    minRole: "owner",
    items: [
      { to: "/data-import", icon: FileSpreadsheet, label: "Data Import", minRole: "owner" },
    ],
  },
  {
    label: "Admin",
    minRole: "super_admin",
    items: [
      { to: "/admin/users", icon: Shield, label: "User Management", minRole: "super_admin" },
    ],
  },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

const roleBadgeColors: Record<string, string> = {
  super_admin: "bg-destructive/20 text-destructive",
  admin: "bg-primary/20 text-primary",
  owner: "bg-accent/20 text-accent-foreground",
  branch_manager: "bg-secondary text-secondary-foreground",
  employee: "bg-muted text-muted-foreground",
};

const AppSidebar = ({ onNavigate }: AppSidebarProps) => {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { profile, roles, signOut, isAtLeast } = useAuth();

  const topRole = roles.length > 0 ? roles[0].role : null;

  // Filter groups and items by role
  const visibleGroups = navGroups
    .filter((group) => isAtLeast(group.minRole))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isAtLeast(item.minRole)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="h-screen w-64 border-r border-border bg-sidebar flex flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <img src={blennixLogo} alt="Blennix Logo" className="h-9 w-9 rounded-lg" />
        <div>
          <h1 className="text-sm font-bold text-sidebar-foreground tracking-tight">Blennix</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">POS System</p>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <p className="text-xs font-medium text-sidebar-foreground truncate">
          {profile?.full_name || profile?.email || "User"}
        </p>
        {topRole && (
          <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${roleBadgeColors[topRole] || "bg-muted text-muted-foreground"}`}>
            <Shield className="h-3 w-3" />
            {topRole.replace("_", " ")}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      isActive
                        ? "bg-sidebar-accent text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all w-full"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <NavLink to="/settings" onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all w-full ${isActive ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-destructive hover:bg-destructive/10 transition-all w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
