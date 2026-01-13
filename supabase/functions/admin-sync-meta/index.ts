import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { parseJsonBody, uuidSchema, isoDateSchema, z } from "../_shared/validators.ts";

// Use restricted CORS
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || 'https://lovable.dev',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key, x-scheduled-job, x-cron-secret',
};

function getOptimalDateRange(startDate?: string, endDate?: string, mode?: string): { 
  since: string; 
  until: string; 
  description: string;
} {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (startDate && endDate) {
    return { since: startDate, until: endDate, description: `Custom range: ${startDate} to ${endDate}` };
  }
  
  if (mode === 'backfill') {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    return { since: sixtyDaysAgo.toISOString().split('T')[0], until: yesterdayStr, description: `Backfill: last 60 days` };
  }
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return { since: sevenDaysAgo.toISOString().split('T')[0], until: today, description: `Last 7 days` };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // --- AUTH CHECK ---
    const adminKey = req.headers.get('x-admin-key');
    const isScheduledJob = req.headers.get('x-scheduled-job') === 'true';
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization');
    
    let isAuthorized = false;
    
    // SECURITY: Cron secret validation REQUIRED for scheduled jobs
    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
      console.log('[META SYNC] Authorized via CRON_SECRET');
    }
    
    // SECURITY: Internal sync trigger (from tiered-meta-sync) - must use valid secret
    const internalTriggerSecret = Deno.env.get('INTERNAL_TRIGGER_SECRET');
    if (!isAuthorized && internalTriggerSecret && adminKey === internalTriggerSecret) {
      isAuthorized = true;
      console.log('[META SYNC] Authorized via INTERNAL_TRIGGER_SECRET');
    }
    
    // SECURITY: Reject x-scheduled-job header without valid cron secret
    if (!isAuthorized && isScheduledJob) {
      console.warn('[META SYNC] Rejected: x-scheduled-job header provided without valid x-cron-secret');
      // Fall through to JWT check - do NOT auto-authorize
    }
    
    // Admin JWT
    if (!isAuthorized && authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (!authError && user) {
        const { data: isAdmin } = await userClient.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        
        if (isAdmin) {
          isAuthorized = true;
          console.log('[META SYNC] Authorized via admin JWT');
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires admin access' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const bodySchema = z.object({
      organization_id: uuidSchema,
      start_date: isoDateSchema.optional(),
      end_date: isoDateSchema.optional(),
      mode: z.string().trim().max(30).optional(),
    }).passthrough();

    const parsedBody = await parseJsonBody(req, bodySchema, { allowEmpty: false });
    if (!parsedBody.ok) {
      return new Response(
        JSON.stringify({ error: parsedBody.error, details: parsedBody.details }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organization_id, start_date, end_date, mode } = parsedBody.data;


    console.log(`[META SYNC] Starting for organization: ${organization_id}, mode: ${mode || 'default'}`);

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

    const dateRange = getOptimalDateRange(start_date, end_date, mode);
    console.log(`[META SYNC] Date range: ${dateRange.description}`);

    // Validate token
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
          await supabase
            .from('client_api_credentials')
            .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'token_expired' })
            .eq('organization_id', organization_id)
            .eq('platform', 'meta');
            
          return new Response(
            JSON.stringify({ error: 'Meta access token is invalid or expired. Please update the token.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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
      
      await supabase
        .from('client_api_credentials')
        .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'api_error' })
        .eq('organization_id', organization_id)
        .eq('platform', 'meta');
      
      if (campaignsData.error.code === 190) {
        return new Response(
          JSON.stringify({ error: 'Meta access token is invalid or expired.' }),
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

      const insightsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,reach,actions,action_values,cpc,cpm,ctr&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}&time_increment=1&access_token=${access_token}`;
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      if (insightsData.error) {
        console.error(`[META SYNC] Insights error for campaign ${campaign.id}:`, insightsData.error);
      } else if (insightsData.data && insightsData.data.length > 0) {
        const dates = insightsData.data.map((i: any) => i.date_start).sort();
        const campaignLatest = dates[dates.length - 1];
        const campaignEarliest = dates[0];
        
        if (!latestDataDate || campaignLatest > latestDataDate) latestDataDate = campaignLatest;
        if (!earliestDataDate || campaignEarliest < earliestDataDate) earliestDataDate = campaignEarliest;
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
    const today = new Date().toISOString().split('T')[0];
    let dataLagDays = 0;
    let lagReason = '';
    
    if (latestDataDate) {
      dataLagDays = Math.floor((new Date(today).getTime() - new Date(latestDataDate).getTime()) / (1000 * 60 * 60 * 24));
      lagReason = dataLagDays <= 1 ? 'Data is current' : dataLagDays <= 2 ? 'Normal delay' : `${dataLagDays} days behind`;
    } else {
      lagReason = 'No data returned';
    }

    await supabase
      .from('client_api_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: metricsStored > 0 ? 'success' : 'success_no_data'
      })
      .eq('organization_id', organization_id)
      .eq('platform', 'meta');

    try {
      await supabase.rpc('update_data_freshness', {
        p_source: 'meta',
        p_organization_id: organization_id,
        p_latest_data_timestamp: latestDataDate ? new Date(latestDataDate).toISOString() : null,
        p_sync_status: metricsStored > 0 ? 'success' : 'success_no_data',
        p_error: null,
        p_records_synced: metricsStored,
        p_duration_ms: Date.now() - startTime,
      });
    } catch (e) {
      console.error('Error updating freshness:', e);
    }

    const duration = Date.now() - startTime;
    console.log(`[META SYNC] Complete: ${campaigns.length} campaigns, ${metricsStored} metrics, ${creativesStored} creatives, ${duration}ms`);

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
        data_freshness: { latest_data_date: latestDataDate, data_lag_days: dataLagDays, lag_reason: lagReason },
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