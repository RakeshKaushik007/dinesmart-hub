import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const auth = req.headers.get("Authorization");
    if (!auth) return respond({ ok: false, error: "Missing Authorization" });
    const { data: { user } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return respond({ ok: false, error: "Unauthorized" });

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (callerRoles || []).map((r) => r.role);
    const allowed = ["super_admin", "admin", "owner"];
    if (!roles.some((r) => allowed.includes(r))) {
      return respond({ ok: false, error: "Only owners and admins can reset data." });
    }

    const body = await req.json().catch(() => ({}));
    const { confirm } = body || {};
    if (confirm !== "RESET") {
      return respond({ ok: false, error: "Confirmation token mismatch." });
    }

    // Wipe operational tables. Order matters for FK-ish relations.
    const tables = [
      "stock_alerts",
      "stock_transactions",
      "wastage_logs",
      "purchase_order_items",
      "purchase_orders",
      "order_items",
      "table_sessions",
      "orders",
      "daily_summaries",
      "prep_batches",
    ];

    for (const t of tables) {
      const { error } = await admin.from(t).delete().not("id", "is", null);
      if (error) console.error(`reset ${t}`, error.message);
    }

    // Reset ingredient stock to zero, clear expiry & last_restocked
    await admin
      .from("ingredients")
      .update({
        current_stock: 0,
        expiry_date: null,
        last_restocked: null,
        status: "out",
      })
      .not("id", "is", null);

    // Free all tables
    await admin
      .from("restaurant_tables")
      .update({ status: "available" })
      .not("id", "is", null);

    await admin.from("user_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "owner_reset_data",
      details: { tables_cleared: tables },
    });

    return respond({ ok: true });
  } catch (e) {
    return respond({ ok: false, error: (e as Error).message });
  }
});
