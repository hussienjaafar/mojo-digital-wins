/**
 * Retry Meta Conversions
 *
 * Processes the retry queue for failed conversion events.
 * Uses per-org tokens (no global token) for multi-tenant support.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, checkRateLimit, decryptCredentials } from "../_shared/security.ts";
import { buildCAPIEndpoint, computeNextRetryAt } from "../_shared/capi-utils.ts";

const corsHeaders = getCorsHeaders();
const MAX_ATTEMPTS = 5;

interface QueueItem {
  id: string;
  meta_conversion_event_id: string;
  organization_id: string;
  event_id: string;
  event_payload: Record<string, any>;
  attempts: number;
}

interface OrgCredentials {
  pixel_id: string;
  access_token: string;
  test_event_code: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rateLimit = await checkRateLimit('retry-meta-conversions', 12, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    const { data: queueItems, error: queueError } = await supabase
      .from('meta_conversion_retry_queue')
      .select('id, meta_conversion_event_id, organization_id, event_id, event_payload, attempts')
      .lte('next_retry_at', now)
      .lt('attempts', MAX_ATTEMPTS)
      .order('next_retry_at', { ascending: true })
      .limit(25);

    if (queueError) throw queueError;

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, sent: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by organization for efficient credential fetching
    const byOrg = new Map<string, QueueItem[]>();
    for (const item of queueItems) {
      const orgItems = byOrg.get(item.organization_id) || [];
      orgItems.push(item as QueueItem);
      byOrg.set(item.organization_id, orgItems);
    }

    // Cache org credentials
    const orgCredentialsCache = new Map<string, OrgCredentials | null>();

    let sent = 0;
    let failed = 0;

    for (const [orgId, items] of byOrg) {
      // Fetch org credentials if not cached
      if (!orgCredentialsCache.has(orgId)) {
        const creds = await getOrgCredentials(supabase, orgId);
        orgCredentialsCache.set(orgId, creds);
      }

      const orgCreds = orgCredentialsCache.get(orgId);
      if (!orgCreds) {
        // No credentials for this org - mark items as failed
        for (const item of items) {
          await markItemFailed(supabase, item, 'No CAPI credentials for organization');
          failed++;
        }
        continue;
      }

      // Process each item for this org
      for (const item of items) {
        const success = await processRetryItem(supabase, item, orgCreds);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    console.log(`[retry-meta-conversions] Processed: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, processed: queueItems.length, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[retry-meta-conversions] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getOrgCredentials(supabase: any, orgId: string): Promise<OrgCredentials | null> {
  // Fetch CAPI config
  const { data: capiConfig } = await supabase
    .from('meta_capi_config')
    .select('pixel_id, test_event_code, is_enabled')
    .eq('organization_id', orgId)
    .eq('is_enabled', true)
    .maybeSingle();

  if (!capiConfig?.pixel_id) {
    return null;
  }

  // Fetch and decrypt access token
  const { data: creds } = await supabase
    .from('client_api_credentials')
    .select('encrypted_credentials')
    .eq('organization_id', orgId)
    .eq('platform', 'meta_capi')
    .eq('is_active', true)
    .maybeSingle();

  if (!creds?.encrypted_credentials) {
    // Try fallback to global token
    const globalToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
    if (globalToken) {
      return {
        pixel_id: capiConfig.pixel_id,
        access_token: globalToken,
        test_event_code: capiConfig.test_event_code,
      };
    }
    return null;
  }

  try {
    const decrypted = await decryptCredentials(creds.encrypted_credentials, orgId);
    if (!decrypted.access_token) {
      return null;
    }
    return {
      pixel_id: capiConfig.pixel_id,
      access_token: decrypted.access_token,
      test_event_code: capiConfig.test_event_code,
    };
  } catch (e) {
    console.error('[retry-meta-conversions] Failed to decrypt credentials for org:', orgId, e);
    return null;
  }
}

async function processRetryItem(
  supabase: any,
  item: QueueItem,
  creds: OrgCredentials
): Promise<boolean> {
  const conversionEvent = item.event_payload;
  const apiUrl = buildCAPIEndpoint(creds.pixel_id);

  const requestBody: Record<string, any> = {
    data: [conversionEvent],
    access_token: creds.access_token,
  };

  if (creds.test_event_code) {
    requestBody.test_event_code = creds.test_event_code;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (response.ok) {
      // Success
      await supabase
        .from('meta_conversion_events')
        .update({
          status: 'sent',
          delivered_at: new Date().toISOString(),
          meta_response: {
            events_received: result.events_received,
            fbtrace_id: result.fbtrace_id,
          },
          last_error: null,
          next_retry_at: null,
        })
        .eq('id', item.meta_conversion_event_id);

      await supabase
        .from('meta_conversion_retry_queue')
        .delete()
        .eq('id', item.id);

      // Update health stats
      await supabase.rpc('update_capi_health_stats', {
        p_organization_id: item.organization_id,
        p_success: true,
        p_error: null,
      }).catch((e: any) => console.error('[retry-meta-conversions] Health update failed:', e.message));

      return true;
    } else {
      // Failure
      await markItemFailed(supabase, item, JSON.stringify(result));
      return false;
    }
  } catch (e: any) {
    await markItemFailed(supabase, item, e.message || 'Network error');
    return false;
  }
}

async function markItemFailed(
  supabase: any,
  item: QueueItem,
  error: string
): Promise<void> {
  const attempts = (item.attempts || 0) + 1;
  const nextRetryAt = computeNextRetryAt(attempts);

  await supabase
    .from('meta_conversion_retry_queue')
    .update({
      attempts,
      last_error: error,
      next_retry_at: nextRetryAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id);

  await supabase
    .from('meta_conversion_events')
    .update({
      status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      retry_count: attempts,
      next_retry_at: nextRetryAt,
      last_error: error,
    })
    .eq('id', item.meta_conversion_event_id);

  // Update health stats
  await supabase.rpc('update_capi_health_stats', {
    p_organization_id: item.organization_id,
    p_success: false,
    p_error: error.substring(0, 500),
  }).catch((e: any) => console.error('[retry-meta-conversions] Health update failed:', e.message));
}
