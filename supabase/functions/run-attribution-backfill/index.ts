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
    // Get all org IDs with 'other' transactions
    const { data: orgs, error: orgErr } = await supabase
      .from("actblue_transactions")
      .select("organization_id")
      .eq("attributed_channel", "other")
      .limit(1000);

    if (orgErr) throw new Error(orgErr.message);

    const uniqueOrgs = [...new Set((orgs || []).map((r: any) => r.organization_id))];
    results.push(`Found ${uniqueOrgs.length} orgs with 'other' transactions`);

    for (const orgId of uniqueOrgs) {
      if (Date.now() - startTime > 50000) {
        results.push(`Timeout - stopping. Processed so far.`);
        break;
      }
      const { data, error } = await supabase.rpc("backfill_attribution_by_org", { p_org_id: orgId });
      if (error) {
        results.push(`Org ${orgId}: ERROR ${error.message}`);
        continue;
      }
      results.push(`Org ${orgId}: ${data}`);
      const match = String(data).match(/^(\d+)/);
      if (match) grandTotal += parseInt(match[1]);
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
