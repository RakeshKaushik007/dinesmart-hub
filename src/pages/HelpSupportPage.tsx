import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePosSession } from "@/hooks/usePosSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LifeBuoy, Loader2, Plus, Inbox } from "lucide-react";
import { z } from "zod";

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved";
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

const ticketSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  description: z.string().trim().min(10, "Please describe the issue (min 10 chars)").max(2000),
  category: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

const STATUS_STYLES: Record<Ticket["status"], string> = {
  open: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const PRIORITY_STYLES: Record<Ticket["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-orange-500/15 text-orange-600",
  urgent: "bg-destructive/15 text-destructive",
};

const HelpSupportPage = () => {
  const { user } = useAuth();
  const { session: pos } = usePosSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<Ticket["priority"]>("normal");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load tickets", { description: error.message });
    else setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submit = async () => {
    if (!user) return;
    const parsed = ticketSchema.safeParse({ subject, description, category, priority });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      subject: parsed.data.subject,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
      created_by: user.id,
      restaurant_id: pos?.restaurant_id ?? null,
      branch_id: pos?.branch_id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not submit ticket", { description: error.message });
      return;
    }
    toast.success("Ticket submitted — our team will respond soon.");
    setSubject("");
    setDescription("");
    setCategory("general");
    setPriority("normal");
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <LifeBuoy className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Help &amp; Support</h1>
          <p className="text-sm text-muted-foreground">Raise issues, ask questions, and track responses from the Blennix team.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> New Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Ticket["priority"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Describe the issue</Label>
              <Textarea id="desc" rows={6} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Steps to reproduce, what you expected, what happened..." />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Ticket
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4" /> Your Tickets ({tickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No tickets yet.</p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="border border-border rounded-lg p-4 space-y-2 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground font-mono">{t.ticket_number} · {new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="outline" className={STATUS_STYLES[t.status]}>{t.status.replace("_", " ")}</Badge>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>
                    {t.admin_response && (
                      <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">Support Response</p>
                        <p className="text-sm whitespace-pre-wrap">{t.admin_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HelpSupportPage;