import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronRight,
  X,
  Loader2,
  UtensilsCrossed,
  Carrot,
  LayoutGrid,
  CreditCard,
  Tag,
} from "lucide-react";

interface Step {
  key: string;
  label: string;
  hint: string;
  route: string;
  icon: typeof UtensilsCrossed;
  done: boolean;
}

const DISMISS_KEY = "blennix.onboarding_dismissed.v1";

const OnboardingChecklist = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const [cats, items, ings, tables, pmts] = await Promise.all([
        supabase.from("menu_categories").select("id", { count: "exact", head: true }),
        supabase.from("menu_items").select("id", { count: "exact", head: true }),
        supabase.from("ingredients").select("id", { count: "exact", head: true }),
        supabase.from("restaurant_tables").select("id", { count: "exact", head: true }),
        supabase.from("payment_methods").select("id", { count: "exact", head: true }),
      ]);
      if (!active) return;
      setSteps([
        { key: "cats", label: "Create menu categories", hint: "Group your dishes (Starters, Mains, Drinks…)", route: "/menu-management", icon: Tag, done: (cats.count ?? 0) > 0 },
        { key: "items", label: "Add your first menu items", hint: "Set names, prices, and prep time", route: "/menu-management", icon: UtensilsCrossed, done: (items.count ?? 0) > 0 },
        { key: "ings", label: "Stock your ingredients", hint: "Track inventory and recipe costs", route: "/ingredients", icon: Carrot, done: (ings.count ?? 0) > 0 },
        { key: "tables", label: "Set up dining tables", hint: "Floor plan, sections, and QR codes", route: "/tables", icon: LayoutGrid, done: (tables.count ?? 0) > 0 },
        { key: "pmts", label: "Configure payment methods", hint: "Cash, UPI, card, aggregators", route: "/payment-methods", icon: CreditCard, done: (pmts.count ?? 0) > 0 },
      ]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  if (dismissed) return null;
  if (loading) return null;

  const completed = steps.filter(s => s.done).length;
  const total = steps.length;
  const allDone = completed === total;
  if (allDone) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20 shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Welcome — let's set up your restaurant</h3>
            <button
              onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } setDismissed(true); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your workspace is empty. Complete these steps to start taking orders.
          </p>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{completed}/{total}</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map(step => {
              const StepIcon = step.icon;
              return (
                <button
                  key={step.key}
                  onClick={() => navigate(step.route)}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    step.done
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {step.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{step.hint}</p>
                  </div>
                  <StepIcon className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingChecklist;