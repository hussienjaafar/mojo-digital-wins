import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Test Integration Edge Function
 * 
 * Actually tests integration credentials by calling the real APIs.
 * Supports: Meta Graph API, Switchboard API, ActBlue API
 * 
 * This replaces the passive "last sync status" check with active validation.
 */

interface TestResult {
  platform: string;
  organizationId: string;
  organizationName?: string;
  success: boolean;
  status: 'success' | 'error' | 'timeout' | 'invalid_credentials' | 'rate_limited';
  message: string;
  latencyMs: number;
  testedAt: string;
  details?: Record<string, any>;
}

async function testMetaIntegration(
  credentials: any,
  organizationId: string
): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    platform: 'meta',
    organizationId,
    success: false,
    status: 'error',
    message: '',
    latencyMs: 0,
    testedAt: new Date().toISOString(),
  };

  try {
    const accessToken = credentials.access_token;
    const adAccountId = credentials.ad_account_id;

    if (!accessToken) {
      result.status = 'invalid_credentials';
      result.message = 'Missing access token';
      result.latencyMs = Date.now() - startTime;
      return result;
    }

    // Test by calling /me endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://graph.facebook.com/v19.0/me?access_token=${accessToken}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    result.latencyMs = Date.now() - startTime;

    const data = await response.json();

    if (!response.ok) {
      if (data.error?.code === 190) {
        result.status = 'invalid_credentials';
        result.message = 'Access token expired or invalid';
      } else if (data.error?.code === 17 || data.error?.code === 4) {
        result.status = 'rate_limited';
        result.message = 'API rate limit exceeded';
      } else {
        result.status = 'error';
        result.message = data.error?.message || 'Unknown Meta API error';
      }
      result.details = { error: data.error };
      return result;
    }

    // If we have an ad account, verify access to it
    if (adAccountId) {
      const adAccountResponse = await fetch(
        `https://graph.facebook.com/v19.0/act_${adAccountId}?access_token=${accessToken}&fields=id,name,account_status`
      );
      
      if (!adAccountResponse.ok) {
        const adError = await adAccountResponse.json();
        result.status = 'error';
        result.message = `Ad account access failed: ${adError.error?.message || 'Unknown error'}`;
        result.details = { adAccountError: adError.error };
        return result;
      }

      const adAccountData = await adAccountResponse.json();
      result.details = {
        user: data.name || data.id,
        adAccount: adAccountData.name || adAccountId,
        accountStatus: adAccountData.account_status,
      };
    } else {
      result.details = { user: data.name || data.id };
    }

    result.success = true;
    result.status = 'success';
    result.message = 'Meta API connection verified';
    return result;

  } catch (error: any) {
    result.latencyMs = Date.now() - startTime;
    if (error.name === 'AbortError') {
      result.status = 'timeout';
      result.message = 'Connection timed out (10s)';
    } else {
      result.status = 'error';
      result.message = error.message || 'Unknown error';
    }
    return result;
  }
}

async function testSwitchboardIntegration(
  credentials: any,
  organizationId: string
): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    platform: 'switchboard',
    organizationId,
    success: false,
    status: 'error',
    message: '',
    latencyMs: 0,
    testedAt: new Date().toISOString(),
  };

  try {
    const apiKey = credentials.api_key;
    const campaignId = credentials.campaign_id;

    if (!apiKey) {
      result.status = 'invalid_credentials';
      result.message = 'Missing API key';
      result.latencyMs = Date.now() - startTime;
      return result;
    }

    // Test by calling the Switchboard API health endpoint or campaigns list
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Switchboard API base URL - adjust based on actual API
    const baseUrl = credentials.base_url || 'https://api.switchboard.sms';
    
    const response = await fetch(
      `${baseUrl}/v1/campaigns`,
      { 
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    clearTimeout(timeoutId);
    result.latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        result.status = 'invalid_credentials';
        result.message = 'API key invalid or unauthorized';
      } else if (response.status === 429) {
        result.status = 'rate_limited';
        result.message = 'API rate limit exceeded';
      } else {
        result.status = 'error';
        result.message = `API error: ${response.status} ${errorText.substring(0, 100)}`;
      }
      return result;
    }

    const data = await response.json();
    result.success = true;
    result.status = 'success';
    result.message = 'Switchboard API connection verified';
    result.details = {
      campaignsCount: Array.isArray(data) ? data.length : (data.campaigns?.length || 0),
    };
    return result;

  } catch (error: any) {
    result.latencyMs = Date.now() - startTime;
    if (error.name === 'AbortError') {
      result.status = 'timeout';
      result.message = 'Connection timed out (10s)';
    } else {
      result.status = 'error';
      result.message = error.message || 'Unknown error';
    }
    return result;
  }
}

async function testActBlueIntegration(
  credentials: any,
  organizationId: string
): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    platform: 'actblue',
    organizationId,
    success: false,
    status: 'error',
    message: '',
    latencyMs: 0,
    testedAt: new Date().toISOString(),
  };

  try {
    // ActBlue uses webhook validation - we verify the webhook secret exists
    const webhookSecret = credentials.webhook_secret;
    const entityId = credentials.entity_id;

    if (!webhookSecret && !entityId) {
      result.status = 'invalid_credentials';
      result.message = 'Missing webhook secret or entity ID';
      result.latencyMs = Date.now() - startTime;
      return result;
    }

    // For ActBlue, we can't directly call their API without a webhook event
    // So we verify the credentials are present and properly formatted
    const isValidSecret = webhookSecret && webhookSecret.length >= 16;
    const isValidEntityId = entityId && /^\d+$/.test(entityId.toString());

    result.latencyMs = Date.now() - startTime;

    if (isValidSecret || isValidEntityId) {
      result.success = true;
      result.status = 'success';
      result.message = 'ActBlue credentials verified (format check)';
      result.details = {
        hasWebhookSecret: !!webhookSecret,
        hasEntityId: !!entityId,
        note: 'Full validation occurs on next webhook event',
      };
    } else {
      result.status = 'invalid_credentials';
      result.message = 'Credentials appear malformed';
      result.details = {
        secretValid: isValidSecret,
        entityIdValid: isValidEntityId,
      };
    }

    return result;

  } catch (error: any) {
    result.latencyMs = Date.now() - startTime;
    result.status = 'error';
    result.message = error.message || 'Unknown error';
    return result;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, platform, test_all_failing } = await req.json();

    console.log(`[TEST-INTEGRATION] Starting tests. org=${organization_id}, platform=${platform}, test_all_failing=${test_all_failing}`);

    // Build query for credentials
    let query = supabase
      .from('client_api_credentials')
      .select(`
        id,
        organization_id,
        platform,
        encrypted_credentials,
        is_active,
        last_test_status,
        client_organizations!inner(name)
      `)
      .eq('is_active', true);

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (test_all_failing) {
      query = query.in('last_test_status', ['error', 'timeout', 'invalid_credentials']);
    }

    const { data: credentials, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[TEST-INTEGRATION] Found ${credentials?.length || 0} credentials to test`);

    const results: TestResult[] = [];

    for (const cred of credentials || []) {
      let result: TestResult;

      try {
        // Parse encrypted credentials (in production, would decrypt first)
        const credData = typeof cred.encrypted_credentials === 'string' 
          ? JSON.parse(cred.encrypted_credentials) 
          : cred.encrypted_credentials;

        switch (cred.platform) {
          case 'meta':
            result = await testMetaIntegration(credData, cred.organization_id);
            break;
          case 'switchboard':
            result = await testSwitchboardIntegration(credData, cred.organization_id);
            break;
          case 'actblue':
            result = await testActBlueIntegration(credData, cred.organization_id);
            break;
          default:
            result = {
              platform: cred.platform,
              organizationId: cred.organization_id,
              success: false,
              status: 'error',
              message: `Unknown platform: ${cred.platform}`,
              latencyMs: 0,
              testedAt: new Date().toISOString(),
            };
        }

        // Add org name
        result.organizationName = (cred.client_organizations as any)?.name;

      } catch (err: any) {
        result = {
          platform: cred.platform,
          organizationId: cred.organization_id,
          organizationName: (cred.client_organizations as any)?.name,
          success: false,
          status: 'error',
          message: err.message || 'Test execution failed',
          latencyMs: 0,
          testedAt: new Date().toISOString(),
        };
      }

      results.push(result);

      // Update the credential record with test results
      const { error: updateError } = await supabase
        .from('client_api_credentials')
        .update({
          last_tested_at: result.testedAt,
          last_test_status: result.status,
          last_test_error: result.success ? null : result.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cred.id);

      if (updateError) {
        console.error(`[TEST-INTEGRATION] Failed to update credential ${cred.id}:`, updateError);
      }

      console.log(`[TEST-INTEGRATION] ${result.platform}@${result.organizationName}: ${result.status} (${result.latencyMs}ms)`);
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[TEST-INTEGRATION] Complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          passed: successCount,
          failed: failCount,
          byPlatform: {
            meta: results.filter(r => r.platform === 'meta').length,
            switchboard: results.filter(r => r.platform === 'switchboard').length,
            actblue: results.filter(r => r.platform === 'actblue').length,
          },
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TEST-INTEGRATION] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
