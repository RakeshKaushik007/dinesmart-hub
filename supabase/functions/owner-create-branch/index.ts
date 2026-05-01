import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const roles = (callerRoles || []).map((r) => r.role as string);
    const isOwner = roles.includes("owner");
    if (!isOwner) {
      return respond({ ok: false, error: "Only Owners can create branches" });
    }

    const body = await req.json().catch(() => ({}));
    const {
      restaurant_id,
      branch_name,
      address,
      phone,
      manager_email,
      manager_password,
      manager_full_name,
      manager_custom_role_name,
    } = body || {};

    if (!restaurant_id || !branch_name || !manager_email || !manager_password) {
      return respond({ ok: false, error: "Restaurant, branch name, manager email and password are required" });
    }
    if (typeof manager_password !== "string" || manager_password.length < 6) {
      return respond({ ok: false, error: "Manager password must be at least 6 characters" });
    }

    // Verify caller owns this restaurant.
    const { data: restaurant, error: rErr } = await admin
      .from("restaurants")
      .select("id, owner_user_id, name")
      .eq("id", restaurant_id)
      .maybeSingle();
    if (rErr || !restaurant) {
      return respond({ ok: false, error: "Restaurant not found" });
    }
    if (restaurant.owner_user_id !== caller.id) {
      return respond({ ok: false, error: "You don't own this restaurant" });
    }

    // 1. Create the manager auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: manager_email,
      password: manager_password,
      email_confirm: true,
      user_metadata: { full_name: manager_full_name || "" },
    });
    if (createErr || !created.user) {
      return respond({ ok: false, error: createErr?.message || "Failed to create manager user" });
    }
    const managerId = created.user.id;

    // 2. Create the branch
    const { data: branch, error: branchErr } = await admin
      .from("branches")
      .insert({
        name: branch_name,
        address: address || null,
        phone: phone || null,
        restaurant_id,
        manager_user_id: managerId,
        created_by: caller.id,
      })
      .select()
      .single();
    if (branchErr) {
      return respond({ ok: false, error: `Manager created but branch insert failed: ${branchErr.message}` });
    }

    // 3. Assign branch_manager role under the caller, scoped to the new branch
    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: managerId,
      role: "branch_manager",
      parent_user_id: caller.id,
      custom_role_name: manager_custom_role_name || null,
      branch_id: branch.id,
      assigned_by: caller.id,
      is_active: true,
    });
    if (roleErr) {
      return respond({ ok: false, error: `Branch created but role assignment failed: ${roleErr.message}` });
    }

    // 4. Audit
    await admin.from("user_audit_log").insert({
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      action: "create_branch",
      target_user_id: managerId,
      target_email: manager_email,
      details: {
        restaurant_id,
        restaurant_name: restaurant.name,
        branch_id: branch.id,
        branch_name,
        manager_custom_role_name: manager_custom_role_name || null,
      },
    });

    return respond({ ok: true, branch, manager: created.user });
  } catch (err) {
    return respond({ ok: false, error: (err as Error).message || "Unexpected error" });
  }
});