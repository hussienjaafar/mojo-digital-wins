import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, checkRateLimit, validateWebhookSecret, validateCronSecret } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Rate limiting for all requests
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(`track-attribution:${clientIP}`, 200, 60000);
    if (!rateLimit.allowed) {
      console.warn(`[SECURITY] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Authentication is REQUIRED - webhook secret OR cron secret OR service JWT
    const hasWebhookSecret = req.headers.get('x-webhook-secret');
    const hasCronSecret = req.headers.get('x-cron-secret');
    const hasAuthHeader = req.headers.get('authorization');
    
    let isAuthenticated = false;
    let authMethod = 'none';
    
    // Option 1: Webhook secret (for external integrations)
    if (hasWebhookSecret) {
      const isValid = await validateWebhookSecret(req, 'ATTRIBUTION_WEBHOOK_SECRET');
      if (isValid) {
        isAuthenticated = true;
        authMethod = 'webhook_secret';
      } else {
        console.warn(`[SECURITY] Invalid webhook secret from IP: ${clientIP}`);
        return new Response(
          JSON.stringify({ error: 'Invalid webhook secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Option 2: Cron secret (for scheduled jobs)
    if (!isAuthenticated && hasCronSecret) {
      const cronSecret = Deno.env.get('CRON_SECRET');
      if (cronSecret && hasCronSecret === cronSecret) {
        isAuthenticated = true;
        authMethod = 'cron_secret';
      } else {
        console.warn(`[SECURITY] Invalid cron secret from IP: ${clientIP}`);
        return new Response(
          JSON.stringify({ error: 'Invalid cron secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Option 3: Service role key in Authorization header (for internal service-to-service calls)
    if (!isAuthenticated && hasAuthHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: hasAuthHeader } }
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (!authError && user) {
        // Verify user has admin or service role
        const { data: isAdmin } = await userClient.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        
        if (isAdmin) {
          isAuthenticated = true;
          authMethod = 'admin_jwt';
        }
      }
    }
    
    // SECURITY: Reject unauthenticated requests
    if (!isAuthenticated) {
      console.warn(`[SECURITY] Unauthenticated request rejected from IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          hint: 'Provide x-webhook-secret, x-cron-secret, or valid Authorization header'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    console.log(`[TOUCHPOINT] Recording ${touchpoint_type} for org ${organization_id} (auth: ${authMethod})`);

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
        metadata: { ...(metadata || {}), auth_method: authMethod },
        occurred_at: occurred_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (touchpointError) {
      console.error('Error inserting touchpoint:', touchpointError);
      throw touchpointError;
    }

    console.log(`[TOUCHPOINT] Recorded: ${touchpoint.id}`);

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
