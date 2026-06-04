import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Store, Users, Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface OwnerRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  restaurant_count: number;
  manager_count: number;
  created_at: string;
}

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
    </CardContent>
  </Card>
);

const SuperAdminDashboard = () => {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ owners: 0, restaurants: 0, branches: 0, managers: 0, staff: 0 });
  const [owners, setOwners] = useState<OwnerRow[]>([]);

  useEffect(() => {
    (async () => {
      const [ownersRes, restosRes, branchesRes, mgrRes, staffRes, ownerProfilesRes] = await Promise.all([
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "owner"),
        supabase.from("restaurants").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "branch_manager"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "employee"),
        supabase.from("user_roles").select("user_id, created_at").eq("role", "owner"),
      ]);

      setStats({
        owners: ownersRes.count ?? 0,
        restaurants: restosRes.count ?? 0,
        branches: branchesRes.count ?? 0,
        managers: mgrRes.count ?? 0,
        staff: staffRes.count ?? 0,
      });

      const ownerIds = (ownerProfilesRes.data ?? []).map((r: any) => r.user_id);
      if (ownerIds.length > 0) {
        const [profiles, restos, descendantMgrs] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, email").in("user_id", ownerIds),
          supabase.from("restaurants").select("owner_user_id"),
          supabase.from("user_roles").select("parent_user_id").eq("role", "branch_manager"),
        ]);
        const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p]));
        const restoCount = new Map<string, number>();
        (restos.data ?? []).forEach((r: any) => {
          if (r.owner_user_id) restoCount.set(r.owner_user_id, (restoCount.get(r.owner_user_id) ?? 0) + 1);
        });
        const mgrCount = new Map<string, number>();
        (descendantMgrs.data ?? []).forEach((r: any) => {
          if (r.parent_user_id) mgrCount.set(r.parent_user_id, (mgrCount.get(r.parent_user_id) ?? 0) + 1);
        });
        setOwners(
          (ownerProfilesRes.data ?? []).map((r: any) => ({
            user_id: r.user_id,
            full_name: (profileMap.get(r.user_id) as any)?.full_name ?? null,
            email: (profileMap.get(r.user_id) as any)?.email ?? null,
            restaurant_count: restoCount.get(r.user_id) ?? 0,
            manager_count: mgrCount.get(r.user_id) ?? 0,
            created_at: r.created_at,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Overview</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Super Admin view — aggregate metrics only. No access to individual restaurant sales or orders."
              : "Admin view — tenant accounts and subscription management. No access to individual restaurant sales or orders."}
          </p>
        </div>
        <Badge variant={isSuperAdmin ? "destructive" : "secondary"} className="gap-1">
          <Shield className="h-3 w-3" /> {isSuperAdmin ? "Super Admin" : "Admin"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Owners" value={stats.owners} />
        <StatCard icon={Store} label="Restaurants" value={stats.restaurants} />
        <StatCard icon={Building2} label="Branches" value={stats.branches} />
        <StatCard icon={Shield} label="Managers" value={stats.managers} />
        <StatCard icon={Users} label="Staff" value={stats.staff} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Owner Accounts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4 text-right">Restaurants</th>
                <th className="py-2 pr-4 text-right">Managers</th>
                <th className="py-2 pr-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {owners.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No owners yet</td></tr>
              )}
              {owners.map((o) => (
                <tr key={o.user_id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{o.full_name || "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{o.email || "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{o.restaurant_count}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{o.manager_count}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            Use <strong>Admin → Restaurants</strong> to create owners & assign restaurants, and <strong>Admin → User Management</strong> for full CRUD.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;