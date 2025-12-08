import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, checkRateLimit, validateWebhookSecret } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Rate limiting for public endpoint
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(`track-attribution:${clientIP}`, 200, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Optional webhook secret validation for server-to-server calls
    const hasWebhookSecret = req.headers.get('x-webhook-secret');
    if (hasWebhookSecret) {
      const isValid = await validateWebhookSecret(req, 'ATTRIBUTION_WEBHOOK_SECRET');
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid webhook secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      touchpoint_type,
      organization_id,
      donor_email,
      utm_source,
      utm_medium,
      utm_campaign,
      refcode,
      campaign_id,
      metadata,
      occurred_at,
    } = await req.json();

    // SECURITY: Input validation
    if (!touchpoint_type || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'touchpoint_type and organization_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate organization exists
    const { data: orgData, error: orgError } = await supabase
      .from('client_organizations')
      .select('id')
      .eq('id', organization_id)
      .eq('is_active', true)
      .maybeSingle();

    if (orgError || !orgData) {
      return new Response(
        JSON.stringify({ error: 'Invalid organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Recording ${touchpoint_type} touchpoint for org ${organization_id}`);

    const { data: touchpoint, error: touchpointError } = await supabase
      .from('attribution_touchpoints')
      .insert({
        touchpoint_type: String(touchpoint_type).substring(0, 50),
        organization_id,
        donor_email: donor_email ? String(donor_email).substring(0, 255).toLowerCase() : null,
        utm_source: utm_source ? String(utm_source).substring(0, 100) : null,
        utm_medium: utm_medium ? String(utm_medium).substring(0, 100) : null,
        utm_campaign: utm_campaign ? String(utm_campaign).substring(0, 100) : null,
        refcode: refcode ? String(refcode).substring(0, 100) : null,
        campaign_id: campaign_id || null,
        metadata: metadata || {},
        occurred_at: occurred_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (touchpointError) {
      console.error('Error inserting touchpoint:', touchpointError);
      throw touchpointError;
    }

    console.log(`Touchpoint recorded: ${touchpoint.id}`);

    return new Response(
      JSON.stringify({ success: true, touchpoint_id: touchpoint.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in track-attribution-touchpoint:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
