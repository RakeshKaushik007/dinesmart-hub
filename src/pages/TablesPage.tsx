import { useState, useEffect } from "react";
import { Users, Clock, User, QrCode, Printer, Download, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

type TableStatus = "available" | "occupied" | "reserved";

interface TableData {
  id: string;
  table_number: number;
  seats: number;
  section: string;
  status: string;
  branch_id: string | null;
  guest_name?: string;
  order_total?: number;
  occupied_since?: string;
  is_paid?: boolean;
  order_id?: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  available: { label: "Available", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  occupied: { label: "Occupied", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" },
  reserved: { label: "Reserved", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  paid_occupied: { label: "Paid (Seated)", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
};

const TablesPage = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const { toast } = useToast();

  const fetchTables = async () => {
    const { data: tablesData } = await supabase
      .from("restaurant_tables")
      .select("id, table_number, seats, section, status, branch_id")
      .eq("is_active", true)
      .order("table_number");

    if (!tablesData) { setLoading(false); return; }

    const { data: sessions } = await supabase
      .from("table_sessions")
      .select("table_id, guest_name, guest_count, seated_at, order_id")
      .is("cleared_at", null);

    // Check if orders linked to sessions are paid (completed)
    const orderIds = sessions?.map(s => s.order_id).filter(Boolean) as string[] || [];
    const { data: ordersData } = orderIds.length > 0
      ? await supabase.from("orders").select("id, status, total").in("id", orderIds)
      : { data: [] };

    const orderMap: Record<string, { status: string; total: number }> = {};
    ordersData?.forEach(o => orderMap[o.id] = { status: o.status, total: o.total });

    const enriched: TableData[] = tablesData.map((t) => {
      const session = sessions?.find((s) => s.table_id === t.id);
      const orderInfo = session?.order_id ? orderMap[session.order_id] : null;
      const isPaid = orderInfo?.status === "completed";
      return {
        ...t,
        guest_name: session?.guest_name ?? undefined,
        occupied_since: session?.seated_at ? new Date(session.seated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        is_paid: isPaid,
        order_total: orderInfo?.total,
        order_id: session?.order_id ?? undefined,
      };
    });

    setTables(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchTables();
    const channel = supabase
      .channel("tables-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, () => fetchTables())
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, () => fetchTables())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchTables())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const sections = ["all", ...new Set(tables.map((t) => t.section))];
  const filtered = tables.filter((t) => {
    if (sectionFilter !== "all" && t.section !== sectionFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    reserved: tables.filter((t) => t.status === "reserved").length,
  };

  const totalGuests = tables.filter((t) => t.status === "occupied").reduce((s, t) => s + t.seats, 0);

  const clearTable = async (tableId: string) => {
    await supabase.from("restaurant_tables").update({ status: "available" }).eq("id", tableId);
    await supabase.from("table_sessions").update({ cleared_at: new Date().toISOString() }).eq("table_id", tableId).is("cleared_at", null);
    setSelectedTable(null);
    toast({ title: `Table cleared and available for new guests` });
  };

  const changeStatus = async (tableId: string, newStatus: TableStatus) => {
    await supabase.from("restaurant_tables").update({ status: newStatus }).eq("id", tableId);
    if (newStatus === "available") {
      await supabase.from("table_sessions").update({ cleared_at: new Date().toISOString() }).eq("table_id", tableId).is("cleared_at", null);
    }
    setSelectedTable(null);
    toast({ title: `Table ${tables.find((t) => t.id === tableId)?.table_number} → ${newStatus}` });
  };

  const getDisplayStatus = (table: TableData) => {
    if (table.status === "occupied" && table.is_paid) return "paid_occupied";
    return table.status;
  };

  const getStatusDot = (table: TableData) => {
    if (table.status === "occupied" && table.is_paid) return "bg-amber-500";
    if (table.status === "available") return "bg-emerald-500";
    if (table.status === "occupied") return "bg-destructive";
    return "bg-amber-500";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Table Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{totalGuests} guests seated · {counts.available} tables free</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {(["available", "occupied", "reserved"] as TableStatus[]).map((s) => {
          const cfg = statusConfig[s];
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-xl border p-3 sm:p-4 text-left transition-all ${statusFilter === s ? `${cfg.bg} border-transparent ring-2 ${cfg.ring}` : "bg-card border-border hover:bg-muted/30"}`}>
              <p className={`text-lg sm:text-2xl font-bold font-mono ${cfg.color}`}>{counts[s]}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 capitalize">{s}</p>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {sections.map((sec) => (
          <button key={sec} onClick={() => setSectionFilter(sec)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors shrink-0 ${sectionFilter === sec ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {sec === "all" ? "All Sections" : sec}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
        {filtered.map((table) => {
          const displayStatus = getDisplayStatus(table);
          const cfg = statusConfig[displayStatus] || statusConfig.available;
          return (
            <button key={table.id} onClick={() => setSelectedTable(table)}
              className={`relative rounded-xl border p-3 sm:p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${cfg.bg} border-transparent ring-1 ${cfg.ring}`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className={`text-base sm:text-lg font-bold font-mono ${cfg.color}`}>T{table.table_number}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot(table)}`} />
              </div>
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
                <span className="text-[10px] sm:text-xs">{table.seats} seats</span>
              </div>
              {table.status === "occupied" && (
                <div className="mt-1.5 space-y-0.5">
                  {table.guest_name && (
                    <div className="flex items-center gap-1 text-xs">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-card-foreground text-[10px] sm:text-xs truncate">{table.guest_name}</span>
                    </div>
                  )}
                  {table.occupied_since && (
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground text-[10px] sm:text-xs">{table.occupied_since}</span>
                    </div>
                  )}
                  {table.is_paid && (
                    <div className="flex items-center gap-1 text-xs mt-1">
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold">Paid</span>
                    </div>
                  )}
                </div>
              )}
              {table.status === "available" && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">{table.section}</p>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedTable && (() => {
            const displayStatus = getDisplayStatus(selectedTable);
            const cfg = statusConfig[displayStatus];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span className="text-xl font-mono">Table {selectedTable.table_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg?.bg} ${cfg?.color}`}>
                      {cfg?.label}
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Section</p>
                      <p className="text-foreground font-medium">{selectedTable.section}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Seats</p>
                      <p className="text-foreground font-medium">{selectedTable.seats}</p>
                    </div>
                    {selectedTable.guest_name && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">Guest</p>
                        <p className="text-foreground font-medium">{selectedTable.guest_name}</p>
                      </div>
                    )}
                    {selectedTable.order_total && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">Order Total</p>
                        <p className="text-foreground font-medium">₹{Number(selectedTable.order_total).toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Clear Table - only show for occupied tables */}
                  {selectedTable.status === "occupied" && (
                    <div className="space-y-2">
                      {selectedTable.is_paid && (
                        <div className="bg-emerald-500/10 rounded-lg p-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Payment received — waiting for guests to leave</span>
                        </div>
                      )}
                      <Button onClick={() => clearTable(selectedTable.id)} variant="default" className="w-full bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle className="h-4 w-4 mr-2" /> Clear Table (Guests Left)
                      </Button>
                    </div>
                  )}

                  {/* Status change for non-occupied */}
                  {selectedTable.status !== "occupied" && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Change Status</p>
                      <div className="flex flex-wrap gap-2">
                        {(["available", "occupied", "reserved"] as TableStatus[])
                          .filter((s) => s !== selectedTable.status)
                          .map((s) => {
                            const c = statusConfig[s];
                            return (
                              <Button key={s} variant="outline" size="sm"
                                onClick={() => changeStatus(selectedTable.id, s)}
                                className={`${c.bg} ${c.color} border-transparent capitalize`}>
                                Mark {s}
                              </Button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* QR Code */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5" /> QR Code for Table Ordering
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-3 rounded-xl" id={`qr-table-${selectedTable.id}`}>
                        <QRCodeSVG value={`${window.location.origin}/order/${selectedTable.id}`} size={120} level="H" includeMargin={false} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-muted-foreground">Customers scan to view menu & order from Table {selectedTable.table_number}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => {
                            const svg = document.querySelector(`#qr-table-${selectedTable.id} svg`);
                            if (!svg) return;
                            const svgData = new XMLSerializer().serializeToString(svg);
                            const canvas = document.createElement("canvas");
                            canvas.width = 400; canvas.height = 480;
                            const ctx = canvas.getContext("2d")!;
                            ctx.fillStyle = "white"; ctx.fillRect(0, 0, 400, 480);
                            const img = new Image();
                            img.onload = () => {
                              ctx.drawImage(img, 50, 30, 300, 300);
                              ctx.fillStyle = "black"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
                              ctx.fillText(`Table ${selectedTable.table_number}`, 200, 380);
                              ctx.font = "16px sans-serif"; ctx.fillStyle = "#666";
                              ctx.fillText("Scan to order", 200, 420);
                              const link = document.createElement("a");
                              link.download = `table-${selectedTable.table_number}-qr.png`;
                              link.href = canvas.toDataURL("image/png");
                              link.click();
                            };
                            img.src = "data:image/svg+xml;base64," + btoa(svgData);
                          }}>
                            <Download className="h-3 w-3 mr-1" /> Download
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => {
                            const svg = document.querySelector(`#qr-table-${selectedTable.id} svg`);
                            if (!svg) return;
                            const svgData = new XMLSerializer().serializeToString(svg);
                            const printWindow = window.open("", "_blank");
                            if (!printWindow) return;
                            printWindow.document.write(`
                              <html><head><title>Table ${selectedTable.table_number} QR</title>
                              <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;}
                              h1{font-size:36px;margin-top:20px;}p{color:#666;font-size:18px;}</style></head>
                              <body>${svgData}<h1>Table ${selectedTable.table_number}</h1><p>Scan to place your order</p>
                              <script>setTimeout(()=>{window.print();window.close();},500)<\/script></body></html>
                            `);
                            printWindow.document.close();
                          }}>
                            <Printer className="h-3 w-3 mr-1" /> Print
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TablesPage;
