import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin key using LOVABLE_API_KEY secret
    const adminKey = req.headers.get('x-admin-key');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    // Allow if key matches or if called from internal scheduled job
    const isAuthorized = adminKey === lovableApiKey || adminKey === 'internal-sync-trigger';
    
    if (!isAuthorized && !lovableApiKey) {
      // If no LOVABLE_API_KEY configured, allow without auth (for initial setup)
      console.log('No LOVABLE_API_KEY configured, allowing unauthenticated request');
    } else if (!isAuthorized) {
      console.error('Invalid admin key provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid admin key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { organization_id, start_date, end_date } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin sync triggered for organization: ${organization_id}`);

    // Fetch credentials
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credData) {
      console.error('Credentials error:', credError);
      return new Response(
        JSON.stringify({ error: 'Meta credentials not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = credData.encrypted_credentials as { access_token: string; ad_account_id: string };
    let { access_token, ad_account_id } = credentials;

    if (!ad_account_id.startsWith('act_')) {
      ad_account_id = `act_${ad_account_id}`;
    }

    // Calculate date range
    const endDate = end_date ? new Date(end_date) : new Date();
    const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const dateRanges = {
      since: startDate.toISOString().split('T')[0],
      until: endDate.toISOString().split('T')[0],
    };

    console.log(`Fetching Meta data from ${dateRanges.since} to ${dateRanges.until}`);

    // Fetch campaigns
    const campaignsUrl = `https://graph.facebook.com/v22.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&access_token=${access_token}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      console.error('Meta API error:', campaignsData.error);
      return new Response(
        JSON.stringify({ error: `Meta API Error: ${campaignsData.error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaigns = campaignsData.data || [];
    console.log(`Found ${campaigns.length} campaigns`);

    let metricsStored = 0;
    let creativesStored = 0;

    // Store campaigns
    for (const campaign of campaigns) {
      await supabase
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
        }, { onConflict: 'organization_id,campaign_id' });

      // Fetch insights
      const insightsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,reach,actions,action_values,cpc,cpm,ctr&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&time_increment=1&access_token=${access_token}`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      if (!insightsData.error && insightsData.data) {
        for (const insight of insightsData.data) {
          let conversions = 0;
          let conversionValue = 0;

          if (insight.actions) {
            const convAction = insight.actions.find((a: any) => 
              a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
            );
            if (convAction) conversions = parseInt(convAction.value) || 0;
          }

          if (insight.action_values) {
            const valueAction = insight.action_values.find((a: any) => 
              a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
            );
            if (valueAction) conversionValue = parseFloat(valueAction.value) || 0;
          }

          const { error: metricsError } = await supabase
            .from('meta_ad_metrics')
            .upsert({
              organization_id,
              campaign_id: campaign.id,
              ad_set_id: '',
              ad_id: '',
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
            }, { onConflict: 'organization_id,campaign_id,ad_set_id,ad_id,date' });

          if (!metricsError) metricsStored++;
        }
      }

      // Fetch ads with creatives
      const adsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/ads?fields=id,name,creative{id,name,object_story_spec,asset_feed_spec,video_id,thumbnail_url}&access_token=${access_token}`;
      const adsResponse = await fetch(adsUrl);
      const adsData = await adsResponse.json();

      if (!adsData.error && adsData.data) {
        for (const ad of adsData.data) {
          const creative = ad.creative;
          if (!creative) continue;

          let primaryText = '', headline = '', description = '', callToActionType = '';
          let videoId = creative.video_id || null;
          let thumbnailUrl = creative.thumbnail_url || null;
          let creativeType = 'unknown';

          if (creative.object_story_spec) {
            const spec = creative.object_story_spec;
            if (spec.link_data) {
              primaryText = spec.link_data.message || '';
              headline = spec.link_data.name || '';
              description = spec.link_data.description || '';
              callToActionType = spec.link_data.call_to_action?.type || '';
              creativeType = spec.link_data.video_id ? 'video' : 'image';
            }
            if (spec.video_data) {
              primaryText = spec.video_data.message || '';
              headline = spec.video_data.title || '';
              creativeType = 'video';
            }
          }

          if (primaryText || headline || videoId) {
            const { error: creativeError } = await supabase
              .from('meta_creative_insights')
              .upsert({
                organization_id,
                campaign_id: campaign.id,
                ad_id: ad.id,
                creative_id: creative.id,
                primary_text: primaryText || null,
                headline: headline || null,
                description: description || null,
                call_to_action_type: callToActionType || null,
                video_url: videoId ? `https://www.facebook.com/video.php?v=${videoId}` : null,
                thumbnail_url: thumbnailUrl,
                creative_type: creativeType,
              }, { onConflict: 'organization_id,campaign_id,ad_id' });

            if (!creativeError) creativesStored++;
          }
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

    console.log(`Sync complete: ${campaigns.length} campaigns, ${metricsStored} metrics, ${creativesStored} creatives`);

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_synced: campaigns.length,
        metrics_stored: metricsStored,
        creatives_stored: creativesStored,
        date_range: dateRanges
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
