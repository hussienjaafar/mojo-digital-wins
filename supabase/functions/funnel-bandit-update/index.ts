import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Thompson Sampling: sample from Beta distribution using Jöhnk's algorithm
function sampleBeta(alpha: number, beta: number): number {
  // Use gamma sampling approach
  const gammaA = sampleGamma(alpha);
  const gammaB = sampleGamma(beta);
  return gammaA / (gammaA + gammaB);
}

function sampleGamma(shape: number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  // Marsaglia and Tsang's method
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number, v: number;
    do {
      x = gaussianRandom();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active variants
    const { data: variants, error: fetchErr } = await supabase
      .from("funnel_variant_performance")
      .select("*")
      .eq("is_active", true);

    if (fetchErr) throw fetchErr;
    if (!variants || variants.length === 0) {
      return new Response(JSON.stringify({ message: "No active variants" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by step_key
    const byStep: Record<string, typeof variants> = {};
    for (const v of variants) {
      if (!byStep[v.step_key]) byStep[v.step_key] = [];
      byStep[v.step_key].push(v);
    }

    const updates: any[] = [];
    const championsToGenerate: any[] = [];
    const MIN_SAMPLES = 100;

    for (const [stepKey, stepVariants] of Object.entries(byStep)) {
      if (stepVariants.length < 2) continue;

      // Thompson Sampling: draw samples and compute weights
      const samples = stepVariants.map((v) => ({
        ...v,
        sample: sampleBeta(Number(v.alpha), Number(v.beta)),
      }));

      const totalSample = samples.reduce((sum, s) => sum + s.sample, 0);

      for (const s of samples) {
        const newWeight = Math.round((s.sample / totalSample) * 10000) / 10000;
        updates.push({
          id: s.id,
          traffic_weight: Math.max(0.05, Math.min(0.95, newWeight)), // floor/ceiling
          updated_at: new Date().toISOString(),
        });
      }

      // Check for statistical significance (95% win probability)
      const totalImpressions = stepVariants.reduce((s, v) => s + v.impressions, 0);
      if (totalImpressions >= MIN_SAMPLES) {
        // Run 1000 simulations
        const wins: Record<string, number> = {};
        for (const v of stepVariants) wins[v.variant_label] = 0;

        for (let i = 0; i < 1000; i++) {
          let bestLabel = "";
          let bestSample = -1;
          for (const v of stepVariants) {
            const s = sampleBeta(Number(v.alpha), Number(v.beta));
            if (s > bestSample) {
              bestSample = s;
              bestLabel = v.variant_label;
            }
          }
          wins[bestLabel]++;
        }

        // If any variant wins >950/1000, declare champion
        for (const [label, winCount] of Object.entries(wins)) {
          if (winCount >= 950 && !stepVariants.find((v) => v.variant_label === label)?.is_champion) {
            championsToGenerate.push({ step_key: stepKey, variant_label: label });
            // Mark as champion
            const champ = stepVariants.find((v) => v.variant_label === label);
            if (champ) {
              await supabase
                .from("funnel_variant_performance")
                .update({ is_champion: true, updated_at: new Date().toISOString() })
                .eq("id", champ.id);
            }
          }
        }
      }
    }

    // Batch update weights
    for (const u of updates) {
      await supabase
        .from("funnel_variant_performance")
        .update({ traffic_weight: u.traffic_weight, updated_at: u.updated_at })
        .eq("id", u.id);
    }

    // Also sync weights to content_optimization
    for (const u of updates) {
      const variant = variants.find((v) => v.id === u.id);
      if (variant) {
        await supabase
          .from("content_optimization")
          .update({ traffic_weight: u.traffic_weight })
          .eq("step_key", variant.step_key)
          .eq("variant_label", variant.variant_label);
      }
    }

    // Trigger challenger generation for new champions
    if (championsToGenerate.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      for (const champ of championsToGenerate) {
        fetch(`${supabaseUrl}/functions/v1/funnel-generate-challenger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": expectedSecret!,
          },
          body: JSON.stringify(champ),
        }).catch((e) => console.error("Failed to trigger challenger generation:", e));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      variants_updated: updates.length,
      champions_declared: championsToGenerate.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("funnel-bandit-update error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
