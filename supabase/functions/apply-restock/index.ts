import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_ROLES = ["super_admin", "admin", "owner", "branch_manager"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return respond({ ok: false, error: "Server is not configured" }, 500);
    }

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return respond({ ok: false, error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return respond({ ok: false, error: "Invalid session" }, 401);
    const caller = userData.user;

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("is_active", true);
    const allowed = (roles ?? []).some((r) => ALLOWED_ROLES.includes(r.role));
    if (!allowed) return respond({ ok: false, error: "Forbidden: manager role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const ingredient_id = String(body.ingredient_id ?? "");
    const quantity = Number(body.quantity);
    const reason = String(body.reason ?? "AI-assisted restock").slice(0, 200);
    if (!ingredient_id || !(quantity > 0) || quantity > 100000) {
      return respond({ ok: false, error: "Invalid ingredient_id or quantity" }, 400);
    }

    const { data: ing, error: ingErr } = await admin
      .from("ingredients")
      .select("id, name, unit, current_stock, min_threshold, cost_per_unit, expiry_date, branch_id")
      .eq("id", ingredient_id)
      .maybeSingle();
    if (ingErr || !ing) return respond({ ok: false, error: "Ingredient not found" }, 404);

    const newStock = Number(ing.current_stock ?? 0) + quantity;
    const today = new Date().toISOString().slice(0, 10);
    const expiringSoon = ing.expiry_date && ing.expiry_date <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const status = ing.expiry_date && ing.expiry_date < today
      ? "expired"
      : newStock <= 0
        ? "out"
        : newStock <= Number(ing.min_threshold ?? 0)
          ? "low"
          : expiringSoon
            ? "expiring"
            : "good";

    const { error: updErr } = await admin
      .from("ingredients")
      .update({
        current_stock: newStock,
        status,
        last_restocked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ing.id);
    if (updErr) return respond({ ok: false, error: updErr.message }, 500);

    await admin.from("stock_transactions").insert({
      ingredient_id: ing.id,
      type: "in",
      quantity,
      unit: ing.unit,
      unit_cost: ing.cost_per_unit ?? 0,
      total_cost: quantity * Number(ing.cost_per_unit ?? 0),
      reference_type: "ai_assistant",
      branch_id: ing.branch_id,
      created_by: caller.id,
      notes: `AI-assisted restock: ${reason}`,
    });

    // Resolve any open low/out alerts now that stock is replenished.
    if (newStock > Number(ing.min_threshold ?? 0)) {
      await admin
        .from("stock_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("ingredient_id", ing.id)
        .eq("resolved", false)
        .in("type", ["low_stock", "out_of_stock"]);
    }

    await admin.from("user_audit_log").insert({
      action: "ai_restock_applied",
      actor_id: caller.id,
      actor_email: caller.email,
      details: {
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        quantity,
        unit: ing.unit,
        new_stock: newStock,
        reason,
      },
    });

    return respond({
      ok: true,
      ingredient: { id: ing.id, name: ing.name, unit: ing.unit, new_stock: newStock, status },
    });
  } catch (e) {
    console.error("apply-restock error", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});