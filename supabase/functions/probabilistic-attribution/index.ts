import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TouchpointMatch {
  donor_email: string;
  transaction_id: string;
  transaction_date: string;
  amount: number;
  touchpoints: Array<{
    type: string;
    occurred_at: string;
    campaign_id?: string;
    refcode?: string;
    weight: number;
  }>;
  attributed_campaign?: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, lookback_days = 7, limit = 100 } = await req.json();
    
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[PROBABILISTIC] Starting attribution for org ${organization_id}`);

    // Find unattributed transactions (no refcode, no click_id, no existing attribution)
    const { data: unattributed, error: unattribErr } = await supabase
      .from('actblue_transactions')
      .select('transaction_id, donor_email, transaction_date, amount, net_amount')
      .eq('organization_id', organization_id)
      .is('refcode', null)
      .is('click_id', null)
      .is('fbclid', null)
      .neq('transaction_type', 'refund')
      .not('donor_email', 'is', null)
      .limit(limit);

    if (unattribErr) {
      console.error('[PROBABILISTIC] Error fetching unattributed:', unattribErr);
      throw unattribErr;
    }

    console.log(`[PROBABILISTIC] Found ${unattributed?.length || 0} unattributed transactions`);

    if (!unattributed || unattributed.length === 0) {
      return new Response(
        JSON.stringify({ success: true, matched: 0, message: 'No unattributed transactions found' }), 
        { headers: corsHeaders }
      );
    }

    // Get unique donor emails
    const donorEmails = [...new Set(unattributed.map(t => t.donor_email).filter(Boolean))];
    
    // Find touchpoints for these donors within the lookback window
    const { data: touchpoints, error: touchErr } = await supabase
      .from('attribution_touchpoints')
      .select('donor_email, touchpoint_type, occurred_at, campaign_id, refcode, utm_source, utm_medium, utm_campaign')
      .eq('organization_id', organization_id)
      .in('donor_email', donorEmails)
      .gte('occurred_at', new Date(Date.now() - lookback_days * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: true });

    if (touchErr) {
      console.error('[PROBABILISTIC] Error fetching touchpoints:', touchErr);
      // Continue without touchpoints - we'll try campaign timing correlation
    }

    const touchpointsByEmail = new Map<string, typeof touchpoints>();
    (touchpoints || []).forEach(tp => {
      const existing = touchpointsByEmail.get(tp.donor_email!) || [];
      existing.push(tp);
      touchpointsByEmail.set(tp.donor_email!, existing);
    });

    // Get recent Meta campaign activity for timing correlation
    const { data: metaCampaigns, error: metaErr } = await supabase
      .from('meta_campaign_insights')
      .select('campaign_id, campaign_name, date_start, date_stop, impressions, clicks')
      .eq('organization_id', organization_id)
      .gte('date_start', new Date(Date.now() - lookback_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('impressions', { ascending: false })
      .limit(20);

    if (metaErr) {
      console.error('[PROBABILISTIC] Error fetching Meta campaigns:', metaErr);
    }

    console.log(`[PROBABILISTIC] Found ${touchpoints?.length || 0} touchpoints, ${metaCampaigns?.length || 0} active campaigns`);

    let matchedCount = 0;
    const attributionUpdates: Array<{
      transaction_id: string;
      campaign_id?: string;
      attribution_method: string;
      confidence: number;
      match_reason: string;
    }> = [];

    for (const txn of unattributed) {
      const donorTouchpoints = touchpointsByEmail.get(txn.donor_email!) || [];
      const txnDate = new Date(txn.transaction_date);
      
      // Filter touchpoints that occurred before the transaction
      const relevantTouchpoints = donorTouchpoints.filter(
        tp => new Date(tp.occurred_at) < txnDate
      );

      let attribution: typeof attributionUpdates[0] | null = null;

      if (relevantTouchpoints.length > 0) {
        // Multi-touch attribution with 40-20-40 weighting (first-touch, middle, last-touch)
        const weights = calculateMultiTouchWeights(relevantTouchpoints.length);
        
        // Find the most impactful touchpoint (usually last touch with highest weight)
        const lastTouch = relevantTouchpoints[relevantTouchpoints.length - 1];
        const timeDiffHours = (txnDate.getTime() - new Date(lastTouch.occurred_at).getTime()) / (1000 * 60 * 60);
        
        // Calculate confidence based on recency and number of touchpoints
        let confidence = 0.5; // Base confidence
        if (timeDiffHours <= 1) confidence += 0.3;
        else if (timeDiffHours <= 24) confidence += 0.2;
        else if (timeDiffHours <= 72) confidence += 0.1;
        
        if (relevantTouchpoints.length >= 3) confidence += 0.1;
        if (lastTouch.campaign_id) confidence += 0.1;

        attribution = {
          transaction_id: txn.transaction_id,
          campaign_id: lastTouch.campaign_id || undefined,
          attribution_method: 'probabilistic_touchpoint',
          confidence: Math.min(confidence, 0.95),
          match_reason: `Matched via ${relevantTouchpoints.length} touchpoint(s), last ${timeDiffHours.toFixed(1)}h before donation`
        };
      } else if (metaCampaigns && metaCampaigns.length > 0) {
        // Fallback: Timing correlation with active campaigns
        const txnDateStr = txn.transaction_date;
        const activeCampaigns = metaCampaigns.filter(c => 
          c.date_start <= txnDateStr && 
          (!c.date_stop || c.date_stop >= txnDateStr)
        );

        if (activeCampaigns.length > 0) {
          // Attribute to the campaign with most impressions (likely highest exposure)
          const bestCampaign = activeCampaigns.sort((a, b) => 
            (b.impressions || 0) - (a.impressions || 0)
          )[0];

          attribution = {
            transaction_id: txn.transaction_id,
            campaign_id: bestCampaign.campaign_id,
            attribution_method: 'probabilistic_timing',
            confidence: 0.3, // Lower confidence for timing-only correlation
            match_reason: `Timing correlation with active campaign "${bestCampaign.campaign_name}" (${bestCampaign.impressions} impressions)`
          };
        }
      }

      if (attribution) {
        attributionUpdates.push(attribution);
        matchedCount++;
      }
    }

    console.log(`[PROBABILISTIC] Matched ${matchedCount} transactions`);

    // Update campaign_attribution table with probabilistic matches
    for (const attr of attributionUpdates) {
      const { error: upsertErr } = await supabase
        .from('campaign_attribution')
        .upsert({
          organization_id,
          refcode: `prob_${attr.transaction_id.slice(0, 8)}`, // Synthetic refcode for tracking
          meta_campaign_id: attr.campaign_id,
          match_confidence: attr.confidence,
          match_reason: attr.match_reason,
          is_auto_matched: true,
          last_matched_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,refcode' });

      if (upsertErr) {
        console.error(`[PROBABILISTIC] Failed to upsert attribution for ${attr.transaction_id}:`, upsertErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matched: matchedCount,
        total_processed: unattributed.length,
        match_rate: `${((matchedCount / unattributed.length) * 100).toFixed(1)}%`,
        methods: {
          touchpoint: attributionUpdates.filter(a => a.attribution_method === 'probabilistic_touchpoint').length,
          timing: attributionUpdates.filter(a => a.attribution_method === 'probabilistic_timing').length,
        }
      }), 
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[PROBABILISTIC] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
});

function calculateMultiTouchWeights(count: number): number[] {
  if (count === 1) return [1.0];
  if (count === 2) return [0.5, 0.5];
  
  // 40-20-40 model: first touch 40%, middle touches split 20%, last touch 40%
  const weights: number[] = [];
  const middleCount = count - 2;
  const middleWeight = middleCount > 0 ? 0.2 / middleCount : 0;
  
  weights.push(0.4); // First touch
  for (let i = 0; i < middleCount; i++) {
    weights.push(middleWeight);
  }
  weights.push(0.4); // Last touch
  
  return weights;
}
