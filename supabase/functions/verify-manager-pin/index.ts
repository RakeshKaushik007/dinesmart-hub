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

// Roles allowed to approve a cancellation, refund, void or discount.
const APPROVER_ROLES = ["super_admin", "admin", "owner", "branch_manager"];
// A 4-digit PIN has only 10,000 combinations, so repeated guessing is blocked.
const MAX_FAILURES = 5;
const WINDOW_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = req.headers.get("Authorization");
    if (!auth) return respond({ ok: false, error: "Missing Authorization" });
    const { data: { user: caller } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!caller) return respond({ ok: false, error: "Please sign in again" });

    const body = await req.json().catch(() => ({}));
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const branchId = typeof body.branch_id === "string" ? body.branch_id : "";

    // Deliberately vague: never reveal whether a PIN exists.
    const DENIED = { ok: false, error: "That PIN is not valid for this branch" };

    if (!/^[0-9]{4}$/.test(pin) || !branchId) return respond(DENIED);

    // The till must be working in the branch it is asking about, so staff in one
    // restaurant cannot guess at another restaurant's PINs.
    const { data: callerBranches } = await admin.rpc("get_user_branch_ids", { _user_id: caller.id });
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", caller.id);
    const activeRoles = (callerRoles ?? [])
      .filter((r: any) => r.is_active !== false)
      .map((r: any) => r.role);
    const callerIsPlatformAdmin = activeRoles.some((r: string) => r === "super_admin" || r === "admin");
    if (!callerIsPlatformAdmin && !(((callerBranches as string[]) ?? []).includes(branchId))) {
      return respond(DENIED);
    }

    // Too many recent failures from this user: stop, so the PIN cannot be guessed.
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: recentFailures } = await admin
      .from("user_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", caller.id)
      .eq("action", "manager_pin_failed")
      .gte("created_at", since);
    if ((recentFailures ?? 0) >= MAX_FAILURES) {
      return respond({ ok: false, error: "Too many incorrect PINs. Wait a few minutes and try again." });
    }

    const recordFailure = async () => {
      await admin.from("user_audit_log").insert({
        actor_id: caller.id,
        actor_email: caller.email ?? null,
        action: "manager_pin_failed",
        details: { branch_id: branchId },
      });
    };

    // Who holds this PIN? Service role only, so PINs never reach the browser.
    const { data: matches } = await admin
      .from("profiles")
      .select("user_id, full_name, is_active")
      .eq("pos_pin", pin);

    const candidates = (matches ?? []).filter((p: any) => p.is_active !== false);
    if (candidates.length === 0) {
      await recordFailure();
      return respond(DENIED);
    }

    for (const candidate of candidates) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role, is_active")
        .eq("user_id", candidate.user_id);
      const approverRoles = (roles ?? [])
        .filter((r: any) => r.is_active !== false)
        .map((r: any) => r.role)
        .filter((r: string) => APPROVER_ROLES.includes(r));
      if (approverRoles.length === 0) continue;

      const isPlatformAdmin = approverRoles.some((r: string) => r === "super_admin" || r === "admin");
      if (!isPlatformAdmin) {
        const { data: branches } = await admin.rpc("get_user_branch_ids", { _user_id: candidate.user_id });
        if (!(((branches as string[]) ?? []).includes(branchId))) continue;
      }

      await admin.from("user_audit_log").insert({
        actor_id: caller.id,
        actor_email: caller.email ?? null,
        action: "manager_pin_verified",
        target_user_id: candidate.user_id,
        details: { branch_id: branchId, approver_role: approverRoles[0] },
      });

      return respond({ ok: true, manager_name: candidate.full_name ?? null });
    }

    await recordFailure();
    return respond(DENIED);
  } catch (e) {
    return respond({ ok: false, error: (e as Error).message }, 500);
  }
});
