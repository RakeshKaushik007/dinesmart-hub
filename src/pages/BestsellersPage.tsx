import { useEffect, useMemo, useState } from "react";
import { Trophy, Clock, TrendingUp, TrendingDown, Loader2, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DishPerformance {
  menuItemId: string;
  rank: number;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  avgPrepTime: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

const minutesBetween = (a: string, b: string) => {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
};

const BestsellersPage = () => {
  const [loading, setLoading] = useState(true);
  const [dishes, setDishes] = useState<DishPerformance[]>([]);
  const [delivery, setDelivery] = useState({
    avgPrepTime: 0,
    avgFulfillTime: 0,
    onTimeRate: 0,
    zomatoAvg: 0,
    swiggyAvg: 0,
    dineInAvg: 0,
    sampleSize: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);

        // Pull completed orders from previous + current week
        const { data: orders, error: ordersErr } = await supabase
          .from("orders")
          .select("id, status, order_source, accepted_at, completed_at, created_at")
          .eq("status", "completed")
          .gte("completed_at", prevWeekStart.toISOString());
        if (ordersErr) throw ordersErr;

        const orderIds = (orders ?? []).map((o) => o.id);
        let items: any[] = [];
        if (orderIds.length) {
          const { data, error } = await supabase
            .from("order_items")
            .select("order_id, menu_item_id, item_name, quantity, total_price, is_void, is_refunded")
            .in("order_id", orderIds);
          if (error) throw error;
          items = data ?? [];
        }

        // Menu metadata
        const { data: menu, error: menuErr } = await supabase
          .from("menu_items")
          .select("id, name, prep_time_minutes, category_id");
        if (menuErr) throw menuErr;
        const { data: cats, error: catsErr } = await supabase
          .from("menu_categories")
          .select("id, name");
        if (catsErr) throw catsErr;
        const catName: Record<string, string> = {};
        (cats ?? []).forEach((c) => (catName[c.id] = c.name));
        const menuMap: Record<string, { name: string; prep: number; category: string }> = {};
        (menu ?? []).forEach((m) => {
          menuMap[m.id] = {
            name: m.name,
            prep: m.prep_time_minutes ?? 0,
            category: m.category_id ? catName[m.category_id] ?? "Uncategorised" : "Uncategorised",
          };
        });

        const orderInWindow = (oid: string, start: Date) => {
          const o = (orders ?? []).find((x) => x.id === oid);
          if (!o?.completed_at) return false;
          return new Date(o.completed_at) >= start;
        };

        // Aggregate per menu item for current and previous week
        type Agg = { units: number; revenue: number };
        const curr: Record<string, Agg> = {};
        const prev: Record<string, Agg> = {};

        items.forEach((it) => {
          if (it.is_void || it.is_refunded || !it.menu_item_id) return;
          const qty = Number(it.quantity) || 0;
          const rev = Number(it.total_price) || 0;
          const isCurr = orderInWindow(it.order_id, weekStart);
          const isPrev = !isCurr && orderInWindow(it.order_id, prevWeekStart);
          const bucket = isCurr ? curr : isPrev ? prev : null;
          if (!bucket) return;
          if (!bucket[it.menu_item_id]) bucket[it.menu_item_id] = { units: 0, revenue: 0 };
          bucket[it.menu_item_id].units += qty;
          bucket[it.menu_item_id].revenue += rev;
        });

        const ranked: DishPerformance[] = Object.entries(curr)
          .map(([id, agg]) => {
            const meta = menuMap[id];
            const prevUnits = prev[id]?.units ?? 0;
            let trend: "up" | "down" | "stable" = "stable";
            let trendPercent = 0;
            if (prevUnits > 0) {
              trendPercent = ((agg.units - prevUnits) / prevUnits) * 100;
              trend = trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "stable";
            } else if (agg.units > 0) {
              trend = "up";
              trendPercent = 100;
            }
            return {
              menuItemId: id,
              rank: 0,
              name: meta?.name ?? "Unknown",
              category: meta?.category ?? "Uncategorised",
              unitsSold: agg.units,
              revenue: agg.revenue,
              avgPrepTime: meta?.prep ?? 0,
              trend,
              trendPercent,
            };
          })
          .sort((a, b) => b.unitsSold - a.unitsSold)
          .slice(0, 4)
          .map((d, i) => ({ ...d, rank: i + 1 }));

        setDishes(ranked);

        // Fulfillment stats from current-week completed orders
        const currOrders = (orders ?? []).filter((o) => o.completed_at && new Date(o.completed_at) >= weekStart);
        let prepSum = 0, prepN = 0, fulfillSum = 0, fulfillN = 0, onTime = 0;
        const platformSums: Record<string, { sum: number; n: number }> = {};
        currOrders.forEach((o) => {
          if (o.accepted_at && o.completed_at) {
            const m = minutesBetween(o.accepted_at, o.completed_at);
            prepSum += m; prepN++;
          }
          if (o.created_at && o.completed_at) {
            const m = minutesBetween(o.created_at, o.completed_at);
            fulfillSum += m; fulfillN++;
            if (m <= 30) onTime++;
            const src = o.order_source ?? "pos";
            if (!platformSums[src]) platformSums[src] = { sum: 0, n: 0 };
            platformSums[src].sum += m;
            platformSums[src].n++;
          }
        });
        const avg = (s: number, n: number) => (n > 0 ? Math.round(s / n) : 0);
        setDelivery({
          avgPrepTime: avg(prepSum, prepN),
          avgFulfillTime: avg(fulfillSum, fulfillN),
          onTimeRate: fulfillN > 0 ? Math.round((onTime / fulfillN) * 100) : 0,
          zomatoAvg: platformSums.zomato ? avg(platformSums.zomato.sum, platformSums.zomato.n) : 0,
          swiggyAvg: platformSums.swiggy ? avg(platformSums.swiggy.sum, platformSums.swiggy.n) : 0,
          dineInAvg: platformSums.pos ? avg(platformSums.pos.sum, platformSums.pos.n) : 0,
          sampleSize: fulfillN,
        });
      } catch (err) {
        console.error("Bestsellers fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const hasData = useMemo(() => dishes.length > 0, [dishes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bestsellers & Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Top dishes and fulfillment analytics from completed orders (last 7 days)</p>
      </div>

      {/* Top dishes */}
      {!hasData ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No completed orders in the last 7 days yet — top dishes will appear here once orders start flowing.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dishes.map((dish) => (
          <div key={dish.rank} className={`rounded-xl border bg-card p-5 ${dish.rank === 1 ? "border-primary/40" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${dish.rank === 1 ? "text-primary" : "text-muted-foreground"}`}>
                #{dish.rank}
              </span>
              {dish.rank === 1 && <Trophy className="h-4 w-4 text-primary" />}
              {dish.trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
              {dish.trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
              {dish.trend === "stable" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <h3 className="text-sm font-semibold text-card-foreground">{dish.name}</h3>
            <p className="text-xs text-muted-foreground">{dish.category}</p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Units Sold</span>
                <span className="font-mono font-semibold text-card-foreground">{dish.unitsSold}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-mono font-semibold text-card-foreground">₹{Math.round(dish.revenue).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg Prep</span>
                <span className="font-mono text-card-foreground">{dish.avgPrepTime || "—"}{dish.avgPrepTime ? " min" : ""}</span>
              </div>
              <div className="flex justify-between text-xs items-center">
                <span className="text-muted-foreground">WoW</span>
                <span className={`font-mono ${dish.trend === "up" ? "text-emerald-600" : dish.trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                  {dish.trendPercent > 0 ? "+" : ""}{dish.trendPercent.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Fulfillment Performance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-card-foreground">Fulfillment Time Performance</h2>
          <span className="ml-auto text-xs text-muted-foreground">{delivery.sampleSize} orders</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Avg Prep Time</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{delivery.avgPrepTime || "—"}{delivery.avgPrepTime ? " min" : ""}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Fulfillment</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{delivery.avgFulfillTime || "—"}{delivery.avgFulfillTime ? " min" : ""}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On-Time (≤30m)</p>
            <p className="text-xl font-bold font-mono text-emerald-600 mt-1">{delivery.sampleSize > 0 ? `${delivery.onTimeRate}%` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Zomato Avg</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{delivery.zomatoAvg || "—"}{delivery.zomatoAvg ? " min" : ""}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Swiggy Avg</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{delivery.swiggyAvg || "—"}{delivery.swiggyAvg ? " min" : ""}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dine-in Avg</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{delivery.dineInAvg || "—"}{delivery.dineInAvg ? " min" : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BestsellersPage;
