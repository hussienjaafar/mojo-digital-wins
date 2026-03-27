import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const maxIterations = 100;
  const startTime = Date.now();
  const timeoutMs = 55_000; // 55s safety margin
  const results: string[] = [];
  let totalUpdated = 0;
  let iteration = 0;

  try {
    for (iteration = 0; iteration < maxIterations; iteration++) {
      if (Date.now() - startTime > timeoutMs) {
        results.push(`Stopped at iteration ${iteration} due to timeout`);
        break;
      }

      const { data, error } = await supabase.rpc("backfill_attribution_batch", { p_limit: 2000 });
      if (error) {
        results.push(`Error at iteration ${iteration}: ${error.message}`);
        break;
      }

      const resultStr = data as string;
      results.push(`Iteration ${iteration}: ${resultStr}`);

      // Parse counts from result string like "sms_form:0 meta_form:0 ..."
      const counts = resultStr.match(/\d+/g)?.map(Number) || [];
      const batchTotal = counts.reduce((a, b) => a + b, 0);
      totalUpdated += batchTotal;

      if (batchTotal === 0) {
        results.push("No more records to update - backfill complete!");
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        iterations: iteration,
        total_updated: totalUpdated,
        elapsed_ms: Date.now() - startTime,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), iterations: iteration, details: results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
