/**
 * Capture Meta Touchpoint Edge Function
 * 
 * A PUBLIC edge function (no auth required) that captures Meta browser identifiers
 * (fbp, fbc, fbclid) from landing pages and stores them in attribution_touchpoints.
 * 
 * This is called from the DonateRedirect component to ensure we have Meta identifiers
 * before users are redirected to ActBlue.
 * 
 * Flow:
 * 1. User clicks Meta ad → lands on our site
 * 2. DonateRedirect component calls this function with cookies/params
 * 3. We store touchpoint with fbp/fbc in metadata
 * 4. User redirects to ActBlue, makes donation
 * 5. ActBlue webhook looks up this touchpoint by email/session
 * 6. CAPI event includes fbp/fbc for accurate deduplication
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      organization_id,
      touchpoint_type: rawType,
      email,
      session_id,
      fbp,
      fbc,
      fbclid,
      refcode,
      utm_source,
      utm_medium,
      utm_campaign,
      landing_url,
      referrer,
    } = body;

    // Map incoming touchpoint_type to allowed values
    // Allowed: 'meta_ad', 'sms', 'email', 'organic', 'other'
    const ALLOWED_TYPES = ['meta_ad', 'sms', 'email', 'organic', 'other'];
    let touchpoint_type = 'meta_ad'; // Default for landing page captures
    if (rawType && ALLOWED_TYPES.includes(rawType)) {
      touchpoint_type = rawType;
    } else if (utm_source?.toLowerCase().includes('facebook') || fbp || fbc || fbclid) {
      touchpoint_type = 'meta_ad';
    } else if (utm_source?.toLowerCase().includes('email')) {
      touchpoint_type = 'email';
    } else if (utm_source) {
      touchpoint_type = 'other';
    }

    // Validate organization_id is required
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate organization exists and is active
    const { data: org, error: orgError } = await supabase
      .from('client_organizations')
      .select('id, name')
      .eq('id', organization_id)
      .eq('is_active', true)
      .maybeSingle();

    if (orgError || !org) {
      console.error('[CAPTURE] Invalid organization:', organization_id, orgError);
      return new Response(
        JSON.stringify({ error: 'Invalid organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log capture attempt
    console.log('[CAPTURE] Recording touchpoint for org:', org.name, {
      has_fbp: !!fbp,
      has_fbc: !!fbc,
      has_fbclid: !!fbclid,
      has_email: !!email,
      has_session: !!session_id,
      refcode,
    });

    // Build metadata with all Meta identifiers
    const metadata: Record<string, any> = {
      source: 'landing_page_capture',
      captured_at: new Date().toISOString(),
    };

    // Store all Meta identifiers in metadata for later lookup
    if (fbp) metadata.fbp = fbp;
    if (fbc) metadata.fbc = fbc;
    if (fbclid) metadata.fbclid = fbclid;
    if (session_id) metadata.session_id = session_id;
    if (landing_url) metadata.landing_url = landing_url;
    if (referrer) metadata.referrer = referrer;

    // Calculate capture quality score
    let captureScore = 0;
    if (fbp) captureScore += 40;  // Browser cookie - most valuable
    if (fbc) captureScore += 30;  // Click ID cookie
    if (fbclid) captureScore += 20; // URL parameter
    if (email) captureScore += 10;  // Email for matching
    metadata.capture_score = captureScore;

    // Insert touchpoint
    const { data: touchpoint, error: insertError } = await supabase
      .from('attribution_touchpoints')
      .insert({
        organization_id,
        touchpoint_type: String(touchpoint_type).substring(0, 50),
        donor_email: email ? String(email).substring(0, 255).toLowerCase() : null,
        utm_source: utm_source ? String(utm_source).substring(0, 100) : null,
        utm_medium: utm_medium ? String(utm_medium).substring(0, 100) : null,
        utm_campaign: utm_campaign ? String(utm_campaign).substring(0, 100) : null,
        refcode: refcode ? String(refcode).substring(0, 100) : null,
        metadata,
        occurred_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[CAPTURE] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store touchpoint', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CAPTURE] Touchpoint stored:', touchpoint.id, 'Score:', captureScore);

    return new Response(
      JSON.stringify({
        success: true,
        touchpoint_id: touchpoint.id,
        capture_score: captureScore,
        message: captureScore >= 40 
          ? 'High-quality capture (fbp cookie found)' 
          : captureScore >= 20 
            ? 'Medium-quality capture (fbclid found)' 
            : 'Low-quality capture (no Meta identifiers)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CAPTURE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
