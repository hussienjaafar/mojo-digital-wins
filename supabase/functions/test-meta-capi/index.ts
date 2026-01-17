/**
 * Test Meta CAPI Connection Edge Function
 * 
 * Tests the Meta Conversions API connection for an organization
 * by sending a test event to validate the token has ads_management permission.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Parse Meta API errors into user-friendly messages with actionable guidance
 */
function parseMetaError(errorMessage: string): { message: string; guidance: string } {
  const lowerMsg = errorMessage.toLowerCase();
  
  if (lowerMsg.includes('missing permission') || lowerMsg.includes('(#100)')) {
    return {
      message: 'Missing required permission',
      guidance: 'The access token needs "ads_management" permission. Generate a System User token from Meta Business Manager with access to this pixel.',
    };
  }
  
  if (lowerMsg.includes('invalid oauth access token') || lowerMsg.includes('malformed')) {
    return {
      message: 'Invalid or expired token',
      guidance: 'The access token is invalid or has expired. Generate a new token from Meta Events Manager.',
    };
  }
  
  if (lowerMsg.includes('invalid pixel_id') || lowerMsg.includes('(#803)')) {
    return {
      message: 'Pixel not found',
      guidance: 'The Pixel ID does not exist or the token does not have access to it. Verify the Pixel ID in Meta Events Manager.',
    };
  }
  
  if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many calls')) {
    return {
      message: 'Rate limited',
      guidance: 'Too many API calls. Wait a few minutes and try again.',
    };
  }
  
  if (lowerMsg.includes('expired')) {
    return {
      message: 'Token expired',
      guidance: 'The access token has expired. Generate a new long-lived token from Meta Business Manager.',
    };
  }
  
  return {
    message: errorMessage,
    guidance: 'Check that your access token has the required permissions and the Pixel ID is correct.',
  };
}

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

    console.log(`[test-meta-capi] Testing CAPI connection for org ${organization_id}, pixel ${pixel_id}`);

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

    // Test connection by sending a test event (requires ads_management permission)
    // Using test_event_code ensures this doesn't count as a real conversion
    const testEventCode = `TEST_${Date.now()}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const eventId = `test_${crypto.randomUUID()}`;

    const testPayload = {
      data: [{
        event_name: 'PageView',
        event_time: eventTime,
        event_id: eventId,
        action_source: 'website',
        user_data: {
          client_ip_address: '0.0.0.0',
          client_user_agent: 'CAPI-Test/1.0',
        },
      }],
      test_event_code: testEventCode,
    };

    console.log(`[test-meta-capi] Sending test event with code: ${testEventCode}`);

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${pixel_id}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      }
    );

    const result = await response.json();

    if (response.ok && result.events_received >= 1) {
      console.log(`[test-meta-capi] Connection successful: ${result.events_received} event(s) received`);
      
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
          message: `CAPI connection verified! Test event received by Meta.`,
          events_received: result.events_received,
          test_event_code: testEventCode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const rawError = result.error?.message || 'Meta API did not accept the test event';
      const { message, guidance } = parseMetaError(rawError);
      const fullError = `${message}: ${guidance}`;
      
      console.error(`[test-meta-capi] Connection failed: ${rawError}`);

      // Update last tested with error
      await supabase
        .from('client_api_credentials')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: 'failed',
          last_test_error: fullError.substring(0, 500),
        })
        .eq('organization_id', organization_id)
        .eq('platform', 'meta_capi');

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: message,
          guidance: guidance,
          raw_error: rawError,
        }),
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
