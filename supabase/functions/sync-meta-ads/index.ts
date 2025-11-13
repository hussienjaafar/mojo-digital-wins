import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaCredentials {
  access_token: string;
  ad_account_id: string;
  business_manager_id?: string;
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

    console.log(`Starting Meta Ads sync for organization: ${organization_id}`);

    // Fetch credentials
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .single();

    if (credError || !credData) {
      throw new Error('Meta credentials not found or inactive');
    }

    const credentials = credData.encrypted_credentials as unknown as MetaCredentials;
    const { access_token, ad_account_id } = credentials;

    // Calculate date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const dateRanges = {
      since: startDate.toISOString().split('T')[0],
      until: endDate.toISOString().split('T')[0],
    };

    console.log(`Fetching Meta Ads data from ${dateRanges.since} to ${dateRanges.until}`);

    // Fetch campaigns
    const campaignsUrl = `https://graph.facebook.com/v22.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&access_token=${access_token}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      throw new Error(`Meta API Error: ${campaignsData.error.message}`);
    }

    const campaigns = campaignsData.data || [];
    console.log(`Found ${campaigns.length} campaigns`);

    // Store campaigns
    for (const campaign of campaigns) {
      const { error: insertError } = await supabase
        .from('meta_campaigns')
        .upsert({
          organization_id,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
          lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
          start_date: campaign.start_time ? campaign.start_time.split('T')[0] : null,
          end_date: campaign.stop_time ? campaign.stop_time.split('T')[0] : null,
        }, {
          onConflict: 'organization_id,campaign_id'
        });

      if (insertError) {
        console.error(`Error storing campaign ${campaign.id}:`, insertError);
      }
    }

    // Fetch insights for each campaign
    for (const campaign of campaigns) {
      const insightsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,reach,actions,action_values,cpc,cpm,ctr&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&time_increment=1&access_token=${access_token}`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      if (insightsData.error) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, insightsData.error.message);
        continue;
      }

      const insights = insightsData.data || [];
      
      // Store daily metrics
      for (const insight of insights) {
        // Extract conversions from actions
        let conversions = 0;
        let conversionValue = 0;

        if (insight.actions) {
          const conversionAction = insight.actions.find((a: any) => 
            a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
          );
          if (conversionAction) {
            conversions = parseInt(conversionAction.value) || 0;
          }
        }

        if (insight.action_values) {
          const valueAction = insight.action_values.find((a: any) => 
            a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
          );
          if (valueAction) {
            conversionValue = parseFloat(valueAction.value) || 0;
          }
        }

        const { error: metricsError } = await supabase
          .from('meta_ad_metrics')
          .upsert({
            organization_id,
            campaign_id: campaign.id,
            ad_set_id: null,
            ad_id: null,
            date: insight.date_start,
            impressions: parseInt(insight.impressions) || 0,
            clicks: parseInt(insight.clicks) || 0,
            spend: parseFloat(insight.spend) || 0,
            reach: parseInt(insight.reach) || 0,
            cpc: parseFloat(insight.cpc) || 0,
            cpm: parseFloat(insight.cpm) || 0,
            ctr: parseFloat(insight.ctr) || 0,
            conversions,
            conversion_value: conversionValue,
            roas: conversionValue > 0 && parseFloat(insight.spend) > 0 
              ? conversionValue / parseFloat(insight.spend) 
              : 0,
          }, {
            onConflict: 'organization_id,campaign_id,ad_set_id,ad_id,date'
          });

        if (metricsError) {
          console.error(`Error storing metrics for ${campaign.id} on ${insight.date_start}:`, metricsError);
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
      .eq('platform', 'meta');

    console.log('Meta Ads sync completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaigns: campaigns.length,
        message: 'Meta Ads sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync-meta-ads:', error);

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
          .eq('platform', 'meta');
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
