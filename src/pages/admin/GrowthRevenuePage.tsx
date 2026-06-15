import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, XCircle, Loader2 } from "lucide-react";

// Simple price map per tier — adjust to match real pricing
const TIER_PRICE: Record<string, number> = { free: 0, basic: 1499, pro: 2999, enterprise: 7999 };

const StatCard = ({ icon: Icon, label, value, hint }: any) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

const GrowthRevenuePage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ mrr: 0, active: 0, canceled: 0, newThisMonth: 0, byTier: {} as Record<string, number> });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, subscription_status, subscription_tier, is_active, created_at")
        .order("created_at", { ascending: false });
      const list = data ?? [];
      const firstOfMonth = new Date(); firstOfMonth.setDate(1); firstOfMonth.setHours(0,0,0,0);
      let mrr = 0;
      const byTier: Record<string, number> = {};
      let active = 0, canceled = 0, newThisMonth = 0;
      for (const r of list) {
        const tier = (r.subscription_tier || "free").toLowerCase();
        byTier[tier] = (byTier[tier] || 0) + 1;
        const status = (r.subscription_status || "").toLowerCase();
        const isActiveSub = r.is_active && status !== "canceled" && status !== "suspended";
        if (isActiveSub) { active++; mrr += TIER_PRICE[tier] ?? 0; }
        if (status === "canceled" || !r.is_active) canceled++;
        if (new Date(r.created_at) >= firstOfMonth) newThisMonth++;
      }
      setStats({ mrr, active, canceled, newThisMonth, byTier });
      setRecent(list.slice(0, 10));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Growth & Revenue</h1>
        <p className="text-sm text-muted-foreground">SaaS metrics: MRR, subscriptions, churn, and acquisition.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="MRR" value={`₹${stats.mrr.toLocaleString()}`} hint="Monthly recurring revenue" />
        <StatCard icon={Users} label="Active Subscriptions" value={stats.active} />
        <StatCard icon={XCircle} label="Canceled / Suspended" value={stats.canceled} />
        <StatCard icon={TrendingUp} label="New This Month" value={stats.newThisMonth} />
      </div>

      <Card>
        <CardHeader><CardTitle>Subscriptions by Tier</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byTier).map(([tier, count]) => (
              <div key={tier} className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{tier}</p>
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="text-xs text-muted-foreground">₹{((TIER_PRICE[tier] ?? 0) * (count as number)).toLocaleString()}/mo</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Sign-ups</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2 pr-4">Restaurant</th><th className="py-2 pr-4">Tier</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Joined</th></tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{r.name}</td>
                  <td className="py-2 pr-4 uppercase text-xs">{r.subscription_tier || "free"}</td>
                  <td className="py-2 pr-4 text-xs">{r.subscription_status || (r.is_active ? "active" : "inactive")}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default GrowthRevenuePage;