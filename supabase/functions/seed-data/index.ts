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

  // 1. Create branch
  const { data: branches } = await supabase.from("branches").select("id, name");
  let branchId: string;
  if (branches && branches.length > 0) {
    branchId = branches[0].id;
    results.push(`Using existing branch: ${branches[0].name}`);
  } else {
    const { data: newBranch } = await supabase.from("branches").insert({ name: "Main Branch", address: "MG Road, Bangalore", phone: "+91-9876543210" }).select().single();
    branchId = newBranch!.id;
    results.push("Created Main Branch");
  }

  // 2. Menu categories
  const { data: existingCats } = await supabase.from("menu_categories").select("id, name").eq("branch_id", branchId);
  let catMap: Record<string, string> = {};
  if (existingCats && existingCats.length > 0) {
    existingCats.forEach(c => catMap[c.name] = c.id);
    results.push(`Using ${existingCats.length} existing categories`);
  } else {
    const catNames = ["Main Course", "Starters", "Sides", "Beverages", "Desserts"];
    const { data: cats } = await supabase.from("menu_categories").insert(
      catNames.map((name, i) => ({ name, sort_order: i + 1, branch_id: branchId }))
    ).select();
    cats?.forEach(c => catMap[c.name] = c.id);
    results.push(`Created ${cats?.length ?? 0} categories`);
  }

  // 3. Ingredients
  const { data: existingIngr } = await supabase.from("ingredients").select("id, name").eq("branch_id", branchId);
  if (existingIngr && existingIngr.length > 0) {
    results.push(`Using ${existingIngr.length} existing ingredients`);
  } else {
    const { data: ingr, error: ingErr } = await supabase.from("ingredients").insert([
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
    ]).select();
    results.push(`Ingredients: ${ingr?.length ?? 0} (${ingErr?.message ?? "ok"})`);
  }

  // 4. Menu items
  const { data: existingItems } = await supabase.from("menu_items").select("id, name, selling_price").eq("branch_id", branchId);
  let menuItemsList = existingItems ?? [];
  if (menuItemsList.length > 0) {
    results.push(`Using ${menuItemsList.length} existing menu items`);
  } else {
    const { data: items, error: itemErr } = await supabase.from("menu_items").insert([
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
    ]).select();
    menuItemsList = items ?? [];
    results.push(`Menu items: ${items?.length ?? 0} (${itemErr?.message ?? "ok"})`);
  }

  // 5. Restaurant tables
  const { data: existingTables } = await supabase.from("restaurant_tables").select("id").eq("branch_id", branchId);
  let tablesList = existingTables ?? [];
  if (tablesList.length > 0) {
    results.push(`Using ${tablesList.length} existing tables`);
  } else {
    const tableData = [];
    for (let i = 1; i <= 12; i++) {
      const section = i <= 4 ? "Indoor" : i <= 8 ? "Outdoor" : i <= 10 ? "Balcony" : "VIP";
      const seats = section === "VIP" ? 6 : section === "Balcony" ? 2 : 4;
      tableData.push({ table_number: i, section, seats, status: i <= 2 ? "occupied" : i === 3 ? "reserved" : "available", branch_id: branchId });
    }
    const { data: tables } = await supabase.from("restaurant_tables").insert(tableData).select();
    tablesList = tables ?? [];
    results.push(`Tables: ${tablesList.length}`);

    // Create sessions for occupied
    if (tablesList.length >= 2) {
      await supabase.from("table_sessions").insert([
        { table_id: tablesList[0].id, guest_name: "Raj Sharma", guest_count: 4, branch_id: branchId },
        { table_id: tablesList[1].id, guest_name: "Priya Patel", guest_count: 2, branch_id: branchId },
      ]);
    }
  }

  // 6. Stock alerts (always add if none exist)
  const { data: existingAlerts } = await supabase.from("stock_alerts").select("id").eq("resolved", false);
  if (!existingAlerts || existingAlerts.length === 0) {
    await supabase.from("stock_alerts").insert([
      { type: "out_of_stock", ingredient_name: "Cooking Oil", message: "Cooking Oil is completely out of stock. 3 dishes disabled.", branch_id: branchId },
      { type: "low_stock", ingredient_name: "Chicken Breast", message: "Chicken Breast at 37% of minimum threshold.", branch_id: branchId },
      { type: "expiring", ingredient_name: "Tomatoes", message: "Tomatoes expiring in 3 days.", branch_id: branchId },
      { type: "low_stock", ingredient_name: "Cream", message: "Cream at 50% of minimum threshold.", branch_id: branchId },
    ]);
    results.push("Created stock alerts");
  }

  // 7. Create today's orders
  const { data: todayOrders } = await supabase.from("orders").select("id").gte("created_at", new Date().toISOString().split("T")[0] + "T00:00:00");
  if (!todayOrders || todayOrders.length < 5) {
    const today = new Date().toISOString().split("T")[0];
    const sources = ["pos", "swiggy", "zomato", "qr", "phone"];
    const payModes = ["cash", "upi", "card"];
    const allStatuses = ["new", "accepted", "preparing", "ready", "completed", "completed", "completed", "completed"];

    const ordersToInsert = [];
    const itemsMap: any[][] = [];

    for (let i = 0; i < 25; i++) {
      const hour = 8 + Math.floor(Math.random() * 14);
      const minute = Math.floor(Math.random() * 60);
      const createdAt = `${today}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+00:00`;
      const source = sources[Math.floor(Math.random() * sources.length)];
      const type = source === "swiggy" || source === "zomato" ? "online" : source === "qr" ? "dine_in" : ["dine_in", "takeaway"][Math.floor(Math.random() * 2)];
      const status = allStatuses[Math.floor(Math.random() * allStatuses.length)];
      const payment = status === "completed" ? payModes[Math.floor(Math.random() * payModes.length)] : "pending";

      const itemCount = 1 + Math.floor(Math.random() * 3);
      const selectedItems = [];
      for (let j = 0; j < itemCount; j++) {
        const item = menuItemsList[Math.floor(Math.random() * menuItemsList.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        selectedItems.push({ id: item.id, name: item.name, price: Number(item.selling_price), qty });
      }

      const subtotal = selectedItems.reduce((s, it) => s + it.price * it.qty, 0);
      const tax = Math.round(subtotal * 0.05);
      const total = subtotal + tax;
      const tableId = type === "dine_in" && tablesList.length > 0 ? tablesList[Math.floor(Math.random() * tablesList.length)].id : null;

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
      });
      itemsMap.push(selectedItems);
    }

    const { data: orders, error: ordErr } = await supabase.from("orders").insert(ordersToInsert).select();
    results.push(`Orders: ${orders?.length ?? 0} (${ordErr?.message ?? "ok"})`);

    if (orders) {
      const allItems: any[] = [];
      for (let i = 0; i < orders.length; i++) {
        for (const it of itemsMap[i]) {
          allItems.push({
            order_id: orders[i].id,
            menu_item_id: it.id,
            item_name: it.name,
            quantity: it.qty,
            unit_price: it.price,
            total_price: it.price * it.qty,
          });
        }
      }
      const { error: oiErr } = await supabase.from("order_items").insert(allItems);
      results.push(`Order items: ${allItems.length} (${oiErr?.message ?? "ok"})`);
    }
  } else {
    results.push(`Already have ${todayOrders.length} orders today`);
  }

  // 8. Wastage logs
  const { data: existingWastage } = await supabase.from("wastage_logs").select("id");
  if (!existingWastage || existingWastage.length === 0) {
    await supabase.from("wastage_logs").insert([
      { ingredient_name: "Tomatoes", category: "Vegetables", quantity: 2, unit: "kg", cost: 80, reason: "expired", branch_id: branchId },
      { ingredient_name: "Cream", category: "Dairy", quantity: 0.5, unit: "L", cost: 110, reason: "spoiled", branch_id: branchId },
      { ingredient_name: "Paneer", category: "Dairy", quantity: 0.3, unit: "kg", cost: 96, reason: "over_cooking", branch_id: branchId },
    ]);
    results.push("Created wastage logs");
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
