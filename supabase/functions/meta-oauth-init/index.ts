import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const META_APP_ID = Deno.env.get('META_APP_ID');
    if (!META_APP_ID) {
      throw new Error('META_APP_ID is not configured');
    }

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organizationId, redirectUri, useRedirect = false } = await req.json();
    
    if (!organizationId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Missing organizationId or redirectUri' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a state token to prevent CSRF and track the organization
    const stateData = {
      organizationId,
      userId: claimsData.claims.sub,
      timestamp: Date.now(),
      // For redirect mode, we need to know where to return
      returnUrl: useRedirect ? `/admin?tab=onboarding-wizard&org=${organizationId}` : undefined,
    };
    const state = btoa(JSON.stringify(stateData));

    // Meta OAuth permissions for Marketing API
    const scopes = [
      'ads_read',
      'ads_management',
      'business_management',
      'pages_read_engagement',
    ].join(',');

    // Build Meta OAuth URL
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('response_type', 'code');
    
    // For full-page redirect, use 'page' display mode for better mobile experience
    if (useRedirect) {
      authUrl.searchParams.set('display', 'page');
    }

    console.log('[meta-oauth-init] Generated OAuth URL for org:', organizationId);

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        state,
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[meta-oauth-init] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});