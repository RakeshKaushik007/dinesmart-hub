import { useState, useEffect } from "react";
import { Loader2, Receipt, Armchair, Clock, Filter, Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditEntry {
  id: string;
  type: "billing" | "table_session";
  timestamp: string;
  staff_name: string;
  staff_id: string;
  details: string;
  meta: Record<string, string | number>;
}

const AuditLogPage = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchAuditData = async () => {
    setLoading(true);
    const dayStart = `${dateFilter}T00:00:00`;
    const dayEnd = `${dateFilter}T23:59:59`;

    const [{ data: orders }, { data: sessions }, { data: profiles }, { data: tables }] = await Promise.all([
      supabase.from("orders")
        .select("id, order_number, created_by, payment_mode, status, total, completed_at, created_at, table_id, order_type")
        .eq("status", "completed")
        .gte("completed_at", dayStart)
        .lte("completed_at", dayEnd)
        .order("completed_at", { ascending: false }),
      supabase.from("table_sessions")
        .select("id, table_id, guest_name, seated_at, cleared_at")
        .gte("seated_at", dayStart)
        .lte("seated_at", dayEnd)
        .order("seated_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("restaurant_tables").select("id, table_number"),
    ]);

    const profileMap: Record<string, { name: string; email: string }> = {};
    profiles?.forEach(p => profileMap[p.user_id] = { name: p.full_name || "", email: p.email || "" });

    const tableMap: Record<string, number> = {};
    tables?.forEach(t => tableMap[t.id] = t.table_number);

    const auditEntries: AuditEntry[] = [];

    orders?.forEach(o => {
      const staff = o.created_by ? profileMap[o.created_by] : null;
      const tableNum = o.table_id ? tableMap[o.table_id] : null;
      auditEntries.push({
        id: `bill-${o.id}`,
        type: "billing",
        timestamp: o.completed_at || o.created_at,
        staff_name: staff?.name || staff?.email || "System",
        staff_id: o.created_by?.slice(0, 8).toUpperCase() || "N/A",
        details: `Settled Order #${o.order_number} — ₹${Number(o.total).toLocaleString()} via ${o.payment_mode.toUpperCase()}`,
        meta: {
          order_number: o.order_number,
          total: Number(o.total),
          payment: o.payment_mode,
          type: o.order_type === "dine_in" ? `Dine-in${tableNum ? ` (T${tableNum})` : ""}` : "Takeaway",
        },
      });
    });

    sessions?.forEach(s => {
      const tableNum = tableMap[s.table_id] || "?";
      const seatedTime = new Date(s.seated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const clearedTime = s.cleared_at
        ? new Date(s.cleared_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "Still occupied";
      const durationMin = s.cleared_at
        ? Math.floor((new Date(s.cleared_at).getTime() - new Date(s.seated_at).getTime()) / 60000)
        : null;

      auditEntries.push({
        id: `session-${s.id}`,
        type: "table_session",
        timestamp: s.seated_at,
        staff_name: s.guest_name || "Walk-in",
        staff_id: "",
        details: `Table ${tableNum}: Booked ${seatedTime} → Released ${clearedTime}${durationMin !== null ? ` (${durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`})` : ""}`,
        meta: {
          table: `T${tableNum}`,
          booked: seatedTime,
          released: clearedTime,
          ...(durationMin !== null ? { duration_min: durationMin } : {}),
        },
      });
    });

    auditEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEntries(auditEntries);
    setLoading(false);
  };

  useEffect(() => {
    fetchAuditData();
  }, [dateFilter]);

  const filtered = typeFilter === "all" ? entries : entries.filter(e => e.type === typeFilter);

  const handlePrint = () => {
    const billingEntries = filtered.filter(e => e.type === "billing");
    const sessionEntries = filtered.filter(e => e.type === "table_session");
    const totalRevenue = billingEntries.reduce((s, e) => s + Number(e.meta.total || 0), 0);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Audit Log — ${dateFilter}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1a1a1a; font-size: 12px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
          .summary { display: flex; gap: 24px; margin-bottom: 20px; padding: 12px; background: #f5f5f5; border-radius: 6px; }
          .summary-item { text-align: center; }
          .summary-item .val { font-size: 18px; font-weight: bold; }
          .summary-item .lbl { font-size: 10px; color: #666; text-transform: uppercase; }
          h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { text-align: left; background: #f0f0f0; padding: 6px 8px; font-size: 11px; text-transform: uppercase; color: #555; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .amount { text-align: right; font-family: monospace; font-weight: bold; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
          @media print { body { padding: 12px; } }
        </style>
      </head>
      <body>
        <h1>Audit Log Report</h1>
        <p class="subtitle">Date: ${new Date(dateFilter).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · ${filtered.length} entries</p>
        
        <div class="summary">
          <div class="summary-item"><div class="val">${billingEntries.length}</div><div class="lbl">Bills Settled</div></div>
          <div class="summary-item"><div class="val">₹${totalRevenue.toLocaleString()}</div><div class="lbl">Total Revenue</div></div>
          <div class="summary-item"><div class="val">${sessionEntries.length}</div><div class="lbl">Table Sessions</div></div>
        </div>

        ${billingEntries.length > 0 ? `
          <h2>Billing Settlements</h2>
          <table>
            <thead><tr><th>Time</th><th>Order</th><th>Staff</th><th>Payment</th><th>Type</th><th class="amount">Amount</th></tr></thead>
            <tbody>
              ${billingEntries.map(e => `<tr>
                <td>${new Date(e.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>#${e.meta.order_number}</td>
                <td>${e.staff_name}</td>
                <td>${String(e.meta.payment).toUpperCase()}</td>
                <td>${e.meta.type || ""}</td>
                <td class="amount">₹${Number(e.meta.total).toLocaleString()}</td>
              </tr>`).join("")}
              <tr style="font-weight:bold;border-top:2px solid #333"><td colspan="5">Total</td><td class="amount">₹${totalRevenue.toLocaleString()}</td></tr>
            </tbody>
          </table>
        ` : ""}

        ${sessionEntries.length > 0 ? `
          <h2>Table Sessions</h2>
          <table>
            <thead><tr><th>Table</th><th>Guest</th><th>Booked</th><th>Released</th><th>Duration</th></tr></thead>
            <tbody>
              ${sessionEntries.map(e => `<tr>
                <td>${e.meta.table || ""}</td>
                <td>${e.staff_name}</td>
                <td>${e.meta.booked || ""}</td>
                <td>${e.meta.released || ""}</td>
                <td>${e.meta.duration_min ? `${e.meta.duration_min}m` : "—"}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        ` : ""}

        <div class="footer">Generated on ${new Date().toLocaleString("en-IN")} · Audit Log Report</div>
        <script>setTimeout(()=>{window.print();},500)<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Billing settlements & table booking/release history</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="w-40 h-9 text-sm" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="billing">Billing Only</SelectItem>
            <SelectItem value="table_session">Table Sessions Only</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5" disabled={filtered.length === 0}
          onClick={() => {
            const headers = ["Time", "Type", "Details", "Staff/Guest", "Staff ID", "Amount"];
            const rows = filtered.map(e => [
              new Date(e.timestamp).toLocaleString("en-IN"),
              e.type === "billing" ? "Billing" : "Table Session",
              `"${e.details.replace(/"/g, '""')}"`,
              e.staff_name,
              e.staff_id,
              e.type === "billing" ? String(e.meta.total) : "",
            ]);
            const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-log-${dateFilter}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5" disabled={filtered.length === 0} onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" /> Print Report
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} entries</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No audit entries for this date.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <div key={entry.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
              <div className={`rounded-lg p-2 shrink-0 ${entry.type === "billing" ? "bg-primary/10" : "bg-accent"}`}>
                {entry.type === "billing"
                  ? <Receipt className="h-4 w-4 text-primary" />
                  : <Armchair className="h-4 w-4 text-accent-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{entry.details}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {entry.staff_name && (
                    <span className="text-xs text-muted-foreground">
                      {entry.type === "billing" ? "Staff" : "Guest"}: <span className="font-medium text-foreground">{entry.staff_name}</span>
                      {entry.staff_id && <span className="font-mono ml-1 opacity-60">({entry.staff_id})</span>}
                    </span>
                  )}
                  {entry.meta.type && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{String(entry.meta.type)}</span>
                  )}
                  {entry.meta.table && entry.type === "table_session" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{String(entry.meta.table)}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {entry.type === "billing" && (
                  <p className="text-sm font-bold font-mono text-foreground mt-0.5">₹{Number(entry.meta.total).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
