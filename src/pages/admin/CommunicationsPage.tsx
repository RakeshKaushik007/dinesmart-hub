import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Megaphone, Trash2, Loader2 } from "lucide-react";

const CommunicationsPage = () => {
  const { user } = useAuth();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [audience, setAudience] = useState("owners");
  const [expires, setExpires] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("system_banners").select("*").order("created_at", { ascending: false });
    setBanners(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!message.trim()) { toast({ title: "Message required", variant: "destructive" }); return; }
    setSubmitting(true);
    const { error } = await supabase.from("system_banners").insert({
      message: message.trim(), severity, audience,
      expires_at: expires ? new Date(expires).toISOString() : null,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Banner published" });
    setMessage(""); setExpires("");
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("system_banners").update({ is_active: active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await supabase.from("system_banners").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Global Communications</h1>
        <p className="text-sm text-muted-foreground">Send system banners to owner, manager, or employee dashboards.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> New Banner</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Scheduled maintenance on Sunday 2 AM IST..." rows={3} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="owners">Owners</SelectItem>
                  <SelectItem value="managers">Managers</SelectItem>
                  <SelectItem value="employees">Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          </div>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Publishing..." : "Publish Banner"}</Button>
          <p className="text-xs text-muted-foreground">Email blasts: connect an email provider (Resend/Brevo) to send targeted broadcasts. Banners are live in-app.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active & Past Banners</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : banners.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">No banners yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-4">Message</th>
                  <th className="py-2 pr-4">Severity</th>
                  <th className="py-2 pr-4">Audience</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 max-w-md truncate">{b.message}</td>
                    <td className="py-2 pr-4"><Badge variant={b.severity === "critical" ? "destructive" : "secondary"}>{b.severity}</Badge></td>
                    <td className="py-2 pr-4 text-xs uppercase">{b.audience}</td>
                    <td className="py-2 pr-4"><Switch checked={b.is_active} onCheckedChange={(v) => toggle(b.id, v)} /></td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="py-2"><Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunicationsPage;