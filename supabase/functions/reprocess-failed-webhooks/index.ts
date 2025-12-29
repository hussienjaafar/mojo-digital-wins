import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Reprocess Failed Webhooks
 * 
 * This function retrieves failed webhooks from webhook_logs and attempts to reprocess them.
 * Useful after schema fixes or bug fixes that caused webhook failures.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { 
      limit = 100,
      webhook_type = 'actblue',
      since_date,
      dry_run = false 
    } = body;

    console.log(`[REPROCESS] Starting for ${webhook_type}, limit=${limit}, dry_run=${dry_run}`);

    // Get failed webhooks from webhook_logs
    let query = supabase
      .from('webhook_logs')
      .select('*')
      .eq('platform', webhook_type)
      .eq('processing_status', 'failed')
      .is('reprocessed_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since_date) {
      query = query.gte('created_at', since_date);
    }

    const { data: failedWebhooks, error: queryError } = await query;

    if (queryError) {
      throw queryError;
    }

    console.log(`[REPROCESS] Found ${failedWebhooks?.length || 0} failed webhooks to reprocess`);

    if (!failedWebhooks || failedWebhooks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No failed webhooks found to reprocess',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dry_run) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Dry run - would process these webhooks',
          webhooks: failedWebhooks.map(w => ({
            id: w.id,
            created_at: w.created_at,
            error_message: w.error_message
          })),
          count: failedWebhooks.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const webhook of failedWebhooks) {
      try {
        processed++;
        
        // Parse the stored payload
        const payload = webhook.payload;
        if (!payload || !payload.contribution) {
          console.log(`[REPROCESS] Skipping webhook ${webhook.id} - no contribution data`);
          continue;
        }

        const contribution = payload.contribution;
        const lineitems = contribution.lineitems || [];
        const donor = contribution.donor || {};
        
        // Get organization ID from the webhook or find by entity_id
        let organizationId = webhook.organization_id;
        
        if (!organizationId && contribution.recipient?.name) {
          // Try to find org by committee name
          const { data: orgMatch } = await supabase
            .from('actblue_transactions')
            .select('organization_id')
            .eq('committee_name', contribution.recipient.name)
            .limit(1)
            .maybeSingle();
          
          if (orgMatch) {
            organizationId = orgMatch.organization_id;
          }
        }

        if (!organizationId) {
          // Default to the known organization
          organizationId = '346d6aaf-34b3-435c-8cd1-3420d6a068d6';
        }

        // Process each lineitem
        for (const item of lineitems) {
          const transactionRecord = {
            organization_id: organizationId,
            transaction_id: `${contribution.orderNumber}-${item.lineitemNumber}`,
            order_number: contribution.orderNumber,
            lineitem_id: item.lineitemNumber,
            transaction_date: contribution.createdAt,
            amount: parseFloat(item.amount || '0'),
            fee: parseFloat(item.paidFee || '0'),
            net_amount: parseFloat(item.amount || '0') - parseFloat(item.paidFee || '0'),
            donor_email: donor.email || null,
            donor_name: donor.firstname && donor.lastname ? `${donor.firstname} ${donor.lastname}` : null,
            first_name: donor.firstname || null,
            last_name: donor.lastname || null,
            phone: donor.phone || null,
            addr1: donor.addr1 || null,
            city: donor.city || null,
            state: donor.state || null,
            zip: donor.zip || null,
            country: donor.country || null,
            employer: donor.employer || null,
            occupation: donor.occupation || null,
            refcode: contribution.refcodes?.refcode || item.recurringRefcode || null,
            refcode2: contribution.refcodes?.refcode2 || null,
            refcode_custom: null,
            source_campaign: contribution.form?.campaignName || null,
            contribution_form: contribution.form?.name || null,
            committee_name: contribution.recipient?.name || null,
            entity_id: contribution.recipient?.entityId || null,
            fec_id: contribution.recipient?.fecId || null,
            transaction_type: item.entityType || 'contribution',
            is_recurring: item.recurringPeriod ? true : false,
            recurring_period: item.recurringPeriod || null,
            recurring_duration: item.recurringDuration || null,
            payment_method: contribution.paymentMethod || null,
            card_type: contribution.cardType || null,
            is_express: contribution.isExpress === true,
            is_mobile: contribution.isMobile === true,
            text_message_option: contribution.textMessageOption || null,
            recurring_upsell_shown: contribution.recurringUpsellShown === true,
            recurring_upsell_succeeded: contribution.recurringUpsellSucceeded === true,
            double_down: contribution.doubleDown === true,
            smart_boost_amount: contribution.smartBoostAmount ? parseFloat(contribution.smartBoostAmount) : null,
            ab_test_name: contribution.abTestName || null,
            ab_test_variation: contribution.abTestVariation || null,
            fbclid: contribution.fbclid || null,
            click_id: contribution.clickId || contribution.fbclid || null,
            next_charge_date: item.nextChargeDate || null,
            recurring_state: item.recurringState || null,
            custom_fields: contribution.customFieldValues ? JSON.stringify(contribution.customFieldValues) : null,
          };

          // Upsert the transaction
          const { error: upsertError } = await supabase
            .from('actblue_transactions')
            .upsert(transactionRecord, { 
              onConflict: 'transaction_id',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            throw upsertError;
          }
        }

        // Mark webhook as reprocessed
        await supabase
          .from('webhook_logs')
          .update({ 
            reprocessed_at: new Date().toISOString(),
            success: true,
            error_message: null
          })
          .eq('id', webhook.id);

        succeeded++;
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Webhook ${webhook.id}: ${errorMsg}`);
        console.error(`[REPROCESS] Failed to reprocess webhook ${webhook.id}:`, err);
        
        // Update webhook log with new error
        await supabase
          .from('webhook_logs')
          .update({ 
            reprocessed_at: new Date().toISOString(),
            error_message: `Reprocess failed: ${errorMsg}`
          })
          .eq('id', webhook.id);
      }
    }

    console.log(`[REPROCESS] Complete. Processed=${processed}, Succeeded=${succeeded}, Failed=${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        succeeded,
        failed,
        errors: errors.slice(0, 10) // Limit errors in response
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[REPROCESS] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
