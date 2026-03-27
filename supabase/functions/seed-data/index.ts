import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: string[] = [];

  // 1. Create branches
  const { data: branches, error: brErr } = await supabase.from("branches").upsert([
    { name: "Main Branch", address: "MG Road, Bangalore", phone: "+91-9876543210", is_active: true },
    { name: "Indiranagar", address: "100 Feet Road, Indiranagar", phone: "+91-9876543211", is_active: true },
    { name: "Koramangala", address: "80 Feet Road, Koramangala", phone: "+91-9876543212", is_active: true },
  ], { onConflict: "name", ignoreDuplicates: true }).select();
  results.push(`Branches: ${branches?.length ?? 0} (${brErr?.message ?? "ok"})`);

  const branchId = branches?.[0]?.id;

  // 2. Create menu categories
  const { data: categories } = await supabase.from("menu_categories").upsert([
    { name: "Main Course", sort_order: 1, branch_id: branchId },
    { name: "Starters", sort_order: 2, branch_id: branchId },
    { name: "Sides", sort_order: 3, branch_id: branchId },
    { name: "Beverages", sort_order: 4, branch_id: branchId },
    { name: "Desserts", sort_order: 5, branch_id: branchId },
  ], { onConflict: "name", ignoreDuplicates: true }).select();
  results.push(`Categories: ${categories?.length ?? 0}`);

  const catMap: Record<string, string> = {};
  categories?.forEach(c => catMap[c.name] = c.id);

  // 3. Create ingredients
  const ingredientData = [
    { name: "Paneer", category: "Dairy", current_stock: 12, unit: "kg", min_threshold: 5, cost_per_unit: 320, status: "good", branch_id: branchId, expiry_date: "2026-04-05" },
    { name: "Chicken Breast", category: "Protein", current_stock: 3, unit: "kg", min_threshold: 8, cost_per_unit: 280, status: "low", branch_id: branchId, expiry_date: "2026-03-30" },
    { name: "Basmati Rice", category: "Grains", current_stock: 25, unit: "kg", min_threshold: 10, cost_per_unit: 85, status: "good", branch_id: branchId },
    { name: "Tomatoes", category: "Vegetables", current_stock: 8, unit: "kg", min_threshold: 5, cost_per_unit: 40, status: "expiring", branch_id: branchId, expiry_date: "2026-03-29" },
    { name: "Cooking Oil", category: "Oils", current_stock: 0, unit: "L", min_threshold: 5, cost_per_unit: 180, status: "out", branch_id: branchId },
    { name: "Garam Masala", category: "Spices", current_stock: 2.5, unit: "kg", min_threshold: 1, cost_per_unit: 650, status: "good", branch_id: branchId },
    { name: "Onions", category: "Vegetables", current_stock: 15, unit: "kg", min_threshold: 10, cost_per_unit: 35, status: "good", branch_id: branchId },
    { name: "Cream", category: "Dairy", current_stock: 1.5, unit: "L", min_threshold: 3, cost_per_unit: 220, status: "low", branch_id: branchId, expiry_date: "2026-04-02" },
    { name: "Green Chilli", category: "Vegetables", current_stock: 0.8, unit: "kg", min_threshold: 1, cost_per_unit: 80, status: "low", branch_id: branchId },
    { name: "Curd", category: "Dairy", current_stock: 4, unit: "kg", min_threshold: 3, cost_per_unit: 60, status: "good", branch_id: branchId },
    { name: "Salt", category: "Spices", current_stock: 8, unit: "kg", min_threshold: 2, cost_per_unit: 20, status: "good", branch_id: branchId },
    { name: "Disposable Plates", category: "Cutlery", current_stock: 50, unit: "pcs", min_threshold: 100, cost_per_unit: 3, status: "low", branch_id: branchId },
  ];
  const { data: ingr, error: ingErr } = await supabase.from("ingredients").upsert(ingredientData, { onConflict: "name", ignoreDuplicates: true }).select();
  results.push(`Ingredients: ${ingr?.length ?? 0} (${ingErr?.message ?? "ok"})`);

  // 4. Create menu items
  const menuItems = [
    { name: "Paneer Butter Masala", category_id: catMap["Main Course"], selling_price: 320, cost_price: 98, branch_id: branchId, prep_time_minutes: 20 },
    { name: "Chicken Biryani", category_id: catMap["Main Course"], selling_price: 380, cost_price: 142, branch_id: branchId, prep_time_minutes: 30 },
    { name: "Dal Tadka", category_id: catMap["Main Course"], selling_price: 220, cost_price: 45, branch_id: branchId, prep_time_minutes: 15 },
    { name: "Jeera Rice", category_id: catMap["Sides"], selling_price: 150, cost_price: 32, branch_id: branchId, prep_time_minutes: 12 },
    { name: "Butter Naan", category_id: catMap["Sides"], selling_price: 60, cost_price: 15, branch_id: branchId, prep_time_minutes: 8 },
    { name: "Chicken Tikka", category_id: catMap["Starters"], selling_price: 280, cost_price: 95, branch_id: branchId, prep_time_minutes: 18 },
    { name: "Paneer Tikka", category_id: catMap["Starters"], selling_price: 260, cost_price: 80, branch_id: branchId, prep_time_minutes: 18 },
    { name: "Masala Chai", category_id: catMap["Beverages"], selling_price: 50, cost_price: 12, branch_id: branchId, prep_time_minutes: 5 },
    { name: "Gulab Jamun", category_id: catMap["Desserts"], selling_price: 120, cost_price: 30, branch_id: branchId, prep_time_minutes: 5 },
    { name: "Tandoori Roti", category_id: catMap["Sides"], selling_price: 40, cost_price: 10, branch_id: branchId, prep_time_minutes: 6 },
  ];
  const { data: items, error: itemErr } = await supabase.from("menu_items").upsert(menuItems, { onConflict: "name", ignoreDuplicates: true }).select();
  results.push(`Menu items: ${items?.length ?? 0} (${itemErr?.message ?? "ok"})`);

  // 5. Create restaurant tables
  const tableData = [];
  for (let i = 1; i <= 12; i++) {
    const section = i <= 4 ? "Indoor" : i <= 8 ? "Outdoor" : i <= 10 ? "Balcony" : "VIP";
    const seats = section === "VIP" ? 6 : section === "Balcony" ? 2 : 4;
    tableData.push({ table_number: i, section, seats, status: "available", branch_id: branchId });
  }
  const { data: tables, error: tblErr } = await supabase.from("restaurant_tables").upsert(tableData, { onConflict: "table_number", ignoreDuplicates: true }).select();
  results.push(`Tables: ${tables?.length ?? 0} (${tblErr?.message ?? "ok"})`);

  // 6. Create stock alerts
  const { error: alertErr } = await supabase.from("stock_alerts").insert([
    { type: "out_of_stock", ingredient_name: "Cooking Oil", message: "Cooking Oil is completely out of stock. 3 dishes disabled.", branch_id: branchId },
    { type: "low_stock", ingredient_name: "Chicken Breast", message: "Chicken Breast at 37% of minimum threshold.", branch_id: branchId },
    { type: "expiring", ingredient_name: "Tomatoes", message: "Tomatoes expiring in 3 days.", branch_id: branchId },
    { type: "low_stock", ingredient_name: "Cream", message: "Cream at 50% of minimum threshold.", branch_id: branchId },
  ]);
  results.push(`Alerts: ${alertErr?.message ?? "ok"}`);

  // 7. Create orders for today with various statuses and sources
  const today = new Date().toISOString().split("T")[0];
  const orderSources = ["pos", "swiggy", "zomato", "qr", "phone"];
  const orderTypes = ["dine_in", "takeaway", "online"];
  const paymentModes = ["cash", "upi", "card"];
  const statuses = ["new", "accepted", "preparing", "ready", "completed", "completed", "completed", "completed"];
  const menuItemNames = items?.map(i => ({ id: i.id, name: i.name, price: i.selling_price })) ?? [];

  const ordersToInsert = [];
  const orderItemsToInsert: any[] = [];

  for (let i = 0; i < 25; i++) {
    const hour = 8 + Math.floor(Math.random() * 14); // 8am to 10pm
    const minute = Math.floor(Math.random() * 60);
    const createdAt = `${today}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    const source = orderSources[Math.floor(Math.random() * orderSources.length)];
    const type = source === "swiggy" || source === "zomato" ? "online" : source === "qr" ? "dine_in" : orderTypes[Math.floor(Math.random() * 2)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const payment = status === "completed" ? paymentModes[Math.floor(Math.random() * paymentModes.length)] : "pending";

    // Pick 1-4 random items
    const itemCount = 1 + Math.floor(Math.random() * 3);
    const selectedItems = [];
    for (let j = 0; j < itemCount; j++) {
      const item = menuItemNames[Math.floor(Math.random() * menuItemNames.length)];
      const qty = 1 + Math.floor(Math.random() * 3);
      selectedItems.push({ ...item, qty });
    }

    const subtotal = selectedItems.reduce((s, it) => s + it.price * it.qty, 0);
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    const tableId = type === "dine_in" && tables?.length ? tables[Math.floor(Math.random() * tables.length)].id : null;

    ordersToInsert.push({
      order_source: source,
      order_type: type,
      status,
      payment_mode: payment,
      subtotal,
      tax,
      total,
      discount: 0,
      branch_id: branchId,
      table_id: tableId,
      created_at: createdAt,
      completed_at: status === "completed" ? createdAt : null,
      customer_name: `Customer ${i + 1}`,
      _items: selectedItems,
    });
  }

  const { data: orders, error: ordErr } = await supabase.from("orders").insert(
    ordersToInsert.map(({ _items, ...o }) => o)
  ).select();
  results.push(`Orders: ${orders?.length ?? 0} (${ordErr?.message ?? "ok"})`);

  if (orders) {
    for (let i = 0; i < orders.length; i++) {
      const selItems = ordersToInsert[i]._items;
      for (const it of selItems) {
        orderItemsToInsert.push({
          order_id: orders[i].id,
          menu_item_id: it.id,
          item_name: it.name,
          quantity: it.qty,
          unit_price: it.price,
          total_price: it.price * it.qty,
        });
      }
    }
    const { error: oiErr } = await supabase.from("order_items").insert(orderItemsToInsert);
    results.push(`Order items: ${orderItemsToInsert.length} (${oiErr?.message ?? "ok"})`);
  }

  // 8. Mark some tables as occupied
  if (tables && tables.length >= 4) {
    await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", tables[0].id);
    await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", tables[1].id);
    await supabase.from("restaurant_tables").update({ status: "reserved" }).eq("id", tables[2].id);

    // Create table sessions for occupied tables
    await supabase.from("table_sessions").insert([
      { table_id: tables[0].id, guest_name: "Raj Sharma", guest_count: 4, branch_id: branchId },
      { table_id: tables[1].id, guest_name: "Priya Patel", guest_count: 2, branch_id: branchId },
    ]);
    results.push("Table sessions created");
  }

  // 9. Create daily summaries for last 7 days
  const summaries = [];
  for (let d = 7; d >= 1; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split("T")[0];
    const rev = 18000 + Math.floor(Math.random() * 20000);
    const cost = Math.floor(rev * (0.35 + Math.random() * 0.1));
    const totalOrders = 25 + Math.floor(Math.random() * 30);
    summaries.push({
      summary_date: dateStr,
      branch_id: branchId,
      total_revenue: rev,
      total_cost: cost,
      gross_profit: rev - cost,
      total_orders: totalOrders,
      avg_order_value: Math.round(rev / totalOrders),
      dine_in_orders: Math.floor(totalOrders * 0.5),
      takeaway_orders: Math.floor(totalOrders * 0.2),
      online_orders: Math.floor(totalOrders * 0.3),
      cash_revenue: Math.floor(rev * 0.3),
      upi_revenue: Math.floor(rev * 0.4),
      card_revenue: Math.floor(rev * 0.15),
      swiggy_revenue: Math.floor(rev * 0.08),
      zomato_revenue: Math.floor(rev * 0.07),
      peak_hour: 12 + Math.floor(Math.random() * 4),
      cancellation_count: Math.floor(Math.random() * 3),
      wastage_cost: 200 + Math.floor(Math.random() * 500),
    });
  }
  const { error: sumErr } = await supabase.from("daily_summaries").insert(summaries);
  results.push(`Daily summaries: ${summaries.length} (${sumErr?.message ?? "ok"})`);

  // 10. Create wastage logs
  const { error: wErr } = await supabase.from("wastage_logs").insert([
    { ingredient_name: "Tomatoes", category: "Vegetables", quantity: 2, unit: "kg", cost: 80, reason: "expired", branch_id: branchId },
    { ingredient_name: "Cream", category: "Dairy", quantity: 0.5, unit: "L", cost: 110, reason: "spoiled", branch_id: branchId },
    { ingredient_name: "Paneer", category: "Dairy", quantity: 0.3, unit: "kg", cost: 96, reason: "over_cooking", branch_id: branchId },
  ]);
  results.push(`Wastage logs: ${wErr?.message ?? "ok"}`);

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
