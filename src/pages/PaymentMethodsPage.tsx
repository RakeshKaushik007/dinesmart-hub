import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BUILT_IN_PAYMENT_METHODS } from "@/hooks/usePaymentMethods";
import { PAYMENT_ICON_NAMES, getPaymentIcon, resolvePaymentIcon } from "@/lib/paymentIcons";

interface CustomMethod {
  id: string;
  name: string;
  code: string;
  type: "direct" | "aggregator";
  is_active: boolean;
  icon: string | null;
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const PaymentMethodsPage = () => {
  const { user, isAtLeast } = useAuth();
  const { toast } = useToast();
  const [methods, setMethods] = useState<CustomMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"direct" | "aggregator">("aggregator");
  const [icon, setIcon] = useState<string>("Building2");
  const [saving, setSaving] = useState(false);

  const isManager = isAtLeast("branch_manager");

  const fetchMethods = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payment_methods")
      .select("id, name, code, type, is_active, icon")
      .order("created_at", { ascending: false });
    setMethods((data || []) as CustomMethod[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const code = slugify(name);
    const { error } = await supabase.from("payment_methods").insert({
      name: name.trim(),
      code,
      type,
      icon,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payment method added", description: `${name} (${type})` });
    setName("");
    setType("aggregator");
    setIcon("Building2");
    setShowAdd(false);
    fetchMethods();
  };

  const toggleActive = async (m: CustomMethod) => {
    await supabase.from("payment_methods").update({ is_active: !m.is_active }).eq("id", m.id);
    fetchMethods();
  };

  const handleDelete = async (m: CustomMethod) => {
    if (!confirm(`Delete payment method "${m.name}"? This cannot be undone.`)) return;
    await supabase.from("payment_methods").delete().eq("id", m.id);
    toast({ title: "Deleted", description: `${m.name} removed` });
    fetchMethods();
  };

  if (!isManager) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Manager access required.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Payment Methods</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure custom payment methods that appear at checkout (e.g. Swiggy, Zomato, EazyDiner).
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Method
        </Button>
      </div>

      {/* Built-in defaults */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Built-in (always available)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {BUILT_IN_PAYMENT_METHODS.map((m) => (
            <div key={m.code} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">{m.name}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{m.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom methods */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Custom methods</h2>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No custom payment methods yet. Click "Add Method" to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => {
              const Icon = resolvePaymentIcon(m.code, m.icon);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    m.type === "direct" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.code}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    m.type === "direct" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                  }`}>
                    {m.type}
                  </span>
                  <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Display name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zomato Pay"
                autoFocus
              />
              {name && (
                <p className="text-[11px] text-muted-foreground mt-1 font-mono">code: {slugify(name)}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "direct" | "aggregator")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct (cash equivalent — counts toward direct revenue)</SelectItem>
                  <SelectItem value="aggregator">Aggregator (third-party — pending settlement)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Icon</Label>
              <div className="grid grid-cols-8 gap-1.5 mt-1.5 p-2 rounded-lg border border-border bg-secondary/30 max-h-40 overflow-y-auto">
                {PAYMENT_ICON_NAMES.map((iconName) => {
                  const Ico = getPaymentIcon(iconName);
                  const selected = icon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setIcon(iconName)}
                      title={iconName}
                      className={`h-8 w-8 flex items-center justify-center rounded-md border transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:bg-background hover:text-foreground"
                      }`}
                    >
                      <Ico className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!name.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethodsPage;
