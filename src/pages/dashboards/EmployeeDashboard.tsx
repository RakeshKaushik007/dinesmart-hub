import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  IndianRupee,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Package,
} from "lucide-react";

interface EmployeeStats {
  todaySales: number;
  openOrders: number;
  completedOrders: number;
  pendingOnlineOrders: number;
  shiftSales: number;
  shiftOrdersHandled: number;
}

interface AlertItem {
  id: string;
  type: string;
  ingredient_name: string;
  message: string;
  created_at: string;
}

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<EmployeeStats>({
    todaySales: 0,
    openOrders: 0,
    completedOrders: 0,
    pendingOnlineOrders: 0,
    shiftSales: 0,
    shiftOrdersHandled: 0,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];
      const todayStart = `${today}T00:00:00`;

      const [ordersRes, alertsRes, shiftRes] = await Promise.all([
        supabase.from("orders").select("id, status, total, order_source, created_at").gte("created_at", todayStart),
        supabase.from("stock_alerts").select("id, type, ingredient_name, message, created_at").eq("resolved", false).order("created_at", { ascending: false }).limit(5),
        user
          ? supabase.from("shifts").select("total_sales, orders_handled").eq("employee_id", user.id).eq("shift_date", today).limit(1)
          : Promise.resolve({ data: [] }),
      ]);

      const orders = ordersRes.data || [];
      const openStatuses = ["new", "accepted", "preparing", "ready"];
      const todaySales = orders.reduce((s, o) => s + Number(o.total), 0);
      const openOrders = orders.filter((o) => openStatuses.includes(o.status)).length;
      const completedOrders = orders.filter((o) => o.status === "completed").length;
      const pendingOnlineOrders = orders.filter(
        (o) => ["swiggy", "zomato"].includes(o.order_source) && o.status === "new"
      ).length;

      const shift = shiftRes.data?.[0];

      setStats({
        todaySales,
        openOrders,
        completedOrders,
        pendingOnlineOrders,
        shiftSales: Number(shift?.total_sales || 0),
        shiftOrdersHandled: Number(shift?.orders_handled || 0),
      });
      setAlerts((alertsRes.data as AlertItem[]) || []);
      setLoading(false);
    };

    fetchData();

    // Real-time order updates
    const channel = supabase
      .channel("employee-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_alerts" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { label: "Today's Sales", value: `₹${stats.todaySales.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    { label: "Open Orders", value: stats.openOrders, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
    { label: "Completed", value: stats.completedOrders, icon: CheckCircle2, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/40" },
    { label: "Pending Online", value: stats.pendingOnlineOrders, icon: ShoppingCart, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40" },
  ];

  const alertTypeStyles: Record<string, string> = {
    out_of_stock: "border-destructive/40 bg-destructive/5",
    low_stock: "border-amber-500/40 bg-amber-500/5",
    expiring: "border-orange-500/40 bg-orange-500/5",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time operational overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <div className={`rounded-lg p-2 ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-card-foreground tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Shift Performance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Current Shift Performance
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Shift Sales</p>
            <p className="text-xl font-bold text-foreground tabular-nums mt-1">₹{stats.shiftSales.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Orders Handled</p>
            <p className="text-xl font-bold text-foreground tabular-nums mt-1">{stats.shiftOrdersHandled}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Active Alerts
        </h2>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No active alerts — all clear!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-3 text-sm ${alertTypeStyles[alert.type] || "border-border"}`}
              >
                <p className="font-medium text-foreground">{alert.ingredient_name}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
