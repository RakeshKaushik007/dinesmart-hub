import { useState } from "react";
import { Users, Clock, User, CalendarClock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restaurantTables, type RestaurantTable, type TableStatus } from "@/data/mockTables";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<TableStatus, { label: string; color: string; bg: string; ring: string }> = {
  available: {
    label: "Available",
    color: "text-stock-good",
    bg: "bg-stock-good/10",
    ring: "ring-stock-good/30",
  },
  occupied: {
    label: "Occupied",
    color: "text-destructive",
    bg: "bg-destructive/10",
    ring: "ring-destructive/30",
  },
  reserved: {
    label: "Reserved",
    color: "text-accent",
    bg: "bg-accent/10",
    ring: "ring-accent/30",
  },
};

const TablesPage = () => {
  const [tables, setTables] = useState(restaurantTables);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const { toast } = useToast();

  const sections = ["all", ...new Set(restaurantTables.map((t) => t.section))];

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

  const totalGuests = tables
    .filter((t) => t.status === "occupied")
    .reduce((s, t) => s + t.seats, 0);

  const changeStatus = (tableId: string, newStatus: TableStatus) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: newStatus,
              guestName: newStatus === "available" ? undefined : t.guestName,
              orderTotal: newStatus === "available" ? undefined : t.orderTotal,
              occupiedSince: newStatus === "occupied" ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
              reservedFor: newStatus === "reserved" ? t.reservedFor || "Walk-in" : undefined,
              reservedAt: newStatus === "reserved" ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
            }
          : t
      )
    );
    setSelectedTable(null);
    toast({
      title: `Table ${tables.find((t) => t.id === tableId)?.number} → ${newStatus}`,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Table Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {totalGuests} guests seated · {counts.available} tables free
          </p>
        </div>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {(["available", "occupied", "reserved"] as TableStatus[]).map((s) => {
          const cfg = statusConfig[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-xl border p-3 sm:p-4 text-left transition-all ${
                statusFilter === s
                  ? `${cfg.bg} border-transparent ring-2 ${cfg.ring}`
                  : "bg-card border-border hover:bg-muted/30"
              }`}
            >
              <p className={`text-lg sm:text-2xl font-bold font-mono ${cfg.color}`}>
                {counts[s]}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 capitalize">{s}</p>
            </button>
          );
        })}
      </div>

      {/* Section filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {sections.map((sec) => (
          <button
            key={sec}
            onClick={() => setSectionFilter(sec)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors shrink-0 ${
              sectionFilter === sec
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {sec === "all" ? "All Sections" : sec}
          </button>
        ))}
      </div>

      {/* Floor plan grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
        {filtered.map((table) => {
          const cfg = statusConfig[table.status];
          return (
            <button
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`relative rounded-xl border p-3 sm:p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${cfg.bg} border-transparent ring-1 ${cfg.ring}`}
            >
              {/* Table number */}
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className={`text-base sm:text-lg font-bold font-mono ${cfg.color}`}>
                  T{table.number}
                </span>
                <span className={`h-2.5 w-2.5 rounded-full ${
                  table.status === "available" ? "bg-stock-good" :
                  table.status === "occupied" ? "bg-destructive" :
                  "bg-accent"
                }`} />
              </div>

              {/* Seats */}
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
                <span className="text-[10px] sm:text-xs">{table.seats} seats</span>
              </div>

              {/* Status-specific info */}
              {table.status === "occupied" && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-card-foreground text-[10px] sm:text-xs truncate">{table.guestName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground text-[10px] sm:text-xs">{table.occupiedSince}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-mono font-semibold text-foreground mt-1">
                    ₹{table.orderTotal?.toLocaleString()}
                  </p>
                </div>
              )}

              {table.status === "reserved" && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-card-foreground text-[10px] sm:text-xs truncate">{table.reservedFor}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <CalendarClock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground text-[10px] sm:text-xs">{table.reservedAt}</span>
                  </div>
                </div>
              )}

              {table.status === "available" && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">{table.section}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Table detail dialog */}
      <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedTable && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-xl font-mono">Table {selectedTable.number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[selectedTable.status].bg} ${statusConfig[selectedTable.status].color}`}>
                    {statusConfig[selectedTable.status].label}
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
                  {selectedTable.guestName && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Guest</p>
                      <p className="text-foreground font-medium">{selectedTable.guestName}</p>
                    </div>
                  )}
                  {selectedTable.orderTotal && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Order Total</p>
                      <p className="text-foreground font-medium font-mono">₹{selectedTable.orderTotal.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedTable.reservedFor && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Reserved For</p>
                      <p className="text-foreground font-medium">{selectedTable.reservedFor}</p>
                    </div>
                  )}
                  {selectedTable.reservedAt && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Reserved At</p>
                      <p className="text-foreground font-medium">{selectedTable.reservedAt}</p>
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
                          <Button
                            key={s}
                            variant="outline"
                            size="sm"
                            onClick={() => changeStatus(selectedTable.id, s)}
                            className={`${cfg.bg} ${cfg.color} border-transparent hover:${cfg.bg} capitalize`}
                          >
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
