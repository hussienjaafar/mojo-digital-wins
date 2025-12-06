import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Basic Auth credentials from request
    const authHeader = req.headers.get('Authorization');
    const requestBody = await req.text();

    console.log('Received ActBlue webhook at', new Date().toISOString());

    // Log webhook delivery for debugging
    await supabase.from('webhook_logs').insert({
      platform: 'actblue',
      event_type: 'incoming',
      payload: JSON.parse(requestBody),
      headers: Object.fromEntries(req.headers.entries()),
      received_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('Failed to log webhook:', error);
    });

    // Parse payload - NO schema validation, just accept any valid JSON
    // ActBlue says: "We may add new data to the JSON payloads without warning"
    let payload: any;
    try {
      payload = JSON.parse(requestBody);
      console.log('Parsed payload successfully, keys:', Object.keys(payload));
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate required fields exist
    if (!payload.lineitems || !Array.isArray(payload.lineitems) || payload.lineitems.length === 0) {
      console.error('Missing lineitems array in payload');
      return new Response(
        JSON.stringify({ error: 'Missing lineitems' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!payload.contribution) {
      console.error('Missing contribution object in payload');
      return new Response(
        JSON.stringify({ error: 'Missing contribution' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find organization by entity_id from lineitems
    const lineitem = payload.lineitems[0];
    const entityId = safeString(lineitem.entityId);
    
    console.log('Processing lineitem with entityId:', entityId);
    
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('organization_id, encrypted_credentials')
      .eq('platform', 'actblue')
      .eq('is_active', true);

    if (credError || !credData || credData.length === 0) {
      console.error('No active ActBlue credentials found:', credError);
      return new Response(
        JSON.stringify({ error: 'No matching organization found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Found', credData.length, 'active ActBlue credentials');

    // Find matching organization by entity_id
    let matchingCred = credData.find((cred: any) => {
      const credentials = cred.encrypted_credentials as any;
      return credentials.entity_id === entityId;
    });

    // If no match by entity_id, try to match by Basic Auth credentials
    // This handles ActBlue test webhooks which use different entity_ids
    if (!matchingCred && authHeader && authHeader.startsWith('Basic ')) {
      console.log('No entity_id match, trying Basic Auth fallback for entityId:', entityId);
      const base64Credentials = authHeader.substring(6);
      try {
        const decodedCredentials = atob(base64Credentials);
        const [providedUsername, providedPassword] = decodedCredentials.split(':');
        
        matchingCred = credData.find((cred: any) => {
          const credentials = cred.encrypted_credentials as any;
          return credentials.webhook_username === providedUsername && 
                 credentials.webhook_password === providedPassword;
        });
        
        if (matchingCred) {
          console.log('Matched organization by Basic Auth credentials');
        }
      } catch (e) {
        console.error('Error decoding Basic Auth for fallback:', e);
      }
    }

    if (!matchingCred) {
      const storedEntityIds = credData.map((c: any) => c.encrypted_credentials?.entity_id);
      console.error('No organization matches. Webhook entityId:', entityId, 'Stored entityIds:', storedEntityIds);
      return new Response(
        JSON.stringify({ error: 'Organization not found for entity_id', receivedEntityId: entityId }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const organization_id = matchingCred.organization_id;
    console.log('Processing webhook for organization:', organization_id);

    // Determine transaction type from URL path or contribution status
    // ActBlue sends separate webhooks to different URLs for donations/refunds/cancellations
    // The URL path isn't available here, so we infer from payload structure
    let transactionType = 'donation';
    const contribution = payload.contribution as any;
    
    // If there's a cancelledAt field, it's a cancellation
    if (contribution.cancelledAt) {
      transactionType = 'cancellation';
    }
    // Check lineitems for refund indicators (cast to any to check optional fields)
    const firstLineitem = payload.lineitems[0] as any;
    if (firstLineitem.refundedAt) {
      transactionType = 'refund';
    }

    // Extract refcodes
    const refcodes = payload.contribution.refcodes || {};
    const refcode = refcodes.refcode || null;
    
    // Extract source campaign from refcode
    let sourceCampaign = null;
    if (refcode) {
      const lowerRefcode = refcode.toLowerCase();
      if (lowerRefcode.includes('meta')) sourceCampaign = 'meta';
      else if (lowerRefcode.includes('sms')) sourceCampaign = 'sms';
      else if (lowerRefcode.includes('email')) sourceCampaign = 'email';
    }

    const donor = payload.donor || {};
    const donorName = donor.firstname && donor.lastname 
      ? `${donor.firstname} ${donor.lastname}`.trim() 
      : null;

    // Extract data using safe helpers
    const amount = safeNumber(lineitem.amount);
    const lineitemId = safeInt(lineitem.lineitemId);
    const paidAt = safeString(lineitem.paidAt) || safeString(contribution.createdAt) || new Date().toISOString();

    if (amount === null || lineitemId === null) {
      console.error('Missing required fields: amount or lineitemId', { amount, lineitemId });
      return new Response(
        JSON.stringify({ error: 'Missing required amount or lineitemId' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Store enhanced transaction data
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
      // If duplicate, update existing record
      if (insertError.code === '23505') {
        console.log('Transaction already exists, updating:', lineitemId);
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
        if (error) console.error('Error tracking touchpoint:', error);
      });

      // Update or create donor demographics
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
            // Update aggregates
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

    console.log('ActBlue transaction stored successfully:', lineitemId);
    
    // Update data freshness tracking for ActBlue webhook
    const { error: freshnessError } = await supabase.rpc('update_data_freshness', {
      p_source: 'actblue_webhook',
      p_organization_id: organization_id,
      p_latest_data_timestamp: paidAt,
      p_sync_status: 'success',
      p_error: null,
      p_records_synced: 1,
      p_duration_ms: null,
    });
    if (freshnessError) {
      console.error('Error updating freshness:', freshnessError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: String(lineitemId)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in actblue-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
