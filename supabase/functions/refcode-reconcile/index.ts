import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // SECURITY: Authentication required
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('authorization');
    
    let isAuthorized = false;
    
    // Check cron secret for scheduled jobs
    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
      console.log('[REFCODE RECONCILE] Authorized via CRON_SECRET');
    }
    
    // Check admin JWT
    if (!isAuthorized && authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await userClient.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        if (isAdmin) {
          isAuthorized = true;
          console.log('[REFCODE RECONCILE] Authorized via admin JWT');
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET or admin access' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, limit = 200 } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: corsHeaders });
    }

    console.log(`[REFCODE RECONCILE] Starting for org ${organization_id}, limit ${limit}`);

    // Find Meta creatives with extracted_refcode but missing mapping
    const { data: creatives, error: creativeErr } = await supabase
      .from('meta_creative_insights')
      .select('organization_id, creative_id, ad_id, campaign_id, extracted_refcode')
      .eq('organization_id', organization_id)
      .not('extracted_refcode', 'is', null)
      .limit(limit);

    if (creativeErr) throw creativeErr;

    let upserts = 0;
    // Build a map of refcode -> latest ad (by ad_id, higher = newer)
    // This ensures when multiple ads share a refcode, we use the newest ad
    const refcodeToLatestAd = new Map<string, typeof creatives[0]>();
    
    for (const c of creatives || []) {
      const refcode = c.extracted_refcode;
      if (!refcode) continue;
      
      const existing = refcodeToLatestAd.get(refcode);
      // Higher ad_id = newer ad (Meta ad IDs are sequential)
      if (!existing || c.ad_id > existing.ad_id) {
        refcodeToLatestAd.set(refcode, c);
      }
    }

    console.log(`[REFCODE RECONCILE] Found ${refcodeToLatestAd.size} unique refcodes from ${creatives?.length || 0} creatives`);

    for (const [refcode, c] of refcodeToLatestAd) {
      // Use UPDATE to force refresh the ad_id even if refcode already exists
      // This ensures donations get attributed to the CURRENT running ad, not old ads
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
        }, { 
          onConflict: 'organization_id,refcode',
          ignoreDuplicates: false  // Force update existing rows
        });

      if (upsertErr) {
        console.error('[REFCODE RECONCILE] Failed for refcode', refcode, upsertErr);
      } else {
        upserts++;
        console.log(`[REFCODE RECONCILE] Upserted refcode=${refcode} -> ad_id=${c.ad_id}`);
      }
    }

    console.log(`[REFCODE RECONCILE] Completed: ${upserts} mappings updated`);

    return new Response(JSON.stringify({ success: true, mappings_updated: upserts }), { headers: corsHeaders });

  } catch (error: any) {
    console.error('[REFCODE RECONCILE] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
