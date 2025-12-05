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

interface AdCreative {
  id: string;
  name?: string;
  primary_text?: string;
  headline?: string;
  description?: string;
  call_to_action_type?: string;
  video_id?: string;
  thumbnail_url?: string;
  creative_type?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organization_id } = await req.json();

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    // Verify user has access to this organization
    const { data: clientUser, error: accessError } = await supabase
      .from('client_users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (accessError || !clientUser || clientUser.organization_id !== organization_id) {
      return new Response(
        JSON.stringify({ error: 'You do not have access to this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting Meta Ads sync for organization: ${organization_id} by user: ${user.id}`);

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
    const { access_token } = credentials;
    
    // Auto-add act_ prefix if missing (users often copy just the numeric ID)
    let ad_account_id = credentials.ad_account_id;
    if (ad_account_id && !ad_account_id.startsWith('act_')) {
      ad_account_id = `act_${ad_account_id}`;
      console.log(`Added act_ prefix to ad_account_id: ${ad_account_id}`);
    }

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

    // Fetch campaign attribution mappings
    const { data: attributionMappings } = await supabase
      .from('campaign_attribution')
      .select('*')
      .eq('organization_id', organization_id)
      .not('meta_campaign_id', 'is', null);

    // Track creative insights synced
    let creativesProcessed = 0;

    // Fetch insights and creatives for each campaign
    for (const campaign of campaigns) {
      // ========== PHASE 2: Fetch Ad Creatives ==========
      try {
        console.log(`Fetching ads and creatives for campaign ${campaign.id}`);
        
        // Fetch ads with creative information
        const adsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/ads?fields=id,name,creative{id,name,object_story_spec,asset_feed_spec,video_id,thumbnail_url,effective_object_story_id}&access_token=${access_token}`;
        
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();
        
        if (!adsData.error && adsData.data) {
          const ads = adsData.data || [];
          console.log(`Found ${ads.length} ads for campaign ${campaign.id}`);
          
          for (const ad of ads) {
            const creative = ad.creative;
            if (!creative) continue;
            
            // Extract creative content
            let primaryText = '';
            let headline = '';
            let description = '';
            let callToActionType = '';
            let videoId = creative.video_id || null;
            let thumbnailUrl = creative.thumbnail_url || null;
            let creativeType = 'unknown';
            
            // Parse object_story_spec for standard creatives
            if (creative.object_story_spec) {
              const spec = creative.object_story_spec;
              
              // Link ad
              if (spec.link_data) {
                primaryText = spec.link_data.message || '';
                headline = spec.link_data.name || '';
                description = spec.link_data.description || '';
                callToActionType = spec.link_data.call_to_action?.type || '';
                creativeType = spec.link_data.video_id ? 'video' : 'image';
                videoId = spec.link_data.video_id || videoId;
              }
              
              // Video ad
              if (spec.video_data) {
                primaryText = spec.video_data.message || '';
                headline = spec.video_data.title || '';
                description = spec.video_data.link_description || '';
                callToActionType = spec.video_data.call_to_action?.type || '';
                creativeType = 'video';
                videoId = spec.video_data.video_id || videoId;
                thumbnailUrl = spec.video_data.image_url || thumbnailUrl;
              }
              
              // Photo ad
              if (spec.photo_data) {
                primaryText = spec.photo_data.caption || '';
                creativeType = 'image';
              }
            }
            
            // Parse asset_feed_spec for dynamic creatives
            if (creative.asset_feed_spec) {
              const feedSpec = creative.asset_feed_spec;
              creativeType = 'dynamic';
              
              // Get first body text
              if (feedSpec.bodies && feedSpec.bodies.length > 0) {
                primaryText = feedSpec.bodies.map((b: any) => b.text).join(' | ');
              }
              
              // Get first title
              if (feedSpec.titles && feedSpec.titles.length > 0) {
                headline = feedSpec.titles.map((t: any) => t.text).join(' | ');
              }
              
              // Get first description
              if (feedSpec.descriptions && feedSpec.descriptions.length > 0) {
                description = feedSpec.descriptions.map((d: any) => d.text).join(' | ');
              }
              
              // Get call to action
              if (feedSpec.call_to_action_types && feedSpec.call_to_action_types.length > 0) {
                callToActionType = feedSpec.call_to_action_types[0];
              }
              
              // Check for videos
              if (feedSpec.videos && feedSpec.videos.length > 0) {
                creativeType = 'video';
                videoId = feedSpec.videos[0].video_id || videoId;
              }
            }
            
            // Only store if we have some creative content
            if (primaryText || headline || description || videoId) {
              // Fetch ad-level insights for performance metrics
              const adInsightsUrl = `https://graph.facebook.com/v22.0/${ad.id}/insights?fields=impressions,clicks,spend,actions,action_values,ctr&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&access_token=${access_token}`;
              
              let impressions = 0, clicks = 0, spend = 0, conversions = 0, conversionValue = 0, ctr = 0;
              
              try {
                const adInsightsResponse = await fetch(adInsightsUrl);
                const adInsightsData = await adInsightsResponse.json();
                
                if (!adInsightsData.error && adInsightsData.data && adInsightsData.data.length > 0) {
                  const insight = adInsightsData.data[0];
                  impressions = parseInt(insight.impressions) || 0;
                  clicks = parseInt(insight.clicks) || 0;
                  spend = parseFloat(insight.spend) || 0;
                  ctr = parseFloat(insight.ctr) || 0;
                  
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
                }
              } catch (insightErr) {
                console.error(`Error fetching insights for ad ${ad.id}:`, insightErr);
              }
              
              // Store creative insight
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
                  impressions,
                  clicks,
                  spend,
                  conversions,
                  conversion_value: conversionValue,
                  ctr,
                  roas: spend > 0 ? conversionValue / spend : 0,
                }, {
                  onConflict: 'organization_id,campaign_id,ad_id'
                });
              
              if (creativeError) {
                console.error(`Error storing creative insight for ad ${ad.id}:`, creativeError);
              } else {
                creativesProcessed++;
              }
            }
          }
        }
      } catch (creativeErr) {
        console.error(`Error fetching creatives for campaign ${campaign.id}:`, creativeErr);
      }
      
      // ========== Original: Fetch campaign-level insights ==========
      const insightsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,reach,actions,action_values,cpc,cpm,ctr&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&time_increment=1&access_token=${access_token}`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      if (insightsData.error) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, insightsData.error.message);
        continue;
      }

      const insights = insightsData.data || [];
      
      // Find attribution mapping for this campaign
      const mapping = attributionMappings?.find(m => m.meta_campaign_id === campaign.id);
      
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

        // Create attribution touchpoints for clicks (if mapping exists)
        if (mapping && parseInt(insight.clicks) > 0) {
          const clicks = parseInt(insight.clicks);
          console.log(`Creating ${clicks} attribution touchpoints for campaign ${campaign.id} on ${insight.date_start}`);
          
          const { error: touchpointError } = await supabase
            .from('attribution_touchpoints')
            .insert({
              organization_id,
              touchpoint_type: 'meta_ad_click',
              occurred_at: `${insight.date_start}T12:00:00Z`,
              utm_source: 'meta',
              utm_medium: 'cpc',
              utm_campaign: campaign.name || campaign.id,
              campaign_id: mapping.meta_campaign_id,
              metadata: {
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                date: insight.date_start,
                clicks: clicks,
                impressions: parseInt(insight.impressions) || 0,
                spend: parseFloat(insight.spend) || 0,
              }
            });

          if (touchpointError) {
            console.error(`Error creating touchpoint for ${campaign.id}:`, touchpointError);
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

    console.log(`Meta Ads sync completed successfully. Creatives processed: ${creativesProcessed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaigns: campaigns.length,
        creatives_processed: creativesProcessed,
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