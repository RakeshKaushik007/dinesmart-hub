import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Plus, Minus, Send, Loader2, ChefHat, X } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  selling_price: number;
  category_id: string | null;
  image_url: string | null;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

const CustomerOrderPage = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: menuData }, { data: catData }, { data: tableData }] = await Promise.all([
        supabase.from("menu_items").select("id, name, description, selling_price, category_id, image_url, is_available").eq("is_active", true).eq("is_available", true),
        supabase.from("menu_categories").select("id, name").eq("is_active", true).order("sort_order"),
        tableId ? supabase.from("restaurant_tables").select("table_number").eq("id", tableId).single() : Promise.resolve({ data: null }),
      ]);
      setItems(menuData || []);
      setCategories(catData || []);
      if (tableData) setTableNumber(tableData.table_number);
      setLoading(false);
    };
    load();
  }, [tableId]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) return prev.map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1, notes: "" }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) => prev.map((c) => c.menuItem.id === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0));
  };

  const cartTotal = cart.reduce((s, c) => s + c.menuItem.selling_price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    const subtotal = cartTotal;
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + tax;

    const { data: order, error } = await supabase.from("orders").insert({
      order_type: "dine_in" as const,
      order_source: "qr" as const,
      status: "new" as const,
      payment_mode: "pending" as const,
      table_id: tableId || null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      subtotal,
      tax,
      total,
    }).select("id, order_number").single();

    if (error || !order) {
      setPlacing(false);
      return;
    }

    const orderItems = cart.map((c) => ({
      order_id: order.id,
      menu_item_id: c.menuItem.id,
      item_name: c.menuItem.name,
      quantity: c.quantity,
      unit_price: c.menuItem.selling_price,
      total_price: c.menuItem.selling_price * c.quantity,
      notes: c.notes || null,
    }));

    await supabase.from("order_items").insert(orderItems);

    // Update table status to occupied
    if (tableId) {
      await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", tableId);
      await supabase.from("table_sessions").insert({
        table_id: tableId,
        guest_name: customerName || "QR Customer",
        order_id: order.id,
      });
    }

    setOrderNumber(order.order_number);
    setOrderPlaced(true);
    setCart([]);
    setPlacing(false);
  };

  const filtered = activeCat === "all" ? items : items.filter((i) => i.category_id === activeCat);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <ChefHat className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">Order Placed!</h1>
          <p className="text-lg text-emerald-600/80 dark:text-emerald-500/80">Order #{orderNumber}</p>
          {tableNumber && <p className="text-sm text-muted-foreground">Table {tableNumber}</p>}
          <p className="text-sm text-muted-foreground">Your order has been sent to the kitchen. Sit back and relax!</p>
          <button onClick={() => { setOrderPlaced(false); setOrderNumber(null); }}
            className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
            Order More
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-orange-200/50 dark:border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-bold text-foreground">Blennix Menu</h1>
            {tableNumber && <p className="text-xs text-muted-foreground">Table {tableNumber}</p>}
          </div>
          <button onClick={() => setCartOpen(true)} className="relative p-2 rounded-xl bg-orange-500 text-white">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="sticky top-[57px] z-20 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md px-4 py-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 max-w-lg mx-auto">
          <button onClick={() => setActiveCat("all")}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCat === "all" ? "bg-orange-500 text-white" : "bg-white dark:bg-zinc-800 text-muted-foreground"}`}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCat === cat.id ? "bg-orange-500 text-white" : "bg-white dark:bg-zinc-800 text-muted-foreground"}`}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-24">
        {filtered.map((item) => {
          const inCart = cart.find((c) => c.menuItem.id === item.id);
          return (
            <div key={item.id} className="bg-white dark:bg-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-orange-100 dark:border-zinc-700">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-1.5">₹{item.selling_price}</p>
              </div>
              <div className="shrink-0">
                {inCart ? (
                  <div className="flex items-center gap-2 bg-orange-500/10 rounded-xl p-1">
                    <button onClick={() => updateQty(item.id, -1)} className="h-7 w-7 rounded-lg bg-orange-500 text-white flex items-center justify-center">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center text-foreground">{inCart.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="h-7 w-7 rounded-lg bg-orange-500 text-white flex items-center justify-center">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(item)} className="px-4 py-1.5 rounded-xl border-2 border-orange-500 text-orange-600 dark:text-orange-400 text-xs font-bold hover:bg-orange-500 hover:text-white transition-colors">
                    ADD
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">No items available in this category.</p>
        )}
      </div>

      {/* Cart Bottom Bar */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-4">
          <button onClick={() => setCartOpen(true)}
            className="w-full max-w-lg mx-auto flex items-center justify-between bg-orange-500 text-white rounded-2xl px-5 py-3.5 shadow-xl shadow-orange-500/30">
            <span className="text-sm font-bold">{cartCount} item{cartCount > 1 ? "s" : ""}</span>
            <span className="text-sm font-bold">View Cart · ₹{cartTotal}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setCartOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-zinc-900 px-5 pt-4 pb-2 flex items-center justify-between border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Your Cart</h2>
              <button onClick={() => setCartOpen(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {cart.map((c) => (
                <div key={c.menuItem.id} className="flex items-center justify-between py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.menuItem.name}</p>
                    <p className="text-xs text-muted-foreground">₹{c.menuItem.selling_price} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(c.menuItem.id, -1)} className="h-7 w-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{c.quantity}</span>
                    <button onClick={() => updateQty(c.menuItem.id, 1)} className="h-7 w-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                      <Plus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold font-mono ml-2 w-16 text-right">₹{c.menuItem.selling_price * c.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 space-y-3 border-t border-border">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your Name (optional)"
                className="w-full px-3 py-2 rounded-xl bg-muted text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone Number (optional)"
                className="w-full px-3 py-2 rounded-xl bg-muted text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <div className="px-5 py-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono font-medium">₹{cartTotal}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax (5%)</span><span className="font-mono font-medium">₹{(cartTotal * 0.05).toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-border"><span>Total</span><span className="font-mono">₹{(cartTotal * 1.05).toFixed(2)}</span></div>
              <button onClick={placeOrder} disabled={placing || cart.length === 0}
                className="w-full mt-3 py-3.5 bg-orange-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {placing ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerOrderPage;
