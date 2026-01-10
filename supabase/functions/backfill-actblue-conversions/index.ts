import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, checkRateLimit } from "../_shared/security.ts";

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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function splitName(name: string): { first?: string; last?: string } {
  const normalized = normalizeName(name);
  if (!normalized) return {};
  const parts = normalized.split(' ');
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function filterCustomData(data: Record<string, any>, allowlist: Set<string>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!allowlist.has(key)) continue;
    if (value === undefined || value === null) continue;
    filtered[key] = value;
  }
  return filtered;
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

    const rateLimit = await checkRateLimit('backfill-actblue-conversions', 6, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Conversions API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit) > 0 ? Number(body.limit) : 50;
    const lookbackDays = Number(body.lookback_days) > 0 ? Number(body.lookback_days) : 60;
    const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: transactions, error: txError } = await supabase
      .from('actblue_transactions')
      .select('id, organization_id, transaction_id, donor_email, donor_name, amount, refcode, source_campaign, transaction_date, meta_capi_status, meta_capi_attempts')
      .gte('transaction_date', cutoff)
      .lt('meta_capi_attempts', 5)
      .or('meta_capi_status.is.null,meta_capi_status.neq.sent')
      .order('transaction_date', { ascending: true })
      .limit(limit);

    if (txError) throw txError;

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, sent: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const refcodes = Array.from(new Set(transactions.map((t) => t.refcode).filter(Boolean)));
    const attributionMap = new Map<string, string>();

    if (refcodes.length > 0) {
      for (const chunk of chunkArray(refcodes, 200)) {
        const { data: attributions } = await supabase
          .from('campaign_attribution')
          .select('organization_id, refcode, meta_campaign_id')
          .in('refcode', chunk);

        for (const row of attributions || []) {
          if (row.meta_campaign_id) {
            attributionMap.set(`${row.organization_id}|${row.refcode}`, row.meta_campaign_id);
          }
        }
      }
    }

    const campaignIds = new Set<string>();
    for (const tx of transactions) {
      const attributionKey = `${tx.organization_id}|${tx.refcode}`;
      const attributedCampaign = attributionMap.get(attributionKey);
      if (attributedCampaign) campaignIds.add(attributedCampaign);
      if (tx.source_campaign) campaignIds.add(tx.source_campaign);
    }

    const campaignTrendMap = new Map<string, string | null>();
    if (campaignIds.size > 0) {
      const campaignIdList = Array.from(campaignIds);
      for (const chunk of chunkArray(campaignIdList, 200)) {
        const { data: campaigns } = await supabase
          .from('meta_campaigns')
          .select('organization_id, campaign_id, trend_event_id')
          .in('campaign_id', chunk);

        for (const row of campaigns || []) {
          campaignTrendMap.set(`${row.organization_id}|${row.campaign_id}`, row.trend_event_id);
        }
      }
    }

    let sent = 0;
    let failed = 0;

    for (const tx of transactions) {
      const attempts = (tx.meta_capi_attempts || 0) + 1;
      const eventId = `actblue_${tx.transaction_id}`;
      const attributionKey = `${tx.organization_id}|${tx.refcode}`;
      const attributedCampaign = attributionMap.get(attributionKey) || null;
      const campaignId = attributedCampaign || tx.source_campaign || null;
      const trendEventId = campaignId
        ? campaignTrendMap.get(`${tx.organization_id}|${campaignId}`) || null
        : null;

      const userData: Record<string, string> = {};
      if (tx.donor_email) {
        const normalizedEmail = normalizeEmail(tx.donor_email);
        if (normalizedEmail) {
          userData.em = await sha256(normalizedEmail);
        }
      }

      if (tx.donor_name) {
        const { first, last } = splitName(tx.donor_name);
        if (first) userData.fn = await sha256(first);
        if (last) userData.ln = await sha256(last);
      }

      if (Object.keys(userData).length === 0) {
        userData.external_id = await sha256(tx.transaction_id);
      }

      const baseCustomData = {
        value: Number(tx.amount) || 0,
        currency: 'USD',
        order_id: tx.transaction_id,
        campaign_id: campaignId,
        refcode: tx.refcode,
        trend_event_id: trendEventId,
      };

      const customData = filterCustomData(baseCustomData, STORAGE_CUSTOM_DATA_KEYS);
      const metaCustomData = filterCustomData(baseCustomData, META_CUSTOM_DATA_KEYS);

      const eventTime = Math.floor(new Date(tx.transaction_date).getTime() / 1000);
      const conversionEvent: Record<string, any> = {
        event_id: eventId,
        event_name: 'Purchase',
        event_time: eventTime,
        action_source: 'system_generated',
        user_data: userData,
      };

      if (Object.keys(metaCustomData).length > 0) {
        conversionEvent.custom_data = metaCustomData;
      }

      const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

      try {
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
          failed += 1;
          await supabase
            .from('actblue_transactions')
            .update({
              meta_capi_status: 'failed',
              meta_capi_attempts: attempts,
              meta_capi_last_error: JSON.stringify(result),
              meta_capi_event_id: eventId,
            })
            .eq('id', tx.id);
          continue;
        }

        sent += 1;

        await supabase
          .from('actblue_transactions')
          .update({
            meta_capi_status: 'sent',
            meta_capi_synced_at: new Date().toISOString(),
            meta_capi_attempts: attempts,
            meta_capi_event_id: eventId,
            meta_capi_last_error: null,
          })
          .eq('id', tx.id);

        await supabase
          .from('meta_conversion_events')
          .upsert({
            organization_id: tx.organization_id,
            event_id: eventId,
            event_name: 'Purchase',
            event_time: new Date(eventTime * 1000).toISOString(),
            campaign_id: campaignId,
            trend_event_id: trendEventId,
            refcode: tx.refcode,
            custom_data: customData,
            status: 'sent',
            delivered_at: new Date().toISOString(),
            meta_response: {
              events_received: result.events_received,
              fbtrace_id: result.fbtrace_id,
            },
          }, { onConflict: 'organization_id,event_id' });

        if (trendEventId) {
          await supabase
            .from('trend_action_outcomes')
            .insert({
              trend_event_id: trendEventId,
              organization_id: tx.organization_id,
              action_type: 'meta',
              action_taken_at: new Date(eventTime * 1000).toISOString(),
              outcome_type: 'donation',
              outcome_value: Number(tx.amount) || 0,
              outcome_recorded_at: new Date().toISOString(),
              metadata: {
                event_id: eventId,
                campaign_id: campaignId,
                refcode: tx.refcode,
              },
            });
        }
      } catch (error) {
        failed += 1;
        await supabase
          .from('actblue_transactions')
          .update({
            meta_capi_status: 'failed',
            meta_capi_attempts: attempts,
            meta_capi_last_error: error instanceof Error ? error.message : 'Unknown error',
            meta_capi_event_id: eventId,
          })
          .eq('id', tx.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: transactions.length, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[backfill-actblue-conversions] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});











