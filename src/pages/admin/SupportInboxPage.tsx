import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Inbox, Loader2, Check, Search } from "lucide-react";

interface AdminTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved";
  admin_response: string | null;
  restaurant_id: string | null;
  branch_id: string | null;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
  restaurant_name?: string | null;
  branch_name?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
}

const STATUS_STYLES: Record<AdminTicket["status"], string> = {
  open: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const PRIORITY_STYLES: Record<AdminTicket["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-orange-500/15 text-orange-600",
  urgent: "bg-destructive/15 text-destructive",
};

const SupportInboxPage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load tickets", { description: error.message });
      setLoading(false);
      return;
    }
    const list = (data ?? []) as AdminTicket[];
    const restIds = Array.from(new Set(list.map((t) => t.restaurant_id).filter(Boolean) as string[]));
    const branchIds = Array.from(new Set(list.map((t) => t.branch_id).filter(Boolean) as string[]));
    const userIds = Array.from(new Set(list.map((t) => t.created_by)));

    const [restRes, branchRes, profRes] = await Promise.all([
      restIds.length ? supabase.from("restaurants").select("id, name").in("id", restIds) : Promise.resolve({ data: [] as any[] }),
      branchIds.length ? supabase.from("branches").select("id, name").in("id", branchIds) : Promise.resolve({ data: [] as any[] }),
      userIds.length ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const restMap = new Map((restRes.data ?? []).map((r: any) => [r.id, r.name]));
    const branchMap = new Map((branchRes.data ?? []).map((b: any) => [b.id, b.name]));
    const profMap = new Map((profRes.data ?? []).map((p: any) => [p.user_id, p]));

    setTickets(
      list.map((t) => ({
        ...t,
        restaurant_name: t.restaurant_id ? restMap.get(t.restaurant_id) ?? null : null,
        branch_name: t.branch_id ? branchMap.get(t.branch_id) ?? null : null,
        requester_name: profMap.get(t.created_by)?.full_name ?? null,
        requester_email: profMap.get(t.created_by)?.email ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticket_number.toLowerCase().includes(q) ||
        (t.restaurant_name ?? "").toLowerCase().includes(q) ||
        (t.requester_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, search]);

  const counts = useMemo(() => ({
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  }), [tickets]);

  const updateStatus = async (ticket: AdminTicket, newStatus: AdminTicket["status"]) => {
    setSavingId(ticket.id);
    const patch: any = { status: newStatus };
    if (newStatus === "resolved") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = user?.id ?? null;
      const resp = responses[ticket.id]?.trim();
      if (resp) patch.admin_response = resp;
    }
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", ticket.id);
    setSavingId(null);
    if (error) {
      toast.error("Update failed", { description: error.message });
      return;
    }
    toast.success(`Ticket marked ${newStatus.replace("_", " ")}`);
    load();
  };

  const saveResponse = async (ticket: AdminTicket) => {
    const resp = responses[ticket.id]?.trim();
    if (!resp) {
      toast.error("Response cannot be empty");
      return;
    }
    setSavingId(ticket.id);
    const { error } = await supabase
      .from("support_tickets")
      .update({ admin_response: resp, status: ticket.status === "open" ? "in_progress" : ticket.status })
      .eq("id", ticket.id);
    setSavingId(null);
    if (error) {
      toast.error("Could not save response", { description: error.message });
      return;
    }
    toast.success("Response saved");
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Inbox</h1>
          <p className="text-sm text-muted-foreground">All incoming tickets from restaurants on the platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-widest">Open</p><p className="text-2xl font-bold text-amber-600">{counts.open}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-widest">In Progress</p><p className="text-2xl font-bold text-blue-600">{counts.in_progress}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-widest">Resolved</p><p className="text-2xl font-bold text-emerald-600">{counts.resolved}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle className="text-base">Tickets ({filtered.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input className="pl-8 w-64" placeholder="Search subject, restaurant, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No tickets match.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <div key={t.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{t.subject}</p>
                        <Badge variant="outline" className={STATUS_STYLES[t.status]}>{t.status.replace("_", " ")}</Badge>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.category}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {t.ticket_number} · {new Date(t.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">{t.restaurant_name ?? "Unknown restaurant"}</span>
                        {t.branch_name ? ` · ${t.branch_name}` : ""}
                        {" · "}
                        {t.requester_name || t.requester_email || "Unknown user"}
                        {t.requester_email && t.requester_name ? ` (${t.requester_email})` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {t.status !== "resolved" && (
                        <Button size="sm" onClick={() => updateStatus(t, "resolved")} disabled={savingId === t.id}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Mark Resolved
                        </Button>
                      )}
                      {t.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(t, "in_progress")} disabled={savingId === t.id}>
                          Start Progress
                        </Button>
                      )}
                      {t.status === "resolved" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(t, "open")} disabled={savingId === t.id}>
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>

                  {t.admin_response && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                      <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">Current Response</p>
                      <p className="text-sm whitespace-pre-wrap">{t.admin_response}</p>
                    </div>
                  )}

                  {t.status !== "resolved" && (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Write a response to the requester..."
                        value={responses[t.id] ?? ""}
                        onChange={(e) => setResponses((p) => ({ ...p, [t.id]: e.target.value }))}
                        maxLength={2000}
                      />
                      <Button size="sm" variant="secondary" onClick={() => saveResponse(t)} disabled={savingId === t.id}>
                        Save Response
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportInboxPage;