import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "owner" | "branch_manager" | "employee";

// Permanent Blennix testing accounts — never soft-delete via this endpoint.
const PROTECTED_EMAILS = new Set([
  "superadmin@blennix.com",
  "admin@blennix.com",
  "owner@blennix.com",
  "manager@blennix.com",
  "employee@blennix.com",
]);

const respond = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ ok: false, error: "Missing Authorization header" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) return respond({ ok: false, error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const { target_user_id, dry_run } = body || {};
    if (!target_user_id) return respond({ ok: false, error: "target_user_id is required" });
    if (target_user_id === caller.id) return respond({ ok: false, error: "You cannot delete yourself" });

    // Hard block: protected testing accounts can never be soft-deleted via this endpoint.
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("email")
      .eq("user_id", target_user_id)
      .maybeSingle();
    if (targetProfile?.email && PROTECTED_EMAILS.has(targetProfile.email.toLowerCase())) {
      return respond({ ok: false, error: "This is a protected testing account and cannot be deleted." });
    }

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const roles = (callerRoles || []).map((r) => r.role) as AppRole[];
    const isSuper = roles.includes("super_admin") || roles.includes("admin");

    // Check authority: super admin can delete anyone, otherwise must be the parent
    if (!isSuper) {
      const { data: targetRole } = await admin
        .from("user_roles")
        .select("parent_user_id")
        .eq("user_id", target_user_id)
        .maybeSingle();
      if (!targetRole || targetRole.parent_user_id !== caller.id) {
        return respond({ ok: false, error: "You can only delete users you created" });
      }
    }

    // Compute descendants via recursive walk
    const collectDescendants = async (rootId: string): Promise<string[]> => {
      const out = new Set<string>();
      const queue = [rootId];
      while (queue.length) {
        const parentId = queue.shift()!;
        const { data: kids } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("parent_user_id", parentId);
        for (const k of kids || []) {
          if (!out.has(k.user_id) && k.user_id !== rootId) {
            out.add(k.user_id);
            queue.push(k.user_id);
          }
        }
      }
      return Array.from(out);
    };

    const descendants = await collectDescendants(target_user_id);

    // Get role breakdown for preview
    const allIds = [target_user_id, ...descendants];
    const { data: allRoles } = await admin
      .from("user_roles")
      .select("user_id, role, custom_role_name")
      .in("user_id", allIds);

    const breakdown: Record<string, number> = {};
    for (const r of allRoles || []) {
      breakdown[r.role] = (breakdown[r.role] || 0) + 1;
    }

    if (dry_run) {
      return respond({
        ok: true,
        preview: {
          target_user_id,
          descendant_count: descendants.length,
          breakdown,
        },
      });
    }

    // Soft-delete: deactivate all roles + profiles for target + descendants
    const { error: roleErr } = await admin
      .from("user_roles")
      .update({ is_active: false })
      .in("user_id", allIds);
    if (roleErr) return respond({ ok: false, error: `Failed to deactivate roles: ${roleErr.message}` });

    const { error: profErr } = await admin
      .from("profiles")
      .update({ is_active: false })
      .in("user_id", allIds);
    if (profErr) return respond({ ok: false, error: `Failed to deactivate profiles: ${profErr.message}` });

    // Status consistency: cascade soft-delete to owned tenants & subscriptions.
    // Restaurants owned by any deactivated user are flagged inactive + cancelled,
    // and their branches mirror the inactive flag.
    const { data: ownedRestaurants } = await admin
      .from("restaurants")
      .select("id")
      .in("owner_user_id", allIds);
    const restaurantIds = (ownedRestaurants || []).map((r: any) => r.id);
    if (restaurantIds.length > 0) {
      await admin
        .from("restaurants")
        .update({
          is_active: false,
          subscription_status: "cancelled",
          subscription_updated_at: new Date().toISOString(),
        })
        .in("id", restaurantIds);
      await admin
        .from("branches")
        .update({ is_active: false })
        .in("restaurant_id", restaurantIds);
    }

    // Audit log
    await admin.from("user_audit_log").insert({
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      action: "delete_user_cascade",
      target_user_id,
      details: {
        descendants,
        descendant_count: descendants.length,
        breakdown,
        cascaded_restaurants: restaurantIds,
      },
    });

    return respond({
      ok: true,
      deactivated_count: allIds.length,
      descendant_count: descendants.length,
      cascaded_restaurant_count: restaurantIds.length,
    });
  } catch (err) {
    return respond({ ok: false, error: (err as Error).message || "Unexpected server error" });
  }
});