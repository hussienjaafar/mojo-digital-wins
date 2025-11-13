import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SwitchboardCredentials {
  api_key: string;
  account_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id } = await req.json();

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`Starting Switchboard SMS sync for organization: ${organization_id}`);

    // Fetch credentials
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'switchboard')
      .eq('is_active', true)
      .single();

    if (credError || !credData) {
      throw new Error('Switchboard credentials not found or inactive');
    }

    const credentials = credData.encrypted_credentials as unknown as SwitchboardCredentials;
    const { api_key, account_id } = credentials;

    // Calculate date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log(`Fetching Switchboard data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch campaigns from Switchboard
    // Note: This is a placeholder URL - adjust based on actual Switchboard API documentation
    const campaignsUrl = `https://api.oneswitchboard.com/v1/campaigns?account_id=${account_id}`;
    
    const campaignsResponse = await fetch(campaignsUrl, {
      headers: {
        'Authorization': `Bearer ${api_key}`,
        'Content-Type': 'application/json',
      }
    });

    if (!campaignsResponse.ok) {
      throw new Error(`Switchboard API Error: ${campaignsResponse.statusText}`);
    }

    const campaignsData = await campaignsResponse.json();
    const campaigns = campaignsData.campaigns || campaignsData.data || [];

    console.log(`Found ${campaigns.length} SMS campaigns`);

    // Fetch metrics for each campaign
    for (const campaign of campaigns) {
      const metricsUrl = `https://api.oneswitchboard.com/v1/campaigns/${campaign.id}/metrics?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`;
      
      const metricsResponse = await fetch(metricsUrl, {
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
        }
      });

      if (!metricsResponse.ok) {
        console.error(`Error fetching metrics for campaign ${campaign.id}`);
        continue;
      }

      const metricsData = await metricsResponse.json();
      const dailyMetrics = metricsData.daily_metrics || metricsData.metrics || [];

      // Store daily metrics
      for (const metric of dailyMetrics) {
        const { error: insertError } = await supabase
          .from('sms_campaign_metrics')
          .upsert({
            organization_id,
            campaign_id: campaign.id,
            campaign_name: campaign.name || campaign.id,
            date: metric.date,
            messages_sent: parseInt(metric.messages_sent) || 0,
            messages_delivered: parseInt(metric.messages_delivered) || 0,
            messages_failed: parseInt(metric.messages_failed) || 0,
            opt_outs: parseInt(metric.opt_outs) || 0,
            clicks: parseInt(metric.clicks) || 0,
            conversions: parseInt(metric.conversions) || 0,
            amount_raised: parseFloat(metric.amount_raised) || 0,
            cost: parseFloat(metric.cost) || 0,
          }, {
            onConflict: 'organization_id,campaign_id,date'
          });

        if (insertError) {
          console.error(`Error storing SMS metrics for ${campaign.id} on ${metric.date}:`, insertError);
        }
      }
    }

    // Update sync status
    await supabase
      .from('client_api_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success'
      })
      .eq('organization_id', organization_id)
      .eq('platform', 'switchboard');

    console.log('Switchboard SMS sync completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaigns: campaigns.length,
        message: 'Switchboard SMS sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync-switchboard-sms:', error);

    // Try to update error status
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { organization_id } = await req.json().catch(() => ({}));
      if (organization_id) {
        await supabase
          .from('client_api_credentials')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'error'
          })
          .eq('organization_id', organization_id)
          .eq('platform', 'switchboard');
      }
    } catch (updateError) {
      console.error('Error updating sync status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
