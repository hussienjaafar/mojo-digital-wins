/**
 * Process Meta CAPI Outbox
 *
 * Scheduled job that processes pending conversion events from the outbox,
 * sends them to Meta CAPI, and handles retries with exponential backoff.
 *
 * Features:
 * - Per-org token decryption with global fallback
 * - Privacy mode-based field hashing
 * - Idempotent: uses same event_id on retry
 * - Exponential backoff for failures
 * - Updates health metrics per org
 * 
 * Updated: 2026-01-21 - Added global token fallback
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, decryptCredentials } from "../_shared/security.ts";
import {
  buildUserDataFromHashed,
  buildCAPIEvent,
  buildCAPIEndpoint,
  computeNextRetryAt,
  META_CAPI_VERSION,
} from "../_shared/capi-utils.ts";

const corsHeaders = getCorsHeaders();
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

interface OutboxEvent {
  id: string;
  organization_id: string;
  event_id: string;
  event_name: string;
  event_time: string;
  event_source_url: string | null;
  dedupe_key: string;
  user_data_hashed: Record<string, string>;  // Pre-hashed PII fields (em, ph, fn, ln, etc.)
  custom_data: Record<string, any>;
  fbp: string | null;
  fbc: string | null;
  external_id: string | null;
  pixel_id: string | null;
  retry_count: number;
  is_enrichment_only: boolean;  // When true, ActBlue owns primary conversion; we send additional matching data
}

interface OrgConfig {
  pixel_id: string;
  privacy_mode: string;
  test_event_code: string | null;
  access_token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate cron or admin auth
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    // Fetch pending events ready for processing
    const { data: outboxEvents, error: fetchError } = await supabase
      .from('meta_conversion_events')
      .select(`
        id,
        organization_id,
        event_id,
        event_name,
        event_time,
        event_source_url,
        dedupe_key,
        user_data_hashed,
        custom_data,
        fbp,
        fbc,
        external_id,
        pixel_id,
        retry_count,
        is_enrichment_only
      `)
      .in('status', ['pending', 'failed'])
      .lte('next_retry_at', now)
      .lt('retry_count', MAX_ATTEMPTS)
      .order('next_retry_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[CAPI-OUTBOX] Failed to fetch events:', fetchError);
      throw fetchError;
    }

    if (!outboxEvents || outboxEvents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, sent: 0, failed: 0, duration_ms: Date.now() - startTime }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CAPI-OUTBOX] Processing ${outboxEvents.length} events`);

    // Group events by organization for efficient processing
    const byOrg = new Map<string, OutboxEvent[]>();
    for (const event of outboxEvents) {
      const orgEvents = byOrg.get(event.organization_id) || [];
      orgEvents.push(event as OutboxEvent);
      byOrg.set(event.organization_id, orgEvents);
    }

    let totalSent = 0;
    let totalFailed = 0;

    // Process each organization's events
    for (const [orgId, events] of byOrg) {
      const result = await processOrgEvents(supabase, orgId, events);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    const duration = Date.now() - startTime;
    console.log(`[CAPI-OUTBOX] Completed: ${totalSent} sent, ${totalFailed} failed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: outboxEvents.length,
        sent: totalSent,
        failed: totalFailed,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CAPI-OUTBOX] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processOrgEvents(
  supabase: any,
  orgId: string,
  events: OutboxEvent[]
): Promise<{ sent: number; failed: number }> {
  // Fetch org CAPI config
  const { data: config, error: configError } = await supabase
    .from('meta_capi_config')
    .select('pixel_id, privacy_mode, test_event_code, is_enabled')
    .eq('organization_id', orgId)
    .single();

  if (configError || !config?.is_enabled) {
    console.log('[CAPI-OUTBOX] Org not configured or disabled:', orgId);
    await markEventsSkipped(supabase, events, 'CAPI not enabled');
    return { sent: 0, failed: events.length };
  }

  // Fetch and decrypt access token
  const { data: creds, error: credsError } = await supabase
    .from('client_api_credentials')
    .select('encrypted_credentials')
    .eq('organization_id', orgId)
    .eq('platform', 'meta_capi')
    .eq('is_active', true)
    .single();

  if (credsError || !creds?.encrypted_credentials) {
    console.error('[CAPI-OUTBOX] No valid credentials for org:', orgId);
    await markEventsFailed(supabase, events, 'No valid CAPI credentials');
    await updateOrgHealth(supabase, orgId, false, 'No valid CAPI credentials');
    return { sent: 0, failed: events.length };
  }

  let accessToken: string;
  
  // First, try reading token directly from JSON (unencrypted storage format)
  const plainCredentials = creds.encrypted_credentials as { access_token?: string };
  console.log('[CAPI-OUTBOX] V2 Checking credentials format:', {
    hasEncryptedCreds: !!creds.encrypted_credentials,
    credType: typeof creds.encrypted_credentials,
    hasAccessToken: !!plainCredentials?.access_token,
    accessTokenType: typeof plainCredentials?.access_token,
    tokenPreview: plainCredentials?.access_token?.substring(0, 20) + '...',
  });
  
  if (plainCredentials?.access_token && typeof plainCredentials.access_token === 'string') {
    console.log('[CAPI-OUTBOX] V2 Using token from plain JSON credentials');
    accessToken = plainCredentials.access_token;
  } else {
    // Try decryption if it's not plain JSON
    try {
      const decrypted = await decryptCredentials(creds.encrypted_credentials, orgId);
      accessToken = decrypted.access_token;
      if (!accessToken) {
        throw new Error('access_token not found in decrypted credentials');
      }
    } catch (e: any) {
      console.error('[CAPI-OUTBOX] Failed to decrypt credentials:', e.message);
      // Fallback to global token if org-specific decryption fails
      const globalToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
      if (globalToken) {
        console.log('[CAPI-OUTBOX] Using global META_CONVERSIONS_API_TOKEN fallback');
        accessToken = globalToken;
      } else {
        await markEventsFailed(supabase, events, 'Credential decryption failed');
        await updateOrgHealth(supabase, orgId, false, 'Credential decryption failed');
        return { sent: 0, failed: events.length };
      }
    }
  }

  const orgConfig: OrgConfig = {
    pixel_id: config.pixel_id,
    privacy_mode: config.privacy_mode || 'conservative',
    test_event_code: config.test_event_code,
    access_token: accessToken,
  };

  // Process events one by one (could batch, but Meta recommends real-time single events)
  let sent = 0;
  let failed = 0;

  for (const event of events) {
    const success = await sendEventToMeta(supabase, orgId, event, orgConfig);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

async function sendEventToMeta(
  supabase: any,
  orgId: string,
  event: OutboxEvent,
  config: OrgConfig
): Promise<boolean> {
  try {
    // Mark as processing to prevent duplicate processing
    await supabase
      .from('meta_conversion_events')
      .update({ status: 'retrying', updated_at: new Date().toISOString() })
      .eq('id', event.id);

    // Build user_data from PRE-HASHED storage, filtering by privacy mode
    // No hashing needed here - data was hashed before storage
    const userData = buildUserDataFromHashed(
      event.user_data_hashed || {},
      config.privacy_mode,
      {
        fbp: event.fbp,
        fbc: event.fbc,
        external_id: event.external_id,
        // Note: client_ip and user_agent would come from original request if stored
      }
    );

    // Build the CAPI event
    const capiEvent = buildCAPIEvent({
      eventName: event.event_name,
      eventTime: event.event_time,
      eventId: event.event_id,  // IMPORTANT: Reuse same event_id for retries
      eventSourceUrl: event.event_source_url || undefined,
      userData,
      customData: event.custom_data,
    });

    // Prepare request body
    const requestBody: Record<string, any> = {
      data: [capiEvent],
      access_token: config.access_token,
    };

    // Add test_event_code if configured (for Meta Test Events validation)
    if (config.test_event_code) {
      requestBody.test_event_code = config.test_event_code;
    }

    // Send to Meta CAPI
    const pixelId = event.pixel_id || config.pixel_id;
    const apiUrl = buildCAPIEndpoint(pixelId);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (response.ok) {
      // Success - mark as sent
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      // Update org health (success)
      await updateOrgHealth(supabase, orgId, true, null);

      const eventType = event.is_enrichment_only ? 'enrichment' : 'primary';
      console.log(`[CAPI-OUTBOX] Sent ${eventType} event ${event.event_id} to pixel ${pixelId}`);
      return true;
    } else {
      // Failure - schedule retry
      const attempts = (event.retry_count || 0) + 1;
      const nextRetry = computeNextRetryAt(attempts);
      const errorMsg = JSON.stringify(result);

      await supabase
        .from('meta_conversion_events')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          retry_count: attempts,
          next_retry_at: nextRetry,
          last_error: errorMsg,
          meta_response: result,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      // Update org health (failure)
      await updateOrgHealth(supabase, orgId, false, errorMsg);

      console.error(`[CAPI-OUTBOX] Failed event ${event.event_id}: ${result?.error?.message || errorMsg}`);
      return false;
    }
  } catch (e: any) {
    // Network or other error
    const attempts = (event.retry_count || 0) + 1;
    const nextRetry = computeNextRetryAt(attempts);
    const errorMsg = e.message || 'Network error';

    await supabase
      .from('meta_conversion_events')
      .update({
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        retry_count: attempts,
        next_retry_at: nextRetry,
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    await updateOrgHealth(supabase, orgId, false, errorMsg);

    console.error(`[CAPI-OUTBOX] Error sending event ${event.event_id}:`, e.message);
    return false;
  }
}

async function markEventsSkipped(
  supabase: any,
  events: OutboxEvent[],
  reason: string
): Promise<void> {
  const ids = events.map(e => e.id);
  await supabase
    .from('meta_conversion_events')
    .update({
      status: 'failed',
      last_error: reason,
      retry_count: MAX_ATTEMPTS,  // Prevent future retries
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);
}

async function markEventsFailed(
  supabase: any,
  events: OutboxEvent[],
  error: string
): Promise<void> {
  for (const event of events) {
    const attempts = (event.retry_count || 0) + 1;
    const nextRetry = computeNextRetryAt(attempts);

    await supabase
      .from('meta_conversion_events')
      .update({
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        retry_count: attempts,
        next_retry_at: nextRetry,
        last_error: error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);
  }
}

async function updateOrgHealth(
  supabase: any,
  orgId: string,
  success: boolean,
  error: string | null
): Promise<void> {
  try {
    await supabase.rpc('update_capi_health_stats', {
      p_organization_id: orgId,
      p_success: success,
      p_error: error ? error.substring(0, 500) : null,  // Truncate long errors
    });
  } catch (e) {
    console.error('[CAPI-OUTBOX] Failed to update health stats:', e);
  }
}
