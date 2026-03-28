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
    // Accept optional org_id parameter
    let targetOrgs: string[] = [];
    try {
      const body = await req.json();
      if (body?.org_id) targetOrgs = [body.org_id];
    } catch { /* no body, run for all */ }

    if (targetOrgs.length === 0) {
      // Get all distinct org IDs with 'other' transactions
      const { data: orgs, error: orgErr } = await supabase
        .rpc("get_orgs_with_other_attribution");

      if (orgErr) {
        // Fallback: query distinct org IDs
        const { data: fallbackOrgs, error: fbErr } = await supabase
          .from("actblue_transactions")
          .select("organization_id")
          .eq("attributed_channel", "other")
          .limit(5000);
        if (fbErr) throw new Error(fbErr.message);
        targetOrgs = [...new Set((fallbackOrgs || []).map((r: any) => r.organization_id))];
      } else {
        targetOrgs = (orgs || []).map((r: any) => r.organization_id);
      }
    }

    results.push(`Processing ${targetOrgs.length} orgs`);

    for (const orgId of targetOrgs) {
      if (Date.now() - startTime > 50000) {
        results.push(`Timeout - stopping.`);
        break;
      }
      const { data, error } = await supabase.rpc("backfill_attribution_by_org", { p_org_id: orgId });
      if (error) {
        results.push(`Org ${orgId}: ERROR ${error.message}`);
        continue;
      }
      const count = Number(data) || 0;
      results.push(`Org ${orgId}: ${count} updated`);
      grandTotal += count;
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
