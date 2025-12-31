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
      console.log('[CLICKID RECONCILE] Authorized via CRON_SECRET');
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
          console.log('[CLICKID RECONCILE] Authorized via admin JWT');
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
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[CLICKID RECONCILE] Starting for org ${organization_id}, limit ${limit}`);

    // Use the new donation_clickid_candidates view via RLS function
    const { data: donations, error: donationErr } = await supabase
      .rpc('get_clickid_candidates', {
        _organization_id: organization_id,
        _limit: limit
      });

    if (donationErr) {
      console.error('[CLICKID RECONCILE] Error fetching candidates:', donationErr);
      throw donationErr;
    }

    console.log(`[CLICKID RECONCILE] Found ${donations?.length || 0} candidates with click_id/fbclid`);

    if (!donations || donations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          mappings_updated: 0,
          message: 'No transactions with click_id/fbclid needing reconciliation'
        }), 
        { headers: corsHeaders }
      );
    }

    let upserts = 0;
    let errors = 0;

    for (const d of donations) {
      const clickId = d.click_id || d.fbclid;
      if (!clickId) continue;

      const { error: upsertErr } = await supabase
        .from('refcode_mappings')
        .upsert({
          organization_id,
          refcode: `clickid_${clickId.slice(0, 16)}`, // Create synthetic refcode from click_id
          platform: 'meta',
          channel_type: 'paid',
          click_id: d.click_id,
          fbclid: d.fbclid,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,refcode' });

      if (upsertErr) {
        console.error(`[CLICKID RECONCILE] Failed for click_id ${clickId}:`, upsertErr);
        errors++;
      } else {
        upserts++;
      }
    }

    console.log(`[CLICKID RECONCILE] Completed: ${upserts} upserts, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        mappings_updated: upserts,
        errors,
        candidates_processed: donations.length
      }), 
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[CLICKID RECONCILE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
});
