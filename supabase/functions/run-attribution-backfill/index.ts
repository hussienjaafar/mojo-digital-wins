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
  const results: string[] = [];
  let grandTotal = 0;

  try {
    let targetOrgs: string[] = [];
    try {
      const body = await req.json();
      if (body?.org_id) targetOrgs = [body.org_id];
    } catch { /* no body */ }

    if (targetOrgs.length === 0) {
      const { data: fallbackOrgs, error: fbErr } = await supabase
        .from("actblue_transactions")
        .select("organization_id")
        .eq("attributed_channel", "other")
        .limit(5000);
      if (fbErr) throw new Error(fbErr.message);
      targetOrgs = [...new Set((fallbackOrgs || []).map((r: any) => r.organization_id))];
    }

    results.push(`Processing ${targetOrgs.length} orgs`);
    const STEPS = 4;
    const BATCH_LIMIT = 20000;

    for (const orgId of targetOrgs) {
      let orgTotal = 0;
      for (let step = 1; step <= STEPS; step++) {
        // Loop each step until no more rows match
        let stepTotal = 0;
        while (true) {
          if (Date.now() - startTime > 50000) {
            results.push(`Timeout at org ${orgId} step ${step}`);
            return new Response(
              JSON.stringify({ success: false, total_updated: grandTotal, details: results, timed_out: true }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const { data, error } = await supabase.rpc("backfill_attribution_step", {
            p_org_id: orgId,
            p_step: step,
            p_limit: BATCH_LIMIT,
          });
          if (error) {
            results.push(`Org ${orgId} step ${step}: ERROR ${error.message}`);
            break;
          }
          const count = Number(data) || 0;
          stepTotal += count;
          if (count < BATCH_LIMIT) break; // done with this step
        }
        orgTotal += stepTotal;
      }
      grandTotal += orgTotal;
      results.push(`Org ${orgId}: ${orgTotal} updated`);
    }

    return new Response(
      JSON.stringify({ success: true, total_updated: grandTotal, elapsed_ms: Date.now() - startTime, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), total_updated: grandTotal, details: results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
