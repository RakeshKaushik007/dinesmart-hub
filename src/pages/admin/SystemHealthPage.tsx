import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartPulse, Inbox, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const SystemHealthPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ openTickets: 0, urgentTickets: 0, resolvedToday: 0, recentTickets: [] as any[], totalRestaurants: 0, totalUsers: 0 });

  useEffect(() => {
    (async () => {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const [open, urgent, resolved, recent, restos, users] = await Promise.all([
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "resolved"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("priority", "urgent").neq("status", "resolved"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "resolved").gte("updated_at", todayStart.toISOString()),
        supabase.from("support_tickets").select("id, ticket_number, subject, priority, status, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("restaurants").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
      ]);
      setStats({
        openTickets: open.count ?? 0,
        urgentTickets: urgent.count ?? 0,
        resolvedToday: resolved.count ?? 0,
        recentTickets: recent.data ?? [],
        totalRestaurants: restos.count ?? 0,
        totalUsers: users.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const Stat = ({ icon: Icon, label, value, tone }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${tone || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent><div className="text-3xl font-bold tabular-nums">{value}</div></CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health & Support</h1>
          <p className="text-sm text-muted-foreground">Live platform pulse and support backlog.</p>
        </div>
        <Badge variant="outline" className="gap-1"><HeartPulse className="h-3 w-3 text-emerald-500" /> Operational</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Inbox} label="Open Tickets" value={stats.openTickets} />
        <Stat icon={AlertTriangle} label="Urgent Open" value={stats.urgentTickets} tone="text-destructive" />
        <Stat icon={CheckCircle2} label="Resolved Today" value={stats.resolvedToday} tone="text-emerald-500" />
        <Stat icon={HeartPulse} label="Tenants / Users" value={`${stats.totalRestaurants} / ${stats.totalUsers}`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Support Tickets</CardTitle>
          <Button asChild variant="outline" size="sm"><Link to="/admin/support">Open Inbox</Link></Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {stats.recentTickets.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">No tickets yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-4">Ticket</th><th className="py-2 pr-4">Subject</th><th className="py-2 pr-4">Priority</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Created</th></tr>
              </thead>
              <tbody>
                {stats.recentTickets.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{t.ticket_number}</td>
                    <td className="py-2 pr-4 font-medium">{t.subject}</td>
                    <td className="py-2 pr-4"><Badge variant={t.priority === "urgent" ? "destructive" : "secondary"}>{t.priority}</Badge></td>
                    <td className="py-2 pr-4"><Badge variant={t.status === "resolved" ? "outline" : "default"}>{t.status}</Badge></td>
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Live Software Errors</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Runtime errors stream from your error logging provider (Sentry, LogRocket, etc.). Connect an integration to surface live software errors here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealthPage;