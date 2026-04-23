import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import StockBadge from "@/components/inventory/StockBadge";
import { supabase } from "@/integrations/supabase/client";
import type { StockStatus } from "@/data/mockInventory";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const statusFilters: { label: string; value: StockStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "In Stock", value: "good" },
  { label: "Low", value: "low" },
  { label: "Out", value: "out" },
  { label: "Expiring", value: "expiring" },
];

const IngredientsPage = () => {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    unit: "kg",
    min_threshold: "",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { roles } = useAuth();
  const branchId = roles.find((r) => r.branch_id)?.branch_id ?? null;

  const fetchIngredients = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data } = await supabase.from("ingredients").select("*").order("name");
    setIngredients(data || []);
    if (showLoader) setLoading(false);
  }, []);

  useEffect(() => {
    fetchIngredients(true);

    const handleFocus = () => fetchIngredients();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchIngredients();
      }
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchIngredients();
      }
    }, 10000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchIngredients]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      category: "",
      unit: "kg",
      min_threshold: "",
    });
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name ?? "",
      category: item.category ?? "",
      unit: item.unit ?? "kg",
      min_threshold: String(item.min_threshold ?? ""),
    });
    setDialogOpen(true);
  };

  const computeStatus = (stock: number, min: number, expiry: string | null): StockStatus => {
    if (stock <= 0) return "out";
    if (stock <= min) return "low";
    if (expiry) {
      const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (days <= 7) return "expiring";
    }
    return "good";
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name required", description: "Enter an ingredient name.", variant: "destructive" });
      return;
    }
    const min = Number(form.min_threshold || 0);
    if (min < 0) {
      toast({ title: "Invalid values", description: "Threshold must be zero or positive.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    let error;
    if (editingId) {
      // Editing: only update name/category/unit/threshold; recompute status from existing stock+expiry
      const existing = ingredients.find((i) => i.id === editingId);
      const stock = Number(existing?.current_stock ?? 0);
      const expiry = existing?.expiry_date ?? null;
      const updatePayload = {
        name,
        category: form.category.trim() || null,
        unit: form.unit.trim() || "kg",
        min_threshold: min,
        status: computeStatus(stock, min, expiry),
        updated_at: new Date().toISOString(),
      };
      ({ error } = await supabase.from("ingredients").update(updatePayload).eq("id", editingId));
    } else {
      const insertPayload = {
        name,
        category: form.category.trim() || null,
        unit: form.unit.trim() || "kg",
        current_stock: 0,
        min_threshold: min,
        cost_per_unit: 0,
        expiry_date: null,
        status: computeStatus(0, min, null),
        branch_id: branchId,
      };
      ({ error } = await supabase.from("ingredients").insert(insertPayload));
    }

    if (error) {
      toast({ title: editingId ? "Could not update ingredient" : "Could not add ingredient", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    toast({ title: editingId ? "Ingredient updated" : "Ingredient added", description: `${name} saved successfully.` });
    setDialogOpen(false);
    resetForm();
    setSubmitting(false);
    fetchIngredients();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("ingredients").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Could not remove ingredient", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ingredient removed", description: "It has been deleted from stock and alerts." });
      fetchIngredients();
    }
    setDeleting(false);
    setDeleteId(null);
  };

  const categories = ["All", ...new Set(ingredients.map((i) => i.category).filter(Boolean))];

  const filtered = ingredients.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ingredients</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage raw materials and stock levels</p>
        </div>
        <button onClick={openAddDialog} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Add Ingredient
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search ingredients..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {statusFilters.map((s) => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Ingredient</th>
              <th className="text-left px-5 py-3 font-medium">Category</th>
              <th className="text-right px-5 py-3 font-medium">Stock</th>
              <th className="text-right px-5 py-3 font-medium">Min Threshold</th>
              <th className="text-right px-5 py-3 font-medium">Cost/Unit</th>
              <th className="text-left px-5 py-3 font-medium">Expiry</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-right px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5 font-medium text-card-foreground">{item.name}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{item.category}</td>
                <td className="px-5 py-3.5 text-right font-mono text-card-foreground">{item.current_stock} {item.unit}</td>
                <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">{item.min_threshold} {item.unit}</td>
                <td className="px-5 py-3.5 text-right font-mono text-card-foreground">₹{item.cost_per_unit}</td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                </td>
                <td className="px-5 py-3.5"><StockBadge status={item.status as StockStatus} /></td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => openEditDialog(item)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">No ingredients match your filters.</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit ingredient" : "Add ingredient"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ing-name">Name</Label>
              <Input id="ing-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Paneer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-cat">Category</Label>
              <Input id="ing-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Dairy" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-unit">Unit</Label>
              <Input id="ing-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, L, pcs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-stock">Current stock</Label>
              <Input id="ing-stock" type="number" min="0" step="0.01" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-min">Min threshold</Label>
              <Input id="ing-min" type="number" min="0" step="0.01" value={form.min_threshold} onChange={(e) => setForm({ ...form, min_threshold: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-cost">Cost per unit (₹)</Label>
              <Input id="ing-cost" type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-expiry">Expiry date</Label>
              <Input id="ing-expiry" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Add ingredient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IngredientsPage;
