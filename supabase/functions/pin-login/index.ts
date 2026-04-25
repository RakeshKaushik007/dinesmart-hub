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

// Resolves a 4-digit POS PIN to the matching user's email so the client can
// sign in with the password the manager set when creating the staff member.
// We never return the password — login still uses signInWithPassword on the client.
// To avoid forcing managers to share passwords, we expose a one-shot magic-link
// alternative: the client calls this function with the PIN, gets back the email,
// and then calls signInWithPassword OR (if the manager opted in) we sign the
// session here using a service-role generated link. For now we just return email
// + a session created via admin.generateLink, which the client exchanges.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pin, identifier } = await req.json().catch(() => ({}));
    if (!pin || !/^\d{4}$/.test(pin)) {
      return respond({ ok: false, error: "Enter a valid 4-digit PIN" });
    }
    const id = typeof identifier === "string" ? identifier.trim() : "";
    if (!id) {
      return respond({ ok: false, error: "Enter your email or phone number" });
    }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const normalizedPhone = id.replace(/[\s\-()]/g, "");
    const isPhone = /^\+?\d{7,15}$/.test(normalizedPhone);
    if (!isEmail && !isPhone) {
      return respond({ ok: false, error: "Enter a valid email or phone number" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = admin
      .from("profiles")
      .select("user_id, email, phone, is_active")
      .eq("pos_pin", pin);
    if (isEmail) {
      query = query.ilike("email", id);
    } else {
      query = query.eq("phone", normalizedPhone);
    }
    const { data: profiles, error: profErr } = await query;

    if (profErr) return respond({ ok: false, error: profErr.message });
    if (!profiles || profiles.length === 0) {
      return respond({ ok: false, error: "Invalid credentials" });
    }
    if (profiles.length > 1) {
      return respond({ ok: false, error: "PIN collision — ask your manager to reset it" });
    }

    const profile = profiles[0];
    if (!profile.is_active) {
      return respond({ ok: false, error: "Your account is inactive. Contact your manager." });
    }
    if (!profile.email) {
      return respond({ ok: false, error: "No email on file for this PIN" });
    }

    // Generate a magic link, then return the hashed token so the client can
    // call supabase.auth.verifyOtp({ type: 'magiclink', token_hash, email }).
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });
    if (linkErr) return respond({ ok: false, error: linkErr.message });

    const hashed = (linkData?.properties as { hashed_token?: string } | undefined)?.hashed_token;
    if (!hashed) return respond({ ok: false, error: "Could not issue session" });

    return respond({ ok: true, email: profile.email, token_hash: hashed });
  } catch (err) {
    return respond({ ok: false, error: (err as Error).message });
  }
});
