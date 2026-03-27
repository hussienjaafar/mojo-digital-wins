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

  const startTime = Date.now();
  const timeoutMs = 55_000;
  const results: string[] = [];
  let grandTotal = 0;

  try {
    // 7 steps, each pattern. Loop each step until it returns 0.
    for (let step = 1; step <= 7; step++) {
      let stepTotal = 0;
      let iter = 0;
      while (true) {
        if (Date.now() - startTime > timeoutMs) {
          results.push(`Step ${step}: timeout after ${iter} iterations, ${stepTotal} updated`);
          return respond(results, grandTotal, startTime, false);
        }
        const { data, error } = await supabase.rpc("backfill_attribution_step", { p_step: step, p_limit: 500 });
        if (error) {
          results.push(`Step ${step} error: ${error.message}`);
          break;
        }
        const updated = data as number;
        stepTotal += updated;
        iter++;
        if (updated === 0) break;
      }
      grandTotal += stepTotal;
      results.push(`Step ${step}: ${stepTotal} updated in ${iter} iterations`);
    }

    return respond(results, grandTotal, startTime, true);
  } catch (err) {
    results.push(`Fatal: ${String(err)}`);
    return respond(results, grandTotal, startTime, false, 500);
  }
});

function respond(details: string[], total: number, startTime: number, complete: boolean, status = 200) {
  return new Response(
    JSON.stringify({ success: status === 200, complete, total_updated: total, elapsed_ms: Date.now() - startTime, details }),
    { status, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } }
  );
}
