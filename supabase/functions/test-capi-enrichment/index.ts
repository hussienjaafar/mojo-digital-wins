import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate admin access
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { organization_id, donation_id, dry_run = true } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log(`[TEST] Starting CAPI enrichment test for org: ${organization_id}`);
    log(`[TEST] Dry run: ${dry_run}`);

    // 1. Fetch org's CAPI config
    const { data: capiConfig, error: configError } = await supabase
      .from('meta_capi_config')
      .select('*')
      .eq('organization_id', organization_id)
      .single();

    if (configError || !capiConfig) {
      log(`[TEST] ERROR: No CAPI config found for org`);
      return new Response(
        JSON.stringify({ error: 'No CAPI config found', logs }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log(`[TEST] CAPI Config:`);
    log(`  - is_enabled: ${capiConfig.is_enabled}`);
    log(`  - pixel_id: ${capiConfig.pixel_id}`);
    log(`  - actblue_owns_donation_complete: ${capiConfig.actblue_owns_donation_complete}`);
    log(`  - privacy_mode: ${capiConfig.privacy_mode}`);

    const isEnrichmentMode = capiConfig.actblue_owns_donation_complete === true;
    log(`[TEST] Mode: ${isEnrichmentMode ? 'ENRICHMENT' : 'PRIMARY'}`);

    if (!capiConfig.is_enabled) {
      log(`[TEST] WARNING: CAPI is not enabled for this org`);
    }

    // 2. Fetch credentials
    const { data: creds, error: credsError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .single();

    if (credsError || !creds) {
      log(`[TEST] ERROR: No Meta credentials found`);
      return new Response(
        JSON.stringify({ error: 'No Meta credentials found', logs }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log(`[TEST] Meta credentials found`);

    // Get access token - try decrypt first, fallback to plain JSON
    let accessToken: string | null = null;
    
    // Try decryption first
    const { data: decrypted } = await supabase
      .rpc('decrypt_credentials', { encrypted_data: creds.encrypted_credentials });
    
    if (decrypted?.access_token) {
      accessToken = decrypted.access_token;
      log(`[TEST] Credentials decrypted successfully`);
    } else {
      // Fallback: check if credentials are stored as plain JSON
      const plainCreds = creds.encrypted_credentials as any;
      if (plainCreds?.access_token) {
        accessToken = plainCreds.access_token;
        log(`[TEST] Using plain credentials (not encrypted)`);
      }
    }

    if (!accessToken) {
      log(`[TEST] ERROR: No access token found in credentials`);
      return new Response(
        JSON.stringify({ error: 'No access token found', logs }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch a donation to test with
    let transaction;
    if (donation_id) {
      const { data, error } = await supabase
        .from('actblue_transactions')
        .select('*')
        .eq('id', donation_id)
        .eq('organization_id', organization_id)
        .single();
      
      if (error || !data) {
        log(`[TEST] ERROR: Donation not found: ${donation_id}`);
        return new Response(
          JSON.stringify({ error: 'Donation not found', logs }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      transaction = data;
    } else {
      // Get most recent donation
      const { data, error } = await supabase
        .from('actblue_transactions')
        .select('*')
        .eq('organization_id', organization_id)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) {
        log(`[TEST] ERROR: No donations found for org`);
        return new Response(
          JSON.stringify({ error: 'No donations found', logs }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      transaction = data;
    }

    log(`[TEST] Using donation: ${transaction.transaction_id}`);
    log(`  - Amount: $${transaction.amount}`);
    log(`  - Date: ${transaction.transaction_date}`);
    log(`  - Email: ${transaction.donor_email ? '***@***' : 'none'}`);
    log(`  - Phone: ${transaction.phone ? '***' : 'none'}`);
    log(`  - Name: ${transaction.donor_name || 'none'}`);
    log(`  - City: ${transaction.city || 'none'}`);
    log(`  - State: ${transaction.state || 'none'}`);
    log(`  - ZIP: ${transaction.zip || 'none'}`);

    // 4. Build the CAPI event payload
    const eventTime = Math.floor(new Date(transaction.transaction_date).getTime() / 1000);
    
    // Generate event_id - deterministic for enrichment mode
    const eventId = isEnrichmentMode
      ? await hashSHA256(`enrichment:${organization_id}:${transaction.transaction_id}`)
      : crypto.randomUUID();

    log(`[TEST] Event ID: ${eventId} (${isEnrichmentMode ? 'deterministic' : 'random'})`);

    // Build user_data with hashed PII
    const userData: Record<string, string> = {};

    if (transaction.donor_email) {
      const normalizedEmail = normalizeEmail(transaction.donor_email);
      userData.em = await hashSHA256(normalizedEmail);
      userData.external_id = await hashSHA256(normalizedEmail);
      log(`[TEST] Hashed email (em): ${userData.em.substring(0, 16)}...`);
      log(`[TEST] External ID: ${userData.external_id.substring(0, 16)}...`);
    }

    if (transaction.phone) {
      const normalizedPhone = normalizePhone(transaction.phone);
      if (normalizedPhone.length >= 10) {
        userData.ph = await hashSHA256(normalizedPhone);
        log(`[TEST] Hashed phone (ph): ${userData.ph.substring(0, 16)}...`);
      }
    }

    if (transaction.first_name) {
      userData.fn = await hashSHA256(normalizeName(transaction.first_name));
      log(`[TEST] Hashed first name (fn): ${userData.fn.substring(0, 16)}...`);
    } else if (transaction.donor_name) {
      const parts = transaction.donor_name.trim().split(/\s+/);
      if (parts[0]) {
        userData.fn = await hashSHA256(normalizeName(parts[0]));
        log(`[TEST] Hashed first name from donor_name (fn): ${userData.fn.substring(0, 16)}...`);
      }
    }

    if (transaction.last_name) {
      userData.ln = await hashSHA256(normalizeName(transaction.last_name));
      log(`[TEST] Hashed last name (ln): ${userData.ln.substring(0, 16)}...`);
    } else if (transaction.donor_name) {
      const parts = transaction.donor_name.trim().split(/\s+/);
      if (parts.length > 1) {
        userData.ln = await hashSHA256(normalizeName(parts.slice(1).join('')));
        log(`[TEST] Hashed last name from donor_name (ln): ${userData.ln.substring(0, 16)}...`);
      }
    }

    if (transaction.city) {
      userData.ct = await hashSHA256(normalizeCity(transaction.city));
      log(`[TEST] Hashed city (ct): ${userData.ct.substring(0, 16)}...`);
    }

    if (transaction.state) {
      userData.st = await hashSHA256(normalizeState(transaction.state));
      log(`[TEST] Hashed state (st): ${userData.st.substring(0, 16)}...`);
    }

    if (transaction.zip) {
      userData.zp = await hashSHA256(normalizeZip(transaction.zip));
      log(`[TEST] Hashed ZIP (zp): ${userData.zp.substring(0, 16)}...`);
    }

    if (transaction.country) {
      userData.country = await hashSHA256(transaction.country.toLowerCase().trim());
      log(`[TEST] Hashed country: ${userData.country.substring(0, 16)}...`);
    } else {
      userData.country = await hashSHA256('us');
      log(`[TEST] Defaulted country to US`);
    }

    // Check for FBP/FBC from attribution touchpoints
    const { data: touchpoint } = await supabase
      .from('attribution_touchpoints')
      .select('metadata')
      .eq('organization_id', organization_id)
      .eq('donor_email', transaction.donor_email)
      .not('metadata', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (touchpoint?.metadata) {
      const meta = touchpoint.metadata as Record<string, any>;
      if (meta.fbp) {
        userData.fbp = meta.fbp;
        log(`[TEST] Found FBP from touchpoint: ${meta.fbp.substring(0, 20)}...`);
      }
      if (meta.fbc) {
        userData.fbc = meta.fbc;
        log(`[TEST] Found FBC from touchpoint: ${meta.fbc.substring(0, 20)}...`);
      }
    } else {
      log(`[TEST] No FBP/FBC found in touchpoints`);
    }

    // Build the event
    const capiEvent = {
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        value: Number(transaction.amount) || 0,
        currency: 'USD',
        order_id: transaction.transaction_id,
      },
    };

    log(`[TEST] Built CAPI event payload`);
    log(`[TEST] User data fields: ${Object.keys(userData).join(', ')}`);

    // 5. Send to Meta (unless dry_run)
    if (dry_run) {
      log(`[TEST] DRY RUN - Not sending to Meta`);
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          mode: isEnrichmentMode ? 'enrichment' : 'primary',
          event: capiEvent,
          logs,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = `https://graph.facebook.com/${API_VERSION}/${capiConfig.pixel_id}/events`;

    log(`[TEST] Sending to Meta: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [capiEvent],
        access_token: accessToken,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      log(`[TEST] ERROR: Meta API returned ${response.status}`);
      log(`[TEST] Response: ${JSON.stringify(result)}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: result,
          event: capiEvent,
          logs,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log(`[TEST] SUCCESS: Event sent to Meta`);
    log(`[TEST] Events received: ${result.events_received}`);
    log(`[TEST] FBTrace ID: ${result.fbtrace_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: false,
        mode: isEnrichmentMode ? 'enrichment' : 'primary',
        meta_response: result,
        event: capiEvent,
        logs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-capi-enrichment] Error:', error);
    logs.push(`[TEST] ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        logs,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
