import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classifyPayment, BUILT_IN_PAYMENT_METHODS, type PaymentMethod } from "@/hooks/usePaymentMethods";

interface Summary {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  avgOrderValue: number;
  topDish: string | null;
  topDishCount: number;
  paymentBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  peakHour: string | null;
  wastage: number;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const formatHour = (h: number) => {
  const start = new Date(); start.setHours(h, 0, 0, 0);
  const end = new Date(); end.setHours(h + 1, 0, 0, 0);
  return `${start.toLocaleTimeString("en-IN", { hour: "numeric", hour12: true })} – ${end.toLocaleTimeString("en-IN", { hour: "numeric", hour12: true })}`;
};

const EODSummaryPage = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = startOfDay(new Date());
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: orders, error: oErr } = await supabase
          .from("orders")
          .select("id, total, payment_mode, order_source, completed_at, status")
          .eq("status", "completed")
          .gte("completed_at", today.toISOString())
          .lt("completed_at", tomorrow.toISOString());
        if (oErr) throw oErr;

        const orderIds = (orders ?? []).map((o) => o.id);
        let items: any[] = [];
        if (orderIds.length) {
          const { data, error } = await supabase
            .from("order_items")
            .select("order_id, menu_item_id, item_name, quantity, is_void, is_refunded")
            .in("order_id", orderIds);
          if (error) throw error;
          items = data ?? [];
        }

        const menuIds = Array.from(new Set(items.map((i) => i.menu_item_id).filter(Boolean)));
        const costMap: Record<string, number> = {};
        if (menuIds.length) {
          const { data: menu } = await supabase.from("menu_items").select("id, cost_price").in("id", menuIds);
          (menu ?? []).forEach((m) => (costMap[m.id] = Number(m.cost_price) || 0));
        }

        // Active payment methods for nicer labels and classification
        const { data: pms } = await supabase.from("payment_methods").select("id, code, name, type, is_active, icon").eq("is_active", true);
        const customPMs: PaymentMethod[] = (pms ?? []) as PaymentMethod[];
        const labelByCode: Record<string, string> = {};
        [...BUILT_IN_PAYMENT_METHODS, ...customPMs].forEach((m) => (labelByCode[m.code] = m.name));

        // Wastage today
        const { data: wastage } = await supabase
          .from("wastage_logs")
          .select("cost, created_at")
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString());

        const totalRevenue = (orders ?? []).reduce((s, o) => s + (Number(o.total) || 0), 0);
        const totalOrders = (orders ?? []).length;

        // Cost
        let totalCost = 0;
        const dishCounts: Record<string, { name: string; count: number }> = {};
        items.forEach((it) => {
          if (it.is_void || it.is_refunded) return;
          const qty = Number(it.quantity) || 0;
          if (it.menu_item_id) totalCost += (costMap[it.menu_item_id] ?? 0) * qty;
          const key = it.menu_item_id ?? it.item_name;
          if (!dishCounts[key]) dishCounts[key] = { name: it.item_name, count: 0 };
          dishCounts[key].count += qty;
        });
        const top = Object.values(dishCounts).sort((a, b) => b.count - a.count)[0];

        // Payment breakdown — show by friendly name; group unknowns under classification
        const paymentBreakdown: Record<string, number> = {};
        (orders ?? []).forEach((o) => {
          const code = o.payment_mode ?? "pending";
          const label = labelByCode[code] ?? (classifyPayment(code, customPMs) === "aggregator" ? "Aggregator" : code);
          paymentBreakdown[label] = (paymentBreakdown[label] ?? 0) + (Number(o.total) || 0);
        });

        // Source breakdown
        const sourceBreakdown: Record<string, number> = {};
        (orders ?? []).forEach((o) => {
          const k = o.order_source ?? "pos";
          sourceBreakdown[k] = (sourceBreakdown[k] ?? 0) + 1;
        });

        // Peak hour
        const hourCounts: Record<number, number> = {};
        (orders ?? []).forEach((o) => {
          if (!o.completed_at) return;
          const h = new Date(o.completed_at).getHours();
          hourCounts[h] = (hourCounts[h] ?? 0) + 1;
        });
        const peakHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
        const peakHour = peakHourEntry ? formatHour(Number(peakHourEntry[0])) : null;

        const wastageCost = (wastage ?? []).reduce((s, w) => s + (Number(w.cost) || 0), 0);
        const grossProfit = totalRevenue - totalCost - wastageCost;

        setSummary({
          date: today.toISOString().slice(0, 10),
          totalOrders,
          totalRevenue,
          totalCost,
          grossProfit,
          avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
          topDish: top?.name ?? null,
          topDishCount: top?.count ?? 0,
          paymentBreakdown,
          sourceBreakdown,
          peakHour,
          wastage: wastageCost,
        });
      } catch (err) {
        console.error("EOD summary fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const hasOrders = useMemo(() => (summary?.totalOrders ?? 0) > 0, [summary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">End of Day Summary</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {new Date(summary.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{Math.round(summary.totalRevenue).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Gross Profit</p>
          <p className={`mt-2 text-2xl font-bold font-mono ${summary.grossProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>₹{Math.round(summary.grossProfit).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Orders</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{summary.totalOrders}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Order Value</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{summary.avgOrderValue}</p>
        </div>
      </div>

      {!hasOrders && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No completed orders today yet. Settle bills to populate this dashboard.</p>
        </div>
      )}

      {hasOrders && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Payment Breakdown</h2>
          <div className="space-y-3">
            {Object.entries(summary.paymentBreakdown).sort((a, b) => b[1] - a[1]).map(([mode, amount]) => (
              <div key={mode} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{mode}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 rounded-full bg-secondary overflow-hidden hidden sm:block">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${summary.totalRevenue > 0 ? (amount / summary.totalRevenue) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-mono font-semibold text-card-foreground w-20 text-right">₹{Math.round(amount).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Order Sources</h2>
          <div className="space-y-3">
            {Object.entries(summary.sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{source}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 rounded-full bg-secondary overflow-hidden hidden sm:block">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${summary.totalOrders > 0 ? (count / summary.totalOrders) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-mono font-semibold text-card-foreground w-16 text-right">{count} orders</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Day Highlights</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Bestseller</p>
              <p className="text-sm font-semibold text-card-foreground mt-1">{summary.topDish ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{summary.topDishCount} sold</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peak Hour</p>
              <p className="text-sm font-semibold text-card-foreground mt-1">{summary.peakHour ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Costs</p>
              <p className="text-sm font-semibold text-card-foreground mt-1 font-mono">₹{Math.round(summary.totalCost).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wastage Loss</p>
              <p className="text-sm font-semibold text-destructive mt-1 font-mono">₹{Math.round(summary.wastage).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default EODSummaryPage;
