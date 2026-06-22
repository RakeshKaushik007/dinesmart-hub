import { useEffect, useMemo, useState } from "react";
import { Trophy, Clock, TrendingUp, TrendingDown, Loader2, Minus, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  prevUnits: number;
  prevRevenue: number;
}

const minutesBetween = (a: string, b: string) => {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
};

type PresetKey = "7d" | "14d" | "30d" | "90d" | "custom";
const PRESETS: { key: PresetKey; label: string; days?: number }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "14d", label: "Last 14 days", days: 14 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "custom", label: "Custom range" },
];

const BestsellersPage = () => {
  const [loading, setLoading] = useState(true);
  const [dishes, setDishes] = useState<DishPerformance[]>([]);
  const [preset, setPreset] = useState<PresetKey>("7d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [delivery, setDelivery] = useState({
    avgPrepTime: 0,
    avgFulfillTime: 0,
    onTimeRate: 0,
    zomatoAvg: 0,
    swiggyAvg: 0,
    dineInAvg: 0,
    sampleSize: 0,
  });

  const { currStart, currEnd, prevStart, prevEnd, rangeLabel, compareLabel, ready } = useMemo(() => {
    const now = new Date();
    let cStart: Date, cEnd: Date;
    if (preset === "custom") {
      if (!customFrom || !customTo) {
        return { currStart: now, currEnd: now, prevStart: now, prevEnd: now, rangeLabel: "Select a custom range to compare", compareLabel: "", ready: false };
      }
      cStart = new Date(customFrom); cStart.setHours(0, 0, 0, 0);
      cEnd = new Date(customTo); cEnd.setHours(23, 59, 59, 999);
    } else {
      const days = PRESETS.find(p => p.key === preset)?.days ?? 7;
      cEnd = new Date(now);
      cStart = new Date(now);
      cStart.setDate(cStart.getDate() - days);
      cStart.setHours(0, 0, 0, 0);
    }
    const spanMs = cEnd.getTime() - cStart.getTime();
    const pEnd = new Date(cStart.getTime() - 1);
    const pStart = new Date(pEnd.getTime() - spanMs);
    return {
      currStart: cStart,
      currEnd: cEnd,
      prevStart: pStart,
      prevEnd: pEnd,
      rangeLabel: `${format(cStart, "PP")} – ${format(cEnd, "PP")}`,
      compareLabel: `vs ${format(pStart, "PP")} – ${format(pEnd, "PP")}`,
      ready: true,
    };
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    if (!ready) { setLoading(false); setDishes([]); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        // Pull completed orders covering both comparison windows
        const { data: orders, error: ordersErr } = await supabase
          .from("orders")
          .select("id, status, order_source, accepted_at, completed_at, created_at")
          .eq("status", "completed")
          .gte("completed_at", prevStart.toISOString())
          .lte("completed_at", currEnd.toISOString());
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

        const orderInWindow = (oid: string, start: Date, end: Date) => {
          const o = (orders ?? []).find((x) => x.id === oid);
          if (!o?.completed_at) return false;
          const t = new Date(o.completed_at).getTime();
          return t >= start.getTime() && t <= end.getTime();
        };

        // Aggregate per menu item for current and previous week
        type Agg = { units: number; revenue: number };
        const curr: Record<string, Agg> = {};
        const prev: Record<string, Agg> = {};

        items.forEach((it) => {
          if (it.is_void || it.is_refunded || !it.menu_item_id) return;
          const qty = Number(it.quantity) || 0;
          const rev = Number(it.total_price) || 0;
          const isCurr = orderInWindow(it.order_id, currStart, currEnd);
          const isPrev = !isCurr && orderInWindow(it.order_id, prevStart, prevEnd);
          const bucket = isCurr ? curr : isPrev ? prev : null;
          if (!bucket) return;
          if (!bucket[it.menu_item_id]) bucket[it.menu_item_id] = { units: 0, revenue: 0 };
          bucket[it.menu_item_id].units += qty;
          bucket[it.menu_item_id].revenue += rev;
        });

        const allIds = new Set<string>([...Object.keys(curr), ...Object.keys(prev)]);
        const ranked: DishPerformance[] = Array.from(allIds)
          .map((id) => {
            const cAgg = curr[id] ?? { units: 0, revenue: 0 };
            const pAgg = prev[id] ?? { units: 0, revenue: 0 };
            const meta = menuMap[id];
            let trend: "up" | "down" | "stable" = "stable";
            let trendPercent = 0;
            if (pAgg.units > 0) {
              trendPercent = ((cAgg.units - pAgg.units) / pAgg.units) * 100;
              trend = trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "stable";
            } else if (cAgg.units > 0) {
              trend = "up";
              trendPercent = 100;
            } else {
              trend = "down";
              trendPercent = -100;
            }
            return {
              menuItemId: id,
              rank: 0,
              name: meta?.name ?? "Unknown",
              category: meta?.category ?? "Uncategorised",
              unitsSold: cAgg.units,
              revenue: cAgg.revenue,
              avgPrepTime: meta?.prep ?? 0,
              trend,
              trendPercent,
              prevUnits: pAgg.units,
              prevRevenue: pAgg.revenue,
            };
          })
          .sort((a, b) => b.unitsSold - a.unitsSold || b.prevUnits - a.prevUnits)
          .slice(0, 8)
          .map((d, i) => ({ ...d, rank: i + 1 }));

        setDishes(ranked);

        // Fulfillment stats from current-window completed orders
        const currOrders = (orders ?? []).filter((o) => {
          if (!o.completed_at) return false;
          const t = new Date(o.completed_at).getTime();
          return t >= currStart.getTime() && t <= currEnd.getTime();
        });
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
  }, [currStart, currEnd, prevStart, prevEnd, ready]);

  const hasData = useMemo(() => dishes.length > 0, [dishes]);

  const totals = useMemo(() => dishes.reduce(
    (acc, d) => {
      acc.units += d.unitsSold;
      acc.revenue += d.revenue;
      acc.prevUnits += d.prevUnits;
      acc.prevRevenue += d.prevRevenue;
      return acc;
    },
    { units: 0, revenue: 0, prevUnits: 0, prevRevenue: 0 }
  ), [dishes]);

  const pct = (c: number, p: number) => (p === 0 ? (c === 0 ? 0 : 100) : ((c - p) / p) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bestsellers & Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rangeLabel}{compareLabel ? ` · ${compareLabel}` : ""}
        </p>
      </div>

      {/* Comparative date filter */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"} onClick={() => setPreset(p.key)}>
            {p.label}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 ml-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {customFrom ? format(customFrom, "PP") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {customTo ? format(customTo, "PP") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(customFrom || customTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setCustomFrom(undefined); setCustomTo(undefined); }}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {ready && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Units Sold</p>
            <p className="text-2xl font-bold font-mono text-card-foreground mt-1">{totals.units.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Prev: <span className="font-mono">{totals.prevUnits.toLocaleString()}</span>{" "}
              <span className={pct(totals.units, totals.prevUnits) >= 0 ? "text-emerald-600" : "text-destructive"}>
                ({pct(totals.units, totals.prevUnits) >= 0 ? "+" : ""}{pct(totals.units, totals.prevUnits).toFixed(0)}%)
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold font-mono text-card-foreground mt-1">₹{Math.round(totals.revenue).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Prev: <span className="font-mono">₹{Math.round(totals.prevRevenue).toLocaleString()}</span>{" "}
              <span className={pct(totals.revenue, totals.prevRevenue) >= 0 ? "text-emerald-600" : "text-destructive"}>
                ({pct(totals.revenue, totals.prevRevenue) >= 0 ? "+" : ""}{pct(totals.revenue, totals.prevRevenue).toFixed(0)}%)
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Items Tracked</p>
            <p className="text-2xl font-bold font-mono text-card-foreground mt-1">{dishes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Top movers in current window</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <>
      {/* Top dishes */}
      {!hasData ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No completed orders in the selected range — try a wider window.</p>
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
                <span className="text-muted-foreground">vs Prev</span>
                <span className={`font-mono ${dish.trend === "up" ? "text-emerald-600" : dish.trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                  {dish.trendPercent > 0 ? "+" : ""}{dish.trendPercent.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Prev units</span>
                <span className="font-mono">{dish.prevUnits}</span>
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
      </>
      )}
    </div>
  );
};

export default BestsellersPage;
