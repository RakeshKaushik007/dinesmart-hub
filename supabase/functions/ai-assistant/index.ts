import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE || !LOVABLE_API_KEY) {
      return respond({ ok: false, error: "Server is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return respond({ ok: false, error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return respond({ ok: false, error: "Invalid session" }, 401);
    }
    const userId = userData.user.id;

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role, branch_id, is_active")
      .eq("user_id", userId);
    const activeRoles = (roleRows ?? []).filter((r: any) => r.is_active !== false);
    const isPlatformAdmin = activeRoles.some((r: any) => r.role === "super_admin" || r.role === "admin");

    const directBranchIds = activeRoles
      .map((r: any) => r.branch_id)
      .filter((id: string | null): id is string => Boolean(id));

    const { data: ownedRestaurants } = await admin
      .from("restaurants")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("is_active", true);
    const ownedRestaurantIds = (ownedRestaurants ?? []).map((r: any) => r.id);

    const branchFilters = [
      directBranchIds.length ? `id.in.(${directBranchIds.join(",")})` : null,
      ownedRestaurantIds.length ? `restaurant_id.in.(${ownedRestaurantIds.join(",")})` : null,
      `manager_user_id.eq.${userId}`,
    ].filter(Boolean) as string[];

    const { data: accessibleBranches } = branchFilters.length
      ? await admin
          .from("branches")
          .select("id")
          .or(branchFilters.join(","))
          .eq("is_active", true)
      : { data: [] as any[] };
    const branchIds = Array.from(new Set((accessibleBranches ?? []).map((b: any) => b.id)));

    const scoped = <T extends { in: (column: string, values: string[]) => T }>(query: T) => {
      if (isPlatformAdmin) return query;
      return query.in("branch_id", branchIds.length ? branchIds : ["00000000-0000-0000-0000-000000000000"]);
    };

    const { messages } = await req.json().catch(() => ({ messages: [] }));
    if (!Array.isArray(messages) || messages.length === 0) {
      return respond({ ok: false, error: "messages required" }, 400);
    }

    // Pull a compact inventory snapshot to ground the model.
    const { data: ingredients } = await scoped(
      admin
        .from("ingredients")
        .select("id, name, current_stock, unit, min_threshold, status, expiry_date, cost_per_unit, category, branch_id"),
    )
      .order("name")
      .limit(200);

    const inventoryContext = (ingredients ?? [])
      .map(
        (i) =>
          `- ${i.name} (${i.category ?? "uncategorized"}): ${i.current_stock} ${i.unit}, min ${i.min_threshold}, status ${i.status}, expires ${i.expiry_date ?? "n/a"}, cost ₹${i.cost_per_unit}/${i.unit}`,
      )
      .join("\n");

    // Pull sales / revenue context: last 30 days of completed orders + top items + daily summaries.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentOrders } = await scoped(
      admin
        .from("orders")
        .select("id, order_number, status, total, subtotal, tax, discount, payment_mode, order_type, order_source, completed_at, created_at, branch_id"),
    )
      .eq("status", "completed")
      .gte("completed_at", since)
      .order("completed_at", { ascending: false })
      .limit(500);

    const orders = recentOrders ?? [];
    const totalRevenue = orders.reduce((s, o: any) => s + Number(o.total ?? 0), 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount ? totalRevenue / orderCount : 0;

    // Aggregate by payment mode and order type
    const byPayment: Record<string, { count: number; revenue: number }> = {};
    const byType: Record<string, { count: number; revenue: number }> = {};
    const byDay: Record<string, { count: number; revenue: number }> = {};
    for (const o of orders as any[]) {
      const pm = o.payment_mode ?? "unknown";
      byPayment[pm] = byPayment[pm] || { count: 0, revenue: 0 };
      byPayment[pm].count++;
      byPayment[pm].revenue += Number(o.total ?? 0);

      const ot = o.order_type ?? "unknown";
      byType[ot] = byType[ot] || { count: 0, revenue: 0 };
      byType[ot].count++;
      byType[ot].revenue += Number(o.total ?? 0);

      const day = (o.completed_at ?? o.created_at ?? "").slice(0, 10);
      if (day) {
        byDay[day] = byDay[day] || { count: 0, revenue: 0 };
        byDay[day].count++;
        byDay[day].revenue += Number(o.total ?? 0);
      }
    }

    // Top-selling items (last 30 days)
    const orderIds = orders.map((o: any) => o.id);
    let topItemsText = "(no item sales data)";
    if (orderIds.length) {
      const { data: items } = await admin
        .from("order_items")
        .select("item_name, quantity, total_price, is_void, is_refunded")
        .in("order_id", orderIds);
      const agg: Record<string, { qty: number; revenue: number }> = {};
      for (const it of items ?? []) {
        if ((it as any).is_void || (it as any).is_refunded) continue;
        const n = (it as any).item_name ?? "Unknown";
        agg[n] = agg[n] || { qty: 0, revenue: 0 };
        agg[n].qty += Number((it as any).quantity ?? 0);
        agg[n].revenue += Number((it as any).total_price ?? 0);
      }
      const top = Object.entries(agg)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 15);
      if (top.length) {
        topItemsText = top
          .map(([name, v], i) => `${i + 1}. ${name} — ${v.qty} sold, ₹${v.revenue.toFixed(2)}`)
          .join("\n");
      }
    }

    const dailyLines = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 14)
      .map(([d, v]) => `- ${d}: ${v.count} orders, ₹${v.revenue.toFixed(2)}`)
      .join("\n") || "(no recent days)";

    const paymentLines = Object.entries(byPayment)
      .map(([k, v]) => `- ${k}: ${v.count} orders, ₹${v.revenue.toFixed(2)}`)
      .join("\n") || "(none)";

    const typeLines = Object.entries(byType)
      .map(([k, v]) => `- ${k}: ${v.count} orders, ₹${v.revenue.toFixed(2)}`)
      .join("\n") || "(none)";

    // Daily summaries table (pre-computed, if present)
    const { data: summaries } = await scoped(
      admin
        .from("daily_summaries")
        .select("summary_date, total_revenue, total_orders, total_cost, gross_profit, wastage_cost, avg_order_value, dine_in_orders, takeaway_orders, online_orders, cash_revenue, upi_revenue, card_revenue, branch_id"),
    )
      .order("summary_date", { ascending: false })
      .limit(14);
    const summaryLines = (summaries ?? [])
      .map((s: any) =>
        `- ${s.summary_date}: revenue ₹${Number(s.total_revenue ?? 0).toFixed(2)}, orders ${s.total_orders ?? 0}, profit ₹${Number(s.gross_profit ?? 0).toFixed(2)}, AOV ₹${Number(s.avg_order_value ?? 0).toFixed(2)}`,
      )
      .join("\n") || "(no precomputed summaries)";

    const systemPrompt = `You are Blennix's restaurant POS assistant. Answer concisely with markdown. Use the live snapshots below (inventory + sales) as the source of truth. If asked about something not in the data, say so.

When the user asks to restock, top-up, add stock, or order more of an ingredient, call the propose_restock tool with the matching ingredient_id from the snapshot. Never invent IDs. Always include a one-line reason. The user must confirm before anything is written; do not claim the change was applied.

All currency values are in INR (₹). The sales window is the last 30 days unless stated otherwise.

INVENTORY SNAPSHOT (${ingredients?.length ?? 0} items):
${(ingredients ?? []).map((i: any) => `- [${i.id}] ${i.name} (${i.category ?? "uncategorized"}): ${i.current_stock} ${i.unit}, min ${i.min_threshold}, status ${i.status}, expires ${i.expiry_date ?? "n/a"}, cost ₹${i.cost_per_unit}/${i.unit}`).join("\n") || "(no ingredients found)"}

SALES SUMMARY (last 30 days):
- Total revenue: ₹${totalRevenue.toFixed(2)}
- Completed orders: ${orderCount}
- Average order value: ₹${avgOrderValue.toFixed(2)}

REVENUE BY PAYMENT MODE:
${paymentLines}

REVENUE BY ORDER TYPE:
${typeLines}

DAILY REVENUE (last 14 days from recent orders):
${dailyLines}

TOP SELLING ITEMS (last 30 days, by revenue):
${topItemsText}

PRE-COMPUTED DAILY SUMMARIES (last 14):
${summaryLines}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "propose_restock",
          description: "Propose adding stock to an ingredient. Requires user confirmation before being applied.",
          parameters: {
            type: "object",
            properties: {
              ingredient_id: { type: "string", description: "UUID of the ingredient from the snapshot" },
              quantity: { type: "number", description: "Amount to add, in the ingredient's unit" },
              reason: { type: "string", description: "Short justification (e.g. 'below threshold', 'weekend prep')" },
            },
            required: ["ingredient_id", "quantity", "reason"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
      }),
    });

    if (aiResp.status === 429) {
      return respond({ ok: false, error: "Rate limit reached. Please try again shortly." }, 429);
    }
    if (aiResp.status === 402) {
      return respond({ ok: false, error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    }
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      return respond({ ok: false, error: `AI gateway error (${aiResp.status}): ${text.slice(0, 300)}` }, 500);
    }

    const json = await aiResp.json();
    const message = json.choices?.[0]?.message ?? {};
    const reply: string = message.content ?? "";
    const proposals: Array<{ ingredient_id: string; ingredient_name: string; quantity: number; unit: string; reason: string }> = [];

    const ingMap = new Map((ingredients ?? []).map((i: any) => [i.id, i]));
    for (const call of message.tool_calls ?? []) {
      if (call?.function?.name !== "propose_restock") continue;
      try {
        const args = JSON.parse(call.function.arguments ?? "{}");
        const ing: any = ingMap.get(args.ingredient_id);
        if (!ing || !(args.quantity > 0)) continue;
        proposals.push({
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          quantity: Number(args.quantity),
          unit: ing.unit,
          reason: String(args.reason ?? "").slice(0, 200),
        });
      } catch { /* ignore malformed tool call */ }
    }

    return respond({ ok: true, reply, proposals });
  } catch (e) {
    console.error("ai-assistant error", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});