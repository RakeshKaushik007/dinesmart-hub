import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertCircle, Trophy, Loader2 } from "lucide-react";

const ProductUsagePage = () => {
  const [loading, setLoading] = useState(true);
  const [topTenants, setTopTenants] = useState<any[]>([]);
  const [inactive, setInactive] = useState<any[]>([]);
  const [featureUsage, setFeatureUsage] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      // Order volume per branch (proxy for tenant activity)
      const since = new Date(); since.setDate(since.getDate() - 30);
      const [ordersRes, restosRes, branchesRes, kotsRes, aggRes, prepRes] = await Promise.all([
        supabase.from("orders").select("branch_id, created_at, order_source").gte("created_at", since.toISOString()),
        supabase.from("restaurants").select("id, name, created_at, is_active"),
        supabase.from("branches").select("id, restaurant_id"),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()).neq("order_source", "pos"),
        supabase.from("prep_batches").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
      ]);

      const branchMap = new Map((branchesRes.data ?? []).map((b: any) => [b.id, b.restaurant_id]));
      const restoMap = new Map((restosRes.data ?? []).map((r: any) => [r.id, r]));
      const orderCountByResto = new Map<string, number>();
      const lastOrderByResto = new Map<string, string>();

      for (const o of ordersRes.data ?? []) {
        const restoId = branchMap.get(o.branch_id);
        if (!restoId) continue;
        orderCountByResto.set(restoId, (orderCountByResto.get(restoId) || 0) + 1);
        const prev = lastOrderByResto.get(restoId);
        if (!prev || o.created_at > prev) lastOrderByResto.set(restoId, o.created_at);
      }

      const ranked = (restosRes.data ?? []).map((r: any) => ({
        ...r,
        orders: orderCountByResto.get(r.id) || 0,
        last_order: lastOrderByResto.get(r.id) || null,
      }));
      ranked.sort((a, b) => b.orders - a.orders);
      setTopTenants(ranked.slice(0, 10));

      // Inactive = no orders in 14d but account active
      const inactiveCutoff = new Date(); inactiveCutoff.setDate(inactiveCutoff.getDate() - 14);
      const inactiveList = ranked.filter((r) => r.is_active && (!r.last_order || new Date(r.last_order) < inactiveCutoff));
      setInactive(inactiveList.slice(0, 10));

      setFeatureUsage([
        { label: "Orders (POS + all)", count: kotsRes.count ?? 0 },
        { label: "Aggregator Orders", count: aggRes.count ?? 0 },
        { label: "Prep Recipe Batches", count: prepRes.count ?? 0 },
      ]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Product Usage</h1>
        <p className="text-sm text-muted-foreground">Last 30 days. Identify top tenants, churn risks, and feature engagement.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Feature Usage (30d)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featureUsage.map((f) => (
              <div key={f.label} className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
                <p className="text-2xl font-bold tabular-nums">{f.count.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Top Tenants by Orders</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-4">Restaurant</th><th className="py-2 pr-4 text-right">Orders (30d)</th></tr>
              </thead>
              <tbody>
                {topTenants.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-muted-foreground">No activity</td></tr>}
                {topTenants.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{t.name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{t.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Churn Risk (Inactive ≥14d)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-4">Restaurant</th><th className="py-2 pr-4">Last Order</th></tr>
              </thead>
              <tbody>
                {inactive.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-muted-foreground">All active 🎉</td></tr>}
                {inactive.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{t.name} <Badge variant="destructive" className="ml-1 text-[10px]">at risk</Badge></td>
                    <td className="py-2 pr-4 text-muted-foreground">{t.last_order ? new Date(t.last_order).toLocaleDateString() : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductUsagePage;