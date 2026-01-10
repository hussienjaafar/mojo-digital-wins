import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Tokens expiring within this many days will be refreshed
const REFRESH_THRESHOLD_DAYS = 7;

interface CredentialRecord {
  id: string;
  organization_id: string;
  platform: string;
  encrypted_credentials: {
    access_token?: string;
    [key: string]: unknown;
  };
  token_expires_at: string | null;
  refresh_status: string | null;
}

function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.warn('[refresh-meta-tokens] CRON_SECRET not configured - allowing request');
    return true;
  }
  const providedSecret = req.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}

async function validateAuth(req: Request, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) return false;

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  return roles?.some((r: { role: string }) => r.role === 'admin') || false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Validate auth: require cron secret OR admin JWT
  const isCron = validateCronSecret(req);
  const isAdmin = !isCron && await validateAuth(req, supabase);

  if (!isCron && !isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - requires cron secret or admin role' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');

    if (!META_APP_ID || !META_APP_SECRET) {
      console.error('[refresh-meta-tokens] Meta credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Meta credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[refresh-meta-tokens] Starting token refresh check...');

    // Find tokens expiring within threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + REFRESH_THRESHOLD_DAYS);

    const { data: expiringCredentials, error: queryError } = await supabase
      .from('client_api_credentials')
      .select('id, organization_id, platform, encrypted_credentials, token_expires_at, refresh_status')
      .eq('platform', 'meta')
      .eq('is_active', true)
      .not('token_expires_at', 'is', null)
      .lte('token_expires_at', thresholdDate.toISOString())
      .order('token_expires_at', { ascending: true });

    if (queryError) {
      console.error('[refresh-meta-tokens] Query error:', queryError);
      throw queryError;
    }

    const credentials = (expiringCredentials || []) as CredentialRecord[];
    console.log(`[refresh-meta-tokens] Found ${credentials.length} tokens expiring within ${REFRESH_THRESHOLD_DAYS} days`);

    if (credentials.length === 0) {
      return new Response(
        JSON.stringify({ success: true, refreshed: 0, message: 'No tokens need refresh' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let refreshed = 0;
    let failed = 0;
    const results: Array<{ org_id: string; status: string; error?: string }> = [];

    for (const cred of credentials) {
      const orgId = cred.organization_id;
      const currentToken = cred.encrypted_credentials?.access_token;

      if (!currentToken) {
        console.warn(`[refresh-meta-tokens] No token found for org ${orgId}`);
        results.push({ org_id: orgId, status: 'skipped', error: 'No token in credentials' });
        continue;
      }

      // Mark as pending
      await supabase
        .from('client_api_credentials')
        .update({
          refresh_status: 'pending',
          refresh_attempted_at: new Date().toISOString(),
        })
        .eq('id', cred.id);

      try {
        // Exchange for new long-lived token
        const refreshUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
        refreshUrl.searchParams.set('client_id', META_APP_ID);
        refreshUrl.searchParams.set('client_secret', META_APP_SECRET);
        refreshUrl.searchParams.set('fb_exchange_token', currentToken);

        const response = await fetch(refreshUrl.toString());
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'Meta API error');
        }

        const newToken = data.access_token;
        const expiresIn = data.expires_in || 5184000; // Default 60 days
        const newExpiry = new Date(Date.now() + (expiresIn * 1000));

        // Update credentials with new token
        const updatedCredentials = {
          ...cred.encrypted_credentials,
          access_token: newToken,
        };

        await supabase
          .from('client_api_credentials')
          .update({
            encrypted_credentials: updatedCredentials,
            token_expires_at: newExpiry.toISOString(),
            refresh_status: 'success',
            refresh_attempted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', cred.id);

        console.log(`[refresh-meta-tokens] Successfully refreshed token for org ${orgId}, expires ${newExpiry.toISOString()}`);
        refreshed++;
        results.push({ org_id: orgId, status: 'success' });

      } catch (refreshError) {
        const errorMessage = refreshError instanceof Error ? refreshError.message : 'Unknown error';
        console.error(`[refresh-meta-tokens] Failed to refresh token for org ${orgId}:`, errorMessage);

        await supabase
          .from('client_api_credentials')
          .update({
            refresh_status: 'failed',
            refresh_attempted_at: new Date().toISOString(),
          })
          .eq('id', cred.id);

        // Log to job_failures for alerting
        await supabase
          .from('job_failures')
          .insert({
            job_type: 'refresh_meta_tokens',
            job_name: 'Meta Token Refresh',
            error_message: errorMessage,
            error_context: { organization_id: orgId },
            created_at: new Date().toISOString(),
          });

        failed++;
        results.push({ org_id: orgId, status: 'failed', error: errorMessage });
      }
    }

    console.log(`[refresh-meta-tokens] Complete. Refreshed: ${refreshed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        refreshed,
        failed,
        total_checked: credentials.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[refresh-meta-tokens] Error:', error);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
