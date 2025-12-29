import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Backfill Attribution for Historical Transactions
 * 
 * Processes all existing ActBlue transactions and creates attribution records
 * by matching refcodes, UTM parameters, and touchpoints.
 */

const BATCH_SIZE = 500;
const MAX_BATCHES = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, start_date, end_date, dry_run = false } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BACKFILL ATTRIBUTION] Starting for org: ${organization_id}, dry_run: ${dry_run}`);

    // Get count of unattributed transactions
    let countQuery = supabase
      .from('actblue_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    if (start_date) countQuery = countQuery.gte('transaction_date', start_date);
    if (end_date) countQuery = countQuery.lte('transaction_date', end_date);

    const { count: totalTransactions } = await countQuery;
    console.log(`[BACKFILL ATTRIBUTION] Found ${totalTransactions} transactions to process`);

    let processedCount = 0;
    let attributedCount = 0;
    let skippedCount = 0;
    let batchNum = 0;
    let lastId: string | null = null;

    // Get all campaigns for matching
    const { data: campaigns } = await supabase
      .from('campaign_attribution')
      .select('*')
      .eq('organization_id', organization_id);

    const campaignsByRefcode = new Map<string, any>();
    const campaignsByUtm = new Map<string, any>();
    
    for (const campaign of campaigns || []) {
      if (campaign.refcode) {
        campaignsByRefcode.set(campaign.refcode.toLowerCase(), campaign);
      }
      if (campaign.utm_campaign) {
        campaignsByUtm.set(campaign.utm_campaign.toLowerCase(), campaign);
      }
    }

    console.log(`[BACKFILL ATTRIBUTION] Loaded ${campaigns?.length || 0} campaign attribution records`);

    // Process in batches
    while (batchNum < MAX_BATCHES) {
      let query = supabase
        .from('actblue_transactions')
        .select('id, transaction_id, transaction_date, donor_email, refcode, refcode2, amount, net_amount, transaction_type, is_recurring')
        .eq('organization_id', organization_id)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);

      if (start_date) query = query.gte('transaction_date', start_date);
      if (end_date) query = query.lte('transaction_date', end_date);
      if (lastId) query = query.gt('id', lastId);

      const { data: transactions, error } = await query;

      if (error) {
        console.error('[BACKFILL ATTRIBUTION] Query error:', error);
        throw error;
      }

      if (!transactions || transactions.length === 0) {
        console.log('[BACKFILL ATTRIBUTION] No more transactions to process');
        break;
      }

      console.log(`[BACKFILL ATTRIBUTION] Processing batch ${batchNum + 1}: ${transactions.length} transactions`);

      const attributionsToCreate: any[] = [];
      const journeyEventsToCreate: any[] = [];

      for (const txn of transactions) {
        processedCount++;
        lastId = txn.id;

        // Try to find matching campaign
        let matchedCampaign: any = null;
        let matchReason = 'none';
        let matchConfidence = 0;

        // 1. Try refcode match (highest confidence)
        if (txn.refcode) {
          const refcodeLower = txn.refcode.toLowerCase();
          matchedCampaign = campaignsByRefcode.get(refcodeLower);
          if (matchedCampaign) {
            matchReason = 'refcode_exact';
            matchConfidence = 1.0;
          }
        }

        // 2. Try refcode2 match
        if (!matchedCampaign && txn.refcode2) {
          const refcode2Lower = txn.refcode2.toLowerCase();
          matchedCampaign = campaignsByRefcode.get(refcode2Lower);
          if (matchedCampaign) {
            matchReason = 'refcode2_exact';
            matchConfidence = 0.9;
          }
        }

        // 3. Try fuzzy refcode match (partial)
        if (!matchedCampaign && txn.refcode) {
          for (const [key, campaign] of campaignsByRefcode) {
            if (txn.refcode.toLowerCase().includes(key) || key.includes(txn.refcode.toLowerCase())) {
              matchedCampaign = campaign;
              matchReason = 'refcode_fuzzy';
              matchConfidence = 0.7;
              break;
            }
          }
        }

        // Create attribution record
        if (matchedCampaign) {
          attributionsToCreate.push({
            organization_id,
            refcode: txn.refcode,
            utm_source: matchedCampaign.utm_source,
            utm_medium: matchedCampaign.utm_medium,
            utm_campaign: matchedCampaign.utm_campaign,
            meta_campaign_id: matchedCampaign.meta_campaign_id,
            switchboard_campaign_id: matchedCampaign.switchboard_campaign_id,
            is_auto_matched: true,
            match_confidence: matchConfidence,
            match_reason: matchReason,
            attributed_revenue: (matchedCampaign.attributed_revenue || 0) + (txn.net_amount || txn.amount || 0),
            attributed_transactions: (matchedCampaign.attributed_transactions || 0) + 1,
            last_matched_at: new Date().toISOString(),
          });
          attributedCount++;
        } else {
          skippedCount++;
        }

        // Create donor journey event
        if (txn.donor_email) {
          const donorKey = await hashEmail(txn.donor_email);
          
          // Determine event type
          let eventType = 'donation';
          if (txn.is_recurring) {
            eventType = 'recurring_donation';
          }
          if (txn.transaction_type === 'refund') {
            eventType = 'refund';
          }

          journeyEventsToCreate.push({
            organization_id,
            donor_key: donorKey,
            event_type: eventType,
            occurred_at: txn.transaction_date,
            amount: txn.amount,
            net_amount: txn.net_amount,
            source: 'actblue',
            refcode: txn.refcode,
            transaction_id: txn.transaction_id,
            metadata: {
              is_recurring: txn.is_recurring,
              transaction_type: txn.transaction_type,
            },
          });
        }
      }

      if (!dry_run) {
        // Upsert campaign attributions
        if (attributionsToCreate.length > 0) {
          const { error: attrError } = await supabase
            .from('campaign_attribution')
            .upsert(attributionsToCreate, { 
              onConflict: 'organization_id,refcode',
              ignoreDuplicates: false 
            });

          if (attrError) {
            console.error('[BACKFILL ATTRIBUTION] Error upserting attributions:', attrError);
          }
        }

        // Upsert donor journey events
        if (journeyEventsToCreate.length > 0) {
          const { error: journeyError } = await supabase
            .from('donor_journeys')
            .upsert(journeyEventsToCreate, {
              onConflict: 'organization_id,donor_key,event_type,occurred_at',
              ignoreDuplicates: true
            });

          if (journeyError) {
            console.error('[BACKFILL ATTRIBUTION] Error upserting journeys:', journeyError);
          }
        }
      }

      batchNum++;

      // Check if we've processed all transactions
      if (transactions.length < BATCH_SIZE) {
        break;
      }
    }

    // Update data freshness
    if (!dry_run) {
      await supabase.rpc('update_data_freshness', {
        p_source: 'attribution_backfill',
        p_organization_id: organization_id,
        p_latest_data_timestamp: new Date().toISOString(),
        p_sync_status: 'success',
        p_error: null,
        p_records_synced: attributedCount,
        p_duration_ms: null,
      });
    }

    console.log(`[BACKFILL ATTRIBUTION] Complete. Processed: ${processedCount}, Attributed: ${attributedCount}, Skipped: ${skippedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        summary: {
          total_transactions: totalTransactions,
          processed: processedCount,
          attributed: attributedCount,
          skipped: skippedCount,
          batches: batchNum,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BACKFILL ATTRIBUTION] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Hash email for privacy
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
