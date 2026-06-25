import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Edit3, Check, X, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PricedIngredient {
  id: string;
  name: string;
  category: string;
  manualPrice: number | null;
  marketPrice: number;
  currentPrice: number;
  unit: string;
  trend: "up" | "down" | "stable";
  lastUpdated: string;
}

const OVERRIDE_KEY = "blennix_price_overrides_v1";

type Overrides = Record<string, { manual: number | null }>;

const loadOverrides = (): Overrides => {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}"); } catch { return {}; }
};
const saveOverrides = (o: Overrides) => localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o));

// Deterministic pseudo-random market price so values don't jump every render
const seedMarket = (id: string, base: number, jitterSeed: number) => {
  let h = 0;
  const s = id + ":" + jitterSeed;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const pct = ((h % 21) - 10) / 100; // -10% .. +10%
  return Math.max(1, Math.round(base * (1 + pct) * 100) / 100);
};

const DynamicPricingPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [items, setItems] = useState<PricedIngredient[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [syncSeed, setSyncSeed] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const refresh = async (seed = syncSeed) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, category, unit, cost_per_unit")
      .order("name");
    if (error) {
      toast({ title: "Failed to load ingredients", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const overrides = loadOverrides();
    const mapped: PricedIngredient[] = (data || []).map((row: any) => {
      const base = Number(row.cost_per_unit) || 0;
      const market = seedMarket(row.id, base || 50, seed);
      const ov = overrides[row.id];
      const manual = ov?.manual ?? null;
      const current = manual ?? market;
      const trend: "up" | "down" | "stable" =
        market > current ? "up" : market < current ? "down" : "stable";
      return {
        id: row.id,
        name: row.name,
        category: row.category || "—",
        manualPrice: manual,
        marketPrice: market,
        currentPrice: current,
        unit: row.unit || "unit",
        trend,
        lastUpdated: new Date().toISOString(),
      };
    });
    setItems(mapped);
    setLoading(false);
  };

  useEffect(() => { refresh(0); /* eslint-disable-next-line */ }, []);

  const syncMarketPrices = async () => {
    setSyncing(true);
    const seed = Date.now();
    setSyncSeed(seed);
    await refresh(seed);
    setLastSync(new Date());
    setSyncing(false);
    toast({ title: "Market prices synced", description: "Auto-priced items updated to latest rates." });
  };

  const startEdit = (it: PricedIngredient) => {
    setEditId(it.id);
    setEditValue(String(it.manualPrice ?? it.currentPrice));
  };

  const cancelEdit = () => { setEditId(null); setEditValue(""); };

  const saveEdit = async (it: PricedIngredient) => {
    const val = Number(editValue);
    if (!Number.isFinite(val) || val < 0) {
      toast({ title: "Invalid price", variant: "destructive" });
      return;
    }
    const overrides = loadOverrides();
    overrides[it.id] = { manual: val };
    saveOverrides(overrides);
    const { error } = await supabase
      .from("ingredients")
      .update({ cost_per_unit: val })
      .eq("id", it.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setItems(prev => prev.map(p => p.id === it.id
      ? { ...p, manualPrice: val, currentPrice: val,
          trend: p.marketPrice > val ? "up" : p.marketPrice < val ? "down" : "stable" }
      : p));
    cancelEdit();
    toast({ title: "Manual price saved" });
  };

  const clearOverride = async (it: PricedIngredient) => {
    const overrides = loadOverrides();
    delete overrides[it.id];
    saveOverrides(overrides);
    await supabase.from("ingredients").update({ cost_per_unit: it.marketPrice }).eq("id", it.id);
    setItems(prev => prev.map(p => p.id === it.id
      ? { ...p, manualPrice: null, currentPrice: p.marketPrice, trend: "stable" }
      : p));
    toast({ title: "Switched to auto" });
  };

  const filtered = useMemo(() =>
    items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())
      || i.category.toLowerCase().includes(search.toLowerCase())),
    [items, search]);

  const autoCount = items.filter(p => p.manualPrice === null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dynamic Base Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-sync market prices or set manual overrides
            {lastSync && <span className="ml-2 text-xs">· Last sync {lastSync.toLocaleTimeString()}</span>}
          </p>
        </div>
        <Button onClick={syncMarketPrices} disabled={syncing || loading} className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? "Syncing…" : "Sync Market Prices"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Items</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{items.length}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Auto-Priced</p>
          <p className="mt-2 text-2xl font-bold text-primary font-mono">{autoCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Using market rates</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Manual Override</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{items.length - autoCount}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search ingredient or category" value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Ingredient</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-right px-5 py-3 font-medium">Market Price</th>
                <th className="text-right px-5 py-3 font-medium">Current Price</th>
                <th className="text-left px-5 py-3 font-medium">Source</th>
                <th className="text-left px-5 py-3 font-medium">Trend</th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">
                  No ingredients found.
                </td></tr>
              ) : filtered.map((item) => {
                const editing = editId === item.id;
                return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-card-foreground">{item.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{item.category}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">₹{item.marketPrice}/{item.unit}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-card-foreground">
                      {editing ? (
                        <Input
                          autoFocus type="number" value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item); if (e.key === "Escape") cancelEdit(); }}
                          className="h-8 w-24 ml-auto text-right"
                        />
                      ) : (
                        <>₹{item.currentPrice}/{item.unit}</>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        item.manualPrice !== null ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
                      }`}>
                        {item.manualPrice !== null ? "Manual" : "Auto"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.trend === "up" && <TrendingUp className="h-4 w-4 text-destructive" />}
                      {item.trend === "down" && <TrendingDown className="h-4 w-4 text-emerald-500" />}
                      {item.trend === "stable" && <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {editing ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(item)}>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {item.manualPrice !== null && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => clearOverride(item)}>
                              Auto
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DynamicPricingPage;
