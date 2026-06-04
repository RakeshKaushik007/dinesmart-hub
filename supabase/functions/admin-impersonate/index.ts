import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return json({ ok: false, error: "Missing auth" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ ok: false, error: "Invalid session" }, 401);
    }

    const admin = createClient(url, serviceKey);

    // Verify caller is admin or super_admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body?.target_user_id;
    const redirectTo: string | undefined = body?.redirect_to;
    if (!targetUserId) return json({ ok: false, error: "target_user_id required" }, 400);

    // Look up target user email
    const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(targetUserId);
    if (targetErr || !targetUser?.user?.email) {
      return json({ ok: false, error: "Target user not found" }, 404);
    }

    // Block impersonating other admins/super_admins
    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId);
    if ((targetRoles ?? []).some((r: any) => r.role === "super_admin" || r.role === "admin")) {
      return json({ ok: false, error: "Cannot impersonate platform admins" }, 403);
    }

    // Generate a magic link the admin can open in a new tab
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
      options: { redirectTo: redirectTo || undefined },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return json({ ok: false, error: linkErr?.message || "Failed to generate link" }, 500);
    }

    // Audit log
    await admin.from("user_audit_log").insert({
      actor_user_id: userData.user.id,
      target_user_id: targetUserId,
      action: "impersonate",
      details: { email: targetUser.user.email },
    });

    return json({ ok: true, action_link: linkData.properties.action_link });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}