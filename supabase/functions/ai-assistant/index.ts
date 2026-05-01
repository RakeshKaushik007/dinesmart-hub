import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE || !LOVABLE_API_KEY) {
      return respond({ ok: false, error: "Server is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return respond({ ok: false, error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return respond({ ok: false, error: "Invalid session" }, 401);
    }

    const { messages } = await req.json().catch(() => ({ messages: [] }));
    if (!Array.isArray(messages) || messages.length === 0) {
      return respond({ ok: false, error: "messages required" }, 400);
    }

    // Pull a compact inventory snapshot to ground the model.
    const { data: ingredients } = await admin
      .from("ingredients")
      .select("name, current_stock, unit, min_threshold, status, expiry_date, cost_per_unit, category")
      .order("name")
      .limit(200);

    const inventoryContext = (ingredients ?? [])
      .map(
        (i) =>
          `- ${i.name} (${i.category ?? "uncategorized"}): ${i.current_stock} ${i.unit}, min ${i.min_threshold}, status ${i.status}, expires ${i.expiry_date ?? "n/a"}, cost ₹${i.cost_per_unit}/${i.unit}`,
      )
      .join("\n");

    const systemPrompt = `You are Blennix's inventory assistant for a restaurant POS. Answer concisely with markdown. Use the live inventory snapshot below as the source of truth. If asked about something not in the data, say so.

When the user asks to restock, top-up, add stock, or order more of an ingredient, call the propose_restock tool with the matching ingredient_id from the snapshot. Never invent IDs. Always include a one-line reason. The user must confirm before anything is written; do not claim the change was applied.

INVENTORY SNAPSHOT (${ingredients?.length ?? 0} items):
${(ingredients ?? []).map((i: any) => `- [${i.id}] ${i.name} (${i.category ?? "uncategorized"}): ${i.current_stock} ${i.unit}, min ${i.min_threshold}, status ${i.status}, expires ${i.expiry_date ?? "n/a"}, cost ₹${i.cost_per_unit}/${i.unit}`).join("\n") || "(no ingredients found)"}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "propose_restock",
          description: "Propose adding stock to an ingredient. Requires user confirmation before being applied.",
          parameters: {
            type: "object",
            properties: {
              ingredient_id: { type: "string", description: "UUID of the ingredient from the snapshot" },
              quantity: { type: "number", description: "Amount to add, in the ingredient's unit" },
              reason: { type: "string", description: "Short justification (e.g. 'below threshold', 'weekend prep')" },
            },
            required: ["ingredient_id", "quantity", "reason"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
      }),
    });

    if (aiResp.status === 429) {
      return respond({ ok: false, error: "Rate limit reached. Please try again shortly." }, 429);
    }
    if (aiResp.status === 402) {
      return respond({ ok: false, error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    }
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      return respond({ ok: false, error: "AI gateway error" }, 500);
    }

    const json = await aiResp.json();
    const message = json.choices?.[0]?.message ?? {};
    const reply: string = message.content ?? "";
    const proposals: Array<{ ingredient_id: string; ingredient_name: string; quantity: number; unit: string; reason: string }> = [];

    const ingMap = new Map((ingredients ?? []).map((i: any) => [i.id, i]));
    for (const call of message.tool_calls ?? []) {
      if (call?.function?.name !== "propose_restock") continue;
      try {
        const args = JSON.parse(call.function.arguments ?? "{}");
        const ing: any = ingMap.get(args.ingredient_id);
        if (!ing || !(args.quantity > 0)) continue;
        proposals.push({
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          quantity: Number(args.quantity),
          unit: ing.unit,
          reason: String(args.reason ?? "").slice(0, 200),
        });
      } catch { /* ignore malformed tool call */ }
    }

    return respond({ ok: true, reply, proposals });
  } catch (e) {
    console.error("ai-assistant error", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});