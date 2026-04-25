import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "owner" | "branch_manager" | "employee";

interface NodeUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  custom_role_name: string | null;
  permissions: string[];
  branch_id: string | null;
  parent_user_id: string | null;
  is_active: boolean;
  children: NodeUser[];
}

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

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const roles = (callerRoles || []).map((r) => r.role) as AppRole[];
    const isSuper = roles.includes("super_admin") || roles.includes("admin");

    // Fetch all role rows + matching profiles
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("user_id, role, custom_role_name, permissions, branch_id, parent_user_id, is_active");

    const userIds = Array.from(new Set((roleRows || []).map((r) => r.user_id)));
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const profileById = new Map((profiles || []).map((p) => [p.user_id, p]));

    // Build flat node list — one node per role assignment (a user could have multiple)
    // For simplicity we collapse by user_id, taking the first role row.
    const byUser = new Map<string, NodeUser>();
    for (const r of roleRows || []) {
      if (byUser.has(r.user_id)) continue;
      const p = profileById.get(r.user_id);
      byUser.set(r.user_id, {
        user_id: r.user_id,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        role: r.role as AppRole,
        custom_role_name: r.custom_role_name ?? null,
        permissions: r.permissions ?? [],
        branch_id: r.branch_id ?? null,
        parent_user_id: r.parent_user_id ?? null,
        is_active: r.is_active ?? true,
        children: [],
      });
    }

    // Determine roots based on caller scope
    let rootIds: string[];
    if (isSuper) {
      rootIds = Array.from(byUser.values())
        .filter((n) => !n.parent_user_id)
        .map((n) => n.user_id);
    } else {
      // Caller becomes the root of their own subtree
      const self = byUser.get(caller.id);
      if (!self) return respond({ ok: true, tree: [] });
      rootIds = [caller.id];
    }

    // Attach children
    for (const node of byUser.values()) {
      if (node.parent_user_id && byUser.has(node.parent_user_id)) {
        byUser.get(node.parent_user_id)!.children.push(node);
      }
    }

    const tree = rootIds.map((id) => byUser.get(id)).filter(Boolean);

    return respond({ ok: true, tree });
  } catch (err) {
    return respond({ ok: false, error: (err as Error).message || "Unexpected server error" });
  }
});