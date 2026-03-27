import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Plus, Minus, Send, Loader2, ChefHat, X, RotateCcw } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  selling_price: number;
  category_id: string | null;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

const KioskPage = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: menuData }, { data: catData }] = await Promise.all([
        supabase.from("menu_items").select("id, name, description, selling_price, category_id, is_available").eq("is_active", true).eq("is_available", true),
        supabase.from("menu_categories").select("id, name").eq("is_active", true).order("sort_order"),
      ]);
      setItems(menuData || []);
      setCategories(catData || []);
      setLoading(false);
    };
    load();
  }, []);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) return prev.map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1 }];
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

    const { data: order } = await supabase.from("orders").insert({
      order_type: "takeaway" as const,
      order_source: "pos" as const,
      status: "new" as const,
      payment_mode: "pending" as const,
      customer_name: customerName || "Counter Customer",
      subtotal, tax, total,
    }).select("id, order_number").single();

    if (!order) { setPlacing(false); return; }

    await supabase.from("order_items").insert(
      cart.map((c) => ({
        order_id: order.id,
        menu_item_id: c.menuItem.id,
        item_name: c.menuItem.name,
        quantity: c.quantity,
        unit_price: c.menuItem.selling_price,
        total_price: c.menuItem.selling_price * c.quantity,
      }))
    );

    setOrderNumber(order.order_number);
    setOrderPlaced(true);
    setCart([]);
    setCustomerName("");
    setPlacing(false);

    // Auto-reset after 8 seconds
    setTimeout(() => { setOrderPlaced(false); setOrderNumber(null); }, 8000);
  };

  const filtered = activeCat === "all" ? items : items.filter((i) => i.category_id === activeCat);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="text-center space-y-6">
          <div className="h-28 w-28 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto animate-pulse">
            <ChefHat className="h-14 w-14 text-emerald-400" />
          </div>
          <h1 className="text-5xl font-black text-emerald-400">Order Placed!</h1>
          <p className="text-3xl font-mono font-bold text-white">Token #{orderNumber}</p>
          <p className="text-lg text-zinc-400">Please wait while your order is being prepared</p>
          <button onClick={() => { setOrderPlaced(false); setOrderNumber(null); }}
            className="mt-6 px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg flex items-center gap-3 mx-auto hover:bg-orange-600 transition-colors">
            <RotateCcw className="h-5 w-5" /> New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-orange-500">BLENNIX</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">Self-Service Kiosk</p>
          </div>
        </div>

        {/* Categories */}
        <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide border-b border-zinc-800/50">
          <button onClick={() => setActiveCat("all")}
            className={`shrink-0 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeCat === "all" ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
            All Items
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className={`shrink-0 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeCat === cat.id ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => {
              const inCart = cart.find((c) => c.menuItem.id === item.id);
              return (
                <button key={item.id} onClick={() => addToCart(item)}
                  className={`rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98] border-2 ${
                    inCart ? "bg-orange-500/10 border-orange-500/50" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  }`}>
                  <h3 className="font-bold text-sm text-white">{item.name}</h3>
                  {item.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{item.description}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-lg font-black text-orange-400">₹{item.selling_price}</p>
                    {inCart && (
                      <span className="h-7 w-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Cart Sidebar */}
      <div className="w-80 lg:w-96 border-l border-zinc-800 flex flex-col bg-zinc-900/50">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-bold">Cart</h2>
          <span className="ml-auto text-sm text-zinc-500">{cartCount} items</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-center text-zinc-600 py-12 text-sm">Tap items to add to cart</p>
          ) : cart.map((c) => (
            <div key={c.menuItem.id} className="bg-zinc-800/50 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.menuItem.name}</p>
                <p className="text-xs text-zinc-500">₹{c.menuItem.selling_price}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateQty(c.menuItem.id, -1)} className="h-8 w-8 rounded-lg bg-zinc-700 flex items-center justify-center hover:bg-zinc-600">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-bold w-6 text-center">{c.quantity}</span>
                <button onClick={() => updateQty(c.menuItem.id, 1)} className="h-8 w-8 rounded-lg bg-zinc-700 flex items-center justify-center hover:bg-zinc-600">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-sm font-bold font-mono w-16 text-right text-orange-400">₹{c.menuItem.selling_price * c.quantity}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-800 px-5 py-4 space-y-3">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Your Name"
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-orange-500/50"
          />
          <div className="flex justify-between text-sm"><span className="text-zinc-500">Subtotal</span><span className="font-mono">₹{cartTotal}</span></div>
          <div className="flex justify-between text-sm"><span className="text-zinc-500">Tax (5%)</span><span className="font-mono">₹{(cartTotal * 0.05).toFixed(2)}</span></div>
          <div className="flex justify-between text-lg font-black pt-1 border-t border-zinc-800"><span>Total</span><span className="font-mono text-orange-400">₹{(cartTotal * 1.05).toFixed(2)}</span></div>
          <button onClick={placeOrder} disabled={placing || cart.length === 0}
            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-orange-600 disabled:opacity-40 transition-colors">
            {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {placing ? "Placing..." : "Place Order"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KioskPage;
