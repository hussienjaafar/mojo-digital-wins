/**
 * ================================================================================
 * SYNC META ADS - AGGREGATED DATA ONLY
 * ================================================================================
 * 
 * CRITICAL ARCHITECTURAL CONSTRAINT:
 * The Meta Marketing API ONLY provides aggregated campaign metrics (total clicks,
 * impressions, spend). It does NOT provide per-user data.
 * 
 * Therefore, this function MUST NEVER create records in `attribution_touchpoints`
 * because we cannot trace Meta interactions back to individual donors.
 * 
 * What this function DOES:
 * - Stores aggregated metrics in meta_campaign_insights, meta_ad_metrics
 * - Extracts refcodes from creative destination URLs for mapping
 * - Stores creative content for analysis
 * 
 * What this function MUST NEVER DO:
 * - Create meta_ad_click or meta_ad_impression touchpoints
 * - Insert into attribution_touchpoints without a verified donor_email
 * - Imply per-donor Meta attribution is possible
 * 
 * Real per-donor attribution can ONLY come from:
 * - ActBlue webhooks (refcode, click_id, fbclid embedded in donation URL)
 * - SMS events with phone_hash identity resolution
 * 
 * See: Attribution System Audit (2026-01-03) for full rationale.
 * ================================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { parseJsonBody, uuidSchema, isoDateSchema, z } from "../_shared/validators.ts";

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

// Demographics breakdown interface
interface DemographicBreakdown {
  age?: string;
  gender?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

// Placement breakdown interface
interface PlacementBreakdown {
  publisher_platform?: string;
  platform_position?: string;
  device_platform?: string;
  impressions: number;
  clicks: number;
  spend: number;
}

// Data freshness tracking
interface DataFreshnessInfo {
  requestedRange: { start: string; end: string };
  actualDataRange: { start: string | null; end: string | null };
  expectedLatestDate: string;
  actualLatestDate: string | null;
  dataLagDays: number;
  dataLagReason: string;
  metricsRetrieved: number;
  campaignsWithData: number;
  campaignsWithoutData: number;
}

/**
 * Calculate the optimal date range for Meta API requests.
 * Meta typically has a 24-48 hour data processing delay.
 * 
 * Key insights from Meta API:
 * - Data for "today" is often not available until next day
 * - Yesterday's data is usually available by morning
 * - Requesting too large a date range can cause API to return truncated results
 * - Best practice: request shorter ranges (30 days) for fresh data
 */
function getOptimalDateRange(startDate?: string, endDate?: string): { since: string; until: string; expectedLatency: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Request up to yesterday - today's data may not be ready
  // But don't cap too aggressively, let Meta return what it has
  const safeEndDate = new Date();
  safeEndDate.setDate(safeEndDate.getDate() - 1);
  const safeEndStr = safeEndDate.toISOString().split('T')[0];
  
  let since: string;
  let until: string;
  
  if (startDate && endDate) {
    since = startDate;
    until = endDate;
    // Don't cap the end date - let Meta return whatever data is available
    console.log(`[DATE RANGE] Using requested dates: ${since} to ${until}`);
  } else {
    // Default: last 30 days (shorter range = more reliable data)
    // For full historical data, user can specify custom dates
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    since = defaultStart.toISOString().split('T')[0];
    until = today; // Request up to today, Meta will return what's available
    console.log(`[DATE RANGE] Using default 30-day range: ${since} to ${until}`);
  }
  
  return { 
    since, 
    until,
    expectedLatency: `Data typically available up to ${safeEndStr} (24h processing delay)`
  };
}

/**
 * Check Meta API data freshness by querying the data_freshness endpoint
 */
async function checkDataFreshness(adAccountId: string, accessToken: string): Promise<{ isDelayed: boolean; latencyHours: number; message: string }> {
  try {
    // Query account-level insights to check most recent data
    const testUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=impressions,date_stop&date_preset=last_7d&access_token=${accessToken}`;
    const response = await fetch(testUrl);
    const data = await response.json();
    
    if (data.error) {
      return { isDelayed: true, latencyHours: 48, message: `Unable to check freshness: ${data.error.message}` };
    }
    
    if (!data.data || data.data.length === 0) {
      return { isDelayed: true, latencyHours: 48, message: 'No recent data available from Meta API' };
    }
    
    // Find the most recent date with data
    const dates = data.data.map((d: any) => d.date_stop).sort();
    const latestDate = dates[dates.length - 1];
    const today = new Date().toISOString().split('T')[0];
    
    const latestDateObj = new Date(latestDate);
    const todayObj = new Date(today);
    const hoursBehind = Math.floor((todayObj.getTime() - latestDateObj.getTime()) / (1000 * 60 * 60));
    
    return {
      isDelayed: hoursBehind > 24,
      latencyHours: hoursBehind,
      message: hoursBehind > 48 
        ? `⚠️ Meta data is ${hoursBehind} hours behind (latest: ${latestDate}). Consider checking Meta Business Manager.`
        : hoursBehind > 24 
          ? `ℹ️ Normal Meta delay: ${hoursBehind}h (latest: ${latestDate})`
          : `✓ Data relatively fresh: ${hoursBehind}h delay (latest: ${latestDate})`
    };
  } catch (error) {
    console.error('Error checking data freshness:', error);
    return { isDelayed: true, latencyHours: 48, message: 'Could not determine data freshness' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse + validate request body first
    const bodySchema = z.object({
      organization_id: uuidSchema,
      start_date: isoDateSchema.optional(),
      end_date: isoDateSchema.optional(),
      mode: z.string().trim().max(30).optional(),
      check_freshness_only: z.coerce.boolean().optional(),
    }).passthrough();

    const parsedBody = await parseJsonBody(req, bodySchema, { allowEmpty: false });
    if (!parsedBody.ok) {
      return new Response(
        JSON.stringify({ error: parsedBody.error, details: parsedBody.details }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organization_id, start_date, end_date, mode, check_freshness_only } = parsedBody.data;

    // --- SECURITY: Authentication checks ---
    const internalKey = req.headers.get('x-internal-key');
    const isInternalCall = mode === 'backfill' && organization_id && internalKey === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 20);
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const internalTriggerSecret = Deno.env.get('INTERNAL_TRIGGER_SECRET');
    const authHeader = req.headers.get('Authorization');
    const isScheduledHeader = req.headers.get('x-scheduled-job') === 'true';
    
    let isAuthorized = false;
    let authMethod = '';

    // SECURITY: Cron secret validation REQUIRED for scheduled jobs
    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
      authMethod = 'CRON_SECRET';
      console.log('[SYNC-META-ADS] Authorized via CRON_SECRET');
    }
    
    // SECURITY: Internal trigger (from tiered-meta-sync or other internal functions)
    if (!isAuthorized && internalTriggerSecret && internalKey === internalTriggerSecret) {
      isAuthorized = true;
      authMethod = 'INTERNAL_TRIGGER_SECRET';
      console.log('[SYNC-META-ADS] Authorized via INTERNAL_TRIGGER_SECRET');
    }
    
    // SECURITY: Legacy internal backfill call (service role key prefix)
    if (!isAuthorized && isInternalCall) {
      isAuthorized = true;
      authMethod = 'INTERNAL_BACKFILL';
      console.log('[SYNC-META-ADS] Authorized via internal backfill key');
    }
    
    // SECURITY: Reject x-scheduled-job header without valid cron secret
    if (!isAuthorized && isScheduledHeader) {
      console.warn('[SYNC-META-ADS] Rejected: x-scheduled-job header provided without valid x-cron-secret');
      // Fall through to JWT check - do NOT auto-authorize
    }
    
    // Admin JWT check
    if (!isAuthorized && authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      
      if (!authError && user) {
        // Check if user is admin
        const { data: isAdmin } = await userClient.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        
        if (isAdmin) {
          isAuthorized = true;
          authMethod = 'ADMIN_JWT';
          console.log('[SYNC-META-ADS] Authorized via admin JWT');
        } else {
          // Non-admin users must belong to the organization
          const { data: clientUser, error: accessError } = await supabase
            .from('client_users')
            .select('organization_id')
            .eq('id', user.id)
            .single();

          if (!accessError && clientUser && clientUser.organization_id === organization_id) {
            isAuthorized = true;
            authMethod = 'USER_JWT';
            console.log('[SYNC-META-ADS] Authorized via user JWT for their organization');
          }
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET, admin access, or org membership' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC-META-ADS] Starting sync for org ${organization_id} (auth: ${authMethod})`);

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    // Fetch credentials
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .single();

    if (credError || !credData) {
      // Return graceful response for orgs without credentials (e.g., demo orgs)
      console.log(`[SYNC-META-ADS] No Meta credentials found for org ${organization_id} - skipping sync`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          message: 'No Meta credentials configured for this organization',
          insight_records: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = credData.encrypted_credentials as unknown as MetaCredentials;
    const { access_token } = credentials;
    
    // Auto-add act_ prefix if missing (users often copy just the numeric ID)
    let ad_account_id = credentials.ad_account_id;
    if (ad_account_id && !ad_account_id.startsWith('act_')) {
      ad_account_id = `act_${ad_account_id}`;
      console.log(`Added act_ prefix to ad_account_id: ${ad_account_id}`);
    }

    // Check data freshness first
    const freshness = await checkDataFreshness(ad_account_id, access_token);
    console.log(`[META DATA FRESHNESS] ${freshness.message}`);
    
    // If only checking freshness, return early
    if (check_freshness_only) {
      return new Response(
        JSON.stringify({
          success: true,
          freshness_check: true,
          latency_hours: freshness.latencyHours,
          is_delayed: freshness.isDelayed,
          message: freshness.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate optimal date range with Meta's processing delay in mind
    const dateRanges = getOptimalDateRange(start_date, end_date);
    
    console.log(`[DATE RANGE] Fetching Meta Ads data from ${dateRanges.since} to ${dateRanges.until}`);
    console.log(`[EXPECTED LATENCY] ${dateRanges.expectedLatency}`);

    // Initialize data freshness tracking
    const freshnessInfo: DataFreshnessInfo = {
      requestedRange: { start: start_date || dateRanges.since, end: end_date || dateRanges.until },
      actualDataRange: { start: null, end: null },
      expectedLatestDate: dateRanges.until,
      actualLatestDate: null,
      dataLagDays: 0,
      dataLagReason: '',
      metricsRetrieved: 0,
      campaignsWithData: 0,
      campaignsWithoutData: 0
    };

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

    // ========== FETCH AND STORE AD SETS ==========
    console.log(`[SYNC-META-ADS] Fetching ad sets for account ${ad_account_id}`);
    
    let adsetsProcessed = 0;
    try {
      const adsetsUrl = `https://graph.facebook.com/v22.0/${ad_account_id}/adsets?fields=id,name,campaign_id,status,targeting&limit=500&access_token=${access_token}`;
      const adsetsResponse = await fetch(adsetsUrl);
      const adsetsData = await adsetsResponse.json();
      
      if (!adsetsData.error && adsetsData.data) {
        const adsets = adsetsData.data || [];
        console.log(`[SYNC-META-ADS] Found ${adsets.length} ad sets`);
        
        for (const adset of adsets) {
          const { error: adsetError } = await supabase
            .from('meta_adsets')
            .upsert({
              organization_id,
              adset_id: adset.id,
              adset_name: adset.name,
              campaign_id: adset.campaign_id,
              status: adset.status || 'UNKNOWN',
              targeting_summary: adset.targeting || {},
            }, {
              onConflict: 'organization_id,adset_id'
            });
          
          if (adsetError) {
            console.error(`[SYNC-META-ADS] Error storing adset ${adset.id}:`, adsetError.message);
          } else {
            adsetsProcessed++;
          }
        }
        
        console.log(`[SYNC-META-ADS] Stored ${adsetsProcessed} ad sets`);
      } else if (adsetsData.error) {
        console.error(`[SYNC-META-ADS] Error fetching ad sets: ${adsetsData.error.message}`);
      }
    } catch (adsetErr) {
      console.error(`[SYNC-META-ADS] Exception fetching ad sets:`, adsetErr);
    }

    // Fetch campaign attribution mappings
    const { data: attributionMappings } = await supabase
      .from('campaign_attribution')
      .select('*')
      .eq('organization_id', organization_id)
      .not('meta_campaign_id', 'is', null);

    // Track creative insights synced and data freshness
    let creativesProcessed = 0;
    let totalInsightRecords = 0;
    let latestDataDate: string | null = null;
    let earliestDataDate: string | null = null;
    
    // Track demographic and placement data
    let demographicRecords = 0;
    let placementRecords = 0;
    
    // Track campaigns by data availability
    const campaignsWithDataIds: string[] = [];
    const campaignsWithoutDataIds: string[] = [];

    // Fetch insights and creatives for each campaign
    for (const campaign of campaigns) {
      // ========== PHASE 2: Fetch Ad Creatives ==========
      try {
        console.log(`Fetching ads and creatives for campaign ${campaign.id}`);
        
        // Fetch ads with creative information - explicitly request link fields for refcode extraction
        const adsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/ads?fields=id,name,creative{id,name,object_story_spec{link_data{link,message,name,description,call_to_action},video_data{video_id,title,link_description,call_to_action,image_url},photo_data{caption}},asset_feed_spec{bodies,titles,descriptions,call_to_action_types,videos,link_urls},video_id,thumbnail_url,effective_object_story_id}&access_token=${access_token}`;
        
        console.log(`[DEBUG][sync-meta-ads] Fetching ads URL: ${adsUrl.replace(access_token, 'REDACTED')}`);
        
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();
        
        if (!adsData.error && adsData.data) {
          const ads = adsData.data || [];
          console.log(`[DEBUG][sync-meta-ads] Found ${ads.length} ads for campaign ${campaign.id}`);
          
          // Log first ad's raw response for debugging
          if (ads.length > 0) {
            console.log(`[DEBUG][sync-meta-ads] Sample raw ad response:`, JSON.stringify(ads[0], null, 2).substring(0, 2000));
          }
          
          for (const ad of ads) {
            const creative = ad.creative;
            if (!creative) {
              console.log(`[DEBUG][sync-meta-ads] Ad ${ad.id} has no creative data`);
              continue;
            }
            
            // Log creative structure for debugging
            console.log(`[DEBUG][sync-meta-ads] Creative ${creative.id} structure:`, {
              hasObjectStorySpec: !!creative.object_story_spec,
              objectStorySpecKeys: creative.object_story_spec ? Object.keys(creative.object_story_spec) : [],
              hasAssetFeedSpec: !!creative.asset_feed_spec,
              assetFeedSpecKeys: creative.asset_feed_spec ? Object.keys(creative.asset_feed_spec) : []
            });
            
            // Extract creative content
            let primaryText = '';
            let headline = '';
            let description = '';
            let callToActionType = '';
            let videoId = creative.video_id || null;
            let thumbnailUrl = creative.thumbnail_url || null;
            let creativeType = 'unknown';
            
            // NEW: Track destination URL and extracted refcode
            let destinationUrl: string | null = null;
            let extractedRefcode: string | null = null;
            let refcodeSource: string | null = null;

            // Parse object_story_spec for standard creatives
            if (creative.object_story_spec) {
              const spec = creative.object_story_spec;
              
              // Log link_data structure for debugging
              if (spec.link_data) {
                console.log(`[DEBUG][sync-meta-ads] Creative ${creative.id} link_data:`, {
                  hasLink: !!spec.link_data.link,
                  link: spec.link_data.link?.substring(0, 100) || 'NOT_FOUND',
                  hasCTA: !!spec.link_data.call_to_action,
                  ctaLink: spec.link_data.call_to_action?.value?.link?.substring(0, 100) || 'NOT_FOUND'
                });
              }
              
              // Link ad
              if (spec.link_data) {
                primaryText = spec.link_data.message || '';
                headline = spec.link_data.name || '';
                description = spec.link_data.description || '';
                callToActionType = spec.link_data.call_to_action?.type || '';
                creativeType = spec.link_data.video_id ? 'video' : 'image';
                videoId = spec.link_data.video_id || videoId;
                
                // Extract destination URL from link_data
                destinationUrl = spec.link_data.link || spec.link_data.call_to_action?.value?.link || null;
                
                console.log(`[DEBUG][sync-meta-ads] Extracted destination URL from link_data: ${destinationUrl?.substring(0, 100) || 'NONE'}`);
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
                
                // Extract destination URL from video CTA
                if (!destinationUrl && spec.video_data.call_to_action?.value?.link) {
                  destinationUrl = spec.video_data.call_to_action.value.link;
                }
              }
              
              // Photo ad
              if (spec.photo_data) {
                primaryText = spec.photo_data.caption || '';
                creativeType = 'image';
              }
            }
            
            // FALLBACK: If no destination URL found, try fetching from the creative directly
            if (!destinationUrl && creative.id) {
              try {
                console.log(`[DEBUG][sync-meta-ads] No URL in object_story_spec, fetching creative ${creative.id} directly...`);
                const creativeUrl = `https://graph.facebook.com/v22.0/${creative.id}?fields=object_story_spec,effective_object_story_id&access_token=${access_token}`;
                const creativeResponse = await fetch(creativeUrl);
                const creativeData = await creativeResponse.json();
                
                if (!creativeData.error) {
                  console.log(`[DEBUG][sync-meta-ads] Direct creative fetch result:`, JSON.stringify(creativeData, null, 2).substring(0, 1000));
                  
                  // Try object_story_spec from direct fetch
                  if (creativeData.object_story_spec?.link_data?.link) {
                    destinationUrl = creativeData.object_story_spec.link_data.link;
                    console.log(`[DEBUG][sync-meta-ads] Found URL in direct creative fetch: ${destinationUrl?.substring(0, 100)}`);
                  } else if (creativeData.object_story_spec?.video_data?.call_to_action?.value?.link) {
                    destinationUrl = creativeData.object_story_spec.video_data.call_to_action.value.link;
                    console.log(`[DEBUG][sync-meta-ads] Found URL in video CTA from direct fetch: ${destinationUrl?.substring(0, 100)}`);
                  }
                  
                  // Try effective_object_story_id (page post) if still no URL
                  if (!destinationUrl && creativeData.effective_object_story_id) {
                    console.log(`[DEBUG][sync-meta-ads] Trying effective_object_story_id: ${creativeData.effective_object_story_id}`);
                    try {
                      const postUrl = `https://graph.facebook.com/v22.0/${creativeData.effective_object_story_id}?fields=call_to_action,link&access_token=${access_token}`;
                      const postResponse = await fetch(postUrl);
                      const postData = await postResponse.json();
                      
                      if (!postData.error) {
                        console.log(`[DEBUG][sync-meta-ads] Page post data:`, JSON.stringify(postData, null, 2).substring(0, 500));
                        destinationUrl = postData.link || postData.call_to_action?.value?.link || null;
                        if (destinationUrl) {
                          console.log(`[DEBUG][sync-meta-ads] Found URL from page post: ${destinationUrl?.substring(0, 100)}`);
                        }
                      }
                    } catch (postErr) {
                      console.log(`[DEBUG][sync-meta-ads] Error fetching page post: ${postErr}`);
                    }
                  }
                }
              } catch (creativeErr) {
                console.log(`[DEBUG][sync-meta-ads] Error fetching creative directly: ${creativeErr}`);
              }
            }
            
            // Parse asset_feed_spec for dynamic creatives
            if (creative.asset_feed_spec) {
              const feedSpec = creative.asset_feed_spec;
              creativeType = 'dynamic';
              
              console.log(`[DEBUG][sync-meta-ads] Creative ${creative.id} has asset_feed_spec:`, {
                hasVideos: !!(feedSpec.videos?.length),
                videoCount: feedSpec.videos?.length || 0,
                hasBodies: !!(feedSpec.bodies?.length),
                hasLinkUrls: !!(feedSpec.link_urls?.length),
                linkUrlsCount: feedSpec.link_urls?.length || 0
              });
              
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
              
              // ENHANCED: Check for videos in asset_feed_spec
              if (feedSpec.videos && feedSpec.videos.length > 0) {
                creativeType = 'video';
                // Extract video_id from first video in the array
                const firstVideo = feedSpec.videos[0];
                videoId = firstVideo.video_id || firstVideo.id || videoId;
                console.log(`[DEBUG][sync-meta-ads] Extracted video_id from asset_feed_spec.videos: ${videoId}`);
                
                // Also log the full video object for debugging
                console.log(`[DEBUG][sync-meta-ads] asset_feed_spec.videos[0]:`, JSON.stringify(firstVideo, null, 2).substring(0, 300));
              }
              
              // Extract destination URLs from dynamic creatives
              if (!destinationUrl && feedSpec.link_urls && feedSpec.link_urls.length > 0) {
                const linkUrl = feedSpec.link_urls[0];
                destinationUrl = linkUrl.website_url || linkUrl.display_url || null;
                console.log(`[DEBUG][sync-meta-ads] Extracted destination URL from asset_feed_spec.link_urls: ${destinationUrl?.substring(0, 100)}`);
              }
              
              // ENHANCED: Check for CTAs in asset_feed_spec that may have URLs
              if (!destinationUrl && feedSpec.call_to_actions && feedSpec.call_to_actions.length > 0) {
                for (const cta of feedSpec.call_to_actions) {
                  if (cta.value?.link) {
                    destinationUrl = cta.value.link;
                    console.log(`[DEBUG][sync-meta-ads] Extracted destination URL from asset_feed_spec.call_to_actions: ${destinationUrl?.substring(0, 100)}`);
                    break;
                  }
                }
              }
            }

            // Log final URL extraction summary
            console.log(`[DEBUG][sync-meta-ads] Ad ${ad.id} final URL extraction:`, {
              destinationUrl: destinationUrl?.substring(0, 100) || 'NONE',
              creativeType,
              source: destinationUrl ? (
                creative.object_story_spec?.link_data?.link ? 'link_data.link' :
                creative.object_story_spec?.link_data?.call_to_action?.value?.link ? 'link_data.cta' :
                creative.object_story_spec?.video_data?.call_to_action?.value?.link ? 'video_data.cta' :
                creative.asset_feed_spec?.link_urls ? 'asset_feed_spec.link_urls' : 'unknown'
              ) : 'none'
            });

            // Extract refcode from destination URL - ENHANCED to support multiple formats
            if (destinationUrl) {
              try {
                const url = new URL(destinationUrl);

                // Check multiple common refcode parameter names (case-insensitive via loop)
                const refcodeParams = ['refcode', 'refCode', 'REFCODE', 'ref_code', 'ref', 'source', 'utm_content'];
                for (const param of refcodeParams) {
                  const value = url.searchParams.get(param);
                  if (value) {
                    extractedRefcode = value;
                    refcodeSource = `url_param_${param}`;
                    console.log(`[REFCODE] Extracted "${extractedRefcode}" from param "${param}" in ${destinationUrl}`);
                    break;
                  }
                }

                // If no param found and this is an ActBlue URL, try extracting from path
                // ActBlue URLs often have format: /donate/campaign-name or /contribute/xxx
                if (!extractedRefcode && destinationUrl.includes('actblue.com')) {
                  // Try to get refcode from the final path segment after /donate/ or /contribute/
                  const pathMatch = url.pathname.match(/\/(donate|contribute)\/([^\/\?]+)/i);
                  if (pathMatch && pathMatch[2]) {
                    // This is the page name, not necessarily the refcode
                    // Only use if it looks like a refcode (alphanumeric with optional numbers)
                    const potentialRefcode = pathMatch[2];
                    if (/^[a-z]+\d{2,}$/i.test(potentialRefcode)) {
                      // Looks like a campaign refcode pattern (e.g., gaza0108, img0108)
                      extractedRefcode = potentialRefcode;
                      refcodeSource = 'actblue_path';
                      console.log(`[REFCODE] Extracted "${extractedRefcode}" from ActBlue path in ${destinationUrl}`);
                    }
                  }
                }
              } catch (urlErr) {
                // URL parsing failed, try regex for common patterns
                const refcodeMatch = destinationUrl.match(/[?&](refcode|ref_code|ref|source)=([^&]+)/i);
                if (refcodeMatch) {
                  extractedRefcode = refcodeMatch[2];
                  refcodeSource = 'url_regex';
                  console.log(`[REFCODE] Extracted "${extractedRefcode}" via regex from ${destinationUrl}`);
                }
              }
            }
            
            // Only store if we have some creative content
            if (primaryText || headline || description || videoId) {
              // PHASE 3: Fetch high-res thumbnail and video source URL from Meta
              let highResThumbnail = thumbnailUrl;
              let mediaSourceUrl: string | null = null;
              
              if (videoId) {
                try {
                  console.log(`[VIDEO][DEBUG] Fetching video details for video_id: ${videoId}`);
                  
                  // Fetch video details including source URL and high-res picture
                  const videoDetailsUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=source,picture,thumbnails{uri,height,width}&access_token=${access_token}`;
                  const videoDetailsResponse = await fetch(videoDetailsUrl);
                  const videoDetails = await videoDetailsResponse.json();
                  
                  console.log(`[VIDEO][DEBUG] Video ${videoId} API response:`, JSON.stringify(videoDetails, null, 2).substring(0, 500));
                  
                  if (videoDetails.error) {
                    console.log(`[VIDEO][DEBUG] ⚠️ API Error for ${videoId}: ${videoDetails.error.message} (code: ${videoDetails.error.code})`);
                    
                    // Try alternate approach: fetch without 'source' field (may be restricted)
                    console.log(`[VIDEO][DEBUG] Trying alternate endpoint without source field...`);
                    const altUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=picture,thumbnails{uri,height,width}&access_token=${access_token}`;
                    const altResponse = await fetch(altUrl);
                    const altData = await altResponse.json();
                    
                    if (!altData.error) {
                      console.log(`[VIDEO][DEBUG] Alternate endpoint succeeded for ${videoId}`);
                      if (altData.thumbnails?.data?.length > 0) {
                        const sortedThumbs = altData.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                        highResThumbnail = sortedThumbs[0]?.uri || altData.picture || thumbnailUrl;
                      } else if (altData.picture) {
                        highResThumbnail = altData.picture;
                      }
                    }
                  } else {
                    // Get the actual playable video source URL
                    if (videoDetails.source) {
                      mediaSourceUrl = videoDetails.source;
                      console.log(`[VIDEO][DEBUG] ✓ Got source URL for video ${videoId}: ${videoDetails.source.substring(0, 80)}...`);
                    } else {
                      console.log(`[VIDEO][DEBUG] ⚠️ No source field in response for ${videoId}. Available fields:`, Object.keys(videoDetails));
                    }
                    
                    // Get highest resolution thumbnail
                    if (videoDetails.thumbnails?.data?.length > 0) {
                      const sortedThumbs = videoDetails.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                      highResThumbnail = sortedThumbs[0]?.uri || videoDetails.picture || thumbnailUrl;
                      console.log(`[VIDEO][DEBUG] Got high-res thumbnail for video ${videoId}`);
                    } else if (videoDetails.picture) {
                      highResThumbnail = videoDetails.picture;
                    }
                  }
                } catch (videoErr) {
                  console.error(`[VIDEO][DEBUG] Exception fetching video details for ${videoId}:`, videoErr);
                }
              } else if (creative.id) {
                // For image creatives, try to get a higher resolution thumbnail
                try {
                  const creativeDetailsUrl = `https://graph.facebook.com/v22.0/${creative.id}?fields=thumbnail_url,image_url,object_story_spec&thumbnail_height=720&access_token=${access_token}`;
                  const creativeDetailsResponse = await fetch(creativeDetailsUrl);
                  const creativeDetails = await creativeDetailsResponse.json();
                  
                  if (!creativeDetails.error) {
                    highResThumbnail = creativeDetails.image_url || creativeDetails.thumbnail_url || highResThumbnail;
                    
                    // Also check object_story_spec for full-size image
                    if (creativeDetails.object_story_spec?.link_data?.picture) {
                      highResThumbnail = creativeDetails.object_story_spec.link_data.picture;
                    }
                  }
                } catch (creativeErr) {
                  console.error(`Error fetching creative details for ${creative.id}:`, creativeErr);
                }
              }

              // Fetch ad-level insights for performance metrics - include video and social engagement metrics
              const adInsightsUrl = `https://graph.facebook.com/v22.0/${ad.id}/insights?fields=impressions,clicks,spend,actions,action_values,ctr,frequency,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,purchase_roas,website_purchase_roas,video_play_actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions,post_engagement,post_reactions_like_total,post_reactions_love_total,post_reactions_haha_total,post_reactions_wow_total,post_reactions_sorry_total,post_reactions_anger_total,comment,share&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&action_attribution_windows=["7d_click","1d_view"]&access_token=${access_token}`;
              
              let impressions = 0, clicks = 0, spend = 0, conversions = 0, conversionValue = 0, ctr = 0;
              let frequency = 0, qualityRanking = '', engagementRanking = '', conversionRanking = '';
              
              // Video engagement metrics
              let videoPlays = 0, videoThruplay = 0, videoP25 = 0, videoP50 = 0, videoP75 = 0, videoP100 = 0;
              let videoAvgWatchTime = 0;
              
              // Social engagement metrics
              let reactionsTotal = 0, reactionsLike = 0, reactionsLove = 0, reactionsOther = 0;
              let commentsCount = 0, sharesCount = 0, postEngagement = 0;
              
              try {
                const adInsightsResponse = await fetch(adInsightsUrl);
                const adInsightsData = await adInsightsResponse.json();
                
                if (!adInsightsData.error && adInsightsData.data && adInsightsData.data.length > 0) {
                  const insight = adInsightsData.data[0];
                  impressions = parseInt(insight.impressions) || 0;
                  clicks = parseInt(insight.clicks) || 0;
                  spend = parseFloat(insight.spend) || 0;
                  // PHASE 1 FIX: Meta returns CTR as percentage (e.g., 2.5 for 2.5%), normalize to decimal (0.025)
                  ctr = (parseFloat(insight.ctr) || 0) / 100;
                  frequency = parseFloat(insight.frequency) || 0;
                  qualityRanking = insight.quality_ranking || '';
                  engagementRanking = insight.engagement_rate_ranking || '';
                  conversionRanking = insight.conversion_rate_ranking || '';
                  
                  // Extract video engagement metrics
                  // FIXED: Meta returns action_type as 'video_view' OR 'video_thruplay' depending on campaign type
                  // Try both action types for reliable extraction
                  if (insight.video_play_actions) {
                    const playAction = insight.video_play_actions.find((a: any) => 
                      a.action_type === 'video_view' || a.action_type === 'video_play'
                    );
                    videoPlays = parseInt(playAction?.value) || 0;
                  }
                  if (insight.video_thruplay_watched_actions) {
                    // Try 'video_view' first (common), then 'video_thruplay' (explicit)
                    let thruplayAction = insight.video_thruplay_watched_actions.find((a: any) => 
                      a.action_type === 'video_view'
                    );
                    if (!thruplayAction) {
                      thruplayAction = insight.video_thruplay_watched_actions.find((a: any) => 
                        a.action_type === 'video_thruplay'
                      );
                    }
                    // Fallback: if array has exactly one element, use it
                    if (!thruplayAction && insight.video_thruplay_watched_actions.length === 1) {
                      thruplayAction = insight.video_thruplay_watched_actions[0];
                    }
                    videoThruplay = parseInt(thruplayAction?.value) || 0;
                  }
                  if (insight.video_p25_watched_actions) {
                    const p25Action = insight.video_p25_watched_actions.find((a: any) => 
                      a.action_type === 'video_view' || a.action_type === 'video_p25_watched'
                    ) || insight.video_p25_watched_actions[0];
                    videoP25 = parseInt(p25Action?.value) || 0;
                  }
                  if (insight.video_p50_watched_actions) {
                    const p50Action = insight.video_p50_watched_actions.find((a: any) => 
                      a.action_type === 'video_view' || a.action_type === 'video_p50_watched'
                    ) || insight.video_p50_watched_actions[0];
                    videoP50 = parseInt(p50Action?.value) || 0;
                  }
                  if (insight.video_p75_watched_actions) {
                    const p75Action = insight.video_p75_watched_actions.find((a: any) => 
                      a.action_type === 'video_view' || a.action_type === 'video_p75_watched'
                    ) || insight.video_p75_watched_actions[0];
                    videoP75 = parseInt(p75Action?.value) || 0;
                  }
                  if (insight.video_p100_watched_actions) {
                    const p100Action = insight.video_p100_watched_actions.find((a: any) => 
                      a.action_type === 'video_view' || a.action_type === 'video_p100_watched'
                    ) || insight.video_p100_watched_actions[0];
                    videoP100 = parseInt(p100Action?.value) || 0;
                  }
                  if (insight.video_avg_time_watched_actions) {
                    const avgTimeAction = insight.video_avg_time_watched_actions.find((a: any) => 
                      a.action_type === 'video_view' || a.action_type === 'video_avg_time_watched'
                    ) || insight.video_avg_time_watched_actions[0];
                    videoAvgWatchTime = parseFloat(avgTimeAction?.value) || 0;
                  }
                  
                  // Extract social engagement metrics
                  postEngagement = parseInt(insight.post_engagement) || 0;
                  reactionsLike = parseInt(insight.post_reactions_like_total) || 0;
                  reactionsLove = parseInt(insight.post_reactions_love_total) || 0;
                  const hahaReactions = parseInt(insight.post_reactions_haha_total) || 0;
                  const wowReactions = parseInt(insight.post_reactions_wow_total) || 0;
                  const sorryReactions = parseInt(insight.post_reactions_sorry_total) || 0;
                  const angerReactions = parseInt(insight.post_reactions_anger_total) || 0;
                  reactionsOther = hahaReactions + wowReactions + sorryReactions + angerReactions;
                  reactionsTotal = reactionsLike + reactionsLove + reactionsOther;
                  commentsCount = parseInt(insight.comment) || 0;
                  sharesCount = parseInt(insight.share) || 0;
                  
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
                  
                  // PHASE 2 FIX: Use Meta's purchase_roas for accurate ROAS matching Ads Manager
                  const metaPurchaseRoas = insight.purchase_roas?.[0]?.value || insight.website_purchase_roas?.[0]?.value;
                  if (metaPurchaseRoas) {
                    // Meta returns ROAS directly (e.g., 2.5 means $2.50 return per $1 spent)
                    conversionValue = parseFloat(metaPurchaseRoas) * (parseFloat(insight.spend) || 0);
                  }
                }
              } catch (insightErr) {
                console.error(`Error fetching insights for ad ${ad.id}:`, insightErr);
              }
              
              // PHASE 2: Extract image hash if available from object_story_spec
              let imageHash: string | null = null;
              if (creative.object_story_spec?.link_data?.image_hash) {
                imageHash = creative.object_story_spec.link_data.image_hash;
              } else if (creative.object_story_spec?.photo_data?.image_hash) {
                imageHash = creative.object_story_spec.photo_data.image_hash;
              }
              
              // Determine media type more accurately
              let mediaType = 'unknown';
              if (videoId) {
                mediaType = 'video';
              } else if (imageHash || thumbnailUrl) {
                mediaType = 'image';
              } else if (creative.asset_feed_spec) {
                mediaType = 'carousel';
              }
              
              // PHASE 2 FIX: Calculate ROAS from Meta's purchase_roas when available
              const creativeRoas = spend > 0 ? conversionValue / spend : 0;
              
              // Store creative insight with enhanced fields including video/social engagement metrics
              // PIPELINE FIX: Only include performance metrics if we actually received data (avoid overwriting with zeros)
              const hasPerformanceData = impressions > 0 || clicks > 0 || spend > 0;
              
              const baseCreativeData: Record<string, any> = {
                organization_id,
                campaign_id: campaign.id,
                ad_id: ad.id,
                creative_id: creative.id,
                primary_text: primaryText || null,
                headline: headline || null,
                description: description || null,
                call_to_action_type: callToActionType || null,
                video_url: videoId ? `https://www.facebook.com/video.php?v=${videoId}` : null,
                thumbnail_url: highResThumbnail, // High-res thumbnail
                creative_type: creativeType,
                // PHASE 2: Store media identifiers for video/image pipeline
                meta_video_id: videoId || null,
                meta_image_hash: imageHash,
                media_type: mediaType,
                // PHASE 3: Store actual playable video source URL
                media_source_url: mediaSourceUrl,
                // NEW: Store destination URL and extracted refcode for attribution matching
                destination_url: destinationUrl,
                extracted_refcode: extractedRefcode,
                refcode_source: refcodeSource,
                // PHASE 3: Track first seen for time-aware model
                first_seen_at: new Date().toISOString(),
              };
              
              // Only include performance metrics if we have actual data from Meta API
              // This prevents overwriting existing metrics with zeros when Meta returns empty insights
              if (hasPerformanceData) {
                baseCreativeData.impressions = impressions;
                baseCreativeData.clicks = clicks;
                baseCreativeData.spend = spend;
                baseCreativeData.conversions = conversions;
                baseCreativeData.conversion_value = conversionValue;
                baseCreativeData.ctr = ctr; // Stored as decimal (0.025 = 2.5%)
                baseCreativeData.roas = creativeRoas; // Uses conversion_value which may come from purchase_roas
                // Video engagement metrics
                baseCreativeData.video_plays = videoPlays;
                baseCreativeData.video_thruplay = videoThruplay;
                baseCreativeData.video_p25 = videoP25;
                baseCreativeData.video_p50 = videoP50;
                baseCreativeData.video_p75 = videoP75;
                baseCreativeData.video_p100 = videoP100;
                baseCreativeData.video_avg_watch_time_seconds = videoAvgWatchTime;
                // Social engagement metrics
                baseCreativeData.reactions_total = reactionsTotal;
                baseCreativeData.reactions_like = reactionsLike;
                baseCreativeData.reactions_love = reactionsLove;
                baseCreativeData.reactions_other = reactionsOther;
                baseCreativeData.comments = commentsCount;
                baseCreativeData.shares = sharesCount;
                baseCreativeData.post_engagement = postEngagement;
                // Quality rankings
                baseCreativeData.frequency = frequency;
                baseCreativeData.quality_ranking = qualityRanking;
                baseCreativeData.engagement_rate_ranking = engagementRanking;
                baseCreativeData.conversion_rate_ranking = conversionRanking;
                
                console.log(`[CREATIVE ${ad.id}] Storing performance: ${impressions} imp, ${clicks} clicks, $${spend.toFixed(2)} spend`);
              } else {
                console.log(`[CREATIVE ${ad.id}] No performance data from Meta - preserving existing metrics`);
              }
              
              const { error: creativeError } = await supabase
                .from('meta_creative_insights')
                .upsert(baseCreativeData, {
                  onConflict: 'organization_id,campaign_id,ad_id'
                });
              
              if (creativeError) {
                console.error(`Error storing creative insight for ad ${ad.id}:`, creativeError);
              } else {
                creativesProcessed++;
                
                // === NEW: Store individual creative variations ===
                // Parse and store individual text variations from asset_feed_spec
                if (creative.asset_feed_spec) {
                  const feedSpec = creative.asset_feed_spec;
                  const variationsToInsert: any[] = [];
                  const syncedAt = new Date().toISOString();
                  
                  // Store body (primary text) variations
                  if (feedSpec.bodies && feedSpec.bodies.length > 0) {
                    for (let i = 0; i < feedSpec.bodies.length; i++) {
                      variationsToInsert.push({
                        organization_id,
                        ad_id: ad.id,
                        asset_type: 'body',
                        asset_index: i,
                        asset_text: feedSpec.bodies[i].text || null,
                        synced_at: syncedAt,
                      });
                    }
                  }
                  
                  // Store title (headline) variations
                  if (feedSpec.titles && feedSpec.titles.length > 0) {
                    for (let i = 0; i < feedSpec.titles.length; i++) {
                      variationsToInsert.push({
                        organization_id,
                        ad_id: ad.id,
                        asset_type: 'title',
                        asset_index: i,
                        asset_text: feedSpec.titles[i].text || null,
                        synced_at: syncedAt,
                      });
                    }
                  }
                  
                  // Store description variations
                  if (feedSpec.descriptions && feedSpec.descriptions.length > 0) {
                    for (let i = 0; i < feedSpec.descriptions.length; i++) {
                      variationsToInsert.push({
                        organization_id,
                        ad_id: ad.id,
                        asset_type: 'description',
                        asset_index: i,
                        asset_text: feedSpec.descriptions[i].text || null,
                        synced_at: syncedAt,
                      });
                    }
                  }
                  
                  if (variationsToInsert.length > 0) {
                    console.log(`[VARIATIONS] Storing ${variationsToInsert.length} text variations for ad ${ad.id}`);
                    const { error: varError } = await supabase
                      .from('meta_creative_variations')
                      .upsert(variationsToInsert, {
                        onConflict: 'organization_id,ad_id,asset_type,asset_index'
                      });
                    
                    if (varError) {
                      console.error(`[VARIATIONS] Error storing variations for ad ${ad.id}:`, varError);
                    } else {
                      console.log(`[VARIATIONS] Stored ${variationsToInsert.length} variations successfully`);
                    }
                  }
                }
                
                // Store refcode mapping for deterministic attribution
                if (extractedRefcode) {
                  const now = new Date().toISOString();
                  
                  // 1. Update current pointer in refcode_mappings
                  const { error: refcodeError } = await supabase
                    .from('refcode_mappings')
                    .upsert({
                      organization_id,
                      refcode: extractedRefcode,
                      platform: 'meta',
                      campaign_id: campaign.id,
                      campaign_name: campaign.name,
                      ad_id: ad.id,
                      ad_name: ad.name || null,
                      creative_id: creative.id,
                      creative_name: creative.name || null,
                      landing_page: destinationUrl,
                      updated_at: now,
                    }, {
                      onConflict: 'organization_id,refcode',
                      ignoreDuplicates: false
                    });
                  
                  if (refcodeError) {
                    console.error(`[REFCODE MAPPING] Error storing refcode mapping for ${extractedRefcode}:`, refcodeError);
                  } else {
                    console.log(`[REFCODE MAPPING] Stored/updated mapping: refcode="${extractedRefcode}" -> ad_id=${ad.id}`);
                  }
                  
                  // 2. Insert into history table for versioned attribution
                  const { error: historyError } = await supabase
                    .from('refcode_mapping_history')
                    .upsert({
                      organization_id,
                      refcode: extractedRefcode,
                      ad_id: ad.id,
                      campaign_id: campaign.id,
                      creative_id: creative.id,
                      landing_page: destinationUrl,
                      last_seen_at: now,
                      is_active: true,
                    }, {
                      onConflict: 'organization_id,refcode,ad_id',
                      ignoreDuplicates: false
                    });
                  
                  if (historyError) {
                    console.error(`[REFCODE HISTORY] Error:`, historyError);
                  }
                }
              }
            }
          }
        }
      } catch (creativeErr) {
        console.error(`Error fetching creatives for campaign ${campaign.id}:`, creativeErr);
      }
      
      // ========== ENHANCED: Fetch demographic breakdown (age + gender) ==========
      try {
        console.log(`Fetching demographic breakdown for campaign ${campaign.id}`);
        
        const demographicUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,actions,action_values&breakdowns=age,gender&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&access_token=${access_token}`;
        
        const demographicResponse = await fetch(demographicUrl);
        const demographicData = await demographicResponse.json();
        
        if (!demographicData.error && demographicData.data && demographicData.data.length > 0) {
          // Build demographic breakdown object
          const demographics: Record<string, any> = {};
          
          for (const row of demographicData.data) {
            const key = `${row.age || 'unknown'}_${row.gender || 'unknown'}`;
            
            let conversions = 0;
            if (row.actions) {
              const convAction = row.actions.find((a: any) => 
                a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
              );
              if (convAction) conversions = parseInt(convAction.value) || 0;
            }
            
            demographics[key] = {
              age: row.age,
              gender: row.gender,
              impressions: parseInt(row.impressions) || 0,
              clicks: parseInt(row.clicks) || 0,
              spend: parseFloat(row.spend) || 0,
              conversions,
            };
          }
          
          // Update campaign metrics with demographic data
          if (Object.keys(demographics).length > 0) {
            demographicRecords += Object.keys(demographics).length;
            console.log(`Captured ${Object.keys(demographics).length} demographic breakdowns for campaign ${campaign.id}`);
          }
        }
      } catch (demoErr) {
        console.error(`Error fetching demographics for campaign ${campaign.id}:`, demoErr);
      }
      
      // ========== ENHANCED: Fetch placement breakdown ==========
      let placementData: Record<string, any> = {};
      try {
        console.log(`Fetching placement breakdown for campaign ${campaign.id}`);
        
        const placementUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,actions&breakdowns=publisher_platform,device_platform&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&access_token=${access_token}`;
        
        const placementResponse = await fetch(placementUrl);
        const placementResult = await placementResponse.json();
        
        if (!placementResult.error && placementResult.data && placementResult.data.length > 0) {
          for (const row of placementResult.data) {
            const key = `${row.publisher_platform || 'unknown'}_${row.device_platform || 'unknown'}`;
            
            placementData[key] = {
              publisher_platform: row.publisher_platform,
              device_platform: row.device_platform,
              impressions: parseInt(row.impressions) || 0,
              clicks: parseInt(row.clicks) || 0,
              spend: parseFloat(row.spend) || 0,
            };
          }
          
          if (Object.keys(placementData).length > 0) {
            placementRecords += Object.keys(placementData).length;
            console.log(`Captured ${Object.keys(placementData).length} placement breakdowns for campaign ${campaign.id}`);
          }
        }
      } catch (placementErr) {
        console.error(`Error fetching placement data for campaign ${campaign.id}:`, placementErr);
      }
      
      // ========== Original: Fetch campaign-level insights with enhanced fields ==========
      const insightsUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,reach,actions,action_values,cpc,cpm,ctr,frequency,cost_per_action_type&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&time_increment=1&access_token=${access_token}`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      if (insightsData.error) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, insightsData.error.message);
        continue;
      }

      const insights = insightsData.data || [];
      
      // Log data freshness for debugging
      if (insights.length === 0) {
        console.warn(`[DATA FRESHNESS] Campaign ${campaign.id} (${campaign.name}): No insights returned for date range ${dateRanges.since} to ${dateRanges.until}`);
        campaignsWithoutDataIds.push(campaign.id);
      } else {
        campaignsWithDataIds.push(campaign.id);
        const dates = insights.map((i: any) => i.date_start).sort();
        const campaignEarliestDate = dates[0];
        const campaignLatestDate = dates[dates.length - 1];
        const expectedEndDate = dateRanges.until;
        console.log(`[DATA FRESHNESS] Campaign ${campaign.id} (${campaign.name}): ${insights.length} days of data, range: ${campaignEarliestDate} to ${campaignLatestDate}, expected: ${expectedEndDate}`);
        
        // Update global date tracking
        if (!earliestDataDate || campaignEarliestDate < earliestDataDate) {
          earliestDataDate = campaignEarliestDate;
        }
        if (!latestDataDate || campaignLatestDate > latestDataDate) {
          latestDataDate = campaignLatestDate;
        }
        
        // Warn if data is more than 2 days behind expected end date
        const latestDateObj = new Date(campaignLatestDate);
        const expectedDateObj = new Date(expectedEndDate);
        const daysBehind = Math.floor((expectedDateObj.getTime() - latestDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (daysBehind > 2) {
          console.warn(`[DATA GAP] Campaign ${campaign.id}: Data is ${daysBehind} days behind expected date. Meta API may have reporting delay or campaign is paused.`);
        }
      }
      
      // Find attribution mapping for this campaign
      const mapping = attributionMappings?.find(m => m.meta_campaign_id === campaign.id);
      
      // Aggregate demographic data for the campaign period
      let campaignDemographics: Record<string, any> = {};
      
      // Fetch demographic breakdown for campaign-level aggregation
      try {
        const demoAggUrl = `https://graph.facebook.com/v22.0/${campaign.id}/insights?fields=impressions,clicks,spend,actions&breakdowns=age,gender&time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&access_token=${access_token}`;
        const demoAggResponse = await fetch(demoAggUrl);
        const demoAggData = await demoAggResponse.json();
        
        if (!demoAggData.error && demoAggData.data) {
          for (const row of demoAggData.data) {
            const key = `${row.age || 'unknown'}_${row.gender || 'unknown'}`;
            if (!campaignDemographics[key]) {
              campaignDemographics[key] = {
                age: row.age,
                gender: row.gender,
                impressions: 0,
                clicks: 0,
                spend: 0,
              };
            }
            campaignDemographics[key].impressions += parseInt(row.impressions) || 0;
            campaignDemographics[key].clicks += parseInt(row.clicks) || 0;
            campaignDemographics[key].spend += parseFloat(row.spend) || 0;
          }
        }
      } catch (err) {
        console.error(`Error aggregating demographics for campaign ${campaign.id}:`, err);
      }
      
      // Store daily metrics
      for (const insight of insights) {
        totalInsightRecords++;
        
        // Extract conversions from actions
        let conversions = 0;
        let conversionValue = 0;
        let costPerResult = 0;

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
        
        // Extract cost per result
        if (insight.cost_per_action_type) {
          const cprAction = insight.cost_per_action_type.find((a: any) => 
            a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
          );
          if (cprAction) {
            costPerResult = parseFloat(cprAction.value) || 0;
          }
        }
        
        // Determine dominant placement from placement data
        let dominantPlacement = null;
        let dominantDevice = null;
        if (Object.keys(placementData).length > 0) {
          const sortedPlacements = Object.values(placementData).sort((a: any, b: any) => b.impressions - a.impressions);
          if (sortedPlacements.length > 0) {
            dominantPlacement = (sortedPlacements[0] as any).publisher_platform;
            dominantDevice = (sortedPlacements[0] as any).device_platform;
          }
        }

        // PHASE 1 FIX: Normalize CTR to decimal and use Meta's purchase_roas
        const normalizedCtr = (parseFloat(insight.ctr) || 0) / 100;
        
        // PHASE 2 FIX: Use Meta's calculated purchase_roas when available (matches Ads Manager)
        const metaPurchaseRoas = insight.purchase_roas?.[0]?.value || insight.website_purchase_roas?.[0]?.value;
        const calculatedRoas = conversionValue > 0 && parseFloat(insight.spend) > 0 
          ? conversionValue / parseFloat(insight.spend) 
          : 0;
        const finalRoas = metaPurchaseRoas ? parseFloat(metaPurchaseRoas) : calculatedRoas;
        
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
            ctr: normalizedCtr, // Now stored as decimal (0.03 = 3%)
            conversions,
            conversion_value: conversionValue,
            roas: finalRoas, // Uses Meta's purchase_roas when available
            // ENHANCED FIELDS
            frequency: parseFloat(insight.frequency) || null,
            cost_per_result: costPerResult || null,
            placement: dominantPlacement,
            device_platform: dominantDevice,
            audience_demographics: Object.keys(campaignDemographics).length > 0 ? campaignDemographics : null,
            synced_at: new Date().toISOString(),
          }, {
            onConflict: 'organization_id,campaign_id,ad_set_id,ad_id,date'
          });

        if (metricsError) {
          console.error(`Error storing metrics for ${campaign.id} on ${insight.date_start}:`, metricsError);
        }

        // PHASE 1 FIX: Create attribution touchpoints for ALL clicks (not just when mapping exists)
        // This ensures we capture ad touchpoints even before refcode mappings are created
        const clicks = parseInt(insight.clicks) || 0;
        const impressions = parseInt(insight.impressions) || 0;
        
        // DEPRECATED: We no longer create per-donor touchpoints from aggregated Meta data.
        // The Meta Marketing API only provides aggregated campaign metrics (total clicks, impressions).
        // Creating "touchpoints" without donor_email leads to fake attribution that cannot be traced
        // to actual individuals. This was misleading users with false precision.
        //
        // Instead, Meta data is stored ONLY as:
        // 1. meta_campaign_insights (campaign-level aggregated metrics)
        // 2. meta_ad_metrics (ad-level aggregated metrics)  
        // 3. meta_creative_insights (creative-level aggregated metrics)
        //
        // Real per-donor touchpoints can only be created when we have actual donor identity:
        // - ActBlue webhooks with refcode/click_id/fbclid → deterministic attribution
        // - SMS events with phone_hash → identity resolution to donor
        //
        // See: Attribution System Audit (2026-01-03) for full rationale.
        
        if (clicks > 0) {
          console.log(`[DEPRECATED] Skipping fake touchpoint creation for campaign ${campaign.id} on ${insight.date_start} (${clicks} clicks). Meta data is aggregated, not per-donor.`);
        }
      }
    }

    // ========== NEW: Fetch AD-LEVEL daily metrics for accurate ROAS ==========
    // This fetches metrics at the ad level (not campaign level) with daily granularity
    let adLevelRecords = 0;

    console.log(`[AD-LEVEL METRICS] Starting ad-level insights fetch for date range ${dateRanges.since} to ${dateRanges.until}`);

    try {
      // Fetch account-level insights broken down by ad with daily granularity
      // UPDATED: Added inline_link_clicks, outbound_clicks, and inline_link_click_ctr for Link CTR metrics
      // inline_link_clicks is the most reliable source for conversion campaigns
      const adInsightsUrl = `https://graph.facebook.com/v22.0/${ad_account_id}/insights?` +
        `level=ad&` +
        `fields=ad_id,ad_name,campaign_id,adset_id,impressions,clicks,spend,reach,cpc,cpm,ctr,frequency,` +
        `inline_link_clicks,outbound_clicks,inline_link_click_ctr,` + // Link CTR metrics (inline_link_clicks is primary source)
        `actions,action_values,cost_per_action_type,purchase_roas,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&` +
        `time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&` +
        `time_increment=1&` + // Daily granularity
        `limit=500&` +
        `access_token=${access_token}`;

      console.log(`[AD-LEVEL METRICS] Fetching from Meta API...`);

      let nextUrl: string | null = adInsightsUrl;

      while (nextUrl) {
        const adInsightsRes: Response = await fetch(nextUrl);
        const adInsightsData: { error?: { message: string }; data?: any[]; paging?: { next?: string } } = await adInsightsRes.json();

        if (adInsightsData.error) {
          console.error(`[AD-LEVEL METRICS] Meta API error:`, adInsightsData.error.message);
          break;
        }

        const adInsights = adInsightsData.data || [];
        console.log(`[AD-LEVEL METRICS] Processing ${adInsights.length} ad-level insight records`);

        for (const insight of adInsights) {
          if (!insight.ad_id) {
            console.warn(`[AD-LEVEL METRICS] Skipping record without ad_id`);
            continue;
          }

          // Extract conversions from actions
          let conversions = 0;
          let conversionValue = 0;
          let costPerResult = 0;

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

          if (insight.cost_per_action_type) {
            const cprAction = insight.cost_per_action_type.find((a: any) =>
              a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
            );
            if (cprAction) costPerResult = parseFloat(cprAction.value) || 0;
          }

          // Get Meta's purchase_roas (matches Ads Manager)
          const metaRoas = insight.purchase_roas?.[0]?.value
            ? parseFloat(insight.purchase_roas[0].value)
            : null;

          // Normalize CTR to decimal (Meta returns as percentage)
          const normalizedCtr = (parseFloat(insight.ctr) || 0) / 100;

          // Extract Link CTR metrics with multi-source fallback
          // Priority: inline_link_clicks (most reliable) → outbound_clicks → actions:link_click
          let linkClicks = 0;
          
          // Try 1: inline_link_clicks (direct field from Meta - works for all campaign types)
          if (insight.inline_link_clicks) {
            linkClicks = parseInt(insight.inline_link_clicks) || 0;
          }
          
          // Try 2: outbound_clicks action array (traffic campaigns)
          if (linkClicks === 0 && insight.outbound_clicks) {
            const outboundAction = insight.outbound_clicks.find((a: any) => 
              a.action_type === 'outbound_click'
            );
            if (outboundAction) linkClicks = parseInt(outboundAction.value) || 0;
          }
          
          // Try 3: actions array with link_click type (conversion campaigns fallback)
          if (linkClicks === 0 && insight.actions) {
            const linkAction = insight.actions.find((a: any) => a.action_type === 'link_click');
            if (linkAction) linkClicks = parseInt(linkAction.value) || 0;
          }

          // Meta's inline_link_click_ctr is returned as percentage (e.g., 2.5 for 2.5%)
          const linkCtr = insight.inline_link_click_ctr 
            ? parseFloat(insight.inline_link_click_ctr) / 100 
            : (parseInt(insight.impressions) > 0 && linkClicks > 0
              ? linkClicks / parseInt(insight.impressions) 
              : null);

          // Look up creative_id from meta_creative_insights if we have it
          let creativeId: string | null = null;
          const { data: creativeMapping } = await supabase
            .from('meta_creative_insights')
            .select('creative_id')
            .eq('organization_id', organization_id)
            .eq('ad_id', insight.ad_id)
            .limit(1)
            .single();

          if (creativeMapping?.creative_id) {
            creativeId = creativeMapping.creative_id;
          }

          // Upsert to meta_ad_metrics_daily with link CTR metrics
          const { error: dailyError } = await supabase
            .from('meta_ad_metrics_daily')
            .upsert({
              organization_id,
              ad_account_id: ad_account_id.replace('act_', ''), // Store without prefix
              date: insight.date_start,
              ad_id: insight.ad_id,
              campaign_id: insight.campaign_id,
              adset_id: insight.adset_id || null,
              creative_id: creativeId,
              ad_name: insight.ad_name || null,
              spend: parseFloat(insight.spend) || 0,
              impressions: parseInt(insight.impressions) || 0,
              clicks: parseInt(insight.clicks) || 0,
              reach: parseInt(insight.reach) || 0,
              cpc: parseFloat(insight.cpc) || null,
              cpm: parseFloat(insight.cpm) || null,
              ctr: normalizedCtr || null,
              link_clicks: linkClicks, // NEW: Link clicks
              link_ctr: linkCtr, // NEW: Link CTR
              frequency: parseFloat(insight.frequency) || null,
              conversions,
              conversion_value: conversionValue,
              cost_per_result: costPerResult || null,
              meta_roas: metaRoas,
              quality_ranking: insight.quality_ranking || null,
              engagement_ranking: insight.engagement_rate_ranking || null,
              conversion_ranking: insight.conversion_rate_ranking || null,
              synced_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,ad_account_id,date,ad_id'
            });

          if (dailyError) {
            console.error(`[AD-LEVEL METRICS] Error storing ad ${insight.ad_id} on ${insight.date_start}:`, dailyError);
          } else {
            adLevelRecords++;
          }
        }

        // Handle pagination
        nextUrl = adInsightsData.paging?.next || null;
        if (nextUrl) {
          console.log(`[AD-LEVEL METRICS] Fetching next page...`);
        }
      }

      console.log(`[AD-LEVEL METRICS] Completed. Stored ${adLevelRecords} ad-level daily records.`);

    } catch (adLevelError) {
      console.error(`[AD-LEVEL METRICS] Error fetching ad-level insights:`, adLevelError);
    }

    // ========== ASSET-LEVEL BREAKDOWN: Fetch performance by text variation ==========
    // ENHANCED: Follows Gemini Pro's Meta API best practices:
    // - Separate API calls for each breakdown type (combining often fails)
    // - CPA-first ranking with CTR fallback
    // - Minimum 500 impressions threshold for reliable data
    // - Include reach and inline_link_clicks fields
    
    const MIN_IMPRESSIONS_THRESHOLD = 500; // Assets below this are excluded from ranking
    let variationBreakdownsProcessed = 0;
    
    try {
      console.log(`[ASSET BREAKDOWNS] Fetching asset-level performance breakdowns...`);
      console.log(`[ASSET BREAKDOWNS] Using minimum impressions threshold: ${MIN_IMPRESSIONS_THRESHOLD}`);
      
      // Meta supports breakdowns by body_asset, title_asset, description_asset for DCO ads
      // CRITICAL: Separate API calls per Gemini guidance (combining breakdowns often fails)
      const breakdownTypes = ['body_asset', 'title_asset', 'description_asset'] as const;
      
      for (const breakdownType of breakdownTypes) {
        try {
          // ENHANCED API FIELDS: Include reach and inline_link_clicks per Gemini guidance
          const assetBreakdownUrl = `https://graph.facebook.com/v22.0/${ad_account_id}/insights?` +
            `level=ad&` +
            `breakdowns=${breakdownType}&` +
            `fields=ad_id,impressions,spend,inline_link_clicks,actions,action_values,reach&` +
            `time_range={"since":"${dateRanges.since}","until":"${dateRanges.until}"}&` +
            `filtering=[{"field":"ad.effective_status","operator":"IN","value":["ACTIVE","PAUSED","ARCHIVED"]}]&` +
            `limit=500&` +
            `access_token=${access_token}`;
          
          console.log(`[ASSET BREAKDOWNS][${breakdownType}] Fetching...`);
          const breakdownRes = await fetch(assetBreakdownUrl);
          const breakdownData = await breakdownRes.json();
          
          // ENHANCED LOGGING: Log raw API response for debugging
          console.log(`[ASSET BREAKDOWNS][${breakdownType}] Raw API response:`, 
            JSON.stringify(breakdownData, null, 2).substring(0, 1500));
          
          if (breakdownData.error) {
            console.log(`[ASSET BREAKDOWNS][${breakdownType}] Error code: ${breakdownData.error.code}`);
            console.log(`[ASSET BREAKDOWNS][${breakdownType}] Error message: ${breakdownData.error.message}`);
            console.log(`[ASSET BREAKDOWNS][${breakdownType}] Error subcode: ${breakdownData.error.error_subcode || 'none'}`);
            console.log(`[ASSET BREAKDOWNS] Note: ${breakdownType} breakdown not available (may not have DCO ads)`);
            continue;
          }
          
          const breakdowns = breakdownData.data || [];
          console.log(`[ASSET BREAKDOWNS][${breakdownType}] Processing ${breakdowns.length} records`);
          
          let skippedLowImpressions = 0;
          
          for (const breakdown of breakdowns) {
            if (!breakdown.ad_id) continue;
            
            // The asset text is returned in the breakdown field name (e.g., body_asset, title_asset)
            const assetText = breakdown[breakdownType];
            if (!assetText) continue;
            
            // Map breakdown type to our asset_type
            const assetType = breakdownType === 'body_asset' ? 'body' 
              : breakdownType === 'title_asset' ? 'title' 
              : 'description';
            
            // Extract metrics - ENHANCED with reach and inline_link_clicks
            const impressions = parseInt(breakdown.impressions) || 0;
            const spend = parseFloat(breakdown.spend) || 0;
            const reach = parseInt(breakdown.reach) || 0;
            const inlineLinkClicks = parseInt(breakdown.inline_link_clicks) || 0;
            
            // ENHANCED: Check minimum impressions threshold
            if (impressions < MIN_IMPRESSIONS_THRESHOLD) {
              skippedLowImpressions++;
              continue; // Skip assets with insufficient data for reliable ranking
            }
            
            // Extract purchases (conversions) - ENHANCED per Gemini guidance
            let purchases = 0;
            if (breakdown.actions) {
              // Check multiple action types for purchases
              const purchaseAction = breakdown.actions.find((a: any) => 
                a.action_type === 'purchase' || 
                a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                a.action_type === 'lead' // Fallback for lead-gen campaigns
              );
              if (purchaseAction) purchases = parseInt(purchaseAction.value) || 0;
            }
            
            // Extract conversion value
            let conversionValue = 0;
            if (breakdown.action_values) {
              const valueAction = breakdown.action_values.find((a: any) => 
                a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
              );
              if (valueAction) conversionValue = parseFloat(valueAction.value) || 0;
            }
            
            // ENHANCED CALCULATIONS per Gemini guidance
            // CPA = spend / purchases (primary ranking metric, lower is better)
            const cpa = purchases > 0 ? spend / purchases : null;
            
            // CTR = inline_link_clicks / impressions * 100 (fallback metric, higher is better)
            const ctr = impressions > 0 ? inlineLinkClicks / impressions : null;
            
            // ROAS for reference
            const roas = spend > 0 ? conversionValue / spend : null;
            
            // Determine ranking method
            const rankingMethod = cpa !== null && cpa > 0 ? 'cpa' : 'ctr';
            
            // Legacy fields for backward compatibility
            const clicks = inlineLinkClicks; // Use link clicks as primary click metric
            const conversions = purchases;
            
            // Normalize asset text for matching (handle whitespace, encoding differences)
            const normalizedAssetText = assetText.trim().replace(/\s+/g, ' ').toLowerCase();
            
            // First try exact match
            let { data: matchedVariation, error: matchError } = await supabase
              .from('meta_creative_variations')
              .select('id, asset_text')
              .eq('organization_id', organization_id)
              .eq('ad_id', breakdown.ad_id)
              .eq('asset_type', assetType)
              .eq('asset_text', assetText)
              .single();
            
            // If exact match fails, try normalized text matching
            if (!matchedVariation && !matchError) {
              // Get all variations for this ad/type and find best match
              const { data: allVariations } = await supabase
                .from('meta_creative_variations')
                .select('id, asset_text')
                .eq('organization_id', organization_id)
                .eq('ad_id', breakdown.ad_id)
                .eq('asset_type', assetType);
              
              if (allVariations && allVariations.length > 0) {
                // Try normalized match
                matchedVariation = allVariations.find(v => {
                  if (!v.asset_text) return false;
                  const normalizedStored = v.asset_text.trim().replace(/\s+/g, ' ').toLowerCase();
                  return normalizedStored === normalizedAssetText;
                }) || null;
                
                // If still no match, try prefix matching (first 100 chars)
                if (!matchedVariation && normalizedAssetText.length > 50) {
                  const prefix = normalizedAssetText.slice(0, 100);
                  matchedVariation = allVariations.find(v => {
                    if (!v.asset_text) return false;
                    const normalizedStored = v.asset_text.trim().replace(/\s+/g, ' ').toLowerCase();
                    return normalizedStored.startsWith(prefix) || prefix.startsWith(normalizedStored.slice(0, 100));
                  }) || null;
                }
              }
            }
            
            if (matchedVariation) {
              // ENHANCED: Update with new CPA/ranking fields
              const { error: updateError } = await supabase
                .from('meta_creative_variations')
                .update({
                  impressions,
                  clicks,
                  spend,
                  conversions,
                  conversion_value: conversionValue,
                  ctr,
                  link_clicks: inlineLinkClicks,
                  link_ctr: ctr, // Link CTR is same as our calculated CTR
                  roas,
                  // NEW FIELDS for CPA-first ranking
                  cpa,
                  purchases,
                  reach,
                  inline_link_clicks: inlineLinkClicks,
                  ranking_method: rankingMethod,
                  is_estimated: false, // This is actual Meta data
                  synced_at: new Date().toISOString(),
                })
                .eq('id', matchedVariation.id);
              
              if (!updateError) {
                variationBreakdownsProcessed++;
                console.log(`[ASSET BREAKDOWNS] ✓ Matched ${assetType} for ad ${breakdown.ad_id}: ${impressions} imp, ${purchases} purchases, CPA=${cpa ? '$' + cpa.toFixed(2) : 'N/A'}, ranking by ${rankingMethod}`);
              }
            } else {
              console.log(`[ASSET BREAKDOWNS] ✗ No match for ${assetType} in ad ${breakdown.ad_id}: "${assetText.slice(0, 50)}..."`);
            }
          }
          
          if (skippedLowImpressions > 0) {
            console.log(`[ASSET BREAKDOWNS][${breakdownType}] Skipped ${skippedLowImpressions} assets below ${MIN_IMPRESSIONS_THRESHOLD} impressions threshold`);
          }
        } catch (breakdownErr) {
          console.error(`[ASSET BREAKDOWNS] Error fetching ${breakdownType}:`, breakdownErr);
        }
      }
      
      console.log(`[ASSET BREAKDOWNS] Updated ${variationBreakdownsProcessed} variation records with performance data`);
      
      // Trigger variation aggregation for any remaining zero-metric variations
      if (variationBreakdownsProcessed === 0) {
        console.log(`[ASSET BREAKDOWNS] No direct matches - triggering fallback aggregation...`);
        try {
          const aggregateResponse = await fetch(
            `${supabaseUrl}/functions/v1/aggregate-variation-metrics`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ organization_id }),
            }
          );
          const aggResult = await aggregateResponse.json();
          console.log(`[ASSET BREAKDOWNS] Fallback aggregation result:`, aggResult);
        } catch (aggError) {
          console.error(`[ASSET BREAKDOWNS] Fallback aggregation failed:`, aggError);
        }
      }
      
      // ENHANCED RANKING: CPA-first with CTR fallback
      if (variationBreakdownsProcessed > 0) {
        console.log(`[ASSET BREAKDOWNS] Updating performance rankings with CPA-first algorithm...`);
        
        // Get all variations for this org that meet the minimum threshold
        const { data: allVariations } = await supabase
          .from('meta_creative_variations')
          .select('id, ad_id, asset_type, cpa, ctr, impressions, purchases')
          .eq('organization_id', organization_id)
          .gte('impressions', MIN_IMPRESSIONS_THRESHOLD);
        
        if (allVariations) {
          // Group by ad_id + asset_type
          const groups: Record<string, typeof allVariations> = {};
          for (const v of allVariations) {
            const key = `${v.ad_id}:${v.asset_type}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(v);
          }
          
          // ENHANCED RANKING per Gemini guidance:
          // Primary: CPA ascending (lower = better, more cost-efficient)
          // Fallback: CTR descending (higher = better engagement)
          for (const group of Object.values(groups)) {
            group.sort((a, b) => {
              // If both have CPA, compare CPA (lower wins)
              if (a.cpa && a.cpa > 0 && b.cpa && b.cpa > 0) {
                return a.cpa - b.cpa;
              }
              // If only one has CPA, that one wins (has actual conversion data)
              if (a.cpa && a.cpa > 0 && (!b.cpa || b.cpa === 0)) return -1;
              if ((!a.cpa || a.cpa === 0) && b.cpa && b.cpa > 0) return 1;
              // Fallback to CTR (higher wins)
              return (b.ctr || 0) - (a.ctr || 0);
            });

            // Update ranks
            for (let i = 0; i < group.length; i++) {
              const rankingMethod = group[i].cpa && group[i].cpa > 0 ? 'cpa' : 'ctr';
              await supabase
                .from('meta_creative_variations')
                .update({ 
                  performance_rank: i + 1,
                  ranking_method: rankingMethod
                })
                .eq('id', group[i].id);
            }
          }
          console.log(`[ASSET BREAKDOWNS] CPA-first rankings updated for ${Object.keys(groups).length} variation groups`);
        }
        
        // Mark low-impression variations with null rank (insufficient data)
        const { error: lowImpError } = await supabase
          .from('meta_creative_variations')
          .update({ performance_rank: null, ranking_method: null })
          .eq('organization_id', organization_id)
          .lt('impressions', MIN_IMPRESSIONS_THRESHOLD)
          .gt('impressions', 0);
        
        if (!lowImpError) {
          console.log(`[ASSET BREAKDOWNS] Cleared rankings for low-impression variations (below ${MIN_IMPRESSIONS_THRESHOLD})`);
        }
      }
      
    } catch (assetBreakdownError) {
      console.error(`[ASSET BREAKDOWNS] Error:`, assetBreakdownError);
    }

    // Update freshness info
    freshnessInfo.actualDataRange.start = earliestDataDate;
    freshnessInfo.actualDataRange.end = latestDataDate;
    freshnessInfo.actualLatestDate = latestDataDate;
    freshnessInfo.metricsRetrieved = totalInsightRecords;
    freshnessInfo.campaignsWithData = campaignsWithDataIds.length;
    freshnessInfo.campaignsWithoutData = campaignsWithoutDataIds.length;
    
    // Calculate data lag
    if (latestDataDate) {
      const latestDateObj = new Date(latestDataDate);
      const expectedDateObj = new Date(freshnessInfo.expectedLatestDate);
      freshnessInfo.dataLagDays = Math.floor((expectedDateObj.getTime() - latestDateObj.getTime()) / (1000 * 60 * 60 * 24));
      
      if (freshnessInfo.dataLagDays <= 0) {
        freshnessInfo.dataLagReason = 'Data is current';
      } else if (freshnessInfo.dataLagDays <= 2) {
        freshnessInfo.dataLagReason = 'Normal Meta API processing delay (24-48 hours)';
      } else {
        freshnessInfo.dataLagReason = 'Extended delay - campaigns may be paused or Meta API is experiencing issues';
      }
    } else {
      freshnessInfo.dataLagReason = 'No data retrieved - campaigns may be inactive or have no impressions';
    }

    // Update sync status with data freshness info
    await supabase
      .from('client_api_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: totalInsightRecords > 0 ? 'success' : 'success_no_data'
      })
      .eq('organization_id', organization_id)
      .eq('platform', 'meta');

    console.log(`=== META ADS SYNC COMPLETE ===`);
    console.log(`Campaigns: ${campaigns.length}`);
    console.log(`Ad sets processed: ${adsetsProcessed}`);
    console.log(`Creatives processed: ${creativesProcessed}`);
    console.log(`Total insight records: ${totalInsightRecords}`);
    console.log(`Ad-level daily records: ${adLevelRecords}`);
    console.log(`Demographic breakdowns captured: ${demographicRecords}`);
    console.log(`Placement breakdowns captured: ${placementRecords}`);
    console.log(`Actual data range: ${earliestDataDate || 'none'} to ${latestDataDate || 'none'}`);
    console.log(`Data freshness: ${freshnessInfo.dataLagReason}`);
    
    // PIPELINE FIX: Trigger creative metrics aggregation to backfill from campaign-level data
    let aggregationResult = null;
    try {
      console.log(`[SYNC-META-ADS] Triggering creative metrics aggregation...`);
      const aggregateResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/aggregate-creative-metrics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ organization_id }),
        }
      );
      aggregationResult = await aggregateResponse.json();
      console.log(`[SYNC-META-ADS] Aggregation result:`, aggregationResult);
    } catch (aggError) {
      console.error(`[SYNC-META-ADS] Aggregation failed (non-fatal):`, aggError);
    }
    
    console.log(`=== END SYNC ===`);

    return new Response(
      JSON.stringify({
        success: true,
        campaigns: campaigns.length,
        adsets_processed: adsetsProcessed,
        creatives_processed: creativesProcessed,
        insight_records: totalInsightRecords,
        ad_level_daily_records: adLevelRecords,
        demographic_breakdowns: demographicRecords,
        placement_breakdowns: placementRecords,
        aggregation: aggregationResult,
        data_freshness: {
          latest_data_date: latestDataDate,
          earliest_data_date: earliestDataDate,
          data_lag_days: freshnessInfo.dataLagDays,
          lag_reason: freshnessInfo.dataLagReason,
          campaigns_with_data: freshnessInfo.campaignsWithData,
          campaigns_without_data: freshnessInfo.campaignsWithoutData,
          meta_api_latency_hours: freshness.latencyHours,
          freshness_message: freshness.message
        },
        message: 'Meta Ads sync completed successfully with ad-level daily metrics'
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
