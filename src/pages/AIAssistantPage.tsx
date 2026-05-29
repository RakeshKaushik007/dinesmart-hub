import { useEffect, useState } from "react";
import { Bot, Sparkles, TrendingUp, AlertTriangle, PackageSearch, Boxes, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AIAssistantChat from "@/components/ai/AIAssistantChat";

const QUICK_PROMPTS = [
  { icon: AlertTriangle, label: "What's low on stock right now?", category: "Inventory" },
  { icon: PackageSearch, label: "Which ingredients are expiring this week?", category: "Expiry" },
  { icon: TrendingUp, label: "Top 5 most expensive ingredients in stock", category: "Cost" },
  { icon: Boxes, label: "Suggest restocks for items below threshold", category: "Restock" },
  { icon: Sparkles, label: "Summarize inventory health in 3 bullets", category: "Summary" },
  { icon: Lightbulb, label: "Which items should I reorder before the weekend?", category: "Planning" },
];

const AIAssistantPage = () => {
  const [stats, setStats] = useState({ total: 0, low: 0, out: 0, expiring: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ingredients").select("status");
      const rows = data ?? [];
      setStats({
        total: rows.length,
        low: rows.filter((r) => r.status === "low").length,
        out: rows.filter((r) => r.status === "out").length,
        expiring: rows.filter((r) => r.status === "expiring" || r.status === "expired").length,
      });
    })();
  }, []);

  const sendQuickPrompt = (text: string) => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Message AI assistant"]');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    setTimeout(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }, 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Owner AI Assistant
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Sparkles className="h-3 w-3" /> Powered by Lovable AI
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Ask anything about inventory, expiries, costs, and restocks. Approve AI restock proposals in one click.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Tracked items" value={stats.total} tone="default" />
        <StatTile label="Low stock" value={stats.low} tone="warn" />
        <StatTile label="Out of stock" value={stats.out} tone="danger" />
        <StatTile label="Expiring / expired" value={stats.expiring} tone="warn" />
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ minHeight: "640px" }}>
          <AIAssistantChat heightClass="h-[640px]" />
        </div>

        <aside className="rounded-xl border border-border bg-card p-4 space-y-3 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Quick prompts</h2>
          </div>
          <p className="text-xs text-muted-foreground">Tap to ask. Replies stream live from the model.</p>
          <div className="space-y-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => sendQuickPrompt(p.label)}
                className="w-full text-left rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors p-3 group"
              >
                <div className="flex items-start gap-2">
                  <p.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{p.category}</p>
                    <p className="text-xs font-medium text-foreground leading-snug">{p.label}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

const StatTile = ({ label, value, tone }: { label: string; value: number; tone: "default" | "warn" | "danger" }) => {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className={`mt-1 text-2xl font-bold font-mono ${toneClass}`}>{value}</p>
    </div>
  );
};

export default AIAssistantPage;
