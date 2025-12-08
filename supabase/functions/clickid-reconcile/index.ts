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

    // Find donations without refcode but with click_id/fbclid
    const { data: donations, error: donationErr } = await supabase
      .from('donation_clickid_candidates')
      .select('transaction_id, click_id, fbclid')
      .eq('organization_id', organization_id)
      .limit(limit);

    if (donationErr) throw donationErr;

    let upserts = 0;
    for (const d of donations || []) {
      const clickId = d.click_id || d.fbclid;
      if (!clickId) continue;

      const { error: upsertErr } = await supabase
        .from('refcode_mappings')
        .upsert({
          organization_id,
          refcode: clickId, // use click_id/fbclid as a key when refcode missing
          platform: 'meta',
          click_id: d.click_id,
          fbclid: d.fbclid,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,refcode' });

      if (upsertErr) {
        console.error('[CLICKID RECONCILE] Failed for click_id/fbclid', clickId, upsertErr);
      } else {
        upserts++;
      }
    }

    return new Response(JSON.stringify({ success: true, mappings_updated: upserts }), { headers: corsHeaders });

  } catch (error: any) {
    console.error('[CLICKID RECONCILE] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
