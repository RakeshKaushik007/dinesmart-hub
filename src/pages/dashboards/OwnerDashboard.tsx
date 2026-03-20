import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Percent,
  Package,
  AlertTriangle,
  Loader2,
  BarChart3,
  Target,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
];

interface DaySummary {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

const OwnerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [foodCostPct, setFoodCostPct] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState<DaySummary[]>([]);
  const [revenueByType, setRevenueByType] = useState<{ name: string; value: number }[]>([]);
  const [stockValuation, setStockValuation] = useState(0);
  const [marginItems, setMarginItems] = useState<{ name: string; margin: number; revenue: number }[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<string[]>([]);
  const [wastageToday, setWastageToday] = useState(0);
  const [tableMetrics, setTableMetrics] = useState({ avgOccupancy: 0, revenuePerTable: 0, totalTables: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [summariesRes, ordersRes, ingredientsRes, menuItemsRes, wastageRes, tablesRes, sessionsRes] = await Promise.all([
        supabase.from("daily_summaries").select("*").gte("summary_date", weekAgo.toISOString().split("T")[0]).order("summary_date", { ascending: true }),
        supabase.from("orders").select("id, total, order_type, status, created_at").gte("created_at", `${todayStr}T00:00:00`),
        supabase.from("ingredients").select("name, current_stock, cost_per_unit"),
        supabase.from("menu_items").select("name, selling_price, cost_price").eq("is_active", true),
        supabase.from("wastage_logs").select("cost").gte("created_at", `${todayStr}T00:00:00`),
        supabase.from("restaurant_tables").select("id").eq("is_active", true),
        supabase.from("table_sessions").select("table_id, seated_at, cleared_at").gte("seated_at", `${todayStr}T00:00:00`),
      ]);

      const summaries = summariesRes.data || [];
      const todayOrders = (ordersRes.data || []).filter((o) => o.status !== "cancelled");

      // Today's revenue
      const todayRev = todayOrders.reduce((s, o) => s + Number(o.total), 0);
      setTodayRevenue(todayRev);

      // Yesterday from summaries
      const yesterdaySummary = summaries.find((s) => s.summary_date === yesterdayStr);
      setYesterdayRevenue(Number(yesterdaySummary?.total_revenue || 0));

      // Revenue trend from summaries + today live
      const trend: DaySummary[] = summaries.map((s) => ({
        date: new Date(s.summary_date).toLocaleDateString("en-IN", { weekday: "short" }),
        revenue: Number(s.total_revenue || 0),
        cost: Number(s.total_cost || 0),
        profit: Number(s.gross_profit || 0),
      }));
      // Add today live
      trend.push({ date: "Today", revenue: todayRev, cost: 0, profit: 0 });
      setRevenueTrend(trend);

      // Today's profit & food cost
      const todaySummary = summaries.find((s) => s.summary_date === todayStr);
      setTodayProfit(Number(todaySummary?.gross_profit || 0));
      setFoodCostPct(todayRev > 0 ? (Number(todaySummary?.total_cost || 0) / todayRev) * 100 : 0);

      // Revenue by type
      const typeMap: Record<string, number> = {};
      todayOrders.forEach((o) => {
        const t = o.order_type === "dine_in" ? "Dine-in" : o.order_type === "takeaway" ? "Takeaway" : "Online";
        typeMap[t] = (typeMap[t] || 0) + Number(o.total);
      });
      setRevenueByType(Object.entries(typeMap).map(([name, value]) => ({ name, value: Math.round(value) })));

      // Stock valuation
      const ingredients = ingredientsRes.data || [];
      setStockValuation(ingredients.reduce((s, i) => s + Number(i.current_stock) * Number(i.cost_per_unit), 0));

      // Item margins
      const menuItems = menuItemsRes.data || [];
      const margins = menuItems
        .map((item) => ({
          name: item.name,
          margin: Number(item.selling_price) > 0 ? ((Number(item.selling_price) - Number(item.cost_price)) / Number(item.selling_price)) * 100 : 0,
          revenue: Number(item.selling_price),
        }))
        .sort((a, b) => b.margin - a.margin);
      setMarginItems(margins);

      // Wastage today
      setWastageToday((wastageRes.data || []).reduce((s, w) => s + Number(w.cost), 0));

      // Table metrics
      const totalTables = (tablesRes.data || []).length;
      const sessions = sessionsRes.data || [];
      const occupiedTables = new Set(sessions.map((s) => s.table_id)).size;
      const revenuePerTable = totalTables > 0 ? todayRev / totalTables : 0;
      setTableMetrics({
        avgOccupancy: totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0,
        revenuePerTable: Math.round(revenuePerTable),
        totalTables,
      });

      // Risk alerts
      const alerts: string[] = [];
      if (foodCostPct > 35) alerts.push("Food cost % is above 35% — review pricing or portions");
      if (wastageToday > 500) alerts.push("High wastage today — investigate kitchen processes");
      const revenueGrowth = yesterdayRevenue > 0 ? ((todayRev - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
      if (revenueGrowth < -20) alerts.push(`Revenue dropped ${Math.abs(revenueGrowth).toFixed(0)}% vs yesterday`);
      setRiskAlerts(alerts);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const revenueGrowth = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Owner Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Strategic business intelligence</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Today's Revenue",
            value: `₹${todayRevenue.toLocaleString("en-IN")}`,
            sub: revenueGrowth >= 0 ? `+${revenueGrowth.toFixed(1)}% vs yesterday` : `${revenueGrowth.toFixed(1)}% vs yesterday`,
            icon: IndianRupee,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-950/40",
          },
          {
            label: "Gross Profit",
            value: `₹${todayProfit.toLocaleString("en-IN")}`,
            sub: todayRevenue > 0 ? `${((todayProfit / todayRevenue) * 100).toFixed(1)}% margin` : "—",
            icon: TrendingUp,
            color: "text-sky-600 dark:text-sky-400",
            bg: "bg-sky-50 dark:bg-sky-950/40",
          },
          {
            label: "Food Cost %",
            value: `${foodCostPct.toFixed(1)}%`,
            sub: foodCostPct > 35 ? "⚠ Above target" : "Within target",
            icon: Percent,
            color: foodCostPct > 35 ? "text-rose-600 dark:text-rose-400" : "text-violet-600 dark:text-violet-400",
            bg: foodCostPct > 35 ? "bg-rose-50 dark:bg-rose-950/40" : "bg-violet-50 dark:bg-violet-950/40",
          },
          {
            label: "Stock Valuation",
            value: `₹${Math.round(stockValuation).toLocaleString("en-IN")}`,
            sub: `Wastage: ₹${Math.round(wastageToday).toLocaleString("en-IN")}`,
            icon: Package,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-950/40",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <div className={`rounded-lg p-2 ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-card-foreground tabular-nums">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Trend + Revenue by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Revenue Trend (7 Days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Revenue Split</h2>
          <div className="h-64 flex items-center">
            {revenueByType.length === 0 ? (
              <p className="text-sm text-muted-foreground mx-auto">No orders today</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueByType} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {revenueByType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Table Capacity + Item Margins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capacity Analytics */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Capacity Analytics
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tables</p>
              <p className="text-xl font-bold text-foreground tabular-nums mt-1">{tableMetrics.totalTables}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Occupancy</p>
              <p className="text-xl font-bold text-foreground tabular-nums mt-1">{tableMetrics.avgOccupancy.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Rev/Table</p>
              <p className="text-xl font-bold text-foreground tabular-nums mt-1">₹{tableMetrics.revenuePerTable.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>

        {/* Item Margins */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Item Margins
          </h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {marginItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No menu items</p>
            ) : (
              <>
                {marginItems.slice(0, 3).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate mr-2">{item.name}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">{item.margin.toFixed(1)}%</span>
                  </div>
                ))}
                {marginItems.length > 3 && (
                  <div className="border-t border-border pt-2 mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Lowest margins:</p>
                    {marginItems.slice(-3).reverse().map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate mr-2">{item.name}</span>
                        <span className="text-rose-600 dark:text-rose-400 tabular-nums font-medium">{item.margin.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Risk Alerts
          </h2>
          <div className="space-y-2">
            {riskAlerts.map((alert, i) => (
              <p key={i} className="text-sm text-foreground">• {alert}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;
