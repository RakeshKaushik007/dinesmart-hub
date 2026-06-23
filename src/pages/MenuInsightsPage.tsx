import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Sparkles, AlertTriangle, Trophy, Lightbulb, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Quadrant = "promote" | "reprice" | "top" | "under";

interface ItemPerf {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  totalProfit: number;
  marginPct: number;
  quadrant: Quadrant;
  wowRevenuePct: number | null;
}

const quadrantMeta: Record<Quadrant, { title: string; subtitle: string; advice: string; Icon: any; accent: string; ring: string; bg: string }> = {
  top: {
    title: "Top Performers",
    subtitle: "High Sales · High Profit",
    advice: "Protect these stars — keep them in stock at all times, feature them on menu covers, and avoid discounting.",
    Icon: Trophy,
    accent: "text-emerald-600",
    ring: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
  },
  promote: {
    title: "Promote These",
    subtitle: "Low Sales · High Profit",
    advice: "Hidden gems. Upsell at billing, add combos, highlight on the menu, and train staff to recommend.",
    Icon: Sparkles,
    accent: "text-primary",
    ring: "border-primary/30",
    bg: "bg-primary/5",
  },
  reprice: {
    title: "Reprice / Redesign",
    subtitle: "High Sales · Low Profit",
    advice: "Volume drivers eroding profit. Raise price slightly, rework portion size, or swap costly ingredients.",
    Icon: AlertTriangle,
    accent: "text-amber-600",
    ring: "border-amber-500/30",
    bg: "bg-amber-500/5",
  },
  under: {
    title: "Underperformers",
    subtitle: "Low Sales · Low Profit",
    advice: "Dead weight on the menu. Consider removing, replacing, or running a final clearance.",
    Icon: TrendingDown,
    accent: "text-destructive",
    ring: "border-destructive/30",
    bg: "bg-destructive/5",
  },
};

const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const MenuInsightsPage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemPerf[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);

        const [{ data: menu }, { data: cats }, { data: orders }] = await Promise.all([
          supabase.from("menu_items").select("id,name,category_id,selling_price,cost_price,is_active"),
          supabase.from("menu_categories").select("id,name"),
          supabase.from("orders").select("id,completed_at").eq("status", "completed").gte("completed_at", since30.toISOString()),
        ]);

        const catName: Record<string, string> = {};
        (cats ?? []).forEach((c) => (catName[c.id] = c.name));

        const orderMap: Record<string, string> = {};
        (orders ?? []).forEach((o) => { orderMap[o.id] = o.completed_at; });

        const orderIds = (orders ?? []).map((o) => o.id);
        let oi: any[] = [];
        if (orderIds.length) {
          const { data } = await supabase
            .from("order_items")
            .select("menu_item_id,quantity,total_price,is_void,is_refunded,order_id")
            .in("order_id", orderIds);
          oi = data ?? [];
        }

        const sold: Record<string, number> = {};
        const currRev: Record<string, number> = {};
        const prevRev: Record<string, number> = {};

        const currStart = new Date();
        currStart.setDate(currStart.getDate() - 7);
        const prevStart = new Date();
        prevStart.setDate(prevStart.getDate() - 14);

        oi.forEach((it) => {
          if (it.is_void || it.is_refunded || !it.menu_item_id) return;
          const qty = Number(it.quantity) || 0;
          sold[it.menu_item_id] = (sold[it.menu_item_id] || 0) + qty;

          const completedAt = orderMap[it.order_id];
          if (!completedAt) return;
          const d = new Date(completedAt);
          const rev = Number(it.total_price) || 0;
          if (d >= currStart) {
            currRev[it.menu_item_id] = (currRev[it.menu_item_id] || 0) + rev;
          } else if (d >= prevStart) {
            prevRev[it.menu_item_id] = (prevRev[it.menu_item_id] || 0) + rev;
          }
        });

        const base: Omit<ItemPerf, "quadrant">[] = (menu ?? [])
          .filter((m) => m.is_active !== false)
          .map((m) => {
            const sell = Number(m.selling_price) || 0;
            const cost = Number(m.cost_price) || 0;
            const unitsSold = sold[m.id] || 0;
            const profitPerUnit = sell - cost;
            const cRev = currRev[m.id] || 0;
            const pRev = prevRev[m.id] || 0;
            let wowRevenuePct: number | null = null;
            if (pRev > 0) {
              wowRevenuePct = ((cRev - pRev) / pRev) * 100;
            } else if (cRev > 0) {
              wowRevenuePct = Infinity;
            }
            return {
              id: m.id,
              name: m.name,
              category: m.category_id ? catName[m.category_id] ?? "Uncategorised" : "Uncategorised",
              unitsSold,
              totalProfit: profitPerUnit * unitsSold,
              marginPct: sell > 0 ? (profitPerUnit / sell) * 100 : 0,
              wowRevenuePct,
            };
          });

        const salesMedian = median(base.map((b) => b.unitsSold));
        const marginMedian = median(base.map((b) => b.marginPct));

        const classified: ItemPerf[] = base.map((b) => {
          const highSales = b.unitsSold > salesMedian;
          const highMargin = b.marginPct > marginMedian;
          let quadrant: Quadrant;
          if (highSales && highMargin) quadrant = "top";
          else if (!highSales && highMargin) quadrant = "promote";
          else if (highSales && !highMargin) quadrant = "reprice";
          else quadrant = "under";
          return { ...b, quadrant };
        });

        setItems(classified);
      } catch (e) {
        console.error("Menu insights fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const groups = useMemo(() => {
    const g: Record<Quadrant, ItemPerf[]> = { top: [], promote: [], reprice: [], under: [] };
    items.forEach((i) => g[i.quadrant].push(i));
    (Object.keys(g) as Quadrant[]).forEach((k) =>
      g[k].sort((a, b) => b.totalProfit - a.totalProfit || b.unitsSold - a.unitsSold)
    );
    return g;
  }, [items]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const order: Quadrant[] = ["top", "promote", "reprice", "under"];

  const formatWow = (pct: number | null) => {
    if (pct === null) return <span className="text-muted-foreground">-</span>;
    if (pct === Infinity) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600">
          <TrendingUp className="h-3.5 w-3.5" />
          New
        </span>
      );
    }
    const isUp = pct >= 0;
    return (
      <span className={`inline-flex items-center gap-1 ${isUp ? "text-emerald-600" : "text-destructive"}`}>
        {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Menu Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Items grouped by sales volume × profit margin (last 30 days of completed orders). Thresholds use the median across your active menu.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No active menu items found. Add menu items and complete a few orders to see insights.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {order.map((q) => {
            const meta = quadrantMeta[q];
            const list = groups[q];
            const Icon = meta.Icon;
            return (
              <div key={q} className={`rounded-xl border ${meta.ring} ${meta.bg} p-5`}>
                <div className="flex items-start gap-3 mb-4">
                  <div className={`rounded-lg p-2 bg-background border border-border ${meta.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className={`text-base font-bold ${meta.accent}`}>{meta.title}</h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{meta.subtitle}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{list.length} item{list.length === 1 ? "" : "s"}</span>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-3 mb-4">
                  <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{meta.advice}</p>
                </div>

                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No items in this group.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="text-left py-2 font-medium">Item</th>
                          <th className="text-right py-2 font-medium">Qty</th>
                          <th className="text-right py-2 font-medium">Profit</th>
                          <th className="text-right py-2 font-medium">Margin</th>
                          <th className="text-right py-2 font-medium">WoW Rev</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.slice(0, 10).map((it) => (
                          <tr key={it.id} className="border-b border-border/40 last:border-0">
                            <td className="py-2.5">
                              <div className="font-medium text-card-foreground">{it.name}</div>
                              <div className="text-[10px] text-muted-foreground">{it.category}</div>
                            </td>
                            <td className="py-2.5 text-right font-mono text-card-foreground">{it.unitsSold}</td>
                            <td className="py-2.5 text-right font-mono text-card-foreground">₹{Math.round(it.totalProfit).toLocaleString()}</td>
                            <td className={`py-2.5 text-right font-mono ${it.marginPct >= 50 ? "text-emerald-600" : it.marginPct >= 25 ? "text-card-foreground" : "text-destructive"}`}>
                              {it.marginPct.toFixed(1)}%
                            </td>
                            <td className="py-2.5 text-right font-mono">
                              {formatWow(it.wowRevenuePct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {list.length > 10 && (
                      <p className="text-[10px] text-muted-foreground mt-2 text-right">+ {list.length - 10} more</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MenuInsightsPage;
