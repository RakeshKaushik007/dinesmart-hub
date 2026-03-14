import { Clock, CheckCircle2, ChefHat, Flame } from "lucide-react";

interface KOTItem {
  id: string;
  orderId: string;
  table: string;
  source: string;
  items: { name: string; qty: number; mods?: string }[];
  status: "queued" | "cooking" | "done";
  orderedAt: string;
  priority: "normal" | "rush";
}

const mockKOTs: KOTItem[] = [
  { id: "KOT-101", orderId: "ORD-4201", table: "T-03", source: "Dine-in", items: [{ name: "Paneer Butter Masala", qty: 2, mods: "Extra butter" }, { name: "Jeera Rice", qty: 2 }], status: "cooking", orderedAt: "2026-03-14T12:30:00", priority: "normal" },
  { id: "KOT-102", orderId: "ORD-4202", table: "—", source: "Zomato", items: [{ name: "Chicken Biryani", qty: 1 }, { name: "Dal Tadka", qty: 1, mods: "Less spicy" }], status: "queued", orderedAt: "2026-03-14T12:35:00", priority: "rush" },
  { id: "KOT-103", orderId: "ORD-4203", table: "—", source: "Swiggy", items: [{ name: "Paneer Butter Masala", qty: 1 }], status: "done", orderedAt: "2026-03-14T12:20:00", priority: "normal" },
  { id: "KOT-104", orderId: "ORD-4204", table: "T-07", source: "QR", items: [{ name: "Chicken Biryani", qty: 2 }, { name: "Jeera Rice", qty: 1 }], status: "cooking", orderedAt: "2026-03-14T12:25:00", priority: "normal" },
  { id: "KOT-105", orderId: "ORD-4205", table: "T-12", source: "Dine-in", items: [{ name: "Dal Tadka", qty: 2 }, { name: "Jeera Rice", qty: 2 }], status: "queued", orderedAt: "2026-03-14T12:38:00", priority: "normal" },
];

const statusConfig: Record<string, { label: string; bg: string; icon: typeof Clock }> = {
  queued: { label: "Queued", bg: "border-amber-500/40 bg-amber-500/5", icon: Clock },
  cooking: { label: "Cooking", bg: "border-orange-500/40 bg-orange-500/5", icon: Flame },
  done: { label: "Done", bg: "border-emerald-500/40 bg-emerald-500/5 opacity-60", icon: CheckCircle2 },
};

const KitchenDisplayPage = () => {
  const queued = mockKOTs.filter(k => k.status === "queued");
  const cooking = mockKOTs.filter(k => k.status === "cooking");
  const done = mockKOTs.filter(k => k.status === "done");

  const renderKOT = (kot: KOTItem) => {
    const config = statusConfig[kot.status];
    const StatusIcon = config.icon;
    return (
      <div key={kot.id} className={`rounded-xl border-2 p-4 ${config.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-card-foreground">{kot.id}</span>
            {kot.priority === "rush" && (
              <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                Rush
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusIcon className="h-3.5 w-3.5" />
            {config.label}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span className="font-semibold text-card-foreground">{kot.table}</span>
          <span>•</span>
          <span>{kot.source}</span>
          <span>•</span>
          <span className="font-mono">{new Date(kot.orderedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="space-y-2">
          {kot.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-bold font-mono text-secondary-foreground min-w-[24px] text-center">{item.qty}</span>
              <div>
                <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                {item.mods && <p className="text-[10px] text-muted-foreground italic">— {item.mods}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ChefHat className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kitchen Display (KOT)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live kitchen order tickets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Queued <span className="rounded-full bg-amber-500/10 text-amber-600 px-1.5 text-[10px]">{queued.length}</span>
          </h2>
          <div className="space-y-3">{queued.map(renderKOT)}</div>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame className="h-3.5 w-3.5" /> Cooking <span className="rounded-full bg-orange-500/10 text-orange-600 px-1.5 text-[10px]">{cooking.length}</span>
          </h2>
          <div className="space-y-3">{cooking.map(renderKOT)}</div>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Done <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-1.5 text-[10px]">{done.length}</span>
          </h2>
          <div className="space-y-3">{done.map(renderKOT)}</div>
        </div>
      </div>
    </div>
  );
};

export default KitchenDisplayPage;
