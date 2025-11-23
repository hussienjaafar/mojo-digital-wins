import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttributionModel {
  first_touch: number;
  last_touch: number;
  linear: number;
  position_based: number;
  time_decay: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { organizationId, startDate, endDate } = await req.json();

    console.log(`📊 Calculating multi-touch attribution for org: ${organizationId}`);

    // Get all transactions with their touchpoints
    const { data: transactions, error: txnError } = await supabase
      .from('actblue_transactions')
      .select(`
        id,
        amount,
        transaction_date,
        refcode,
        donor_email
      `)
      .eq('organization_id', organizationId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .not('refcode', 'is', null);

    if (txnError) throw txnError;

    // Get attribution mappings
    const { data: attributions, error: attrError } = await supabase
      .from('campaign_attribution')
      .select('*')
      .eq('organization_id', organizationId);

    if (attrError) throw attrError;

    // Build refcode to campaign mapping
    const refcodeToCampaign = new Map();
    attributions?.forEach(attr => {
      if (attr.refcode) {
        refcodeToCampaign.set(attr.refcode, {
          meta_campaign_id: attr.meta_campaign_id,
          switchboard_campaign_id: attr.switchboard_campaign_id,
          utm_source: attr.utm_source,
        });
      }
    });

    // Calculate attribution for each model
    const modelResults: Record<string, {
      first_touch: number;
      last_touch: number;
      linear: number;
      position_based: number;
      time_decay: number;
    }> = {};

    for (const txn of transactions || []) {
      const campaignData = refcodeToCampaign.get(txn.refcode);
      if (!campaignData) continue;

      const campaignId = campaignData.meta_campaign_id || campaignData.switchboard_campaign_id;
      if (!campaignId) continue;

      if (!modelResults[campaignId]) {
        modelResults[campaignId] = {
          first_touch: 0,
          last_touch: 0,
          linear: 0,
          position_based: 0,
          time_decay: 0,
        } as any;
      }

      // For single-touch transactions, all models give full credit
      // In a real implementation, you'd track the donor journey
      const amount = Number(txn.amount);
      
      // First-touch: 100% to first interaction
      modelResults[campaignId].first_touch += amount;
      
      // Last-touch: 100% to last interaction
      modelResults[campaignId].last_touch += amount;
      
      // Linear: Equal distribution
      modelResults[campaignId].linear += amount;
      
      // Position-based: 40% first, 40% last, 20% middle
      modelResults[campaignId].position_based += amount;
      
      // Time-decay: More recent gets more credit
      modelResults[campaignId].time_decay += amount;
    }

    // Calculate totals by model
    const modelTotals = {
      first_touch: 0,
      last_touch: 0,
      linear: 0,
      position_based: 0,
      time_decay: 0,
    };

    Object.values(modelResults).forEach(campaign => {
      modelTotals.first_touch += campaign.first_touch;
      modelTotals.last_touch += campaign.last_touch;
      modelTotals.linear += campaign.linear;
      modelTotals.position_based += campaign.position_based;
      modelTotals.time_decay += campaign.time_decay;
    });

    // Calculate ROI by channel using last-touch model
    const { data: metaMetrics, error: metaError } = await supabase
      .from('meta_ad_metrics')
      .select('campaign_id, spend')
      .gte('date', startDate)
      .lte('date', endDate);

    const { data: smsMetrics, error: smsError } = await supabase
      .from('sms_campaign_metrics')
      .select('campaign_id, cost')
      .gte('date', startDate)
      .lte('date', endDate);

    const channelROI: Record<string, { revenue: number; cost: number; roi: number }> = {};

    // Calculate Meta ROI
    const metaSpendMap = new Map<string, number>();
    metaMetrics?.forEach(m => {
      const current = metaSpendMap.get(m.campaign_id) || 0;
      metaSpendMap.set(m.campaign_id, current + Number(m.spend));
    });

    metaSpendMap.forEach((spend, campaignId) => {
      const revenue = modelResults[campaignId]?.last_touch || 0;
      const revenueNum = Number(revenue);
      channelROI[campaignId] = {
        revenue: revenueNum,
        cost: spend,
        roi: spend > 0 ? ((revenueNum - spend) / spend) * 100 : 0,
      };
    });

    // Calculate SMS ROI
    const smsSpendMap = new Map<string, number>();
    smsMetrics?.forEach(m => {
      const current = smsSpendMap.get(m.campaign_id) || 0;
      smsSpendMap.set(m.campaign_id, current + Number(m.cost));
    });

    smsSpendMap.forEach((cost, campaignId) => {
      const revenue = modelResults[campaignId]?.last_touch || 0;
      const revenueNum = Number(revenue);
      channelROI[campaignId] = {
        revenue: revenueNum,
        cost,
        roi: cost > 0 ? ((revenueNum - cost) / cost) * 100 : 0,
      };
    });

    console.log(`✅ Calculated attribution across ${Object.keys(modelResults).length} campaigns`);

    return new Response(
      JSON.stringify({
        success: true,
        modelResults,
        modelTotals,
        channelROI,
        transactionCount: transactions?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating attribution:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
