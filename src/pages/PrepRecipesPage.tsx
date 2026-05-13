import { useEffect, useMemo, useState } from "react";
import { Beaker, Plus, X, Loader2, CalendarIcon, ChefHat, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  current_stock: number;
  is_prep: boolean;
}

interface RecipeLine {
  id?: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
}

interface PrepRecipe {
  id: string;
  prep_ingredient_id: string;
  name: string;
  output_quantity: number;
  output_unit: string;
  notes: string | null;
}

const PrepRecipesPage = () => {
  const { toast } = useToast();
  const { user, roles } = useAuth();
  const branchId = useMemo(() => roles.find((r) => r.branch_id)?.branch_id ?? null, [roles]);

  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<PrepRecipe[]>([]);
  const [lines, setLines] = useState<Record<string, RecipeLine[]>>({});

  // Recipe editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PrepRecipe | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPrepIng, setDraftPrepIng] = useState<string>("");
  const [draftOutputQty, setDraftOutputQty] = useState("1");
  const [draftOutputUnit, setDraftOutputUnit] = useState("kg");
  const [draftLines, setDraftLines] = useState<RecipeLine[]>([]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Batch producer
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRecipe, setBatchRecipe] = useState<PrepRecipe | null>(null);
  const [batchQty, setBatchQty] = useState("1");
  const [batchExpiry, setBatchExpiry] = useState<Date | undefined>(undefined);
  const [batchNotes, setBatchNotes] = useState("");
  const [producing, setProducing] = useState(false);

  const ingById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const rawIngredients = useMemo(() => ingredients.filter((i) => !i.is_prep), [ingredients]);
  const prepIngredients = useMemo(() => ingredients.filter((i) => i.is_prep), [ingredients]);

  const load = async () => {
    setLoading(true);
    const [ingsRes, recRes, lineRes] = await Promise.all([
      supabase.from("ingredients").select("id, name, unit, cost_per_unit, current_stock, is_prep").order("name"),
      supabase.from("prep_recipes").select("id, prep_ingredient_id, name, output_quantity, output_unit, notes").order("name"),
      supabase.from("prep_recipe_ingredients").select("id, prep_recipe_id, ingredient_id, quantity, unit"),
    ]);
    setIngredients((ingsRes.data || []).map((i) => ({ ...i, is_prep: !!i.is_prep })) as Ingredient[]);
    setRecipes(recRes.data || []);
    const grouped: Record<string, RecipeLine[]> = {};
    (lineRes.data || []).forEach((l: any) => {
      if (!grouped[l.prep_recipe_id]) grouped[l.prep_recipe_id] = [];
      grouped[l.prep_recipe_id].push({
        id: l.id,
        ingredient_id: l.ingredient_id,
        quantity: Number(l.quantity),
        unit: l.unit,
      });
    });
    setLines(grouped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setDraftName("");
    setDraftPrepIng("");
    setDraftOutputQty("1");
    setDraftOutputUnit("kg");
    setDraftLines([]);
    setEditorOpen(true);
  };

  const openEdit = (recipe: PrepRecipe) => {
    setEditing(recipe);
    setDraftName(recipe.name);
    setDraftPrepIng(recipe.prep_ingredient_id);
    setDraftOutputQty(String(recipe.output_quantity));
    setDraftOutputUnit(recipe.output_unit);
    setDraftLines((lines[recipe.id] || []).map((l) => ({ ...l })));
    setEditorOpen(true);
  };

  const addDraftLine = () => {
    if (rawIngredients.length === 0) {
      toast({ title: "Add raw ingredients first", variant: "destructive" });
      return;
    }
    const first = rawIngredients[0];
    setDraftLines((prev) => [...prev, { ingredient_id: first.id, quantity: 1, unit: first.unit }]);
  };

  const updateDraftLine = (idx: number, patch: Partial<RecipeLine>) => {
    setDraftLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const merged = { ...l, ...patch };
      if (patch.ingredient_id) {
        const ing = ingById.get(patch.ingredient_id);
        if (ing) merged.unit = ing.unit;
      }
      return merged;
    }));
  };

  const removeDraftLine = (idx: number) => setDraftLines((p) => p.filter((_, i) => i !== idx));

  const ensurePrepIngredient = async (): Promise<string | null> => {
    // If the user picked a "create new" sentinel, prompt for name.
    if (draftPrepIng !== "__new__") return draftPrepIng;
    const name = draftName.trim();
    if (!name) {
      toast({ title: "Enter a recipe name", description: "Used as the prep ingredient name", variant: "destructive" });
      return null;
    }
    const { data, error } = await supabase
      .from("ingredients")
      .insert({
        name,
        unit: draftOutputUnit,
        category: "Prep",
        current_stock: 0,
        min_threshold: 0,
        cost_per_unit: 0,
        is_prep: true,
        status: "out",
        branch_id: branchId,
      })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Could not create prep ingredient", description: error.message, variant: "destructive" });
      return null;
    }
    return data.id;
  };

  const saveRecipe = async () => {
    if (!draftName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!draftPrepIng) {
      toast({ title: "Pick a prep ingredient", variant: "destructive" });
      return;
    }
    if (draftLines.some((l) => !l.ingredient_id || l.quantity <= 0)) {
      toast({ title: "Invalid lines", description: "Every line needs an ingredient and quantity > 0", variant: "destructive" });
      return;
    }
    setSavingRecipe(true);
    const prepIngId = await ensurePrepIngredient();
    if (!prepIngId) { setSavingRecipe(false); return; }

    let recipeId = editing?.id;
    if (editing) {
      await supabase.from("prep_recipes").update({
        name: draftName.trim(),
        prep_ingredient_id: prepIngId,
        output_quantity: Number(draftOutputQty) || 1,
        output_unit: draftOutputUnit,
      }).eq("id", editing.id);
    } else {
      const { data, error } = await supabase.from("prep_recipes").insert({
        prep_ingredient_id: prepIngId,
        name: draftName.trim(),
        output_quantity: Number(draftOutputQty) || 1,
        output_unit: draftOutputUnit,
        branch_id: branchId,
        created_by: user?.id,
      }).select("id").single();
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        setSavingRecipe(false);
        return;
      }
      recipeId = data.id;
    }

    if (recipeId) {
      await supabase.from("prep_recipe_ingredients").delete().eq("prep_recipe_id", recipeId);
      if (draftLines.length > 0) {
        await supabase.from("prep_recipe_ingredients").insert(
          draftLines.map((l) => ({
            prep_recipe_id: recipeId,
            ingredient_id: l.ingredient_id,
            quantity: l.quantity,
            unit: l.unit,
          })),
        );
      }
    }
    toast({ title: "Prep recipe saved" });
    setSavingRecipe(false);
    setEditorOpen(false);
    load();
  };

  const deleteRecipe = async (id: string) => {
    if (!confirm("Delete this prep recipe? Existing batches stay.")) return;
    await supabase.from("prep_recipes").delete().eq("id", id);
    toast({ title: "Recipe removed" });
    load();
  };

  const openBatch = (recipe: PrepRecipe) => {
    setBatchRecipe(recipe);
    setBatchQty(String(recipe.output_quantity));
    setBatchExpiry(undefined);
    setBatchNotes("");
    setBatchOpen(true);
  };

  const produceBatch = async () => {
    if (!batchRecipe) return;
    const qty = Number(batchQty);
    if (!(qty > 0)) {
      toast({ title: "Quantity must be > 0", variant: "destructive" });
      return;
    }
    setProducing(true);
    const recipeLines = lines[batchRecipe.id] || [];
    const factor = qty / Number(batchRecipe.output_quantity || 1);
    const prepIng = ingById.get(batchRecipe.prep_ingredient_id);
    if (!prepIng) {
      toast({ title: "Prep ingredient missing", variant: "destructive" });
      setProducing(false);
      return;
    }

    // Deduct raw materials (allow negative)
    let totalCost = 0;
    for (const line of recipeLines) {
      const ing = ingById.get(line.ingredient_id);
      if (!ing) continue;
      const deduct = line.quantity * factor;
      const newStock = Number(ing.current_stock || 0) - deduct;
      const lineCost = deduct * Number(ing.cost_per_unit || 0);
      totalCost += lineCost;
      await supabase.from("ingredients").update({
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      }).eq("id", ing.id);
      await supabase.from("stock_transactions").insert({
        ingredient_id: ing.id,
        type: "out",
        quantity: deduct,
        unit: line.unit,
        unit_cost: ing.cost_per_unit,
        total_cost: lineCost,
        reference_type: "prep_batch",
        branch_id: branchId,
        created_by: user?.id,
        notes: `Used in prep batch: ${batchRecipe.name}`,
      });
    }

    // Add prep ingredient stock
    const newPrepStock = Number(prepIng.current_stock || 0) + qty;
    const costPerUnit = qty > 0 ? totalCost / qty : 0;
    const expiryStr = batchExpiry ? format(batchExpiry, "yyyy-MM-dd") : null;
    const status = expiryStr && new Date(expiryStr) < new Date(new Date().setHours(0,0,0,0))
      ? "expired"
      : expiryStr && new Date(expiryStr) <= new Date(Date.now() + 7*86400000)
        ? "expiring"
        : newPrepStock <= 0 ? "out" : "good";
    await supabase.from("ingredients").update({
      current_stock: newPrepStock,
      cost_per_unit: Number(costPerUnit.toFixed(4)),
      expiry_date: expiryStr,
      last_restocked: new Date().toISOString(),
      status,
    }).eq("id", prepIng.id);

    const { data: batchRow } = await supabase.from("prep_batches").insert({
      prep_ingredient_id: prepIng.id,
      prep_recipe_id: batchRecipe.id,
      batch_quantity: qty,
      unit: batchRecipe.output_unit,
      expiry_date: expiryStr,
      notes: batchNotes || null,
      branch_id: branchId,
      prepared_by: user?.id,
    }).select("id").single();

    await supabase.from("stock_transactions").insert({
      ingredient_id: prepIng.id,
      type: "in",
      quantity: qty,
      unit: batchRecipe.output_unit,
      unit_cost: costPerUnit,
      total_cost: totalCost,
      reference_id: batchRow?.id,
      reference_type: "prep_batch",
      branch_id: branchId,
      created_by: user?.id,
      notes: `Produced batch: ${batchRecipe.name}${expiryStr ? ` · expires ${expiryStr}` : ""}`,
    });

    toast({ title: "Batch produced", description: `${qty} ${batchRecipe.output_unit} of ${prepIng.name} added to stock.` });
    setProducing(false);
    setBatchOpen(false);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Beaker className="h-6 w-6 text-primary" />
            Prep Recipes (Base Gravy)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Combine raw ingredients into a prep batch. The batch becomes a new ingredient that menu recipes can use.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New prep recipe
        </Button>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <ChefHat className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No prep recipes yet. Create one to start tracking Base Gravy and similar batches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {recipes.map((r) => {
            const lns = lines[r.id] || [];
            const prepIng = ingById.get(r.prep_ingredient_id);
            const cost = lns.reduce((s, l) => {
              const ing = ingById.get(l.ingredient_id);
              return s + (ing ? Number(l.quantity) * Number(ing.cost_per_unit) : 0);
            }, 0);
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-card-foreground truncate">{r.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Yields {r.output_quantity} {r.output_unit} of <span className="text-foreground font-medium">{prepIng?.name || "?"}</span>
                      {prepIng && <span className="ml-2 font-mono">· stock {Number(prepIng.current_stock).toFixed(2)} {prepIng.unit}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                    <Button size="sm" onClick={() => openBatch(r)}>Make batch</Button>
                    <button onClick={() => deleteRecipe(r.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ingredients per batch (cost ₹{cost.toFixed(2)})</p>
                  {lns.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No raw ingredients defined.</p>
                  ) : lns.map((l) => {
                    const ing = ingById.get(l.ingredient_id);
                    return (
                      <div key={l.id || l.ingredient_id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
                        <span className="text-card-foreground">{ing?.name || "Unknown"}</span>
                        <span className="font-mono text-muted-foreground">{l.quantity} {l.unit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recipe editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit prep recipe" : "New prep recipe"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label>Recipe name</Label>
                <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Base Gravy" />
              </div>
              <div className="space-y-1">
                <Label>Output unit</Label>
                <Input value={draftOutputUnit} onChange={(e) => setDraftOutputUnit(e.target.value)} placeholder="kg / L" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Prep ingredient</Label>
                <Select value={draftPrepIng} onValueChange={setDraftPrepIng}>
                  <SelectTrigger><SelectValue placeholder="Pick or create…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">+ Create new prep ingredient</SelectItem>
                    {prepIngredients.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Output quantity per batch</Label>
                <Input type="number" min="0" step="0.01" value={draftOutputQty} onChange={(e) => setDraftOutputQty(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Raw materials per batch</Label>
                <Button size="sm" variant="outline" onClick={addDraftLine}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {draftLines.length === 0 && <p className="text-xs text-muted-foreground italic">No ingredients yet.</p>}
                {draftLines.map((line, idx) => (
                  <div key={idx} className="flex items-end gap-2 rounded-lg border border-border p-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] uppercase">Ingredient</Label>
                      <Select value={line.ingredient_id} onValueChange={(v) => updateDraftLine(idx, { ingredient_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {rawIngredients.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-[10px] uppercase">Qty</Label>
                      <Input type="number" min="0" step="0.001" value={line.quantity} onChange={(e) => updateDraftLine(idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <div className="w-16 space-y-1">
                      <Label className="text-[10px] uppercase">Unit</Label>
                      <Input value={line.unit} readOnly className="bg-muted/50" />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeDraftLine(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={savingRecipe}>Cancel</Button>
            <Button onClick={saveRecipe} disabled={savingRecipe}>
              {savingRecipe && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch producer */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Produce batch — {batchRecipe?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Quantity ({batchRecipe?.output_unit})</Label>
              <Input type="number" min="0" step="0.01" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Raw materials will be deducted proportionally. Recipe yields {batchRecipe?.output_quantity} {batchRecipe?.output_unit} per batch.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Expiry date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !batchExpiry && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {batchExpiry ? format(batchExpiry, "PPP") : "Pick expiry"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={batchExpiry} onSelect={setBatchExpiry} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input value={batchNotes} onChange={(e) => setBatchNotes(e.target.value)} placeholder="e.g. Morning batch" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)} disabled={producing}>Cancel</Button>
            <Button onClick={produceBatch} disabled={producing}>
              {producing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Produce
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrepRecipesPage;
