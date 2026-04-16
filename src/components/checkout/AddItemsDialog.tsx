import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Minus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  is_available: boolean;
}

interface NewItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  open: boolean;
  orderId: string;
  orderNumber: number;
  onClose: () => void;
  onAdded: () => void;
}

const AddItemsDialog = ({ open, orderId, orderNumber, onClose, onAdded }: Props) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setNewItems([]);
    const fetch = async () => {
      setLoading(true);
      const [{ data: items }, { data: cats }] = await Promise.all([
        supabase.from("menu_items").select("id, name, selling_price, is_available, category_id").eq("is_active", true).eq("is_available", true).order("name"),
        supabase.from("menu_categories").select("id, name"),
      ]);
      const catMap: Record<string, string> = {};
      cats?.forEach(c => catMap[c.id] = c.name);
      setMenuItems((items || []).map(i => ({ ...i, category: catMap[i.category_id || ""] || "Uncategorized" })));
      setLoading(false);
    };
    fetch();
  }, [open]);

  const filtered = useMemo(
    () => menuItems.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase())),
    [search, menuItems]
  );

  const addItem = (item: MenuItem) => {
    setNewItems(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.selling_price, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setNewItems(prev => prev.map(c => c.menuItemId === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));
  };

  const handleSave = async () => {
    if (newItems.length === 0) return;
    setSaving(true);

    const { error } = await supabase.from("order_items").insert(
      newItems.map(c => ({
        order_id: orderId,
        menu_item_id: c.menuItemId,
        item_name: c.name,
        quantity: c.quantity,
        unit_price: c.price,
        total_price: c.price * c.quantity,
      }))
    );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Recalculate order totals
    const { data: allItems } = await supabase.from("order_items")
      .select("total_price, is_void, is_nc")
      .eq("order_id", orderId);

    if (allItems) {
      const subtotal = allItems.filter(i => !i.is_void).reduce((s, i) => s + (i.is_nc ? 0 : Number(i.total_price)), 0);
      const settings = JSON.parse(localStorage.getItem("blennix_settings") || "{}");
      const taxPct = parseFloat(settings.taxRate || "5") / 100;
      const tax = subtotal * taxPct;
      await supabase.from("orders").update({ subtotal, tax, total: subtotal + tax }).eq("id", orderId);
    }

    toast({ title: "Items Added", description: `${newItems.length} item(s) added to Order #${orderNumber}` });
    setSaving(false);
    onAdded();
    onClose();
  };

  const itemTotal = newItems.reduce((s, c) => s + c.price * c.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Items — Order #{orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..." className="pl-9" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 max-h-48">
            {filtered.map(item => {
              const inCart = newItems.find(c => c.menuItemId === item.id);
              return (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category} · ₹{item.selling_price}</p>
                  </div>
                  {inCart ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-destructive/20"><Minus className="h-3 w-3" /></button>
                      <span className="text-sm font-mono w-6 text-center">{inCart.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-primary/20"><Plus className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => addItem(item)} className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No dishes found</p>}
          </div>
        )}

        {newItems.length > 0 && (
          <div className="border-t border-border pt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">New items to add:</p>
            {newItems.map(item => (
              <div key={item.menuItemId} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.quantity}× {item.name}</span>
                <span className="font-mono">₹{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
              <span>Subtotal</span>
              <span className="font-mono">₹{itemTotal.toLocaleString()}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={newItems.length === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add {newItems.length} Item{newItems.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemsDialog;
