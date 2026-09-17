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

/** Supabase URL length limits bite on large .in() lists, so page them. */
const CHUNK = 200;
const chunked = <T>(xs: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
};

/**
 * Branches the caller may reset. Mirrors public.get_user_branch_ids():
 * directly assigned + owned via restaurant + managed.
 *
 * Platform admins deliberately get an EMPTY list here. They can reach every
 * branch, so defaulting them to "everything" is precisely the bug this
 * function used to have. They must name the branches explicitly.
 */
const accessibleBranchIds = async (admin: any, userId: string): Promise<string[]> => {
  const ids = new Set<string>();

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("branch_id, is_active")
    .eq("user_id", userId);
  for (const r of roleRows ?? []) {
    if (r.branch_id && r.is_active !== false) ids.add(r.branch_id);
  }

  const { data: owned } = await admin
    .from("restaurants")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("is_active", true);
  const restaurantIds = (owned ?? []).map((r: any) => r.id);
  if (restaurantIds.length) {
    const { data: ownedBranches } = await admin
      .from("branches")
      .select("id")
      .in("restaurant_id", restaurantIds)
      .eq("is_active", true);
    for (const b of ownedBranches ?? []) ids.add(b.id);
  }

  const { data: managed } = await admin
    .from("branches")
    .select("id")
    .eq("manager_user_id", userId)
    .eq("is_active", true);
  for (const b of managed ?? []) ids.add(b.id);

  return Array.from(ids);
};

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
    if (!roles.some((r) => ["super_admin", "admin", "owner"].includes(r))) {
      return respond({ ok: false, error: "Only owners and admins can reset data." });
    }
    const isPlatformAdmin = roles.some((r) => r === "super_admin" || r === "admin");

    const body = await req.json().catch(() => ({}));
    const { confirm, branch_ids, dry_run } = body || {};
    const isDryRun = dry_run === true;
    // A dry run deletes nothing, so it deliberately does NOT need the RESET
    // token. That matters for safety: the previous deployment of this function
    // ignored dry_run entirely, so a preview carrying the token would have been
    // executed as a real, platform-wide reset. Without the token, an older
    // deployment rejects the preview instead.
    if (!isDryRun && confirm !== "RESET") {
      return respond({ ok: false, error: "Confirmation token mismatch." });
    }

    // ---- Work out exactly which branches get wiped -------------------------
    const allowed = await accessibleBranchIds(admin, user.id);
    let targets: string[];

    if (Array.isArray(branch_ids) && branch_ids.length > 0) {
      const requested = branch_ids.filter((b: unknown): b is string => typeof b === "string");
      if (isPlatformAdmin) {
        // Admins may name any branch, but it has to actually exist.
        const { data: found } = await admin.from("branches").select("id").in("id", requested);
        targets = (found ?? []).map((b: any) => b.id);
        const missing = requested.filter((id) => !targets.includes(id));
        if (missing.length) {
          return respond({ ok: false, error: `Unknown branch id(s): ${missing.join(", ")}` });
        }
      } else {
        const denied = requested.filter((id) => !allowed.includes(id));
        if (denied.length) {
          return respond({ ok: false, error: "You can only reset branches you own or manage." });
        }
        targets = requested;
      }
    } else if (isPlatformAdmin) {
      // The old behaviour here was "delete every row in the database".
      // Refuse rather than guess.
      return respond({
        ok: false,
        error: "Platform admins must pass branch_ids explicitly. Refusing to reset every branch.",
      });
    } else {
      targets = allowed;
    }

    if (targets.length === 0) {
      return respond({ ok: false, error: "No branches available to reset." });
    }

    // ---- Child rows are reached through their parents ----------------------
    const orderIds: string[] = [];
    for (const group of chunked(targets)) {
      const { data } = await admin.from("orders").select("id").in("branch_id", group);
      for (const o of data ?? []) orderIds.push(o.id);
    }
    const poIds: string[] = [];
    for (const group of chunked(targets)) {
      const { data } = await admin.from("purchase_orders").select("id").in("branch_id", group);
      for (const p of data ?? []) poIds.push(p.id);
    }

    if (isDryRun) {
      const counts: Record<string, number> = {};
      const countable = [
        "orders",
        "purchase_orders",
        "wastage_logs",
        "stock_transactions",
        "stock_alerts",
        "prep_batches",
        "table_sessions",
        "daily_summaries",
      ];
      for (const t of countable) {
        let total = 0;
        for (const group of chunked(targets)) {
          const { count } = await admin
            .from(t)
            .select("id", { count: "exact", head: true })
            .in("branch_id", group);
          total += count ?? 0;
        }
        counts[t] = total;
      }
      counts["order_items_via_orders"] = orderIds.length;
      counts["po_items_via_purchase_orders"] = poIds.length;
      return respond({ ok: true, dry_run: true, branches: targets, counts });
    }

    // Collected rather than just logged: the old version answered "ok" even
    // when a delete failed, so an owner could believe a reset completed when
    // half their data was still there.
    const failures: string[] = [];
    const note = (label: string, error: { message: string } | null) => {
      if (!error) return;
      console.error(`reset ${label}`, error.message);
      failures.push(`${label}: ${error.message}`);
    };

    // ---- Delete, children first --------------------------------------------
    for (const group of chunked(orderIds)) {
      const { error } = await admin.from("order_items").delete().in("order_id", group);
      note("order_items", error);
    }
    for (const group of chunked(poIds)) {
      const { error } = await admin.from("purchase_order_items").delete().in("purchase_order_id", group);
      note("purchase_order_items", error);
    }

    const branchScoped = [
      "stock_alerts",
      "stock_transactions",
      "wastage_logs",
      "purchase_orders",
      "table_sessions",
      "orders",
      "daily_summaries",
      "prep_batches",
    ];
    for (const t of branchScoped) {
      for (const group of chunked(targets)) {
        const { error } = await admin.from(t).delete().in("branch_id", group);
        note(t, error);
      }
    }

    // Zero the stock and free the tables for these branches only.
    for (const group of chunked(targets)) {
      const { error: ingErr } = await admin
        .from("ingredients")
        .update({ current_stock: 0, expiry_date: null, last_restocked: null, status: "out" })
        .in("branch_id", group);
      note("ingredients", ingErr);
      const { error: tableErr } = await admin
        .from("restaurant_tables")
        .update({ status: "available" })
        .in("branch_id", group);
      note("restaurant_tables", tableErr);
    }

    await admin.from("user_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "owner_reset_data",
      details: {
        branch_ids: targets,
        orders_deleted: orderIds.length,
        purchase_orders_deleted: poIds.length,
        tables_cleared: [...branchScoped, "order_items", "purchase_order_items"],
        failures,
      },
    });

    if (failures.length) {
      return respond({
        ok: false,
        error: `Reset only partly completed. Failed: ${failures.join("; ")}`,
        branches: targets,
      });
    }

    return respond({ ok: true, branches: targets, orders_deleted: orderIds.length });
  } catch (e) {
    return respond({ ok: false, error: (e as Error).message });
  }
});
