import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key, x-scheduled-job',
};

/**
 * Calculate optimal date range for Meta API requests.
 * Meta typically has a 24-48 hour data processing delay.
 * 
 * For scheduled syncs: Focus on last 7 days (fresh data)
 * For manual syncs with dates: Use provided dates
 * For backfill: Use full 30-day range
 */
function getOptimalDateRange(startDate?: string, endDate?: string, mode?: string): { 
  since: string; 
  until: string; 
  description: string;
} {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Yesterday is typically the latest date with complete data from Meta
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (startDate && endDate) {
    // User specified dates - use them
    return {
      since: startDate,
      until: endDate,
      description: `Custom range: ${startDate} to ${endDate}`
    };
  }
  
  if (mode === 'backfill') {
    // Backfill mode: last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    return {
      since: sixtyDaysAgo.toISOString().split('T')[0],
      until: yesterdayStr,
      description: `Backfill: last 60 days`
    };
  }
  
  // Default: Focus on last 7 days for fresh data (scheduled syncs)
  // This ensures we always get the most recent data available
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return {
    since: sevenDaysAgo.toISOString().split('T')[0],
    until: today, // Request up to today, Meta will return what's available
    description: `Last 7 days: ${sevenDaysAgo.toISOString().split('T')[0]} to ${today}`
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Verify admin key using LOVABLE_API_KEY secret
    const adminKey = req.headers.get('x-admin-key');
    const isScheduledJob = req.headers.get('x-scheduled-job') === 'true';
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    // Allow if key matches or if called from internal scheduled job
    const isAuthorized = adminKey === lovableApiKey || adminKey === 'internal-sync-trigger' || isScheduledJob;
    
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

    const { organization_id, start_date, end_date, mode } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[META SYNC] Starting for organization: ${organization_id}, mode: ${mode || 'default'}`);

    // Fetch credentials
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credData) {
      console.error('[META SYNC] Credentials error:', credError);
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

    // Calculate optimal date range
    const dateRange = getOptimalDateRange(start_date, end_date, mode);
    console.log(`[META SYNC] Date range: ${dateRange.description}`);

    // Validate the access token
    console.log(`[META SYNC] Validating access token...`);
    const tokenDebugUrl = `https://graph.facebook.com/v22.0/debug_token?input_token=${access_token}&access_token=${access_token}`;
    try {
      const tokenResponse = await fetch(tokenDebugUrl);
      const tokenData = await tokenResponse.json();
      if (tokenData.data) {
        const expiresAt = tokenData.data.expires_at;
        const isValid = tokenData.data.is_valid;
        console.log(`[META SYNC] Token valid: ${isValid}, expires: ${expiresAt ? new Date(expiresAt * 1000).toISOString() : 'never'}`);
        
        if (!isValid) {
          // Update credentials status to indicate token issue
          await supabase
            .from('client_api_credentials')
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: 'token_expired'
            })
            .eq('organization_id', organization_id)
            .eq('platform', 'meta');
            
          return new Response(
            JSON.stringify({ error: 'Meta access token is invalid or expired. Please update the token.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Warn if token expires within 7 days
        if (expiresAt) {
          const daysUntilExpiry = (expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntilExpiry < 7) {
            console.warn(`[META SYNC] WARNING: Token expires in ${Math.round(daysUntilExpiry)} days!`);
          }
        }
      }
    } catch (e) {
      console.warn('[META SYNC] Could not validate token (non-fatal):', e);
    }

    // Fetch campaigns
    const campaignsUrl = `https://graph.facebook.com/v22.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&access_token=${access_token}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      console.error('[META SYNC] Meta API error:', campaignsData.error);
      
      // Update sync status with error
      await supabase
        .from('client_api_credentials')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'api_error'
        })
        .eq('organization_id', organization_id)
        .eq('platform', 'meta');
      
      if (campaignsData.error.code === 190) {
        return new Response(
          JSON.stringify({ error: 'Meta access token is invalid or expired. Please update the token in API Credentials.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Meta API Error: ${campaignsData.error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaigns = campaignsData.data || [];
    console.log(`[META SYNC] Found ${campaigns.length} campaigns`);

    let metricsStored = 0;
    let creativesStored = 0;
    let latestDataDate: string | null = null;
    let earliestDataDate: string | null = null;

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

      // Fetch daily insights with time_increment=1 for per-day data
      // THIS IS CRITICAL: Without time_increment=1, Meta returns aggregated data
      const insightsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,reach,actions,action_values,cpc,cpm,ctr&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}&time_increment=1&access_token=${access_token}`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      // Log insights response for debugging
      if (insightsData.error) {
        console.error(`[META SYNC] Insights error for campaign ${campaign.id} (${campaign.name}):`, insightsData.error);
      } else if (!insightsData.data || insightsData.data.length === 0) {
        console.log(`[META SYNC] No data for campaign ${campaign.name} in range ${dateRange.since} to ${dateRange.until}`);
      } else {
        const dates = insightsData.data.map((i: any) => i.date_start).sort();
        const campaignLatest = dates[dates.length - 1];
        const campaignEarliest = dates[0];
        const totalSpend = insightsData.data.reduce((sum: number, i: any) => sum + (parseFloat(i.spend) || 0), 0);
        
        console.log(`[META SYNC] Campaign "${campaign.name}": ${insightsData.data.length} days, ${campaignEarliest} to ${campaignLatest}, spend: $${totalSpend.toFixed(2)}`);
        
        // Track overall date range
        if (!latestDataDate || campaignLatest > latestDataDate) {
          latestDataDate = campaignLatest;
        }
        if (!earliestDataDate || campaignEarliest < earliestDataDate) {
          earliestDataDate = campaignEarliest;
        }
      }

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

      // Fetch ads with creatives (abbreviated - same as before)
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

    // Calculate data freshness metrics
    const today = new Date().toISOString().split('T')[0];
    let dataLagDays = 0;
    let lagReason = '';
    
    if (latestDataDate) {
      const latestDate = new Date(latestDataDate);
      const todayDate = new Date(today);
      dataLagDays = Math.floor((todayDate.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dataLagDays <= 1) {
        lagReason = 'Data is current (within normal Meta 24h processing delay)';
      } else if (dataLagDays <= 2) {
        lagReason = 'Data is slightly behind (normal for weekends or low activity)';
      } else {
        lagReason = `Data is ${dataLagDays} days behind - may indicate campaign pause or API issues`;
      }
    } else {
      lagReason = 'No data returned from Meta API for the requested date range';
    }

    // Update sync status
    await supabase
      .from('client_api_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: metricsStored > 0 ? 'success' : 'success_no_data'
      })
      .eq('organization_id', organization_id)
      .eq('platform', 'meta');

    const duration = Date.now() - startTime;
    console.log(`[META SYNC] Complete: ${campaigns.length} campaigns, ${metricsStored} metrics, ${creativesStored} creatives, duration: ${duration}ms`);
    console.log(`[META SYNC] Data freshness: latest=${latestDataDate}, lag=${dataLagDays} days, reason=${lagReason}`);

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_synced: campaigns.length,
        metrics_stored: metricsStored,
        creatives_stored: creativesStored,
        date_range: {
          requested: { since: dateRange.since, until: dateRange.until },
          actual: { earliest: earliestDataDate, latest: latestDataDate }
        },
        data_freshness: {
          latest_data_date: latestDataDate,
          data_lag_days: dataLagDays,
          lag_reason: lagReason
        },
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[META SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
