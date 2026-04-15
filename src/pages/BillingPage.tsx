import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, Minus, Trash2, Receipt, X, Loader2, UtensilsCrossed, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  cost_price: number;
  is_available: boolean;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface TableOption {
  id: string;
  table_number: number;
  status: string;
}

const BillingPage = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<"menu" | "cart">("menu");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [tables, setTables] = useState<TableOption[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      const [{ data: items }, { data: cats }, { data: tablesData }] = await Promise.all([
        supabase.from("menu_items").select("id, name, selling_price, cost_price, is_available, category_id").eq("is_active", true).order("name"),
        supabase.from("menu_categories").select("id, name"),
        supabase.from("restaurant_tables").select("id, table_number, status").eq("is_active", true).order("table_number"),
      ]);
      const catMap: Record<string, string> = {};
      cats?.forEach(c => catMap[c.id] = c.name);
      setMenuItems((items || []).map(i => ({ ...i, category: catMap[i.category_id || ""] || "Uncategorized" })));
      setTables(tablesData || []);
      setLoading(false);
    };
    fetch();
    searchRef.current?.focus();
  }, []);

  const filteredItems = useMemo(
    () => menuItems.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase())),
    [search, menuItems]
  );

  const addToCart = useCallback((item: MenuItem) => {
    if (!item.is_available) return;
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.selling_price, quantity: 1 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(c => c.menuItemId === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));
  }, []);

  const removeItem = useCallback((id: string) => setCart(prev => prev.filter(c => c.menuItemId !== id)), []);
  const clearCart = useCallback(() => { setCart([]); setSelectedTableId(""); }, []);

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (orderType === "dine_in" && !selectedTableId) {
      toast({ title: "Select a table", description: "Dining orders require a table number", variant: "destructive" });
      return;
    }
    setPlacingOrder(true);

    const { data: order, error } = await supabase.from("orders").insert({
      order_source: "pos" as const,
      order_type: orderType,
      status: "new" as const,
      payment_mode: "pending" as const,
      subtotal,
      tax,
      total,
      discount: 0,
      created_by: user?.id,
      table_id: orderType === "dine_in" ? selectedTableId : null,
    }).select("id, order_number").single();

    if (error || !order) {
      toast({ title: "Error", description: error?.message || "Failed to create order", variant: "destructive" });
      setPlacingOrder(false);
      return;
    }

    await supabase.from("order_items").insert(
      cart.map(c => ({
        order_id: order.id,
        menu_item_id: c.menuItemId,
        item_name: c.name,
        quantity: c.quantity,
        unit_price: c.price,
        total_price: c.price * c.quantity,
      }))
    );

    // Update table status if dining
    if (orderType === "dine_in" && selectedTableId) {
      await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", selectedTableId);
      await supabase.from("table_sessions").insert({
        table_id: selectedTableId,
        guest_name: "POS Customer",
        order_id: order.id,
      });
    }

    // Print KOT
    const tableInfo = orderType === "dine_in"
      ? `Table ${tables.find(t => t.id === selectedTableId)?.table_number || "?"}`
      : "Takeaway";
    printKOT(order.order_number, tableInfo, cart);

    toast({ title: "Order placed & KOT sent!", description: `Order #${order.order_number} — ${tableInfo}` });
    setCart([]);
    setSelectedTableId("");
    setSearch("");
    setPlacingOrder(false);
    searchRef.current?.focus();
  };

  const printKOT = (orderNum: number, tableInfo: string, items: CartItem[]) => {
    const printWindow = window.open("", "_blank", "width=300,height=500");
    if (!printWindow) return;
    const staffName = profile?.full_name || user?.email || "Staff";
    const staffId = user?.id?.slice(0, 8).toUpperCase() || "N/A";
    const itemsHtml = items.map(i => `
      <tr><td style="padding:4px 0;font-size:14px;">${i.name}</td><td style="text-align:right;padding:4px 0;font-size:14px;font-weight:bold;">×${i.quantity}</td></tr>
    `).join("");
    printWindow.document.write(`
      <html><head><title>KOT #${orderNum}</title>
      <style>body{font-family:monospace;margin:0;padding:16px;width:260px;}
      h2{text-align:center;margin:0 0 4px;font-size:18px;}
      .info{text-align:center;font-size:13px;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;}
      table{width:100%;border-collapse:collapse;}
      .staff{border-top:1px dashed #000;margin-top:8px;padding-top:6px;font-size:11px;text-align:center;color:#555;}
      .footer{margin-top:4px;text-align:center;font-size:11px;}</style></head>
      <body>
        <h2>--- KOT ---</h2>
        <div class="info">
          <div><strong>Order #${orderNum}</strong></div>
          <div>${tableInfo}</div>
          <div>${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <table>${itemsHtml}</table>
        <div class="staff">KOT by: ${staffName} (${staffId})</div>
        <div class="footer">Kitchen Copy</div>
        <script>setTimeout(()=>{window.print();window.close();},400)<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Disable F8 for accidental billing - checkout is now a separate flow on Active Orders
      if (e.key === "F8") { e.preventDefault(); return; }
      if (e.key === "/" && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); setActivePanel("menu"); return; }
      if (e.key === "Escape") { search ? setSearch("") : searchRef.current?.blur(); return; }
      if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); setActivePanel(p => p === "menu" ? "cart" : "menu"); return; }
      if (activePanel === "menu" && document.activeElement !== searchRef.current) {
        if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === "Enter") { e.preventDefault(); const item = filteredItems[selectedIndex]; if (item) addToCart(item); }
      }
      if (e.key === "F9") { e.preventDefault(); clearCart(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search, activePanel, selectedIndex, filteredItems, addToCart, clearCart]);

  useEffect(() => { setSelectedIndex(0); }, [search]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const categories = ["All", ...new Set(menuItems.map(i => i.category))];
  const availableTables = tables.filter(t => t.status === "available");

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-7rem)] md:h-[calc(100vh-3rem)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl font-bold text-foreground whitespace-nowrap">Billing</h1>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder='Search dishes... (press "/" to focus)' className="pl-9 bg-card border-border" onFocus={() => setActivePanel("menu")} />
          </div>
        </div>

        {/* Order Type & Table Selector */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => { setOrderType("dine_in"); setSelectedTableId(""); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${orderType === "dine_in" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              <UtensilsCrossed className="h-3.5 w-3.5" /> Dining
            </button>
            <button onClick={() => { setOrderType("takeaway"); setSelectedTableId(""); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${orderType === "takeaway" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              <ShoppingBag className="h-3.5 w-3.5" /> Takeaway
            </button>
          </div>
          {orderType === "dine_in" && (
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {availableTables.length === 0 && (
                  <SelectItem value="none" disabled>No tables available</SelectItem>
                )}
                {availableTables.map(t => (
                  <SelectItem key={t.id} value={t.id}>Table {t.table_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          {[{ key: "/", label: "Search" }, { key: "↑↓", label: "Navigate" }, { key: "Enter", label: "Add item" }, { key: "Tab", label: "Switch panel" }, { key: "F9", label: "Clear" }].map(s => (
            <span key={s.key} className="text-[10px] font-mono bg-secondary text-muted-foreground rounded px-1.5 py-0.5">
              <span className="text-foreground font-semibold">{s.key}</span> {s.label}
            </span>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {categories.map(cat => (
            <button key={cat} onClick={() => setSearch(cat === "All" ? "" : cat)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${(cat === "All" && !search) || search === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filteredItems.map((item, idx) => (
            <button key={item.id} onClick={() => addToCart(item)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all ${idx === selectedIndex && activePanel === "menu" ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/20" : "bg-card border border-border hover:bg-muted/50"}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-mono font-semibold text-foreground">₹{item.selling_price}</span>
                {!item.is_available && <span className="text-[10px] bg-destructive/10 text-destructive rounded px-1.5 py-0.5">Unavailable</span>}
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
          {filteredItems.length === 0 && <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No dishes found</div>}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className={`w-full md:w-80 shrink-0 flex flex-col rounded-xl border bg-card ${activePanel === "cart" ? "border-primary/30 ring-1 ring-primary/20" : "border-border"}`}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">
              {orderType === "dine_in" ? "Dine-In" : "Takeaway"} Order
            </h2>
          </div>
          {cart.length > 0 && <button onClick={clearCart} className="text-xs text-muted-foreground hover:text-destructive transition-colors"><X className="h-4 w-4" /></button>}
        </div>

        {orderType === "dine_in" && selectedTableId && (
          <div className="px-4 py-2 bg-primary/5 border-b border-border text-xs font-medium text-primary">
            Table {tables.find(t => t.id === selectedTableId)?.table_number}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Receipt className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">No items yet</p><p className="text-xs mt-1">Search and add dishes</p>
            </div>
          ) : cart.map(item => (
            <div key={item.menuItemId} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground font-mono">₹{item.price} × {item.quantity}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.menuItemId, -1)} className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-destructive/20 transition-colors"><Minus className="h-3 w-3" /></button>
                <span className="text-sm font-mono w-6 text-center text-foreground">{item.quantity}</span>
                <button onClick={() => updateQty(item.menuItemId, 1)} className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors"><Plus className="h-3 w-3" /></button>
                <button onClick={() => removeItem(item.menuItemId)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"><Trash2 className="h-3 w-3" /></button>
              </div>
              <span className="text-sm font-mono font-semibold text-foreground w-14 text-right">₹{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span className="font-mono">₹{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>GST (5%)</span><span className="font-mono">₹{tax.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border"><span>Total</span><span className="font-mono">₹{total.toLocaleString()}</span></div>
          <Button onClick={handlePlaceOrder} disabled={cart.length === 0 || placingOrder} className="w-full mt-2" size="lg">
            {placingOrder ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
            Place Order & Print KOT
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
