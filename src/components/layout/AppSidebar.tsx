import { NavLink, useLocation } from "react-router-dom";
import {
  ChefHat,
  AlertTriangle,
  LayoutDashboard,
  Settings,
  Package,
  CreditCard,
  Armchair,
  Truck,
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
} from "lucide-react";
import blennixLogo from "/blennix-logo.png";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/useAuth";

interface NavGroup {
  label: string;
  items: { to: string; icon: any; label: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Overview" },
      { to: "/billing", icon: CreditCard, label: "Billing" },
      { to: "/tables", icon: Armchair, label: "Tables" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { to: "/ingredients", icon: Package, label: "Stock & Alerts" },
      { to: "/purchase-orders", icon: Truck, label: "Purchase Orders" },
      { to: "/wastage", icon: Trash2, label: "Wastage Logs" },
      { to: "/dynamic-pricing", icon: TrendingUp, label: "Dynamic Pricing" },
    ],
  },
  {
    label: "Orders",
    items: [
      { to: "/active-orders", icon: ShoppingBag, label: "Active Orders" },
      { to: "/kitchen-display", icon: ChefHat, label: "Kitchen (KOT)" },
      { to: "/order-history", icon: Clock, label: "Order History" },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/eod-summary", icon: CalendarDays, label: "EOD Summary" },
      { to: "/profitability", icon: Target, label: "Profitability" },
      { to: "/bestsellers", icon: Trophy, label: "Bestsellers" },
    ],
  },
  {
    label: "More",
    items: [
      { to: "/recipes", icon: ChefHat, label: "Recipes" },
      { to: "/alerts", icon: AlertTriangle, label: "Alerts" },
      { to: "/ai-assistant", icon: Bot, label: "AI Assistant" },
      { to: "/multi-branch", icon: Building2, label: "Multi-Branch" },
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
  const { profile, roles, signOut } = useAuth();

  const topRole = roles.length > 0 ? roles[0].role : null;

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
        {navGroups.map((group) => (
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
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all w-full">
          <Settings className="h-4 w-4" />
          Settings
        </button>
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
