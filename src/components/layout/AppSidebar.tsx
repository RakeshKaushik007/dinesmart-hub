import { NavLink, useLocation } from "react-router-dom";
import {
  ChefHat,
  AlertTriangle,
  LayoutDashboard,
  Settings,
  Package,
} from "lucide-react";
import blennixLogo from "/blennix-logo.png";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/ingredients", icon: Package, label: "Ingredients" },
  { to: "/recipes", icon: ChefHat, label: "Recipes" },
  { to: "/alerts", icon: AlertTriangle, label: "Alerts" },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar flex flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <img src={blennixLogo} alt="Blennix Logo" className="h-9 w-9 rounded-lg" />
        <div>
          <h1 className="text-sm font-bold text-sidebar-foreground tracking-tight">Blennix</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">POS System</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all w-full">
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
