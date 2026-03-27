import { useState, useEffect } from "react";
import { Users, Clock, User, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
}

const statusConfig: Record<TableStatus, { label: string; color: string; bg: string; ring: string }> = {
  available: { label: "Available", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  occupied: { label: "Occupied", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" },
  reserved: { label: "Reserved", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
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

    // Get active sessions for occupied tables
    const { data: sessions } = await supabase
      .from("table_sessions")
      .select("table_id, guest_name, guest_count, seated_at, order_id")
      .is("cleared_at", null);

    const enriched: TableData[] = tablesData.map((t) => {
      const session = sessions?.find((s) => s.table_id === t.id);
      return {
        ...t,
        guest_name: session?.guest_name ?? undefined,
        occupied_since: session?.seated_at ? new Date(session.seated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
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

  const changeStatus = async (tableId: string, newStatus: TableStatus) => {
    await supabase.from("restaurant_tables").update({ status: newStatus }).eq("id", tableId);
    if (newStatus === "available") {
      await supabase.from("table_sessions").update({ cleared_at: new Date().toISOString() }).eq("table_id", tableId).is("cleared_at", null);
    }
    setSelectedTable(null);
    toast({ title: `Table ${tables.find((t) => t.id === tableId)?.table_number} → ${newStatus}` });
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
          const cfg = statusConfig[table.status as TableStatus] || statusConfig.available;
          return (
            <button key={table.id} onClick={() => setSelectedTable(table)}
              className={`relative rounded-xl border p-3 sm:p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${cfg.bg} border-transparent ring-1 ${cfg.ring}`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className={`text-base sm:text-lg font-bold font-mono ${cfg.color}`}>T{table.table_number}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${table.status === "available" ? "bg-emerald-500" : table.status === "occupied" ? "bg-destructive" : "bg-amber-500"}`} />
              </div>
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
                <span className="text-[10px] sm:text-xs">{table.seats} seats</span>
              </div>
              {table.status === "occupied" && table.guest_name && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-card-foreground text-[10px] sm:text-xs truncate">{table.guest_name}</span>
                  </div>
                  {table.occupied_since && (
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground text-[10px] sm:text-xs">{table.occupied_since}</span>
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
          {selectedTable && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-xl font-mono">Table {selectedTable.table_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[selectedTable.status as TableStatus]?.bg} ${statusConfig[selectedTable.status as TableStatus]?.color}`}>
                    {statusConfig[selectedTable.status as TableStatus]?.label}
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
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Change Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(["available", "occupied", "reserved"] as TableStatus[])
                      .filter((s) => s !== selectedTable.status)
                      .map((s) => {
                        const cfg = statusConfig[s];
                        return (
                          <Button key={s} variant="outline" size="sm"
                            onClick={() => changeStatus(selectedTable.id, s)}
                            className={`${cfg.bg} ${cfg.color} border-transparent capitalize`}>
                            Mark {s}
                          </Button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TablesPage;
