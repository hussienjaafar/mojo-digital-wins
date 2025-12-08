import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, limit = 200 } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: corsHeaders });
    }

    // Find Meta creatives with extracted_refcode but missing mapping
    const { data: creatives, error: creativeErr } = await supabase
      .from('meta_creative_insights')
      .select('organization_id, creative_id, ad_id, campaign_id, extracted_refcode')
      .eq('organization_id', organization_id)
      .not('extracted_refcode', 'is', null)
      .limit(limit);

    if (creativeErr) throw creativeErr;

    let upserts = 0;
    for (const c of creatives || []) {
      const refcode = c.extracted_refcode;
      if (!refcode) continue;

      const { error: upsertErr } = await supabase
        .from('refcode_mappings')
        .upsert({
          organization_id,
          refcode,
          platform: 'meta',
          campaign_id: c.campaign_id,
          ad_id: c.ad_id,
          creative_id: c.creative_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,refcode' });

      if (upsertErr) {
        console.error('[REFCODE RECONCILE] Failed for refcode', refcode, upsertErr);
      } else {
        upserts++;
      }
    }

    return new Response(JSON.stringify({ success: true, mappings_updated: upserts }), { headers: corsHeaders });

  } catch (error: any) {
    console.error('[REFCODE RECONCILE] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
