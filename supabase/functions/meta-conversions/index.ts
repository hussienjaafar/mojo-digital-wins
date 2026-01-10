import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, checkRateLimit, validateAuth } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();
const PIXEL_ID = "1344961220416600";
const API_VERSION = "v22.0";

const META_CUSTOM_DATA_KEYS = new Set([
  'value', 'currency', 'content_type', 'content_ids', 'contents', 'num_items',
  'order_id', 'predicted_ltv'
]);

const STORAGE_CUSTOM_DATA_KEYS = new Set([
  'value', 'currency', 'content_type', 'content_ids', 'contents', 'num_items',
  'order_id', 'predicted_ltv',
  'campaign_id', 'ad_set_id', 'adset_id', 'ad_id',
  'trend_event_id', 'refcode', 'organization_id',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'source', 'medium'
]);

const ATTRIBUTION_REQUIRED_EVENTS = new Set([
  'Purchase', 'Lead', 'CompleteRegistration', 'Donate', 'Conversion'
]);

const metaEventSchema = z.object({
  event_name: z.string().trim().min(1).max(100),
  event_id: z.string().trim().min(1).max(128).optional(),
  event_source_url: z.string().url().max(500).optional(),
  user_data: z.object({
    em: z.string().optional(),
    ph: z.string().optional(),
    fn: z.string().optional(),
    ln: z.string().optional(),
    fbp: z.string().optional(),
    fbc: z.string().optional(),
    external_id: z.string().optional(),
  }).optional(),
  custom_data: z.record(z.string(), z.any()).optional()
});

interface ConversionEvent {
  event_id?: string;
  event_name: string;
  event_time: number;
  action_source: string;
  event_source_url?: string;
  user_data?: {
    client_ip_address?: string;
    client_user_agent?: string;
    em?: string;
    ph?: string;
    fn?: string;
    ln?: string;
    fbp?: string;
    fbc?: string;
    external_id?: string;
  };
  custom_data?: Record<string, any>;
}

function getEventId(provided?: string): string {
  if (provided && provided.trim().length > 0) return provided.trim();
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function filterCustomData(data: Record<string, any>, allowlist: Set<string>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (!allowlist.has(key)) continue;
    if (value === undefined) continue;
    filtered[key] = value;
  }
  return filtered;
}

function normalizeNumeric(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function computeNextRetryAt(attempts: number): string {
  const delayMinutes = Math.min(60, 5 * Math.pow(2, Math.max(0, attempts - 1)));
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

function pluckString(data: Record<string, any>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Rate limiting for public endpoint
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(`meta-conversions:${clientIP}`, 100, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
    if (!accessToken) {
      console.error('META_CONVERSIONS_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Conversions API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const requestBody = await req.json();
    const validationResult = metaEventSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input parameters', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { event_name, event_id, event_source_url, user_data = {}, custom_data = {} } = validationResult.data;
    const eventId = getEventId(event_id);
    const storedCustomData = filterCustomData(custom_data, STORAGE_CUSTOM_DATA_KEYS);
    const metaCustomData = filterCustomData(custom_data, META_CUSTOM_DATA_KEYS);
    const normalizedValue = normalizeNumeric(storedCustomData.value);
    if (normalizedValue !== null) {
      storedCustomData.value = normalizedValue;
      metaCustomData.value = normalizedValue;
    }

    const authResult = await validateAuth(req, supabase);
    let organizationId: string | null = null;
    let userId: string | null = null;

    if (authResult?.user?.id) {
      userId = authResult.user.id;
      const { data: clientUser, error: clientUserError } = await supabase
        .from('client_users')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (clientUserError) {
        console.warn('[meta-conversions] Failed to resolve organization:', clientUserError);
      } else {
        organizationId = clientUser?.organization_id ?? null;
      }
    }

    const customOrganizationId = pluckString(storedCustomData, 'organization_id');
    if (!organizationId && authResult?.isAdmin && customOrganizationId) {
      organizationId = customOrganizationId;
    }

    const campaignId = pluckString(storedCustomData, 'campaign_id');
    const adSetId = pluckString(storedCustomData, 'ad_set_id') || pluckString(storedCustomData, 'adset_id');
    const adId = pluckString(storedCustomData, 'ad_id');
    const trendEventId = pluckString(storedCustomData, 'trend_event_id');
    const refcode = pluckString(storedCustomData, 'refcode');

    const requiresAttribution = ATTRIBUTION_REQUIRED_EVENTS.has(event_name);
    if (authResult && requiresAttribution) {
      if (!organizationId) {
        return new Response(
          JSON.stringify({ error: 'organization_id is required for attributed conversions' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!trendEventId) {
        return new Response(
          JSON.stringify({ error: 'trend_event_id is required for attributed conversions' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!campaignId && !adSetId && !adId) {
        return new Response(
          JSON.stringify({ error: 'campaign_id or ad_set_id or ad_id is required for attributed conversions' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let existingEvent: { id: string; status: string | null; retry_count: number | null } | null = null;
    if (organizationId) {
      const { data: existingData } = await supabase
        .from('meta_conversion_events')
        .select('id, status, retry_count')
        .eq('organization_id', organizationId)
        .eq('event_id', eventId)
        .maybeSingle();
      existingEvent = existingData ?? null;

      if (existingEvent?.status === 'sent') {
        return new Response(
          JSON.stringify({ success: true, deduped: true, event_id: eventId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const eventTimestamp = Math.floor(Date.now() / 1000);

    let eventRowId: string | null = existingEvent?.id ?? null;
    let retryCount = existingEvent?.retry_count ?? 0;

    if (organizationId) {
      const { data: upsertedEvent, error: upsertError } = await supabase
        .from('meta_conversion_events')
        .upsert({
          organization_id: organizationId,
          user_id: userId,
          event_id: eventId,
          event_name,
          event_source_url,
          event_time: new Date(eventTimestamp * 1000).toISOString(),
          campaign_id: campaignId,
          ad_set_id: adSetId,
          ad_id: adId,
          trend_event_id: trendEventId,
          refcode,
          custom_data: storedCustomData,
          status: existingEvent ? 'retrying' : 'pending',
          next_retry_at: null,
          last_error: null
        }, {
          onConflict: 'organization_id,event_id'
        })
        .select('id, retry_count')
        .maybeSingle();

      if (upsertError) {
        console.error('[meta-conversions] Failed to upsert conversion event:', upsertError);
      } else {
        eventRowId = upsertedEvent?.id ?? eventRowId;
        retryCount = upsertedEvent?.retry_count ?? retryCount;
      }
    }

    const userAgent = req.headers.get('user-agent') || '';
    const conversionEvent: ConversionEvent = {
      event_id: eventId,
      event_name,
      event_time: eventTimestamp,
      action_source: 'website',
      event_source_url,
      user_data: {
        client_ip_address: clientIP,
        client_user_agent: userAgent,
        ...user_data,
      },
    };

    if (Object.keys(metaCustomData).length > 0) {
      conversionEvent.custom_data = metaCustomData;
    }

    const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [conversionEvent],
        access_token: accessToken,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta Conversions API error:', result);
      const nextRetryAt = computeNextRetryAt(retryCount + 1);

      if (organizationId) {
        await supabase
          .from('meta_conversion_events')
          .update({
            status: 'failed',
            retry_count: retryCount + 1,
            next_retry_at: nextRetryAt,
            last_error: JSON.stringify(result),
            meta_response: result,
          })
          .eq('organization_id', organizationId)
          .eq('event_id', eventId);

        const queuePayload = {
          meta_conversion_event_id: eventRowId,
          organization_id: organizationId,
          event_id: eventId,
          event_payload: conversionEvent,
          attempts: retryCount + 1,
          next_retry_at: nextRetryAt,
          last_error: JSON.stringify(result),
        };

        const { error: queueError } = await supabase
          .from('meta_conversion_retry_queue')
          .upsert(queuePayload, { onConflict: 'organization_id,event_id' });

        if (queueError) {
          console.error('[meta-conversions] Failed to enqueue retry:', queueError);
        }
      }

      return new Response(
        JSON.stringify({ error: 'Failed to send conversion event', details: result, event_id: eventId }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (organizationId) {
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
        .eq('organization_id', organizationId)
        .eq('event_id', eventId);
    }

    if (organizationId && trendEventId) {
      const outcomeValue = normalizeNumeric(storedCustomData.value) ?? 0;
      const { error: outcomeError } = await supabase
        .from('trend_action_outcomes')
        .insert({
          trend_event_id: trendEventId,
          organization_id: organizationId,
          action_type: 'meta',
          action_taken_at: new Date(eventTimestamp * 1000).toISOString(),
          outcome_type: 'conversion',
          outcome_value: outcomeValue,
          outcome_recorded_at: new Date().toISOString(),
          metadata: {
            event_id: eventId,
            campaign_id: campaignId,
            ad_set_id: adSetId,
            ad_id: adId,
            refcode,
          }
        });

      if (outcomeError) {
        console.error('[meta-conversions] Failed to store trend action outcome:', outcomeError);
      }
    }

    console.log('Conversion event sent:', { event_name, events_received: result.events_received });

    return new Response(
      JSON.stringify({
        success: true,
        events_received: result.events_received,
        fbtrace_id: result.fbtrace_id,
        event_id: eventId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-conversions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
