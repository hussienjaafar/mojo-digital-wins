import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced validation schema for ActBlue webhook payload
const actblueWebhookSchema = z.object({
  event_type: z.string(),
  donor: z.object({
    firstname: z.string().optional(),
    lastname: z.string().optional(),
    addr1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    employerData: z.object({
      employer: z.string().optional(),
      occupation: z.string().optional(),
    }).optional(),
  }).optional(),
  contribution: z.object({
    createdAt: z.string(),
    orderNumber: z.string().optional(),
    contributionForm: z.string().optional(),
    refcodes: z.object({
      refcode: z.string().optional(),
      refcode2: z.string().optional(),
      refcodeCustom: z.string().optional(),
    }).optional(),
    abTestName: z.string().optional(),
    abTestVariation: z.string().optional(),
    isMobile: z.boolean().optional(),
    isExpress: z.boolean().optional(),
    textMessageOption: z.string().optional(),
    recurringPeriod: z.string().optional(),
    recurringDuration: z.number().optional(),
    customFields: z.array(z.object({
      label: z.string(),
      answer: z.string(),
    })).optional(),
  }),
  lineitems: z.array(z.object({
    lineitemId: z.number(),
    entityId: z.number(),
    fecId: z.string().optional().nullable(),
    committeeName: z.string().optional(),
    amount: z.string(),
    paidAt: z.string(),
  })),
});

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

    // Parse and validate payload
    let payload;
    try {
      payload = actblueWebhookSchema.parse(JSON.parse(requestBody));
    } catch (validationError) {
      if (Deno.env.get('ENVIRONMENT') === 'development') {
        console.error('Invalid webhook payload:', validationError);
      }
      return new Response(
        JSON.stringify({ error: 'Invalid payload format' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find organization by entity_id from lineitems
    const lineitem = payload.lineitems[0];
    const entityId = lineitem.entityId?.toString();
    
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('organization_id, encrypted_credentials')
      .eq('platform', 'actblue')
      .eq('is_active', true);

    if (credError || !credData || credData.length === 0) {
      if (Deno.env.get('ENVIRONMENT') === 'development') {
        console.error('No active ActBlue credentials found');
      }
      return new Response(
        JSON.stringify({ error: 'No matching organization found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find matching organization by entity_id
    const matchingCred = credData.find((cred: any) => {
      const credentials = cred.encrypted_credentials as any;
      return credentials.entity_id === entityId;
    });

    if (!matchingCred) {
      if (Deno.env.get('ENVIRONMENT') === 'development') {
        console.error('No organization matches entity_id:', entityId);
      }
      return new Response(
        JSON.stringify({ error: 'Organization not found for entity_id' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const organization_id = matchingCred.organization_id;
    const credentials = matchingCred.encrypted_credentials as any;

    // Validate Basic Auth credentials (ActBlue uses HTTP Basic Auth, not signing secrets)
    if (authHeader && authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.substring(6);
      try {
        const decodedCredentials = atob(base64Credentials);
        const [providedUsername, providedPassword] = decodedCredentials.split(':');
        
        // Check if credentials match what we have stored
        if (credentials.webhook_username && credentials.webhook_password) {
          if (providedUsername !== credentials.webhook_username || 
              providedPassword !== credentials.webhook_password) {
            console.error('Invalid Basic Auth credentials');
            return new Response(
              JSON.stringify({ error: 'Unauthorized' }),
              { 
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
          console.log('Basic Auth credentials validated successfully');
        }
      } catch (e) {
        console.error('Error decoding Basic Auth credentials:', e);
      }
    }

    // Determine transaction type
    let transactionType = 'donation';
    if (payload.event_type === 'refund') {
      transactionType = 'refund';
    } else if (payload.event_type === 'cancellation') {
      transactionType = 'cancellation';
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

    // Store enhanced transaction data
    const { error: insertError } = await supabase
      .from('actblue_transactions')
      .insert({
        organization_id,
        transaction_id: `${lineitem.lineitemId}`,
        donor_email: donor.email || null,
        donor_name: donorName,
        first_name: donor.firstname || null,
        last_name: donor.lastname || null,
        addr1: donor.addr1 || null,
        city: donor.city || null,
        state: donor.state || null,
        zip: donor.zip || null,
        country: donor.country || null,
        phone: donor.phone || null,
        employer: donor.employerData?.employer || null,
        occupation: donor.employerData?.occupation || null,
        amount: parseFloat(lineitem.amount),
        order_number: payload.contribution.orderNumber || null,
        contribution_form: payload.contribution.contributionForm || null,
        refcode: refcode,
        refcode2: refcodes.refcode2 || null,
        refcode_custom: refcodes.refcodeCustom || null,
        source_campaign: sourceCampaign,
        ab_test_name: payload.contribution.abTestName || null,
        ab_test_variation: payload.contribution.abTestVariation || null,
        is_mobile: payload.contribution.isMobile || false,
        is_express: payload.contribution.isExpress || false,
        text_message_option: payload.contribution.textMessageOption || null,
        lineitem_id: lineitem.lineitemId,
        entity_id: lineitem.entityId?.toString() || null,
        committee_name: lineitem.committeeName || null,
        fec_id: lineitem.fecId || null,
        recurring_period: payload.contribution.recurringPeriod || null,
        recurring_duration: payload.contribution.recurringDuration || null,
        is_recurring: !!payload.contribution.recurringPeriod,
        custom_fields: payload.contribution.customFields || [],
        transaction_type: transactionType,
        transaction_date: lineitem.paidAt,
      });

    if (insertError) {
      // If duplicate, update existing record
      if (insertError.code === '23505') {
        console.log('Transaction already exists, updating:', lineitem.lineitemId);
        const { error: updateError } = await supabase
          .from('actblue_transactions')
          .update({ transaction_type: transactionType })
          .eq('transaction_id', `${lineitem.lineitemId}`);

        if (updateError) throw updateError;
      } else {
        throw insertError;
      }
    }

    // Track attribution touchpoint
    if (donor.email && refcode) {
      await supabase.from('attribution_touchpoints').insert({
        organization_id,
        donor_email: donor.email,
        touchpoint_type: sourceCampaign || 'other',
        campaign_id: payload.contribution.contributionForm || null,
        utm_source: refcodes.refcode2 || null,
        utm_campaign: refcode,
        refcode: refcode,
        occurred_at: lineitem.paidAt,
        metadata: {
          ab_test: payload.contribution.abTestName,
          ab_variation: payload.contribution.abTestVariation,
          is_mobile: payload.contribution.isMobile,
        },
      }).then(({ error }) => {
        if (error) console.error('Error tracking touchpoint:', error);
      });

      // Update or create donor demographics
      await supabase.from('donor_demographics')
        .upsert({
          organization_id,
          donor_email: donor.email,
          first_name: donor.firstname || null,
          last_name: donor.lastname || null,
          address: donor.addr1 || null,
          city: donor.city || null,
          state: donor.state || null,
          zip: donor.zip || null,
          country: donor.country || null,
          phone: donor.phone || null,
          employer: donor.employerData?.employer || null,
          occupation: donor.employerData?.occupation || null,
          last_donation_date: lineitem.paidAt,
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
                  first_donation_date: data.first_donation_date || lineitem.paidAt,
                })
                .eq('id', data.id);
            }
          }
        });
    }

    console.log('ActBlue transaction stored successfully:', lineitem.lineitemId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: `${lineitem.lineitemId}`
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
