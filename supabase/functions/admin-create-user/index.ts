import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "owner" | "branch_manager" | "employee";

// Caller role -> roles they may create
const CAN_CREATE: Record<AppRole, AppRole[]> = {
  super_admin: ["admin", "owner", "branch_manager", "employee"],
  admin: ["owner", "branch_manager", "employee"],
  owner: ["branch_manager", "employee"],
  branch_manager: ["employee"],
  employee: [],
};

// Always return 200 so the supabase-js client surfaces our `{ ok, error }` body
// instead of swallowing it under a generic "non-2xx status code" error.
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ ok: false, error: "Missing Authorization header" });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) return respond({ ok: false, error: "Unauthorized — please sign in again" });

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles || []).map((r) => r.role) as AppRole[];
    if (roles.length === 0) {
      return respond({ ok: false, error: "You don't have permission to create users" });
    }

    const body = await req.json().catch(() => ({}));
    const {
      email,
      password,
      full_name,
      role,
      custom_role_name,
      permissions,
      branch_id,
    } = body || {};

    if (!email || !password) {
      return respond({ ok: false, error: "Email and password are required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return respond({ ok: false, error: "Password must be at least 6 characters" });
    }

    // If caller specified a role, enforce hierarchy
    let targetRole: AppRole | null = null;
    if (role) {
      targetRole = role as AppRole;
      const canCreate = roles.flatMap((r) => CAN_CREATE[r] || []);
      if (!canCreate.includes(targetRole)) {
        return respond({
          ok: false,
          error: `You don't have permission to create a user with role "${targetRole}"`,
        });
      }
    } else {
      // Backward-compat: no role provided just creates the auth user
      const allowed = ["super_admin", "admin", "owner", "branch_manager"];
      if (!roles.some((r) => allowed.includes(r))) {
        return respond({ ok: false, error: "You don't have permission to create users" });
      }
    }

    // Custom role name uniqueness within this parent
    if (targetRole && custom_role_name) {
      const { data: dup } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("parent_user_id", caller.id)
        .ilike("custom_role_name", custom_role_name)
        .maybeSingle();
      if (dup) {
        return respond({
          ok: false,
          error: `You already have a "${custom_role_name}" under you. Pick a different name.`,
        });
      }
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "" },
    });

    if (error) {
      return respond({ ok: false, error: error.message });
    }

    const newUserId = data.user?.id;

    // Insert role assignment with hierarchy fields
    if (newUserId && targetRole) {
      const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: newUserId,
        role: targetRole,
        parent_user_id: caller.id,
        custom_role_name: custom_role_name || null,
        permissions: Array.isArray(permissions) ? permissions : [],
        branch_id: branch_id || null,
        assigned_by: caller.id,
        is_active: true,
      });
      if (roleErr) {
        return respond({ ok: false, error: `User created but role assignment failed: ${roleErr.message}` });
      }
    }

    // Audit log
    await supabaseAdmin.from("user_audit_log").insert({
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      action: "create_user",
      target_user_id: newUserId,
      target_email: email,
      details: {
        role: targetRole,
        custom_role_name: custom_role_name || null,
        branch_id: branch_id || null,
        permissions: permissions || [],
      },
    });

    return respond({ ok: true, user: data.user });
  } catch (err) {
    return respond({ ok: false, error: (err as Error).message || "Unexpected server error" });
  }
});
