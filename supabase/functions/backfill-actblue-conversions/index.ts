import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();
const API_VERSION = "v22.0";

async function hashSHA256(value: string): Promise<string> {
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

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, '');
}

function normalizeCity(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, '');
}

function normalizeState(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, '');
}

function normalizeZip(value: string): string {
  const zip = value.replace(/\D/g, '');
  return zip.substring(0, 5);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface OrgConfig {
  pixel_id: string;
  access_token: string;
  is_enrichment_only: boolean;
  privacy_mode: string;
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

    const body = await req.json().catch(() => ({}));
    const organizationId = body.organization_id as string | undefined;
    const limit = Number(body.limit) > 0 ? Number(body.limit) : 50;
    const lookbackDays = Number(body.lookback_days) > 0 ? Number(body.lookback_days) : 60;
    const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[backfill] Starting with org=${organizationId || 'all'}, limit=${limit}, lookback=${lookbackDays}d`);

    // Build transaction query
    let txQuery = supabase
      .from('actblue_transactions')
      .select('id, organization_id, transaction_id, donor_email, donor_name, first_name, last_name, phone, city, state, zip, country, amount, refcode, source_campaign, transaction_date, meta_capi_status, meta_capi_attempts')
      .gte('transaction_date', cutoff)
      .lt('meta_capi_attempts', 5)
      .or('meta_capi_status.is.null,meta_capi_status.neq.sent')
      .order('transaction_date', { ascending: true })
      .limit(limit);

    if (organizationId) {
      txQuery = txQuery.eq('organization_id', organizationId);
    }

    const { data: transactions, error: txError } = await txQuery;

    if (txError) throw txError;

    if (!transactions || transactions.length === 0) {
      console.log('[backfill] No transactions to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0, sent: 0, failed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill] Found ${transactions.length} transactions to process`);

    // Get unique org IDs
    const orgIds = Array.from(new Set(transactions.map(t => t.organization_id)));
    
    // Fetch CAPI configs for all orgs
    const { data: capiConfigs } = await supabase
      .from('meta_capi_config')
      .select('organization_id, pixel_id, is_enabled, actblue_owns_donation_complete, privacy_mode')
      .in('organization_id', orgIds)
      .eq('is_enabled', true);

    const configMap = new Map<string, any>();
    for (const cfg of capiConfigs || []) {
      configMap.set(cfg.organization_id, cfg);
    }

    // Fetch credentials for all orgs
    const { data: allCreds } = await supabase
      .from('client_api_credentials')
      .select('organization_id, encrypted_credentials')
      .in('organization_id', orgIds)
      .eq('platform', 'meta')
      .eq('is_active', true);

    // Get access tokens - try decrypt first, fallback to plain JSON
    const credMap = new Map<string, string>();
    for (const cred of allCreds || []) {
      let accessToken: string | null = null;
      
      // Try decryption first
      const { data: decrypted } = await supabase
        .rpc('decrypt_credentials', { encrypted_data: cred.encrypted_credentials });
      
      if (decrypted?.access_token) {
        accessToken = decrypted.access_token;
      } else {
        // Fallback: check if credentials are stored as plain JSON
        const plainCreds = cred.encrypted_credentials as any;
        if (plainCreds?.access_token) {
          accessToken = plainCreds.access_token;
        }
      }
      
      if (accessToken) {
        credMap.set(cred.organization_id, accessToken);
      }
    }

    // Build org config map
    const orgConfigMap = new Map<string, OrgConfig>();
    for (const [orgId, cfg] of configMap) {
      const token = credMap.get(orgId);
      if (token && cfg.pixel_id) {
        orgConfigMap.set(orgId, {
          pixel_id: cfg.pixel_id,
          access_token: token,
          is_enrichment_only: cfg.actblue_owns_donation_complete === true,
          privacy_mode: cfg.privacy_mode || 'standard',
        });
      }
    }

    console.log(`[backfill] Loaded configs for ${orgConfigMap.size} orgs`);

    // Fetch attribution data
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

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const tx of transactions) {
      const orgConfig = orgConfigMap.get(tx.organization_id);
      if (!orgConfig) {
        console.log(`[backfill] Skipping ${tx.transaction_id} - no valid config for org`);
        skipped++;
        continue;
      }

      const attempts = (tx.meta_capi_attempts || 0) + 1;
      const attributionKey = `${tx.organization_id}|${tx.refcode}`;
      const campaignId = attributionMap.get(attributionKey) || tx.source_campaign || null;

      // Generate event_id - deterministic for enrichment mode
      const eventId = orgConfig.is_enrichment_only
        ? await hashSHA256(`enrichment:${tx.organization_id}:${tx.transaction_id}`)
        : `backfill_${tx.transaction_id}`;

      // Build user_data with full PII (hashed)
      const userData: Record<string, string> = {};

      if (tx.donor_email) {
        const normalizedEmail = normalizeEmail(tx.donor_email);
        userData.em = await hashSHA256(normalizedEmail);
        userData.external_id = await hashSHA256(normalizedEmail);
      }

      if (tx.phone) {
        const normalizedPhone = normalizePhone(tx.phone);
        if (normalizedPhone.length >= 10) {
          userData.ph = await hashSHA256(normalizedPhone);
        }
      }

      // Handle name - prefer first_name/last_name, fallback to donor_name
      if (tx.first_name) {
        userData.fn = await hashSHA256(normalizeName(tx.first_name));
      } else if (tx.donor_name) {
        const parts = tx.donor_name.trim().split(/\s+/);
        if (parts[0]) {
          userData.fn = await hashSHA256(normalizeName(parts[0]));
        }
      }

      if (tx.last_name) {
        userData.ln = await hashSHA256(normalizeName(tx.last_name));
      } else if (tx.donor_name) {
        const parts = tx.donor_name.trim().split(/\s+/);
        if (parts.length > 1) {
          userData.ln = await hashSHA256(normalizeName(parts.slice(1).join('')));
        }
      }

      if (tx.city) {
        userData.ct = await hashSHA256(normalizeCity(tx.city));
      }

      if (tx.state) {
        userData.st = await hashSHA256(normalizeState(tx.state));
      }

      if (tx.zip) {
        userData.zp = await hashSHA256(normalizeZip(tx.zip));
      }

      if (tx.country) {
        userData.country = await hashSHA256(tx.country.toLowerCase().trim());
      } else {
        userData.country = await hashSHA256('us');
      }

      // Fallback external_id if no email
      if (!userData.external_id) {
        userData.external_id = await hashSHA256(tx.transaction_id);
      }

      // Check for FBP/FBC from touchpoints
      if (tx.donor_email) {
        const { data: touchpoint } = await supabase
          .from('attribution_touchpoints')
          .select('metadata')
          .eq('organization_id', tx.organization_id)
          .eq('donor_email', tx.donor_email)
          .not('metadata', 'is', null)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (touchpoint?.metadata) {
          const meta = touchpoint.metadata as Record<string, any>;
          if (meta.fbp) userData.fbp = meta.fbp;
          if (meta.fbc) userData.fbc = meta.fbc;
        }
      }

      const eventTime = Math.floor(new Date(tx.transaction_date).getTime() / 1000);
      const customData = {
        value: Number(tx.amount) || 0,
        currency: 'USD',
        order_id: tx.transaction_id,
      };

      const conversionEvent = {
        event_id: eventId,
        event_name: 'Purchase',
        event_time: eventTime,
        action_source: 'website',
        user_data: userData,
        custom_data: customData,
      };

      const apiUrl = `https://graph.facebook.com/${API_VERSION}/${orgConfig.pixel_id}/events`;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [conversionEvent],
            access_token: orgConfig.access_token,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.log(`[backfill] Failed to send ${tx.transaction_id}: ${JSON.stringify(result)}`);
          failed++;
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

        console.log(`[backfill] Sent ${tx.transaction_id} (${orgConfig.is_enrichment_only ? 'enrichment' : 'primary'})`);
        sent++;

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

        // Record in outbox for tracking
        await supabase
          .from('meta_conversion_events')
          .upsert({
            organization_id: tx.organization_id,
            event_id: eventId,
            event_name: 'Purchase',
            event_time: new Date(eventTime * 1000).toISOString(),
            campaign_id: campaignId,
            refcode: tx.refcode,
            custom_data: customData,
            status: 'sent',
            delivered_at: new Date().toISOString(),
            is_enrichment_only: orgConfig.is_enrichment_only,
            meta_response: {
              events_received: result.events_received,
              fbtrace_id: result.fbtrace_id,
              backfilled: true,
            },
          }, { onConflict: 'organization_id,event_id' });

      } catch (error) {
        console.error(`[backfill] Error sending ${tx.transaction_id}:`, error);
        failed++;
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

    console.log(`[backfill] Complete: processed=${transactions.length}, sent=${sent}, failed=${failed}, skipped=${skipped}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: transactions.length, 
        sent, 
        failed, 
        skipped,
        enrichment_mode_count: transactions.filter(t => orgConfigMap.get(t.organization_id)?.is_enrichment_only).length,
      }),
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







