import { useEffect, useMemo, useState } from "react";
import { Target, ArrowUpRight, ArrowDownRight, Loader2, Pencil, Save, X, Wallet, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface DayRow {
  day: string;
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

interface FixedCosts {
  rent: number;
  salaries: number;
  utilities: number;
  misc: number;
}

interface VendorDue {
  id: string;
  vendor: string;
  balance: number;
  status: string;
  daysOld: number;
  poNumber: string | null;
}

const FIXED_COSTS_KEY = "blennix_fixed_costs";
const DEFAULT_FIXED: FixedCosts = { rent: 0, salaries: 0, utilities: 0, misc: 0 };

const loadFixedCosts = (): FixedCosts => {
  if (typeof window === "undefined") return DEFAULT_FIXED;
  try {
    const raw = localStorage.getItem(FIXED_COSTS_KEY);
    if (!raw) return DEFAULT_FIXED;
    const parsed = JSON.parse(raw);
    return {
      rent: Number(parsed.rent) || 0,
      salaries: Number(parsed.salaries) || 0,
      utilities: Number(parsed.utilities) || 0,
      misc: Number(parsed.misc) || 0,
    };
  } catch {
    return DEFAULT_FIXED;
  }
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const ProfitabilityPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<DayRow[]>([]);
  const [lastWeekRevenue, setLastWeekRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [fixedCosts, setFixedCosts] = useState<FixedCosts>(loadFixedCosts);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FixedCosts>(loadFixedCosts);
  const [pendingDues, setPendingDues] = useState<VendorDue[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const today = startOfDay(now);
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 6); // last 7 days incl today
        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Fetch completed orders for the broader range (month start OR last-week start, whichever earlier)
        const rangeStart = lastWeekStart < monthStart ? lastWeekStart : monthStart;

        const { data: orders, error: ordersErr } = await supabase
          .from("orders")
          .select("id, total, completed_at, status")
          .eq("status", "completed")
          .gte("completed_at", rangeStart.toISOString());
        if (ordersErr) throw ordersErr;

        const completedOrderIds = (orders ?? []).map((o) => o.id);

        // Fetch order items (for COGS) — only for completed orders in range
        let itemsByOrder: Record<string, { menu_item_id: string | null; quantity: number; is_void: boolean | null; is_nc: boolean | null; is_refunded: boolean }[]> = {};
        const menuItemIds = new Set<string>();
        if (completedOrderIds.length) {
          const { data: items, error: itemsErr } = await supabase
            .from("order_items")
            .select("order_id, menu_item_id, quantity, is_void, is_nc, is_refunded")
            .in("order_id", completedOrderIds);
          if (itemsErr) throw itemsErr;
          (items ?? []).forEach((it) => {
            if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
            itemsByOrder[it.order_id].push(it as any);
            if (it.menu_item_id) menuItemIds.add(it.menu_item_id);
          });
        }

        // Fetch cost prices for involved menu items
        const costMap: Record<string, number> = {};
        if (menuItemIds.size) {
          const { data: menuItems, error: miErr } = await supabase
            .from("menu_items")
            .select("id, cost_price")
            .in("id", Array.from(menuItemIds));
          if (miErr) throw miErr;
          (menuItems ?? []).forEach((m) => {
            costMap[m.id] = Number(m.cost_price) || 0;
          });
        }

        // Fetch wastage costs in range (added to COGS-side losses)
        const { data: wastage, error: wErr } = await supabase
          .from("wastage_logs")
          .select("cost, created_at")
          .gte("created_at", rangeStart.toISOString());
        if (wErr) throw wErr;

        // Build per-day buckets for last 7 days
        const dayKeys: { key: string; label: string; date: Date }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          dayKeys.push({
            key: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString("en-IN", { weekday: "short" }),
            date: d,
          });
        }
        const buckets: Record<string, { revenue: number; cost: number }> = {};
        dayKeys.forEach((d) => (buckets[d.key] = { revenue: 0, cost: 0 }));

        let lastWeekRev = 0;
        let monthRev = 0;

        (orders ?? []).forEach((o) => {
          if (!o.completed_at) return;
          const completed = new Date(o.completed_at);
          const key = startOfDay(completed).toISOString().slice(0, 10);
          const total = Number(o.total) || 0;

          // Compute COGS from items
          let cogs = 0;
          (itemsByOrder[o.id] ?? []).forEach((it) => {
            if (it.is_void || it.is_refunded) return;
            if (!it.menu_item_id) return;
            const cp = costMap[it.menu_item_id] ?? 0;
            cogs += cp * (Number(it.quantity) || 0);
          });

          if (buckets[key]) {
            buckets[key].revenue += total;
            buckets[key].cost += cogs;
          }
          if (completed >= lastWeekStart && completed < weekStart) {
            lastWeekRev += total;
          }
          if (completed >= monthStart) {
            monthRev += total;
          }
        });

        // Add wastage cost into the day bucket
        (wastage ?? []).forEach((w) => {
          const key = startOfDay(new Date(w.created_at)).toISOString().slice(0, 10);
          if (buckets[key]) buckets[key].cost += Number(w.cost) || 0;
        });

        const rows: DayRow[] = dayKeys.map((d) => {
          const b = buckets[d.key];
          return {
            day: d.label,
            date: d.key,
            revenue: b.revenue,
            cost: b.cost,
            profit: b.revenue - b.cost,
          };
        });

        setWeeklyData(rows);
        setLastWeekRevenue(lastWeekRev);
        setMonthlyRevenue(monthRev);

        // Pending vendor dues from purchase orders
        const { data: pos, error: poErr } = await supabase
          .from("purchase_orders")
          .select("id, po_number, vendor_name, balance_due, payment_status, created_at, expected_date")
          .gt("balance_due", 0)
          .in("payment_status", ["pending", "partial"])
          .order("balance_due", { ascending: false });
        if (poErr) throw poErr;
        const dues: VendorDue[] = (pos ?? []).map((p: any) => {
          const refDate = new Date(p.created_at);
          const daysOld = Math.max(0, Math.floor((Date.now() - refDate.getTime()) / 86400000));
          return {
            id: p.id,
            vendor: p.vendor_name ?? "Unknown vendor",
            balance: Number(p.balance_due) || 0,
            status: p.payment_status ?? "pending",
            daysOld,
            poNumber: p.po_number ?? null,
          };
        });
        setPendingDues(dues);
      } catch (err) {
        console.error("Profitability fetch error", err);
        toast({ title: "Failed to load profitability data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const totals = useMemo(() => {
    const totalRevenue = weeklyData.reduce((s, d) => s + d.revenue, 0);
    const totalCost = weeklyData.reduce((s, d) => s + d.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const wowDelta = lastWeekRevenue > 0 ? ((totalRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;
    const fixedTotal = fixedCosts.rent + fixedCosts.salaries + fixedCosts.utilities + fixedCosts.misc;
    const dailyFixedCost = fixedTotal / 30;
    const breakeven = fixedTotal;
    const breakevenProgress = breakeven > 0 ? Math.min((monthlyRevenue / breakeven) * 100, 100) : 0;
    const totalDues = pendingDues.reduce((s, d) => s + d.balance, 0);
    const oldestDue = pendingDues.reduce((m, d) => Math.max(m, d.daysOld), 0);
    const cashBreakeven = breakeven + totalDues;
    const cashBreakevenProgress = cashBreakeven > 0 ? Math.min((monthlyRevenue / cashBreakeven) * 100, 100) : 0;
    return { totalRevenue, totalCost, totalProfit, margin, wowDelta, fixedTotal, dailyFixedCost, breakeven, breakevenProgress, totalDues, oldestDue, cashBreakeven, cashBreakevenProgress };
  }, [weeklyData, lastWeekRevenue, monthlyRevenue, fixedCosts, pendingDues]);

  const saveFixed = () => {
    setFixedCosts(draft);
    localStorage.setItem(FIXED_COSTS_KEY, JSON.stringify(draft));
    setEditing(false);
    toast({ title: "Fixed costs updated" });
  };

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
        <h1 className="text-2xl font-bold text-foreground">Profitability & Breakeven</h1>
        <p className="text-sm text-muted-foreground mt-1">Live insights from completed orders, recipes & wastage</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">7-Day Revenue</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{Math.round(totals.totalRevenue).toLocaleString()}</p>
          {lastWeekRevenue > 0 ? (
            <p className={`text-xs flex items-center gap-0.5 mt-1 ${totals.wowDelta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {totals.wowDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(totals.wowDelta).toFixed(1)}% vs prev week
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">No prior week data</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">7-Day Gross Profit</p>
          <p className={`mt-2 text-2xl font-bold font-mono ${totals.totalProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>₹{Math.round(totals.totalProfit).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Profit Margin</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{totals.margin.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Daily Fixed Cost</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{Math.round(totals.dailyFixedCost).toLocaleString()}</p>
        </div>
      </div>

      {/* Pending Vendor Dues KPI */}
      <div className={`rounded-xl border p-5 ${totals.totalDues > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${totals.totalDues > 0 ? "bg-amber-500/10 text-amber-600" : "bg-secondary text-muted-foreground"}`}>
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pending Vendor Dues</p>
              <p className={`mt-1 text-2xl font-bold font-mono ${totals.totalDues > 0 ? "text-amber-600" : "text-card-foreground"}`}>
                ₹{Math.round(totals.totalDues).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingDues.length === 0
                  ? "All vendor payments settled"
                  : `${pendingDues.length} PO${pendingDues.length > 1 ? "s" : ""} • oldest ${totals.oldestDue} day${totals.oldestDue === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <Link to="/purchase-orders" className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5">
            Manage POs <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Breakeven Tracker */}
      <div className="rounded-xl border border-primary/30 bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Monthly Breakeven Progress</h2>
          </div>
          <span className="text-sm font-mono text-muted-foreground">₹{Math.round(monthlyRevenue).toLocaleString()} / ₹{totals.breakeven.toLocaleString()}</span>
        </div>
        <div className="w-full h-4 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${totals.breakevenProgress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {totals.breakeven <= 0
            ? "Set your monthly fixed costs below to enable breakeven tracking."
            : totals.breakevenProgress >= 100
              ? "✅ Breakeven reached! You're in profit."
              : `${totals.breakevenProgress.toFixed(0)}% — ₹${Math.round(totals.breakeven - monthlyRevenue).toLocaleString()} remaining`}
        </p>
        {totals.totalDues > 0 && totals.breakeven > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Cash-Adjusted Breakeven (incl. vendor dues)
              </p>
              <span className="text-xs font-mono text-muted-foreground">
                ₹{Math.round(monthlyRevenue).toLocaleString()} / ₹{Math.round(totals.cashBreakeven).toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${totals.cashBreakevenProgress}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {totals.cashBreakevenProgress >= 100
                ? "Covered fixed costs and outstanding vendor balances."
                : `₹${Math.round(totals.cashBreakeven - monthlyRevenue).toLocaleString()} still needed to clear fixed costs + vendor dues.`}
            </p>
          </div>
        )}
      </div>

      {/* Daily breakdown */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-card-foreground">Daily Breakdown (Last 7 Days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Day</th>
                <th className="text-right px-5 py-3 font-medium">Revenue</th>
                <th className="text-right px-5 py-3 font-medium">Cost</th>
                <th className="text-right px-5 py-3 font-medium">Profit</th>
                <th className="text-right px-5 py-3 font-medium hidden sm:table-cell">Margin</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">vs Fixed</th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((day) => {
                const netAfterFixed = day.profit - totals.dailyFixedCost;
                const margin = day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0;
                return (
                  <tr key={day.date} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-card-foreground">{day.day}</td>
                    <td className="px-5 py-3.5 text-right font-mono">₹{Math.round(day.revenue).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">₹{Math.round(day.cost).toLocaleString()}</td>
                    <td className={`px-5 py-3.5 text-right font-mono font-semibold ${day.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>₹{Math.round(day.profit).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono hidden sm:table-cell">{margin.toFixed(0)}%</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs font-mono font-semibold ${netAfterFixed >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {netAfterFixed >= 0 ? "+" : ""}₹{Math.round(netAfterFixed).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {weeklyData.every((d) => d.revenue === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No completed orders in the last 7 days yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Dues panel */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-card-foreground">Top Vendor Dues</h2>
          </div>
          <Link to="/purchase-orders" className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {pendingDues.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">All vendor payments are settled.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {pendingDues.slice(0, 5).map((d) => (
              <div key={d.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{d.vendor}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.poNumber ? `${d.poNumber} • ` : ""}{d.daysOld} day{d.daysOld === 1 ? "" : "s"} old
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                    d.status === "partial" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                  }`}>
                    {d.status}
                  </span>
                  <span className="text-sm font-bold font-mono text-card-foreground">₹{Math.round(d.balance).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Monthly Fixed Costs</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Total: ₹{totals.fixedTotal.toLocaleString()}</p>
          </div>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => { setDraft(fixedCosts); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" onClick={saveFixed}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(Object.keys(fixedCosts) as (keyof FixedCosts)[]).map((key) => (
            <div key={key}>
              <p className="text-xs text-muted-foreground capitalize">{key}</p>
              {editing ? (
                <Input
                  type="number"
                  min={0}
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) || 0 }))}
                  className="mt-1 font-mono h-9"
                />
              ) : (
                <p className="text-sm font-bold font-mono text-card-foreground mt-1">₹{fixedCosts[key].toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfitabilityPage;
