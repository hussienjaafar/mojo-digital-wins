import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions (same as actblue-webhook)
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
      organization_id,
      limit = 100,
      dry_run = false,
      error_filter = 'Authentication failed'
    } = body;

    console.log(`[REPROCESS] Starting for org=${organization_id}, limit=${limit}, dry_run=${dry_run}`);

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get failed webhooks from webhook_logs
    let query = supabase
      .from('webhook_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('platform', 'actblue')
      .eq('processing_status', 'failed')
      .is('reprocessed_at', null)
      .order('received_at', { ascending: true })
      .limit(limit);

    if (error_filter) {
      query = query.ilike('error_message', `%${error_filter}%`);
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
            received_at: w.received_at,
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
        if (!payload || !payload.lineitems || !Array.isArray(payload.lineitems)) {
          console.log(`[REPROCESS] Skipping webhook ${webhook.id} - no lineitems data`);
          continue;
        }

        const contribution = payload;
        const lineitems = contribution.lineitems || [];
        const donor = contribution.donor || {};
        const refcodes = contribution.refcodes || {};
        
        // Get paidAt timestamp - normalize to UTC
        let paidAt = safeString(contribution.paidAt);
        if (!paidAt) {
          paidAt = webhook.received_at;
        }

        // Process each lineitem
        for (const lineitem of lineitems) {
          const lineitemId = safeInt(lineitem.lineitemId);
          if (!lineitemId) {
            console.log(`[REPROCESS] Skipping lineitem - no lineitemId`);
            continue;
          }

          const amount = safeNumber(lineitem.amount);
          const donorName = donor.firstname && donor.lastname 
            ? `${donor.firstname} ${donor.lastname}` 
            : null;

          // Determine transaction type
          let transactionType = 'donation';
          const cancelledAt = safeString(lineitem.cancelledAt);
          const refundedAt = safeString(lineitem.refundedAt);
          if (cancelledAt) transactionType = 'cancellation';
          if (refundedAt) transactionType = 'refund';

          // Get refcode
          const refcode = safeString(refcodes.refcode) || 
                         safeString(lineitem.refcode) || 
                         safeString(contribution.refcode);
          
          const clickId = safeString(contribution.clickId);
          const fbclid = safeString(contribution.fbclid);

          // Determine source from refcode
          let determinedSource = 'other';
          if (refcode) {
            const refLower = refcode.toLowerCase();
            if (refLower.includes('email') || refLower.includes('em_')) determinedSource = 'email';
            else if (refLower.includes('sms') || refLower.includes('txt')) determinedSource = 'sms';
            else if (refLower.includes('fb') || refLower.includes('meta') || fbclid) determinedSource = 'meta';
            else if (refLower.includes('ggl') || refLower.includes('google')) determinedSource = 'google';
          }

          // Recurring state
          let recurringState = null;
          if (contribution.recurringPeriod && contribution.recurringPeriod !== 'once') {
            recurringState = cancelledAt ? 'cancelled' : 'active';
          }

          const transactionRecord = {
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
            fee: safeNumber(lineitem.feeAmount) ?? (amount ? Math.round(amount * 0.0395 * 100) / 100 : null),
            payment_method: safeString(contribution.paymentMethod),
            card_type: safeString(contribution.cardType),
            smart_boost_amount: safeNumber(contribution.smartBoostAmount),
            double_down: safeBool(contribution.doubleDown),
            recurring_upsell_shown: safeBool(contribution.recurringUpsellShown),
            recurring_upsell_succeeded: safeBool(contribution.recurringUpsellSucceeded),
            order_number: safeString(contribution.orderNumber),
            contribution_form: safeString(contribution.contributionForm),
            refcode: refcode,
            refcode2: safeString(refcodes.refcode2),
            refcode_custom: safeString(refcodes.refcodeCustom),
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
            next_charge_date: null,
            custom_fields: contribution.customFields || [],
            transaction_type: transactionType,
            transaction_date: paidAt,
          };

          // Upsert the transaction (handle duplicates gracefully)
          const { error: upsertError } = await supabase
            .from('actblue_transactions')
            .upsert(transactionRecord, { 
              onConflict: 'transaction_id,organization_id',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            throw upsertError;
          }

          console.log(`[REPROCESS] Inserted transaction ${lineitemId}`);
        }

        // Mark webhook as reprocessed
        await supabase
          .from('webhook_logs')
          .update({ 
            reprocessed_at: new Date().toISOString(),
            processing_status: 'reprocessed',
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
