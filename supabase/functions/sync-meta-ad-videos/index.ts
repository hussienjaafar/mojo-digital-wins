/**
 * =============================================================================
 * SYNC META AD VIDEOS
 * =============================================================================
 *
 * Syncs video data from meta_creative_insights to meta_ad_videos table.
 * This function uses the EXISTING video_id stored by sync-meta-ads rather than
 * independently resolving video IDs, ensuring consistency between the ad display
 * and transcription.
 *
 * IMPORTANT: This function does NOT re-fetch video IDs from Meta API.
 * It uses meta_creative_insights.meta_video_id which was extracted during
 * the main ad sync process. This ensures the transcribed video matches
 * the video shown in the ad.
 *
 * If video source URL is missing, it fetches from Meta API.
 *
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Fetch video source URL from Meta API
 */
async function fetchVideoSource(
  videoId: string,
  accessToken: string
): Promise<{ source: string | null; duration: number | null; thumbnail: string | null; error: string | null }> {
  try {
    // First try with source field
    const url = `https://graph.facebook.com/v22.0/${videoId}?fields=source,length,picture,thumbnails{uri,height,width}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.log(`[SYNC-VIDEOS] API error for ${videoId}: ${data.error.message} (code: ${data.error.code})`);

      // Try without source field (may be restricted)
      const altUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=length,picture,thumbnails{uri,height,width}&access_token=${accessToken}`;
      const altResponse = await fetch(altUrl);
      const altData = await altResponse.json();

      if (altData.error) {
        return {
          source: null,
          duration: null,
          thumbnail: null,
          error: `${data.error.message} (code: ${data.error.code})`
        };
      }

      // Got metadata but not source URL
      return {
        source: null,
        duration: altData.length ? Math.round(altData.length) : null,
        thumbnail: altData.picture || altData.thumbnails?.data?.[0]?.uri || null,
        error: 'Video source URL not accessible - may require additional permissions'
      };
    }

    // Successfully got source URL
    const thumbnail = data.thumbnails?.data?.length > 0
      ? data.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0))[0]?.uri
      : data.picture;

    return {
      source: data.source || null,
      duration: data.length ? Math.round(data.length) : null,
      thumbnail: thumbnail || null,
      error: null
    };
  } catch (err) {
    console.error(`[SYNC-VIDEOS] Exception fetching ${videoId}:`, err);
    return {
      source: null,
      duration: null,
      thumbnail: null,
      error: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
    };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      organization_id,
      ad_account_id,
      start_date,
      end_date,
      ad_ids,
      force_refresh = false,
      limit = 100
    } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[SYNC-VIDEOS] Starting for org ${organization_id}`);

    // Get Meta credentials
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .single();

    if (credError || !credData) {
      return new Response(
        JSON.stringify({ error: 'Meta credentials not found for organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = credData.encrypted_credentials as { access_token: string };
    const accessToken = credentials.access_token;

    // CRITICAL FIX: Use EXISTING video_id from meta_creative_insights
    // This ensures consistency with what sync-meta-ads extracted
    let query = supabase
      .from('meta_creative_insights')
      .select('id, ad_id, creative_id, meta_video_id, media_source_url, thumbnail_url, creative_type, organization_id')
      .eq('organization_id', organization_id)
      .not('meta_video_id', 'is', null);

    // Filter by specific ad_ids if provided
    if (ad_ids && ad_ids.length > 0) {
      query = query.in('ad_id', ad_ids);
    }

    // Filter by date range if provided
    if (start_date) {
      query = query.gte('date_start', start_date);
    }
    if (end_date) {
      query = query.lte('date_stop', end_date);
    }

    // Only get videos that need processing unless force_refresh
    if (!force_refresh) {
      // Get creatives that either:
      // 1. Don't have a corresponding meta_ad_videos entry, OR
      // 2. Have a meta_ad_videos entry with no source URL
      // We'll check this after fetching
    }

    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data: creatives, error: fetchError } = await query;

    if (fetchError) {
      console.error('[SYNC-VIDEOS] Error fetching creatives:', fetchError);
      return new Response(
        JSON.stringify({ error: `Database error: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!creatives || creatives.length === 0) {
      console.log('[SYNC-VIDEOS] No video creatives found');
      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            creatives_checked: 0,
            videos_synced: 0,
            videos_with_source: 0,
            videos_with_error: 0,
          },
          message: 'No video creatives found in meta_creative_insights'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC-VIDEOS] Found ${creatives.length} video creatives to process`);

    // Check which ones already exist in meta_ad_videos
    const adIds = creatives.map(c => c.ad_id);
    const { data: existingVideos, error: existingError } = await supabase
      .from('meta_ad_videos')
      .select('ad_id, video_id, status, video_source_url')
      .eq('organization_id', organization_id)
      .in('ad_id', adIds);

    const existingMap = new Map<string, any>();
    for (const v of existingVideos || []) {
      existingMap.set(`${v.ad_id}:${v.video_id}`, v);
    }

    // Stats tracking
    let synced = 0;
    let withSource = 0;
    let withError = 0;
    let skipped = 0;
    const errors: Array<{ ad_id: string; video_id: string; error: string }> = [];

    for (const creative of creatives) {
      const videoId = creative.meta_video_id;
      const adId = creative.ad_id;
      const existingKey = `${adId}:${videoId}`;
      const existing = existingMap.get(existingKey);

      // Skip if already has source URL and not forcing refresh
      if (!force_refresh && existing?.video_source_url) {
        skipped++;
        continue;
      }

      console.log(`[SYNC-VIDEOS] Processing video ${videoId} for ad ${adId}`);

      // Check if we already have source URL in meta_creative_insights
      let sourceUrl = creative.media_source_url;
      let thumbnailUrl = creative.thumbnail_url;
      let duration: number | null = null;
      let errorMsg: string | null = null;
      let status = 'PENDING';

      // If no source URL yet, fetch from Meta API
      if (!sourceUrl) {
        const videoInfo = await fetchVideoSource(videoId, accessToken);
        sourceUrl = videoInfo.source;
        thumbnailUrl = thumbnailUrl || videoInfo.thumbnail;
        duration = videoInfo.duration;
        errorMsg = videoInfo.error;
      }

      // Determine status
      if (sourceUrl) {
        status = 'URL_FETCHED';
        withSource++;
      } else if (errorMsg) {
        status = 'URL_INACCESSIBLE';
        withError++;
        errors.push({ ad_id: adId, video_id: videoId, error: errorMsg });
      }

      // Upsert to meta_ad_videos - using the SAME video_id from meta_creative_insights
      const { error: upsertError } = await supabase
        .from('meta_ad_videos')
        .upsert({
          organization_id,
          ad_id: adId,
          creative_id: creative.creative_id,
          video_id: videoId, // CRITICAL: Use the same video_id from meta_creative_insights
          video_source_url: sourceUrl,
          thumbnail_url: thumbnailUrl,
          duration_seconds: duration,
          resolution_method: 'meta_creative_insights', // Mark source of video_id
          status,
          error_code: errorMsg ? 'FETCH_ERROR' : null,
          error_message: errorMsg,
          url_fetched_at: sourceUrl ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,ad_id,video_id'
        });

      if (upsertError) {
        console.error(`[SYNC-VIDEOS] Error upserting video ${videoId}:`, upsertError);
        withError++;
      } else {
        synced++;
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[SYNC-VIDEOS] Complete. Synced: ${synced}, WithSource: ${withSource}, Errors: ${withError}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          creatives_checked: creatives.length,
          videos_synced: synced,
          videos_with_source: withSource,
          videos_with_error: withError,
          videos_skipped: skipped,
        },
        errors: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[SYNC-VIDEOS] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
