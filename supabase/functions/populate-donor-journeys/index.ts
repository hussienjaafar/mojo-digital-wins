import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Populate Donor Journeys
 * 
 * This function aggregates events from multiple sources into the donor_journeys table:
 * - ActBlue transactions (donations)
 * - Attribution touchpoints (ad views, clicks)
 * - SMS events (clicks, opt-outs)
 * 
 * It creates a unified view of each donor's journey for funnel analysis.
 */

interface DonorJourneyEvent {
  organization_id: string;
  donor_key: string;
  event_type: string;
  occurred_at: string;
  amount?: number;
  net_amount?: number;
  source?: string;
  refcode?: string;
  campaign_id?: string;
  transaction_id?: string;
  metadata?: Record<string, any>;
}

// Hash email for privacy-preserving donor key
function hashDonorKey(email: string): string {
  // Simple hash - in production you'd use a proper hash function
  // This creates a consistent key without storing raw email
  const normalized = email.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `donor_${Math.abs(hash).toString(36)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id, days_back = 90, batch_size = 500 } = body;

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`[DONOR JOURNEYS] Starting for org ${organization_id}, days_back=${days_back}`);

    const cutoffDate = new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString();
    const journeyEvents: DonorJourneyEvent[] = [];
    const processedDonorKeys = new Set<string>();
    
    // PHASE 2 FIX: Load phone-to-email identity links for SMS matching
    const { data: identityLinks } = await supabase
      .from('donor_identity_links')
      .select('phone_hash, donor_email')
      .eq('organization_id', organization_id);
    
    const phoneToEmailMap = new Map<string, string>();
    for (const link of (identityLinks || [])) {
      if (link.phone_hash && link.donor_email) {
        phoneToEmailMap.set(link.phone_hash, link.donor_email);
      }
    }
    console.log(`[DONOR JOURNEYS] Loaded ${phoneToEmailMap.size} phone-to-email identity links`);
    
    // Load refcode-to-donor mapping from transactions for touchpoint matching
    const { data: refcodeDonors } = await supabase
      .from('actblue_transactions')
      .select('refcode, donor_email')
      .eq('organization_id', organization_id)
      .not('refcode', 'is', null)
      .not('donor_email', 'is', null)
      .order('transaction_date', { ascending: false });
    
    const refcodeToEmailMap = new Map<string, string>();
    for (const tx of (refcodeDonors || [])) {
      if (tx.refcode && tx.donor_email && !refcodeToEmailMap.has(tx.refcode)) {
        refcodeToEmailMap.set(tx.refcode, tx.donor_email);
      }
    }
    console.log(`[DONOR JOURNEYS] Loaded ${refcodeToEmailMap.size} refcode-to-donor mappings`);

    // 1. Process ActBlue transactions (donation events)
    console.log('[DONOR JOURNEYS] Processing ActBlue transactions...');
    let txOffset = 0;
    let hasMoreTx = true;

    while (hasMoreTx) {
      const { data: transactions, error: txError } = await supabase
        .from('actblue_transactions')
        .select('transaction_id, donor_email, amount, net_amount, transaction_date, transaction_type, is_recurring, refcode, source_campaign')
        .eq('organization_id', organization_id)
        .gte('transaction_date', cutoffDate)
        .order('transaction_date', { ascending: true })
        .range(txOffset, txOffset + batch_size - 1);

      if (txError) {
        console.error('[DONOR JOURNEYS] Error fetching transactions:', txError);
        break;
      }

      if (!transactions || transactions.length === 0) {
        hasMoreTx = false;
        break;
      }

      for (const tx of transactions) {
        if (!tx.donor_email) continue;
        
        const donorKey = hashDonorKey(tx.donor_email);
        processedDonorKeys.add(donorKey);

        // Determine event type based on transaction characteristics
        let eventType = 'donation';
        if (tx.transaction_type === 'refund') {
          eventType = 'refund';
        } else if (tx.is_recurring) {
          // Check if this is their first recurring donation
          const isFirst = !journeyEvents.some(
            e => e.donor_key === donorKey && e.event_type === 'recurring_signup'
          );
          if (isFirst) {
            journeyEvents.push({
              organization_id,
              donor_key: donorKey,
              event_type: 'recurring_signup',
              occurred_at: tx.transaction_date,
              amount: tx.amount,
              source: 'actblue',
              refcode: tx.refcode,
              transaction_id: tx.transaction_id,
            });
          }
          eventType = 'recurring_donation';
        } else {
          // Check if first-time donor
          const previousDonations = journeyEvents.filter(
            e => e.donor_key === donorKey && 
                 (e.event_type === 'donation' || e.event_type === 'first_donation')
          );
          if (previousDonations.length === 0) {
            eventType = 'first_donation';
          } else {
            eventType = 'repeat_donation';
          }
        }

        journeyEvents.push({
          organization_id,
          donor_key: donorKey,
          event_type: eventType,
          occurred_at: tx.transaction_date,
          amount: tx.amount,
          net_amount: tx.net_amount,
          source: 'actblue',
          refcode: tx.refcode,
          campaign_id: tx.source_campaign,
          transaction_id: tx.transaction_id,
        });
      }

      txOffset += batch_size;
      if (transactions.length < batch_size) hasMoreTx = false;
    }

    console.log(`[DONOR JOURNEYS] Processed ${journeyEvents.length} transaction events`);

    // 2. Process Attribution Touchpoints (ad views, clicks, etc.)
    console.log('[DONOR JOURNEYS] Processing attribution touchpoints...');
    let tpOffset = 0;
    let hasMoreTp = true;
    let touchpointCount = 0;

    while (hasMoreTp) {
      const { data: touchpoints, error: tpError } = await supabase
        .from('attribution_touchpoints')
        .select('donor_email, touchpoint_type, occurred_at, utm_source, utm_medium, utm_campaign, campaign_id, refcode')
        .eq('organization_id', organization_id)
        .gte('occurred_at', cutoffDate)
        .order('occurred_at', { ascending: true })
        .range(tpOffset, tpOffset + batch_size - 1);

      if (tpError) {
        console.error('[DONOR JOURNEYS] Error fetching touchpoints:', tpError);
        break;
      }

      if (!touchpoints || touchpoints.length === 0) {
        hasMoreTp = false;
        break;
      }

      for (const tp of touchpoints) {
        // PHASE 3 FIX: Try to resolve donor email from multiple sources
        let donorEmail = tp.donor_email;
        
        // If no donor_email, try to match via refcode
        if (!donorEmail && tp.refcode && refcodeToEmailMap.has(tp.refcode)) {
          donorEmail = refcodeToEmailMap.get(tp.refcode)!;
        }
        
        // Skip if still no donor email
        if (!donorEmail) continue;
        
        const donorKey = hashDonorKey(donorEmail);
        processedDonorKeys.add(donorKey);

        // Map touchpoint types to meaningful journey event types based on utm_medium/source
        let eventType = tp.touchpoint_type || 'other';
        
        // Improve touchpoint categorization based on actual data
        if (eventType === 'other' || eventType === 'unknown_touchpoint') {
          // Infer type from utm_medium
          const medium = (tp.utm_medium || '').toLowerCase();
          const source = (tp.utm_source || '').toLowerCase();
          
          if (medium.includes('cpc') || medium.includes('paid') || source.includes('facebook') || source.includes('meta')) {
            eventType = 'ad_click';
          } else if (medium.includes('email') || source.includes('email')) {
            eventType = 'email_click';
          } else if (medium.includes('sms') || source.includes('sms')) {
            eventType = 'sms_click';
          } else if (medium.includes('social') || source.includes('twitter') || source.includes('instagram')) {
            eventType = 'social_click';
          } else if (medium.includes('organic') || source.includes('google')) {
            eventType = 'organic_search';
          } else if (source.includes('direct') || (!tp.utm_source && !tp.utm_medium)) {
            eventType = 'direct_visit';
          } else {
            eventType = 'landing_page_view';
          }
        } else {
          // Map existing types - keep meta_ad_click and meta_ad_impression as-is for visibility
          if (eventType === 'meta_ad_click') eventType = 'ad_click';
          else if (eventType === 'meta_ad_impression') eventType = 'ad_view';
          else if (eventType === 'ad_impression') eventType = 'ad_view';
          else if (eventType === 'landing_page') eventType = 'landing_page_view';
        }

        journeyEvents.push({
          organization_id,
          donor_key: donorKey,
          event_type: eventType,
          occurred_at: tp.occurred_at,
          source: tp.utm_source || 'unknown',
          refcode: tp.refcode,
          campaign_id: tp.campaign_id || tp.utm_campaign,
          metadata: {
            utm_medium: tp.utm_medium,
            utm_campaign: tp.utm_campaign,
          },
        });
        touchpointCount++;
      }

      tpOffset += batch_size;
      if (touchpoints.length < batch_size) hasMoreTp = false;
    }

    console.log(`[DONOR JOURNEYS] Processed ${touchpointCount} touchpoint events`);

    // 3. Process SMS Events (clicks, opt-outs)
    console.log('[DONOR JOURNEYS] Processing SMS events...');
    let smsOffset = 0;
    let hasMoreSms = true;
    let smsCount = 0;

    while (hasMoreSms) {
      const { data: smsEvents, error: smsError } = await supabase
        .from('sms_events')
        .select('phone_hash, event_type, occurred_at, campaign_id, campaign_name, link_clicked')
        .eq('organization_id', organization_id)
        .gte('occurred_at', cutoffDate)
        .in('event_type', ['clicked', 'opted_out', 'replied'])
        .order('occurred_at', { ascending: true })
        .range(smsOffset, smsOffset + batch_size - 1);

      if (smsError) {
        console.error('[DONOR JOURNEYS] Error fetching SMS events:', smsError);
        break;
      }

      if (!smsEvents || smsEvents.length === 0) {
        hasMoreSms = false;
        break;
      }

      for (const sms of smsEvents) {
        if (!sms.phone_hash) continue;
        
        // PHASE 2 FIX: Try to resolve donor via phone-to-email identity link
        let donorKey: string;
        const linkedEmail = phoneToEmailMap.get(sms.phone_hash);
        
        if (linkedEmail) {
          // Use email-based donor key for unified tracking
          donorKey = hashDonorKey(linkedEmail);
        } else {
          // Fallback to phone-based key
          donorKey = `sms_${sms.phone_hash}`;
        }
        processedDonorKeys.add(donorKey);

        let eventType = 'sms_' + (sms.event_type || 'unknown');
        if (sms.event_type === 'clicked') eventType = 'sms_click';
        else if (sms.event_type === 'opted_out') eventType = 'sms_opt_out';
        else if (sms.event_type === 'replied') eventType = 'sms_reply';
        else if (sms.event_type === 'delivered') eventType = 'sms_sent';
        else if (sms.event_type === 'sent') eventType = 'sms_sent';

        journeyEvents.push({
          organization_id,
          donor_key: donorKey,
          event_type: eventType,
          occurred_at: sms.occurred_at,
          source: 'sms',
          campaign_id: sms.campaign_id,
          metadata: {
            campaign_name: sms.campaign_name,
            link_clicked: sms.link_clicked,
            phone_linked: !!linkedEmail,
          },
        });
        smsCount++;
      }

      smsOffset += batch_size;
      if (smsEvents.length < batch_size) hasMoreSms = false;
    }

    console.log(`[DONOR JOURNEYS] Processed ${smsCount} SMS events`);

    // 4. Sort all events chronologically and insert
    journeyEvents.sort((a, b) => 
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

    console.log(`[DONOR JOURNEYS] Inserting ${journeyEvents.length} total journey events...`);

    // Insert in batches, using upsert to avoid duplicates
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < journeyEvents.length; i += batch_size) {
      const batch = journeyEvents.slice(i, i + batch_size).map(event => ({
        ...event,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      }));

      // Use insert with on conflict ignore (we don't have a unique constraint, so duplicates are possible)
      const { error: insertError } = await supabase
        .from('donor_journeys')
        .insert(batch);

      if (insertError) {
        console.error(`[DONOR JOURNEYS] Batch insert error:`, insertError);
        errorCount += batch.length;
      } else {
        insertedCount += batch.length;
      }
    }

    // 5. Update processing checkpoint
    try {
      await supabase.rpc('update_processing_checkpoint', {
        p_function_name: 'populate-donor-journeys',
        p_records_processed: insertedCount,
        p_checkpoint_data: {
          organization_id,
          unique_donors: processedDonorKeys.size,
          transaction_events: journeyEvents.filter(e => e.source === 'actblue').length,
          touchpoint_events: touchpointCount,
          sms_events: smsCount,
        },
      });
    } catch (checkpointError) {
      console.warn('[DONOR JOURNEYS] Failed to update checkpoint:', checkpointError);
    }

    const duration = Date.now() - startTime;
    console.log(`[DONOR JOURNEYS] Complete. Inserted ${insertedCount} events for ${processedDonorKeys.size} donors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        events_created: insertedCount,
        unique_donors: processedDonorKeys.size,
        errors: errorCount,
        duration_ms: duration,
        breakdown: {
          transactions: journeyEvents.filter(e => e.source === 'actblue').length,
          touchpoints: touchpointCount,
          sms_events: smsCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DONOR JOURNEYS] Error:', error);
    
    // Log failure
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      
      await supabase.rpc('log_job_failure', {
        p_function_name: 'populate-donor-journeys',
        p_error_message: error instanceof Error ? error.message : String(error),
        p_context: {},
      });
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
