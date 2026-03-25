import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require CRON_SECRET or admin JWT
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

    // Compute metrics for yesterday (or today if forced)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);
    const dateStr = targetDate.toISOString().split("T")[0];

    // Get all analytics for the target date
    const { data: analytics, error: fetchErr } = await supabase
      .from("funnel_analytics")
      .select("step_key, step_number, action, variant_label, segment, duration_ms, exit_type")
      .gte("created_at", `${dateStr}T00:00:00Z`)
      .lt("created_at", `${dateStr}T23:59:59Z`);

    if (fetchErr) throw fetchErr;
    if (!analytics || analytics.length === 0) {
      return new Response(JSON.stringify({ message: "No data for target date", date: dateStr }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by (variant_label, segment, step_key)
    const groups: Record<string, {
      step_number: number;
      views: number;
      completions: number;
      durations: number[];
      dropOffs: number;
    }> = {};

    for (const row of analytics) {
      const key = `${row.variant_label}|${row.segment || "null"}|${row.step_key}`;
      if (!groups[key]) {
        groups[key] = { step_number: row.step_number, views: 0, completions: 0, durations: [], dropOffs: 0 };
      }
      const g = groups[key];
      if (row.action === "view") g.views++;
      if (row.exit_type === "completed") g.completions++;
      if (row.exit_type === "abandoned") g.dropOffs++;
      if (row.duration_ms) g.durations.push(row.duration_ms);
    }

    // Upsert metrics
    const rows = Object.entries(groups).map(([key, g]) => {
      const [variant_label, segment, step_key] = key.split("|");
      const avgDuration = g.durations.length > 0
        ? Math.round(g.durations.reduce((a, b) => a + b, 0) / g.durations.length)
        : null;
      return {
        date: dateStr,
        variant_label,
        segment: segment === "null" ? null : segment,
        step_key,
        step_number: g.step_number,
        views: g.views,
        completions: g.completions,
        conversion_rate: g.views > 0 ? Math.round((g.completions / g.views) * 10000) / 10000 : 0,
        avg_duration_ms: avgDuration,
        drop_off_count: g.dropOffs,
      };
    });

    const { error: upsertErr } = await supabase
      .from("funnel_step_metrics")
      .upsert(rows, { onConflict: "date,variant_label,segment,step_key" });

    if (upsertErr) throw upsertErr;

    // Also update impressions/conversions on funnel_variant_performance
    for (const row of rows) {
      await supabase.rpc("increment_variant_stats", {
        p_step_key: row.step_key,
        p_variant_label: row.variant_label,
        p_impressions: row.views,
        p_conversions: row.completions,
      }).then(() => {});
    }

    return new Response(JSON.stringify({
      success: true,
      date: dateStr,
      metrics_computed: rows.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("funnel-compute-metrics error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
