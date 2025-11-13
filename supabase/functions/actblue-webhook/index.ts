import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema for ActBlue webhook payload
const actblueWebhookSchema = z.object({
  event_type: z.string(),
  contribution: z.object({
    transaction_id: z.string(),
    donor: z.object({
      email: z.string().email().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
    }).optional(),
    amount: z.number(),
    refcode: z.string().optional(),
    recurring: z.boolean().optional(),
    created_at: z.string(),
  }),
  entity_id: z.string(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get webhook signature for validation
    const signature = req.headers.get('x-actblue-signature');
    const requestBody = await req.text();

    console.log('Received ActBlue webhook');

    // Parse and validate payload
    let payload;
    try {
      payload = actblueWebhookSchema.parse(JSON.parse(requestBody));
    } catch (validationError) {
      console.error('Invalid webhook payload:', validationError);
      return new Response(
        JSON.stringify({ error: 'Invalid payload format' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find organization by entity_id
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('organization_id, encrypted_credentials')
      .eq('platform', 'actblue')
      .eq('is_active', true);

    if (credError || !credData || credData.length === 0) {
      console.error('No active ActBlue credentials found');
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
      return credentials.entity_id === payload.entity_id;
    });

    if (!matchingCred) {
      console.error('No organization matches entity_id:', payload.entity_id);
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

    // Validate webhook signature
    if (signature && credentials.webhook_secret) {
      // In production, implement proper HMAC validation
      // For now, we'll log it for debugging
      console.log('Webhook signature validation would happen here');
      // const isValid = validateSignature(requestBody, signature, credentials.webhook_secret);
      // if (!isValid) {
      //   throw new Error('Invalid webhook signature');
      // }
    }

    // Determine transaction type
    let transactionType = 'donation';
    if (payload.event_type === 'refund') {
      transactionType = 'refund';
    } else if (payload.event_type === 'cancellation') {
      transactionType = 'cancellation';
    }

    // Extract source campaign from refcode (if pattern matches)
    let sourceCampaign = null;
    if (payload.contribution.refcode) {
      // Try to extract campaign identifier from refcode
      // Common patterns: "campaign-name", "meta-campaign-123", "sms-abc123"
      const refcode = payload.contribution.refcode.toLowerCase();
      if (refcode.includes('meta')) {
        sourceCampaign = 'meta';
      } else if (refcode.includes('sms')) {
        sourceCampaign = 'sms';
      }
    }

    // Store transaction
    const donorName = payload.contribution.donor 
      ? `${payload.contribution.donor.first_name || ''} ${payload.contribution.donor.last_name || ''}`.trim()
      : null;

    const { error: insertError } = await supabase
      .from('actblue_transactions')
      .insert({
        organization_id,
        transaction_id: payload.contribution.transaction_id,
        donor_email: payload.contribution.donor?.email || null,
        donor_name: donorName,
        amount: payload.contribution.amount,
        refcode: payload.contribution.refcode || null,
        source_campaign: sourceCampaign,
        transaction_type: transactionType,
        is_recurring: payload.contribution.recurring || false,
        transaction_date: payload.contribution.created_at,
      });

    if (insertError) {
      // If duplicate, update existing record
      if (insertError.code === '23505') {
        console.log('Transaction already exists, updating:', payload.contribution.transaction_id);
        const { error: updateError } = await supabase
          .from('actblue_transactions')
          .update({
            transaction_type: transactionType,
          })
          .eq('transaction_id', payload.contribution.transaction_id);

        if (updateError) {
          throw updateError;
        }
      } else {
        throw insertError;
      }
    }

    console.log('ActBlue transaction stored successfully:', payload.contribution.transaction_id);

    // Trigger ROI calculation for this organization (async)
    // This could be done via a separate edge function call or database trigger
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: payload.contribution.transaction_id
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
