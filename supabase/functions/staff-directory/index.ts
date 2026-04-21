import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AppRole = "super_admin" | "admin" | "owner" | "branch_manager" | "employee";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTERNAL_ROLES: AppRole[] = ["super_admin", "admin"];
const MANAGEMENT_ROLES: AppRole[] = ["super_admin", "admin", "owner", "branch_manager"];
const OWNER_VISIBLE_ROLES: AppRole[] = ["owner", "branch_manager", "employee"];

const respond = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hasAnyRole = (roles: AppRole[], allowed: AppRole[]) => roles.some((role) => allowed.includes(role));

const getVisibleTargetRoles = (
  viewerRoles: AppRole[],
  targetRoles: AppRole[],
  viewerId: string,
  targetUserId: string,
) => {
  if (targetRoles.length === 0) return [] as AppRole[];

  if (hasAnyRole(viewerRoles, INTERNAL_ROLES)) {
    return targetRoles;
  }

  if (targetUserId === viewerId) {
    return targetRoles.filter((role) => !INTERNAL_ROLES.includes(role));
  }

  if (targetRoles.some((role) => INTERNAL_ROLES.includes(role))) {
    return [] as AppRole[];
  }

  if (viewerRoles.includes("owner")) {
    return targetRoles.filter((role) => OWNER_VISIBLE_ROLES.includes(role));
  }

  if (viewerRoles.includes("branch_manager")) {
    return targetRoles.filter((role) => role === "employee");
  }

  return [] as AppRole[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ ok: false, error: "Missing Authorization header" });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
    } = await supabaseAdmin.auth.getUser(token);

    if (!caller) return respond({ ok: false, error: "Unauthorized — please sign in again" });

    const { data: callerRoleRows, error: callerRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (callerRolesError) return respond({ ok: false, error: callerRolesError.message });

    const viewerRoles = (callerRoleRows || []).map((row) => row.role as AppRole);
    if (!hasAnyRole(viewerRoles, MANAGEMENT_ROLES)) {
      return respond({ ok: false, error: "You don't have permission to view staff" });
    }

    const [profilesRes, rolesRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, user_id, full_name, email, phone, pos_pin, is_active, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    if (profilesRes.error) return respond({ ok: false, error: profilesRes.error.message });
    if (rolesRes.error) return respond({ ok: false, error: rolesRes.error.message });

    const rolesByUser = new Map<string, AppRole[]>();
    for (const row of rolesRes.data || []) {
      const existing = rolesByUser.get(row.user_id) || [];
      existing.push(row.role as AppRole);
      rolesByUser.set(row.user_id, existing);
    }

    const staff = (profilesRes.data || [])
      .map((profile) => {
        const targetRoles = rolesByUser.get(profile.user_id) || [];
        const visibleRoles = getVisibleTargetRoles(viewerRoles, targetRoles, caller.id, profile.user_id);

        return {
          ...profile,
          roles: Array.from(new Set(visibleRoles)),
        };
      })
      .filter((profile) => profile.roles.length > 0);

    return respond({ ok: true, staff });
  } catch (error) {
    return respond({ ok: false, error: (error as Error).message || "Unexpected server error" });
  }
});