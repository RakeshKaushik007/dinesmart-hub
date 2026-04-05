import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Category {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  selling_price: number;
  cost_price: number;
  category_id: string | null;
  is_active: boolean;
  is_available: boolean;
  prep_time_minutes: number | null;
}

const MenuManagementPage = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");

  // Item dialog
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "", description: "", selling_price: "", cost_price: "", category_id: "", prep_time_minutes: "",
  });

  const fetchData = async () => {
    const [{ data: cats }, { data: menuItems }] = await Promise.all([
      supabase.from("menu_categories").select("id, name, is_active, sort_order").order("sort_order"),
      supabase.from("menu_items").select("id, name, description, selling_price, cost_price, category_id, is_active, is_available, prep_time_minutes").order("name"),
    ]);
    setCategories(cats || []);
    setItems(menuItems || []);
    if (cats && expandedCats.size === 0) setExpandedCats(new Set(cats.map(c => c.id)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Category CRUD
  const openCatDialog = (cat?: Category) => {
    setEditingCat(cat || null);
    setCatName(cat?.name || "");
    setCatDialog(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    if (editingCat) {
      await supabase.from("menu_categories").update({ name: catName.trim() }).eq("id", editingCat.id);
    } else {
      await supabase.from("menu_categories").insert({ name: catName.trim(), sort_order: categories.length });
    }
    setCatDialog(false);
    fetchData();
    toast({ title: editingCat ? "Category updated" : "Category added" });
  };

  const toggleCat = async (cat: Category) => {
    await supabase.from("menu_categories").update({ is_active: !cat.is_active }).eq("id", cat.id);
    fetchData();
  };

  const deleteCat = async (catId: string) => {
    const hasItems = items.some(i => i.category_id === catId);
    if (hasItems) {
      toast({ title: "Cannot delete", description: "Remove or reassign items first", variant: "destructive" });
      return;
    }
    await supabase.from("menu_categories").delete().eq("id", catId);
    fetchData();
    toast({ title: "Category deleted" });
  };

  // Item CRUD
  const openItemDialog = (item?: MenuItem, defaultCatId?: string) => {
    setEditingItem(item || null);
    setItemForm({
      name: item?.name || "",
      description: item?.description || "",
      selling_price: item ? String(item.selling_price) : "",
      cost_price: item ? String(item.cost_price) : "",
      category_id: item?.category_id || defaultCatId || "",
      prep_time_minutes: item?.prep_time_minutes ? String(item.prep_time_minutes) : "",
    });
    setItemDialog(true);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.selling_price) return;
    const payload = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      selling_price: Number(itemForm.selling_price),
      cost_price: Number(itemForm.cost_price) || 0,
      category_id: itemForm.category_id || null,
      prep_time_minutes: itemForm.prep_time_minutes ? Number(itemForm.prep_time_minutes) : null,
    };
    if (editingItem) {
      await supabase.from("menu_items").update(payload).eq("id", editingItem.id);
    } else {
      await supabase.from("menu_items").insert(payload);
    }
    setItemDialog(false);
    fetchData();
    toast({ title: editingItem ? "Item updated" : "Item added" });
  };

  const toggleItemActive = async (item: MenuItem) => {
    await supabase.from("menu_items").update({ is_active: !item.is_active }).eq("id", item.id);
    fetchData();
  };

  const toggleItemAvailable = async (item: MenuItem) => {
    await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    fetchData();
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from("menu_items").delete().eq("id", itemId);
    fetchData();
    toast({ title: "Item deleted" });
  };

  const toggleExpand = (catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const uncategorized = items.filter(i => !i.category_id);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Menu Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{categories.length} categories · {items.length} items</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openCatDialog()}>
            <Plus className="h-4 w-4 mr-1" /> Category
          </Button>
          <Button size="sm" onClick={() => openItemDialog()}>
            <Plus className="h-4 w-4 mr-1" /> Item
          </Button>
        </div>
      </div>

      {/* Categories with items */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category_id === cat.id);
          const expanded = expandedCats.has(cat.id);
          return (
            <div key={cat.id} className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
                <button onClick={() => toggleExpand(cat.id)} className="p-0.5">
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                <span className={`font-semibold text-sm flex-1 ${!cat.is_active ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {cat.name}
                </span>
                <span className="text-xs text-muted-foreground">{catItems.length} items</span>
                <Switch checked={cat.is_active} onCheckedChange={() => toggleCat(cat)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCatDialog(cat)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCat(cat.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openItemDialog(undefined, cat.id)}>
                  <Plus className="h-3.5 w-3.5 mr-0.5" /> Add
                </Button>
              </div>
              {expanded && catItems.length > 0 && (
                <div className="divide-y divide-border">
                  {catItems.map(item => (
                    <ItemRow key={item.id} item={item}
                      onEdit={() => openItemDialog(item)}
                      onDelete={() => deleteItem(item.id)}
                      onToggleActive={() => toggleItemActive(item)}
                      onToggleAvailable={() => toggleItemAvailable(item)}
                    />
                  ))}
                </div>
              )}
              {expanded && catItems.length === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-4 text-center">No items in this category</p>
              )}
            </div>
          );
        })}

        {uncategorized.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-3 bg-muted/30">
              <span className="font-semibold text-sm text-muted-foreground">Uncategorized</span>
              <span className="text-xs text-muted-foreground ml-2">{uncategorized.length} items</span>
            </div>
            <div className="divide-y divide-border">
              {uncategorized.map(item => (
                <ItemRow key={item.id} item={item}
                  onEdit={() => openItemDialog(item)}
                  onDelete={() => deleteItem(item.id)}
                  onToggleActive={() => toggleItemActive(item)}
                  onToggleAvailable={() => toggleItemAvailable(item)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Category name" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancel</Button>
            <Button onClick={saveCat} disabled={!catName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="Item name" />
            <Textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Selling Price (₹)</label>
                <Input type="number" value={itemForm.selling_price} onChange={e => setItemForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cost Price (₹)</label>
                <Input type="number" value={itemForm.cost_price} onChange={e => setItemForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <Select value={itemForm.category_id} onValueChange={v => setItemForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prep Time (min)</label>
                <Input type="number" value={itemForm.prep_time_minutes} onChange={e => setItemForm(f => ({ ...f, prep_time_minutes: e.target.value }))} placeholder="--" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button>
            <Button onClick={saveItem} disabled={!itemForm.name.trim() || !itemForm.selling_price}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ItemRow = ({ item, onEdit, onDelete, onToggleActive, onToggleAvailable }: {
  item: MenuItem; onEdit: () => void; onDelete: () => void; onToggleActive: () => void; onToggleAvailable: () => void;
}) => (
  <div className={`flex items-center gap-3 px-4 py-2.5 ${!item.is_active ? "opacity-50" : ""}`}>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium ${!item.is_active ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.name}</p>
      {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
    </div>
    <span className="text-sm font-mono font-semibold text-foreground shrink-0">₹{item.selling_price}</span>
    <div className="flex items-center gap-1 shrink-0">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-muted-foreground">Active</span>
        <Switch checked={item.is_active} onCheckedChange={onToggleActive} className="scale-75" />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-muted-foreground">In Stock</span>
        <Switch checked={item.is_available} onCheckedChange={onToggleAvailable} className="scale-75" />
      </div>
    </div>
    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
  </div>
);

export default MenuManagementPage;
