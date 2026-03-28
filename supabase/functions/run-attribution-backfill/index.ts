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

  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body?.org_id;
    const step = body?.step || 1;
    const batchSize = body?.batch_size || 2000;

    if (!orgId) {
      return new Response(JSON.stringify({ error: "org_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data, error } = await supabase.rpc("backfill_attribution_step", {
      p_org_id: orgId,
      p_step: step,
      p_limit: batchSize,
    });

    if (error) throw error;
    const count = Number(data) || 0;

    return new Response(
      JSON.stringify({ step, updated: count, has_more: count >= batchSize }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
