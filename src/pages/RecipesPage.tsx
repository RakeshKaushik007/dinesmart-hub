import { useEffect, useMemo, useState } from "react";
import { ChefHat, Plus, Pencil, Trash2, Loader2, X, AlertCircle, TrendingUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  status: string;
}

interface MenuItem {
  id: string;
  name: string;
  selling_price: number;
  cost_price: number;
  category_id: string | null;
}

interface Category { id: string; name: string }

interface RecipeLine {
  id?: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
}

interface RecipeRow {
  menu_item_id: string;
  lines: RecipeLine[];
}

const RecipesPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeLine[]>>({});
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftLines, setDraftLines] = useState<RecipeLine[]>([]);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const loadAll = async () => {
    setLoading(true);
    const [itemsRes, catsRes, ingsRes, recipesRes] = await Promise.all([
      supabase.from("menu_items").select("id, name, selling_price, cost_price, category_id").order("name"),
      supabase.from("menu_categories").select("id, name").order("name"),
      supabase.from("ingredients").select("id, name, unit, cost_per_unit, status").order("name"),
      supabase.from("recipe_ingredients").select("id, menu_item_id, ingredient_id, quantity, unit"),
    ]);
    if (itemsRes.error || catsRes.error || ingsRes.error || recipesRes.error) {
      toast({
        title: "Failed to load recipes",
        description: itemsRes.error?.message || catsRes.error?.message || ingsRes.error?.message || recipesRes.error?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    setItems(itemsRes.data || []);
    setCategories(catsRes.data || []);
    setIngredients(ingsRes.data || []);
    const grouped: Record<string, RecipeLine[]> = {};
    for (const r of recipesRes.data || []) {
      if (!grouped[r.menu_item_id]) grouped[r.menu_item_id] = [];
      grouped[r.menu_item_id].push({
        id: r.id,
        ingredient_id: r.ingredient_id,
        quantity: Number(r.quantity),
        unit: r.unit,
      });
    }
    setRecipes(grouped);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const openEditor = (itemId: string) => {
    setEditingItemId(itemId);
    const existing = recipes[itemId] || [];
    setDraftLines(existing.length ? existing.map((l) => ({ ...l })) : []);
    setDialogOpen(true);
  };

  const addDraftLine = () => {
    const firstAvailable = ingredients[0];
    if (!firstAvailable) {
      toast({ title: "No ingredients available", description: "Add ingredients first.", variant: "destructive" });
      return;
    }
    setDraftLines((prev) => [
      ...prev,
      { ingredient_id: firstAvailable.id, quantity: 0.1, unit: firstAvailable.unit },
    ]);
  };

  const updateDraftLine = (idx: number, patch: Partial<RecipeLine>) => {
    setDraftLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const merged = { ...l, ...patch };
      if (patch.ingredient_id) {
        const ing = ingredientById.get(patch.ingredient_id);
        if (ing) merged.unit = ing.unit;
      }
      return merged;
    }));
  };

  const removeDraftLine = (idx: number) => {
    setDraftLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const computedDraftCost = useMemo(() => {
    return draftLines.reduce((sum, l) => {
      const ing = ingredientById.get(l.ingredient_id);
      if (!ing) return sum;
      return sum + Number(l.quantity || 0) * Number(ing.cost_per_unit || 0);
    }, 0);
  }, [draftLines, ingredientById]);

  const saveRecipe = async () => {
    if (!editingItemId) return;
    // Validation
    const ids = new Set<string>();
    for (const l of draftLines) {
      if (!l.ingredient_id) {
        toast({ title: "Invalid recipe", description: "Every line needs an ingredient.", variant: "destructive" });
        return;
      }
      if (ids.has(l.ingredient_id)) {
        toast({ title: "Duplicate ingredient", description: "Each ingredient can only appear once per recipe.", variant: "destructive" });
        return;
      }
      ids.add(l.ingredient_id);
      if (!l.quantity || l.quantity <= 0) {
        toast({ title: "Invalid quantity", description: "Quantity must be greater than zero.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    // Replace strategy: delete existing, then insert new
    const del = await supabase.from("recipe_ingredients").delete().eq("menu_item_id", editingItemId);
    if (del.error) {
      toast({ title: "Save failed", description: del.error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    if (draftLines.length > 0) {
      const ins = await supabase.from("recipe_ingredients").insert(
        draftLines.map((l) => ({
          menu_item_id: editingItemId,
          ingredient_id: l.ingredient_id,
          quantity: l.quantity,
          unit: l.unit,
        })),
      );
      if (ins.error) {
        toast({ title: "Save failed", description: ins.error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    // Update menu_items.cost_price to computed cost
    await supabase.from("menu_items").update({ cost_price: Number(computedDraftCost.toFixed(2)) }).eq("id", editingItemId);

    toast({ title: "Recipe saved", description: "Inventory deduction rules updated." });
    setSaving(false);
    setDialogOpen(false);
    setEditingItemId(null);
    setDraftLines([]);
    loadAll();
  };

  const clearRecipe = async (itemId: string) => {
    if (!confirm("Remove all ingredients from this recipe?")) return;
    const { error } = await supabase.from("recipe_ingredients").delete().eq("menu_item_id", itemId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("menu_items").update({ cost_price: 0 }).eq("id", itemId);
    toast({ title: "Recipe cleared" });
    loadAll();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const editingItem = items.find((i) => i.id === editingItemId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recipes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Link each menu item to its ingredients. Saving updates inventory deduction rules automatically.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search dishes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <ChefHat className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No menu items yet. Create dishes from <span className="text-foreground font-medium">Menu Management</span> first, then attach recipes here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const lines = recipes[item.id] || [];
            const computedCost = lines.reduce((sum, l) => {
              const ing = ingredientById.get(l.ingredient_id);
              return sum + (ing ? Number(l.quantity) * Number(ing.cost_per_unit) : 0);
            }, 0);
            const margin = item.selling_price > 0
              ? (((item.selling_price - computedCost) / item.selling_price) * 100).toFixed(1)
              : "0.0";
            const hasOutOfStock = lines.some((l) => ingredientById.get(l.ingredient_id)?.status === "out");

            return (
              <div key={item.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <ChefHat className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-card-foreground truncate">{item.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.category_id ? categoryById.get(item.category_id) || "Uncategorized" : "Uncategorized"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasOutOfStock && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
                        <AlertCircle className="h-3 w-3" />
                        Out
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEditor(item.id)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      {lines.length ? "Edit" : "Add"}
                    </Button>
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-6">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Selling</p>
                        <p className="text-lg font-bold font-mono text-card-foreground">₹{Number(item.selling_price).toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recipe Cost</p>
                        <p className="text-lg font-bold font-mono text-muted-foreground">₹{computedCost.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-500">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-bold font-mono">{margin}%</span>
                      <span className="text-[10px] text-muted-foreground ml-1">margin</span>
                    </div>
                  </div>

                  {lines.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No recipe defined. Inventory will not deduct on sale.
                    </p>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Ingredients ({lines.length})
                        </p>
                        <button
                          onClick={() => clearRecipe(item.id)}
                          className="text-[10px] text-destructive hover:underline uppercase tracking-wider"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {lines.map((l) => {
                          const ing = ingredientById.get(l.ingredient_id);
                          const isOut = ing?.status === "out";
                          return (
                            <div
                              key={l.id || l.ingredient_id}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                                isOut ? "bg-destructive/5 border border-destructive/20" : "bg-muted/30"
                              }`}
                            >
                              <span className={isOut ? "text-destructive font-medium" : "text-card-foreground"}>
                                {ing?.name || "Unknown ingredient"}
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {Number(l.quantity)} {l.unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingItemId(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Recipe — ${editingItem.name}` : "Recipe"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {draftLines.length === 0 && (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                No ingredients added yet.
              </p>
            )}
            {draftLines.map((line, idx) => {
              const ing = ingredientById.get(line.ingredient_id);
              return (
                <div key={idx} className="flex items-end gap-2 rounded-lg border border-border p-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ingredient</label>
                    <Select
                      value={line.ingredient_id}
                      onValueChange={(v) => updateDraftLine(idx, { ingredient_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {ingredients.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} <span className="text-muted-foreground">({i.unit})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantity</label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => updateDraftLine(idx, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="w-16 space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Unit</label>
                    <Input value={ing?.unit || line.unit} readOnly className="bg-muted/50" />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeDraftLine(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            <Button variant="outline" className="w-full" onClick={addDraftLine}>
              <Plus className="h-4 w-4 mr-2" />
              Add ingredient
            </Button>
          </div>

          <div className="rounded-lg bg-muted/40 px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Computed recipe cost</span>
            <span className="font-mono font-bold">₹{computedDraftCost.toFixed(2)}</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingItemId(null); }} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveRecipe} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecipesPage;
