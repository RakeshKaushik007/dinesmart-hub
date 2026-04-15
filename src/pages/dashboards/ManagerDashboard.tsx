import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertTriangle,
  Loader2,
  CreditCard,
  Smartphone,
  Banknote,
  XCircle,
} from "lucide-react";
import {
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

const PIE_COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

interface HourlyData {
  hour: string;
  sales: number;
  orders: number;
}

const DIRECT_MODES = ["cash", "upi", "card"];
const AGGREGATOR_MODES = ["zomato_pay", "swiggy_dineout", "easydiner"];

const ManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [cancellations, setCancellations] = useState(0);
  const [directRevenue, setDirectRevenue] = useState(0);
  const [aggregatorRevenue, setAggregatorRevenue] = useState(0);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [paymentData, setPaymentData] = useState<{ name: string; value: number }[]>([]);
  const [orderTypeData, setOrderTypeData] = useState<{ name: string; value: number }[]>([]);
  const [platformData, setPlatformData] = useState<{ name: string; revenue: number; cancellations: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<{ name: string; current_stock: number; unit: string; min_threshold: number }[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [bottomItems, setBottomItems] = useState<{ name: string; qty: number; revenue: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];
      const todayStart = `${today}T00:00:00`;

      const [ordersRes, itemsRes, ingredientsRes] = await Promise.all([
        supabase.from("orders").select("id, status, total, order_source, order_type, payment_mode, created_at").gte("created_at", todayStart),
        supabase.from("order_items").select("item_name, quantity, total_price, order_id, created_at").gte("created_at", todayStart),
        supabase.from("ingredients").select("name, current_stock, unit, min_threshold, status").in("status", ["low", "out"]),
      ]);

      const orders = ordersRes.data || [];
      const items = itemsRes.data || [];
      const completedOrders = orders.filter((o) => o.status !== "cancelled");
      const cancelled = orders.filter((o) => o.status === "cancelled");

      // KPIs
      const total = completedOrders.reduce((s, o) => s + Number(o.total), 0);
      setTotalSales(total);
      setOrderCount(completedOrders.length);
      setAvgOrderValue(completedOrders.length > 0 ? total / completedOrders.length : 0);
      // Direct vs Aggregator revenue
      const direct = completedOrders
        .filter((o) => DIRECT_MODES.includes(o.payment_mode))
        .reduce((s, o) => s + Number(o.total), 0);
      const agg = completedOrders
        .filter((o) => AGGREGATOR_MODES.includes(o.payment_mode))
        .reduce((s, o) => s + Number(o.total), 0);
      setDirectRevenue(direct);
      setAggregatorRevenue(agg);


      // Hourly distribution
      const hourMap: Record<number, { sales: number; orders: number }> = {};
      for (let h = 8; h <= 23; h++) hourMap[h] = { sales: 0, orders: 0 };
      completedOrders.forEach((o) => {
        const h = new Date(o.created_at).getHours();
        if (hourMap[h]) {
          hourMap[h].sales += Number(o.total);
          hourMap[h].orders += 1;
        }
      });
      setHourlyData(
        Object.entries(hourMap).map(([h, d]) => ({
          hour: `${String(h).padStart(2, "0")}:00`,
          sales: Math.round(d.sales),
          orders: d.orders,
        }))
      );

      // Payment mode breakdown
      const payMap: Record<string, number> = {};
      completedOrders.forEach((o) => {
        const mode = o.payment_mode || "pending";
        payMap[mode] = (payMap[mode] || 0) + Number(o.total);
      });
      setPaymentData(Object.entries(payMap).map(([name, value]) => ({ name: name.toUpperCase(), value: Math.round(value) })));

      // Order type breakdown
      const typeMap: Record<string, number> = {};
      completedOrders.forEach((o) => {
        const t = o.order_type.replace("_", " ");
        typeMap[t] = (typeMap[t] || 0) + 1;
      });
      setOrderTypeData(Object.entries(typeMap).map(([name, value]) => ({ name, value })));

      // Platform breakdown
      const swiggyOrders = orders.filter((o) => o.order_source === "swiggy");
      const zomatoOrders = orders.filter((o) => o.order_source === "zomato");
      setPlatformData([
        {
          name: "Swiggy",
          revenue: swiggyOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0),
          cancellations: swiggyOrders.filter((o) => o.status === "cancelled").length,
        },
        {
          name: "Zomato",
          revenue: zomatoOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0),
          cancellations: zomatoOrders.filter((o) => o.status === "cancelled").length,
        },
      ]);

      // Top & bottom items
      const itemAgg: Record<string, { qty: number; revenue: number }> = {};
      items.forEach((i) => {
        const name = i.item_name;
        if (!itemAgg[name]) itemAgg[name] = { qty: 0, revenue: 0 };
        itemAgg[name].qty += i.quantity;
        itemAgg[name].revenue += Number(i.total_price);
      });
      const sorted = Object.entries(itemAgg)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.qty - a.qty);
      setTopItems(sorted.slice(0, 5));
      setBottomItems(sorted.slice(-5).reverse());

      // Low stock
      setLowStockItems(
        (ingredientsRes.data || []).map((i) => ({
          name: i.name,
          current_stock: Number(i.current_stock),
          unit: i.unit,
          min_threshold: Number(i.min_threshold),
        }))
      );

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

  const peakHour = hourlyData.reduce((max, d) => (d.sales > max.sales ? d : max), hourlyData[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Daily control & monitoring</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Sales", value: `₹${totalSales.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
          { label: "Orders", value: orderCount, icon: ShoppingCart, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/40" },
          { label: "Avg Order", value: `₹${Math.round(avgOrderValue).toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40" },
          { label: "Peak Hour", value: peakHour?.hour || "--", icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
          { label: "Cancellations", value: cancellations, icon: XCircle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40" },
        ].map((kpi) => (
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

      {/* Revenue Settlement Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/40">
              <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Direct Revenue</p>
              <p className="text-sm text-muted-foreground">Cash, UPI, Card — in your account</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">₹{directRevenue.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-950/40">
              <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Aggregator Pending</p>
              <p className="text-sm text-muted-foreground">Zomato Pay, Swiggy Dineout, EazyDiner</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">₹{aggregatorRevenue.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Sales */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Hourly Sales Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Sales"]}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Payment Mode Breakdown</h2>
          <div className="h-64 flex items-center">
            {paymentData.length === 0 ? (
              <p className="text-sm text-muted-foreground mx-auto">No orders yet today</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Order Type + Platform */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Type Split */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Order Type Split</h2>
          <div className="space-y-3">
            {orderTypeData.map((d) => {
              const total = orderTypeData.reduce((s, x) => s + x.value, 0);
              const pct = total > 0 ? (d.value / total) * 100 : 0;
              return (
                <div key={d.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-foreground">{d.name}</span>
                    <span className="text-muted-foreground tabular-nums">{d.value} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {orderTypeData.length === 0 && <p className="text-sm text-muted-foreground">No orders yet today</p>}
          </div>
        </div>

        {/* Platform Revenue */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Platform Performance</h2>
          <div className="space-y-4">
            {platformData.map((p) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Revenue today</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground tabular-nums">₹{p.revenue.toLocaleString("en-IN")}</p>
                  {p.cancellations > 0 && (
                    <p className="text-xs text-destructive">{p.cancellations} cancelled</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top / Bottom Items + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">🔥 Top 5 Items</h2>
          <div className="space-y-2">
            {topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              topItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground"><span className="text-muted-foreground mr-2">{i + 1}.</span>{item.name}</span>
                  <span className="tabular-nums text-muted-foreground">{item.qty} sold</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">📉 Bottom 5 Items</h2>
          <div className="space-y-2">
            {bottomItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              bottomItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground"><span className="text-muted-foreground mr-2">{i + 1}.</span>{item.name}</span>
                  <span className="tabular-nums text-muted-foreground">{item.qty} sold</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock
          </h2>
          <div className="space-y-2">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">All stock levels normal</p>
            ) : (
              lowStockItems.slice(0, 8).map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{item.name}</span>
                  <span className={`tabular-nums ${item.current_stock <= 0 ? "text-destructive font-medium" : "text-amber-600 dark:text-amber-400"}`}>
                    {item.current_stock} {item.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
