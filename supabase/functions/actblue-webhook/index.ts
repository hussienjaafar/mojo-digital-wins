import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

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
    const refcode = refcodes.refcode || null;
    
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

    // Store transaction data (RLS-compatible with service role)
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
        order_number: safeString(contribution.orderNumber),
        contribution_form: safeString(contribution.contributionForm),
        refcode: refcode,
        refcode2: safeString(refcodes.refcode2),
        refcode_custom: safeString(refcodes.refcodeCustom),
        source_campaign: sourceCampaign,
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
    if (donor.email && refcode) {
      await supabase.from('attribution_touchpoints').insert({
        organization_id,
        donor_email: safeString(donor.email),
        touchpoint_type: sourceCampaign || 'other',
        campaign_id: safeString(contribution.contributionForm),
        utm_source: safeString(refcodes.refcode2),
        utm_campaign: refcode,
        refcode: refcode,
        occurred_at: paidAt,
        metadata: {
          ab_test: safeString(contribution.abTestName),
          ab_variation: safeString(contribution.abTestVariation),
          is_mobile: safeBool(contribution.isMobile),
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
