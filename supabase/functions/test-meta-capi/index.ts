/**
 * Test Meta CAPI Connection Edge Function
 * 
 * Tests the Meta Conversions API connection for an organization
 * by validating the stored credentials against the Meta Graph API.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Auth client to verify user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for credential access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body = await req.json();
    const { organization_id, pixel_id } = body;

    if (!organization_id || !pixel_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing organization_id or pixel_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-meta-capi] Testing connection for org ${organization_id}, pixel ${pixel_id}`);

    // Get stored credentials
    const { data: creds, error: credsError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta_capi')
      .eq('is_active', true)
      .single();

    if (credsError || !creds) {
      console.error('[test-meta-capi] No credentials found:', credsError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'No CAPI credentials found for this organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = creds.encrypted_credentials as { access_token?: string };
    const accessToken = credentials?.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No access token in stored credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test connection by querying the pixel
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${pixel_id}?fields=name,id&access_token=${accessToken}`
    );

    const result = await response.json();

    if (response.ok && result.id) {
      console.log(`[test-meta-capi] Connection successful: Pixel "${result.name}" (${result.id})`);
      
      // Update last tested timestamp
      await supabase
        .from('client_api_credentials')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: 'success',
          last_test_error: null,
        })
        .eq('organization_id', organization_id)
        .eq('platform', 'meta_capi');

      return new Response(
        JSON.stringify({
          success: true,
          message: `Connected to pixel: ${result.name || result.id}`,
          pixel_name: result.name,
          pixel_id: result.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorMsg = result.error?.message || 'Unknown error from Meta API';
      console.error(`[test-meta-capi] Connection failed: ${errorMsg}`);

      // Update last tested with error
      await supabase
        .from('client_api_credentials')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: 'failed',
          last_test_error: errorMsg.substring(0, 500),
        })
        .eq('organization_id', organization_id)
        .eq('platform', 'meta_capi');

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (e) {
    console.error('[test-meta-capi] Error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
