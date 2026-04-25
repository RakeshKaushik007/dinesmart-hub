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
    if (!roles.some((r) => r === "super_admin" || r === "admin")) {
      return respond({ ok: false, error: "Only Super Admins or Admins can create restaurants" });
    }

    const body = await req.json().catch(() => ({}));
    const {
      restaurant_name,
      address,
      phone,
      owner_email,
      owner_password,
      owner_full_name,
      owner_custom_role_name,
    } = body || {};

    if (!restaurant_name || !owner_email || !owner_password) {
      return respond({ ok: false, error: "Restaurant name, owner email and password are required" });
    }
    if (typeof owner_password !== "string" || owner_password.length < 6) {
      return respond({ ok: false, error: "Owner password must be at least 6 characters" });
    }

    // 1. Create owner auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: owner_email,
      password: owner_password,
      email_confirm: true,
      user_metadata: { full_name: owner_full_name || "" },
    });
    if (createErr || !created.user) {
      return respond({ ok: false, error: createErr?.message || "Failed to create owner user" });
    }
    const ownerId = created.user.id;

    // 2. Assign owner role under the caller
    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: ownerId,
      role: "owner",
      parent_user_id: caller.id,
      custom_role_name: owner_custom_role_name || null,
      assigned_by: caller.id,
      is_active: true,
    });
    if (roleErr) {
      return respond({ ok: false, error: `Owner created but role assignment failed: ${roleErr.message}` });
    }

    // 3. Create the restaurant
    const { data: restaurant, error: restErr } = await admin
      .from("restaurants")
      .insert({
        name: restaurant_name,
        address: address || null,
        phone: phone || null,
        owner_user_id: ownerId,
        created_by: caller.id,
      })
      .select()
      .single();
    if (restErr) {
      return respond({ ok: false, error: `Owner created but restaurant insert failed: ${restErr.message}` });
    }

    // 4. Audit
    await admin.from("user_audit_log").insert({
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      action: "create_restaurant",
      target_user_id: ownerId,
      target_email: owner_email,
      details: {
        restaurant_id: restaurant.id,
        restaurant_name,
        owner_custom_role_name: owner_custom_role_name || null,
      },
    });

    return respond({ ok: true, restaurant, owner: created.user });
  } catch (err) {
    return respond({ ok: false, error: (err as Error).message || "Unexpected error" });
  }
});