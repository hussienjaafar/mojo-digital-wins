import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import {
  generateDedupeKey,
  hashUserDataForStorage,
  hashSHA256,
  calculateMatchScore,
  getMatchQualityLabel,
} from "../_shared/capi-utils.ts";

// SECURITY: Restrict CORS to known origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-actblue-signature',
};

// ============= HMAC Signature Validation =============
// ActBlue sends HMAC-SHA256 signature in X-ActBlue-Signature header
// Format: sha256=<hex-encoded-signature>

/**
 * Computes HMAC-SHA256 signature for request body
 * @param body - Raw request body string
 * @param secret - Webhook secret for the organization
 * @returns hex-encoded signature
 */
export async function computeHmacSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validates HMAC signature from ActBlue webhook
 * @param signatureHeader - Value of X-ActBlue-Signature header
 * @param body - Raw request body
 * @param secret - Organization's webhook secret
 * @returns true if signature is valid
 */
export async function validateHmacSignature(
  signatureHeader: string | null,
  body: string,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) {
    return false;
  }

  // Expected format: sha256=<signature>
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const providedSignature = parts[1];
  const computedSignature = await computeHmacSignature(body, secret);

  // Timing-safe comparison
  if (providedSignature.length !== computedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < providedSignature.length; i++) {
    result |= providedSignature.charCodeAt(i) ^ computedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates Basic Auth credentials
 * @param authHeader - Value of Authorization header
 * @param expectedUsername - Expected username
 * @param expectedPassword - Expected password
 * @returns true if credentials are valid
 */
function validateBasicAuth(
  authHeader: string | null,
  expectedUsername: string,
  expectedPassword: string
): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');
    
    // Timing-safe comparison for both username and password
    const usernameMatch = username === expectedUsername;
    const passwordMatch = password === expectedPassword;
    
    return usernameMatch && passwordMatch;
  } catch (e) {
    console.error('[ACTBLUE] Failed to decode Basic Auth:', e);
    return false;
  }
}

// Helper to safely extract values from any type
const safeString = (val: any): string | null => {
  if (val === null || val === undefined) return null;
  return String(val);
};

const safeNumber = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? null : num;
};

const safeInt = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? Math.round(val) : parseInt(String(val));
  return isNaN(num) ? null : num;
};

const safeBool = (val: any): boolean => {
  if (val === true || val === 'true') return true;
  return false;
};

const getCustomFieldValue = (customFields: any, key: string): string | null => {
  if (!Array.isArray(customFields)) return null;
  const match = customFields.find((f: any) => f?.name?.toLowerCase() === key.toLowerCase());
  return match?.value ? safeString(match.value) : null;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get auth headers BEFORE consuming body
  const signatureHeader = req.headers.get('X-ActBlue-Signature') || req.headers.get('x-actblue-signature');
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const requestBody = await req.text();

  console.log('[ACTBLUE] Received webhook at', new Date().toISOString());
  console.log('[ACTBLUE] Auth method:', signatureHeader ? 'HMAC' : (authHeader ? 'Basic Auth' : 'None'));

  // Log webhook for debugging (create initial log entry)
  let webhookLogId: string | null = null;
  let parsedPayload: any;
  
  try {
    parsedPayload = JSON.parse(requestBody);
  } catch (parseError) {
    console.error('[ACTBLUE] Failed to parse JSON:', parseError);
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create initial webhook log
  const { data: logData } = await supabase.from('webhook_logs').insert({
    platform: 'actblue',
    event_type: 'incoming',
    payload: parsedPayload,
    headers: { 
      ...Object.fromEntries(req.headers.entries()),
      'x-actblue-signature': signatureHeader ? '[REDACTED]' : null,
      'authorization': authHeader ? '[REDACTED]' : null,
    },
    received_at: new Date().toISOString(),
    processing_status: 'pending',
  }).select('id').single();
  
  webhookLogId = logData?.id;

  try {
    // Validate required fields
    if (!parsedPayload.lineitems || !Array.isArray(parsedPayload.lineitems) || parsedPayload.lineitems.length === 0) {
      console.error('[ACTBLUE] Missing lineitems array in payload');
      await updateWebhookLog(supabase, webhookLogId, 'failed', null, 'Missing lineitems');
      return new Response(
        JSON.stringify({ error: 'Missing lineitems' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parsedPayload.contribution) {
      console.error('[ACTBLUE] Missing contribution object in payload');
      await updateWebhookLog(supabase, webhookLogId, 'failed', null, 'Missing contribution');
      return new Response(
        JSON.stringify({ error: 'Missing contribution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Find organization by entity_id
    const lineitem = parsedPayload.lineitems[0];
    const entityId = safeString(lineitem.entityId);
    
    console.log('[ACTBLUE] Processing lineitem with entityId:', entityId);
    
    // Fetch ALL ActBlue credentials to find matching org by entity_id
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('organization_id, encrypted_credentials')
      .eq('platform', 'actblue')
      .eq('is_active', true);

    if (credError || !credData || credData.length === 0) {
      console.error('[ACTBLUE] No active ActBlue credentials found:', credError);
      await updateWebhookLog(supabase, webhookLogId, 'failed', null, 'No ActBlue credentials configured');
      return new Response(
        JSON.stringify({ error: 'No matching organization found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find organization by entity_id
    let matchingCred = credData.find((cred: any) => {
      const credentials = cred.encrypted_credentials as any;
      return credentials?.entity_id === entityId;
    });

    if (!matchingCred) {
      const storedEntityIds = credData.map((c: any) => c.encrypted_credentials?.entity_id);
      console.error('[SECURITY] No organization matches entityId:', entityId, 'Stored:', storedEntityIds);
      await updateWebhookLog(supabase, webhookLogId, 'failed', null, `No org for entity_id: ${entityId}`);
      return new Response(
        JSON.stringify({ error: 'Organization not found for entity_id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organization_id = matchingCred.organization_id;
    const credentials = matchingCred.encrypted_credentials as any;

    // ============= HYBRID AUTH VALIDATION =============
    // Try HMAC first (preferred), fall back to Basic Auth
    let isAuthenticated = false;
    let authMethod = 'none';

    // Option 1: HMAC Signature (most secure)
    const webhookSecret = credentials?.webhook_secret;
    if (signatureHeader && webhookSecret && webhookSecret !== 'false' && webhookSecret !== false) {
      isAuthenticated = await validateHmacSignature(signatureHeader, requestBody, webhookSecret);
      if (isAuthenticated) {
        authMethod = 'hmac';
        console.log('[ACTBLUE] Authenticated via HMAC signature');
      } else {
        console.warn('[ACTBLUE] HMAC signature validation failed');
      }
    }

    // Option 2: Basic Auth (fallback for ActBlue's default configuration)
    if (!isAuthenticated && authHeader) {
      const basicUsername = credentials?.basic_auth_username;
      const basicPassword = credentials?.basic_auth_password;
      
      if (basicUsername && basicPassword) {
        isAuthenticated = validateBasicAuth(authHeader, basicUsername, basicPassword);
        if (isAuthenticated) {
          authMethod = 'basic';
          console.log('[ACTBLUE] Authenticated via Basic Auth');
        } else {
          console.warn('[ACTBLUE] Basic Auth validation failed');
        }
      }
    }

    // Option 3: No auth configured but webhook is being received (legacy support)
    // Only allow if explicitly enabled via allow_unauthenticated flag
    if (!isAuthenticated && credentials?.allow_unauthenticated === true) {
      isAuthenticated = true;
      authMethod = 'unauthenticated';
      console.warn('[ACTBLUE] Processing UNAUTHENTICATED webhook (not recommended!)');
    }

    if (!isAuthenticated) {
      console.error('[SECURITY] Authentication failed for organization:', organization_id);
      console.error('[SECURITY] HMAC available:', !!webhookSecret, '| Basic Auth available:', !!(credentials?.basic_auth_username));
      await updateWebhookLog(supabase, webhookLogId, 'failed', organization_id, 'Authentication failed');
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          hint: 'Configure webhook_secret for HMAC or basic_auth_username/password in API credentials'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ACTBLUE] Authenticated (${authMethod}) for organization:`, organization_id);

    // Determine transaction type
    let transactionType = 'donation';
    const contribution = parsedPayload.contribution as any;
    
    if (contribution.cancelledAt) {
      transactionType = 'cancellation';
    }
    const firstLineitem = parsedPayload.lineitems[0] as any;
    if (firstLineitem.refundedAt) {
      transactionType = 'refund';
    }

    // Extract refcodes
    const refcodes = parsedPayload.contribution.refcodes || {};
    let refcode = refcodes.refcode || null;
    
    // Extract source campaign from refcode
    let sourceCampaign = null;
    if (refcode) {
      const lowerRefcode = refcode.toLowerCase();
      if (lowerRefcode.includes('meta')) sourceCampaign = 'meta';
      else if (lowerRefcode.includes('sms')) sourceCampaign = 'sms';
      else if (lowerRefcode.includes('email')) sourceCampaign = 'email';
    }

    const donor = parsedPayload.donor || {};
    const donorName = donor.firstname && donor.lastname 
      ? `${donor.firstname} ${donor.lastname}`.trim() 
      : null;
    const customFields = contribution.customFields || [];
    const clickId = getCustomFieldValue(customFields, 'click_id') || getCustomFieldValue(customFields, 'fbclid');
    const fbclid = getCustomFieldValue(customFields, 'fbclid');

    // Recurring state derivation (best-effort with available payload fields)
    let recurringState: string | null = null;
    if (transactionType === 'refund') recurringState = 'refunded';
    else if (transactionType === 'cancellation') recurringState = 'cancelled';
    else if (contribution.recurringPeriod) recurringState = 'active';

    // Extract data using safe helpers
    const amount = safeNumber(lineitem.amount);
    const lineitemId = safeInt(lineitem.lineitemId);
    const paidAt = safeString(lineitem.paidAt) || safeString(contribution.createdAt) || new Date().toISOString();

    if (amount === null || lineitemId === null) {
      console.error('[ACTBLUE] Missing required fields: amount or lineitemId', { amount, lineitemId });
      await updateWebhookLog(supabase, webhookLogId, 'failed', organization_id, 'Missing amount or lineitemId');
      return new Response(
        JSON.stringify({ error: 'Missing required amount or lineitemId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, try to look up refcode in refcode_mappings for deterministic attribution
    let determinedSource = sourceCampaign;
    let mapping: any = null;
    if (refcode) {
      const { data: mappingData } = await supabase
        .from('refcode_mappings')
        .select('platform, campaign_id, ad_id, creative_id')
        .eq('organization_id', organization_id)
        .eq('refcode', refcode)
        .maybeSingle();

      mapping = mappingData;

      if (mapping?.platform) {
        determinedSource = mapping.platform;
        console.log(`[ACTBLUE] Found deterministic attribution: refcode "${refcode}" -> platform "${mapping.platform}"`);
      }
    }

    // Fallback deterministic lookup by click_id/fbclid when refcode is missing or unmapped
    if (!mapping && (clickId || fbclid)) {
      const conditions = [];
      if (clickId) conditions.push(`click_id.eq.${clickId}`);
      if (fbclid) conditions.push(`fbclid.eq.${fbclid}`);

      const { data: clickMapping } = await supabase
        .from('refcode_mappings')
        .select('platform, campaign_id, ad_id, creative_id, refcode')
        .eq('organization_id', organization_id)
        .or(conditions.join(','))
        .maybeSingle();

      if (clickMapping) {
        mapping = clickMapping;
        determinedSource = clickMapping.platform || 'meta';
        if (!refcode) {
          refcode = clickMapping.refcode || clickId || fbclid;
        }
        console.log('[ACTBLUE] Deterministic attribution via click_id/fbclid', { clickId, fbclid });
      }
    }

    // Store transaction data (RLS-compatible with service role)
    // Now capturing ALL available ActBlue fields for complete analytics
    const { error: insertError } = await supabase
      .from('actblue_transactions')
      .insert({
        organization_id,
        transaction_id: String(lineitemId),
        donor_email: safeString(donor.email),
        donor_name: donorName,
        first_name: safeString(donor.firstname),
        last_name: safeString(donor.lastname),
        addr1: safeString(donor.addr1),
        city: safeString(donor.city),
        state: safeString(donor.state),
        zip: safeString(donor.zip),
        country: safeString(donor.country),
        phone: safeString(donor.phone),
        employer: safeString(donor.employerData?.employer),
        occupation: safeString(donor.employerData?.occupation),
        amount: amount,
        // NEW: Capture fee for net revenue calculation
        fee: safeNumber(lineitem.feeAmount),
        // NEW: Payment method details for payment quality analysis
        payment_method: safeString(contribution.paymentMethod),
        card_type: safeString(contribution.cardType),
        // NEW: Smart Boost and Double Down for upsell analysis
        smart_boost_amount: safeNumber(contribution.smartBoostAmount),
        double_down: safeBool(contribution.doubleDown),
        // NEW: Recurring upsell tracking for subscription health
        recurring_upsell_shown: safeBool(contribution.recurringUpsellShown),
        recurring_upsell_succeeded: safeBool(contribution.recurringUpsellSucceeded),
        order_number: safeString(contribution.orderNumber),
        contribution_form: safeString(contribution.contributionForm),
        refcode: refcode,
        refcode2: safeString(refcodes.refcode2),
        refcode_custom: safeString(refcodes.refcodeCustom),
        // Deterministic attribution support
        click_id: clickId,
        fbclid,
        source_campaign: determinedSource,
        ab_test_name: safeString(contribution.abTestName),
        ab_test_variation: safeString(contribution.abTestVariation),
        is_mobile: safeBool(contribution.isMobile),
        is_express: safeBool(contribution.isExpress),
        text_message_option: safeString(contribution.textMessageOption),
        lineitem_id: lineitemId,
        entity_id: safeString(lineitem.entityId),
        committee_name: safeString(lineitem.committeeName),
        fec_id: safeString(lineitem.fecId),
        recurring_period: safeString(contribution.recurringPeriod),
        recurring_duration: safeInt(contribution.recurringDuration),
        is_recurring: !!contribution.recurringPeriod && contribution.recurringPeriod !== 'once',
        recurring_state: recurringState,
        next_charge_date: null, // placeholder until ActBlue exposes next charge date
        custom_fields: contribution.customFields || [],
        transaction_type: transactionType,
        transaction_date: paidAt,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        console.log('[ACTBLUE] Transaction already exists, updating:', lineitemId);
        const { error: updateError } = await supabase
          .from('actblue_transactions')
          .update({ transaction_type: transactionType })
          .eq('transaction_id', String(lineitemId));

        if (updateError) throw updateError;
      } else {
        throw insertError;
      }
    }

    // Track attribution touchpoint
    const touchpointRef = refcode || mapping?.refcode || clickId || fbclid;
    if (donor.email && touchpointRef) {
      await supabase.from('attribution_touchpoints').insert({
        organization_id,
        donor_email: safeString(donor.email),
        touchpoint_type: determinedSource || 'other',
        campaign_id: mapping?.campaign_id || safeString(contribution.contributionForm),
        ad_id: mapping?.ad_id || null,
        creative_id: mapping?.creative_id || null,
        utm_source: safeString(refcodes.refcode2),
        utm_campaign: touchpointRef,
        refcode: touchpointRef,
        occurred_at: paidAt,
        metadata: {
          ab_test: safeString(contribution.abTestName),
          ab_variation: safeString(contribution.abTestVariation),
          is_mobile: safeBool(contribution.isMobile),
          deterministic_match: !!mapping,
          click_id: clickId,
          fbclid: fbclid,
        },
      }).then(({ error }) => {
        if (error) console.error('[ACTBLUE] Error tracking touchpoint:', error);
      });

      // Update donor demographics
      await supabase.from('donor_demographics')
        .upsert({
          organization_id,
          donor_email: safeString(donor.email),
          first_name: safeString(donor.firstname),
          last_name: safeString(donor.lastname),
          address: safeString(donor.addr1),
          city: safeString(donor.city),
          state: safeString(donor.state),
          zip: safeString(donor.zip),
          country: safeString(donor.country),
          phone: safeString(donor.phone),
          employer: safeString(donor.employerData?.employer),
          occupation: safeString(donor.employerData?.occupation),
          last_donation_date: paidAt,
        }, {
          onConflict: 'organization_id,donor_email',
          ignoreDuplicates: false,
        })
        .select()
        .single()
        .then(async ({ data, error }) => {
          if (!error && data) {
            const { data: txData } = await supabase
              .from('actblue_transactions')
              .select('amount')
              .eq('organization_id', organization_id)
              .eq('donor_email', donor.email);
            
            if (txData) {
              const total = txData.reduce((sum, tx) => sum + tx.amount, 0);
              await supabase.from('donor_demographics')
                .update({
                  total_donated: total,
                  donation_count: txData.length,
                  first_donation_date: data.first_donation_date || paidAt,
                })
                .eq('id', data.id);
            }
          }
        });
    }

    console.log('[ACTBLUE] Transaction stored successfully:', lineitemId, '| Amount:', amount);

    // === META CAPI OUTBOX ENQUEUE ===
    // Enqueue conversion event for server-side tracking (non-blocking, non-fatal)
    try {
      await enqueueCAPIEvent(supabase, {
        organization_id,
        transactionId: String(lineitemId),
        transactionType,
        donor: {
          email: safeString(donor.email) || undefined,
          firstname: safeString(donor.firstname) || undefined,
          lastname: safeString(donor.lastname) || undefined,
          phone: safeString(donor.phone) || undefined,
          city: safeString(donor.city) || undefined,
          state: safeString(donor.state) || undefined,
          zip: safeString(donor.zip) || undefined,
          country: safeString(donor.country) || undefined,
        },
        amount,
        paidAt,
        refcode,
        fbclid,
        clickId,
        contributionForm: safeString(contribution.contributionForm) || undefined,
      });
    } catch (capiError: any) {
      // Non-fatal: log but don't fail the webhook
      console.error('[ACTBLUE] CAPI enqueue failed (non-fatal):', capiError?.message || capiError);
    }

    // Update webhook log with success
    await updateWebhookLog(supabase, webhookLogId, 'success', organization_id, null, {
      transaction_id: String(lineitemId),
      amount,
      auth_method: authMethod,
    });

    // Update data freshness tracking
    await supabase.rpc('update_data_freshness', {
      p_source: 'actblue_webhook',
      p_organization_id: organization_id,
      p_latest_data_timestamp: paidAt,
      p_sync_status: 'success',
      p_error: null,
      p_records_synced: 1,
      p_duration_ms: null,
    }).then(({ error }) => {
      if (error) console.error('[ACTBLUE] Error updating freshness:', error);
    });
    
    return new Response(
      JSON.stringify({ success: true, transaction_id: String(lineitemId), auth_method: authMethod }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ACTBLUE] Error in webhook:', error);
    await updateWebhookLog(supabase, webhookLogId, 'failed', null, error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper to update webhook log status
async function updateWebhookLog(
  supabase: any,
  logId: string | null,
  status: string,
  organizationId: string | null,
  error: string | null,
  metadata?: any
) {
  if (!logId) return;

  await supabase.from('webhook_logs').update({
    processing_status: status,
    organization_id: organizationId,
    error_message: error,
    processed_at: new Date().toISOString(),
    metadata: metadata,
  }).eq('id', logId).then(({ error: updateError }: any) => {
    if (updateError) console.error('[ACTBLUE] Failed to update webhook log:', updateError);
  });
}

// ============= META CAPI OUTBOX ENQUEUE =============
// Enqueues donation events to Meta Conversions API outbox for server-side tracking

interface EnqueueCAPIParams {
  organization_id: string;
  transactionId: string;
  transactionType: string;
  donor: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  amount: number;
  paidAt: string;
  refcode?: string | null;
  fbclid?: string | null;
  clickId?: string | null;
  contributionForm?: string | null;
}

async function enqueueCAPIEvent(
  supabase: any,
  params: EnqueueCAPIParams
): Promise<void> {
  const {
    organization_id,
    transactionId,
    transactionType,
    donor,
    amount,
    paidAt,
    refcode,
    fbclid,
    clickId,
    contributionForm,
  } = params;

  // Only enqueue for donation events (not refunds/cancellations)
  if (transactionType !== 'donation') {
    console.log('[CAPI] Skipping non-donation transaction type:', transactionType);
    return;
  }

  // Check if CAPI is enabled for this org
  const { data: capiConfig, error: configError } = await supabase
    .from('meta_capi_config')
    .select('is_enabled, actblue_owns_donation_complete, donation_event_name, pixel_id, privacy_mode')
    .eq('organization_id', organization_id)
    .maybeSingle();

  if (configError) {
    console.error('[CAPI] Error fetching config:', configError.message);
    return;
  }

  if (!capiConfig || !capiConfig.is_enabled) {
    // CAPI not configured or not enabled for this org - silent skip
    return;
  }

  // Skip if ActBlue owns donation CAPI events (to prevent double-counting)
  if (capiConfig.actblue_owns_donation_complete) {
    console.log('[CAPI] ActBlue owns donation CAPI for org:', organization_id);
    return;
  }

  const eventName = capiConfig.donation_event_name || 'Purchase';
  const dedupeKey = generateDedupeKey(eventName, organization_id, transactionId);

  // Generate deterministic event_id from dedupe_key
  const eventId = crypto.randomUUID();

  // Lookup fbp/fbc from attribution touchpoints if not in payload
  let fbp: string | null = null;
  let fbc: string | null = fbclid || clickId || null;

  if (donor.email) {
    const { data: touchpoint } = await supabase
      .from('attribution_touchpoints')
      .select('metadata')
      .eq('organization_id', organization_id)
      .eq('donor_email', donor.email)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (touchpoint?.metadata) {
      fbp = touchpoint.metadata.fbp || fbp;
      fbc = touchpoint.metadata.fbc || touchpoint.metadata.fbclid || fbc;
    }
  }

  // SECURITY: Pre-hash all PII before storing in database
  // This ensures NO plaintext PII is stored in meta_conversion_events
  const userDataHashed = await hashUserDataForStorage({
    email: donor.email,
    phone: donor.phone,
    fn: donor.firstname,
    ln: donor.lastname,
    city: donor.city,
    state: donor.state,
    zip: donor.zip,
    country: donor.country,
  });

  // Generate external_id from email hash (if email exists)
  let externalId: string | null = null;
  if (donor.email) {
    externalId = await hashSHA256(donor.email.toLowerCase().trim());
  }

  // Calculate match score for debugging (based on field presence)
  // Note: Score is capped at 40 if neither email nor phone is present
  const matchScore = calculateMatchScore(userDataHashed, {
    fbp,
    fbc,
    external_id: externalId,
  });
  // Pass userDataHashed to enforce safety cap on label
  const matchQuality = getMatchQualityLabel(matchScore, userDataHashed);

  // Build custom_data for the event
  const customData = {
    value: amount,
    currency: 'USD',
    content_type: 'donation',
    order_id: transactionId,
  };

  // Build event source URL
  const eventSourceUrl = contributionForm
    ? `https://secure.actblue.com/donate/${contributionForm}`
    : null;

  // Insert into meta_conversion_events (the outbox)
  const { error: insertError } = await supabase
    .from('meta_conversion_events')
    .upsert({
      organization_id,
      event_id: eventId,
      event_name: eventName,
      event_time: paidAt,
      event_source_url: eventSourceUrl,
      dedupe_key: dedupeKey,
      source_type: 'actblue_webhook',
      source_id: transactionId,
      user_data_hashed: userDataHashed,
      custom_data: customData,
      refcode,
      fbp,
      fbc,
      external_id: externalId,
      pixel_id: capiConfig.pixel_id,
      match_score: matchScore,
      match_quality: matchQuality,
      status: 'pending',
      retry_count: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,dedupe_key',
      ignoreDuplicates: true,  // Skip if already queued (idempotent)
    });

  if (insertError) {
    // Log but don't fail the webhook - CAPI is non-critical
    console.error('[CAPI] Failed to enqueue event:', insertError.message);
  } else {
    console.log('[CAPI] Enqueued donation event:', dedupeKey);
  }
}
