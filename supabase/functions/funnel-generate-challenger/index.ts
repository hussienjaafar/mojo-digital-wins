import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { step_key, variant_label } = await req.json();
    if (!step_key || !variant_label) {
      return new Response(JSON.stringify({ error: "step_key and variant_label required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the winning copy
    const { data: champion, error: champErr } = await supabase
      .from("content_optimization")
      .select("*")
      .eq("step_key", step_key)
      .eq("variant_label", variant_label)
      .eq("is_active", true)
      .single();

    if (champErr || !champion) {
      return new Response(JSON.stringify({ error: "Champion variant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch performance data
    const { data: perf } = await supabase
      .from("funnel_variant_performance")
      .select("impressions, conversions")
      .eq("step_key", step_key)
      .eq("variant_label", variant_label)
      .single();

    const convRate = perf && perf.impressions > 0
      ? ((perf.conversions / perf.impressions) * 100).toFixed(1)
      : "unknown";

    // Generate challenger copy using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a conversion rate optimization expert for a B2B lead generation funnel.

The current champion copy for the "${step_key}" step has a ${convRate}% conversion rate:
- Headline: "${champion.headline_text}"
- Subheadline: "${champion.subheadline_text || "none"}"
- CTA: "${champion.cta_text}"

Generate a new challenger variant that could beat this. Apply these CRO principles:
1. Use specific numbers and social proof
2. Address the visitor's primary objection
3. Create urgency without being dishonest
4. Use action-oriented, benefit-focused language
5. Keep headlines under 60 characters
6. Keep CTAs under 25 characters

Return your response using the generate_challenger tool.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a conversion rate optimization expert." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_challenger",
              description: "Generate a challenger copy variant for A/B testing",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "New headline (max 60 chars)" },
                  subheadline: { type: "string", description: "New subheadline (max 120 chars)" },
                  cta: { type: "string", description: "New CTA text (max 25 chars)" },
                  rationale: { type: "string", description: "Why this variant might win" },
                },
                required: ["headline", "subheadline", "cta", "rationale"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_challenger" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, will retry later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required for AI" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    let args = toolCall.function.arguments;
    if (typeof args === "string") {
      args = args.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      args = JSON.parse(args);
    }

    // Create new variant label (C, D, E, ...)
    const { data: existingVariants } = await supabase
      .from("content_optimization")
      .select("variant_label")
      .eq("step_key", step_key)
      .order("variant_label", { ascending: false })
      .limit(1);

    const lastLabel = existingVariants?.[0]?.variant_label || "B";
    const newLabel = String.fromCharCode(lastLabel.charCodeAt(0) + 1);

    // Insert into content_optimization
    const { error: insertErr } = await supabase
      .from("content_optimization")
      .insert({
        step_key,
        variant_label: newLabel,
        headline_text: args.headline,
        subheadline_text: args.subheadline,
        cta_text: args.cta,
        is_active: true,
        traffic_weight: 0.1, // 10% exploration
        impressions: 0,
        conversions: 0,
      });

    if (insertErr) throw insertErr;

    // Create bandit entry
    await supabase.from("funnel_variant_performance").insert({
      step_key,
      variant_label: newLabel,
      alpha: 1,
      beta: 1,
      traffic_weight: 0.1,
      is_active: true,
    });

    // Log generation
    await supabase.from("funnel_copy_generations").insert({
      step_key,
      variant_label: newLabel,
      headline_text: args.headline,
      subheadline_text: args.subheadline,
      cta_text: args.cta,
      generation_prompt: prompt,
      parent_variant: variant_label,
      status: "active",
    });

    // Reduce champion weight to accommodate new variant
    await supabase
      .from("content_optimization")
      .update({ traffic_weight: 0.45 })
      .eq("step_key", step_key)
      .eq("variant_label", variant_label);

    // Deactivate losing variants (non-champion, non-new)
    await supabase
      .from("content_optimization")
      .update({ is_active: false, traffic_weight: 0 })
      .eq("step_key", step_key)
      .neq("variant_label", variant_label)
      .neq("variant_label", newLabel);

    return new Response(JSON.stringify({
      success: true,
      new_variant: newLabel,
      headline: args.headline,
      cta: args.cta,
      rationale: args.rationale,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("funnel-generate-challenger error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
