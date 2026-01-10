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
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    
    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta credentials not configured');
    }

    const { code, state, redirectUri } = await req.json();
    
    if (!code || !state || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Missing code, state, or redirectUri' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode and validate state
    let stateData: { organizationId: string; userId: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check state age (max 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: 'OAuth session expired' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[meta-oauth-callback] Exchanging code for token, org:', stateData.organizationId);

    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', META_APP_ID);
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[meta-oauth-callback] Token error:', tokenData.error);
      return new Response(
        JSON.stringify({ error: tokenData.error.message || 'Failed to get access token' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_token, expires_in } = tokenData;

    // Exchange for long-lived token (60 days instead of ~1 hour)
    const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', META_APP_ID);
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET);
    longLivedUrl.searchParams.set('fb_exchange_token', access_token);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    const finalToken = longLivedData.access_token || access_token;
    const finalExpiry = longLivedData.expires_in || expires_in;

    console.log('[meta-oauth-callback] Got long-lived token, expires in:', finalExpiry, 'seconds');

    // Get user info
    const userInfoResponse = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${finalToken}`
    );
    const userInfo = await userInfoResponse.json();

    // Fetch available ad accounts
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_id,account_status,currency,business_name&access_token=${finalToken}`
    );
    const adAccountsData = await adAccountsResponse.json();

    if (adAccountsData.error) {
      console.error('[meta-oauth-callback] Ad accounts error:', adAccountsData.error);
      return new Response(
        JSON.stringify({ error: adAccountsData.error.message || 'Failed to fetch ad accounts' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[meta-oauth-callback] Found', adAccountsData.data?.length || 0, 'ad accounts');

    // Store credentials with expiry timestamp for proactive refresh
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const tokenExpiresAt = new Date(Date.now() + (finalExpiry * 1000));

    const { error: upsertError } = await supabase
      .from('client_api_credentials')
      .upsert({
        organization_id: stateData.organizationId,
        platform: 'meta',
        encrypted_credentials: {
          access_token: finalToken,
          meta_user_id: userInfo.id,
          meta_user_name: userInfo.name,
          meta_user_email: userInfo.email,
          ad_accounts: adAccountsData.data || [],
        },
        token_expires_at: tokenExpiresAt.toISOString(),
        refresh_status: null,
        is_active: true,
        last_sync_status: 'oauth_complete',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,platform',
      });

    if (upsertError) {
      console.error('[meta-oauth-callback] Failed to store credentials:', upsertError);
      // Don't fail the request, just log - frontend will still get the token
    } else {
      console.log('[meta-oauth-callback] Stored credentials with expiry:', tokenExpiresAt.toISOString());
    }

    return new Response(
      JSON.stringify({
        success: true,
        organizationId: stateData.organizationId,
        userId: stateData.userId,
        metaUser: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
        },
        adAccounts: adAccountsData.data || [],
        accessToken: finalToken,
        expiresIn: finalExpiry,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[meta-oauth-callback] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});