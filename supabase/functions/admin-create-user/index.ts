import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Caller must be at least branch_manager (managers create employees, owners create managers/employees)
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles || []).map((r) => r.role);
    const allowed = ["super_admin", "admin", "owner", "branch_manager"];
    if (!roles.some((r) => allowed.includes(r))) {
      return respond({ ok: false, error: "You don't have permission to create users" });
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name } = body || {};
    if (!email || !password) {
      return respond({ ok: false, error: "Email and password are required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return respond({ ok: false, error: "Password must be at least 6 characters" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "" },
    });

    if (error) {
      // Surface Supabase's actual message (e.g. "User already registered", weak password, etc.)
      return respond({ ok: false, error: error.message });
    }

    return respond({ ok: true, user: data.user });
  } catch (err) {
    return respond({ ok: false, error: (err as Error).message || "Unexpected server error" });
  }
});
