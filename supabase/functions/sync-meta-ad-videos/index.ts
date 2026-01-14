/**
 * =============================================================================
 * SYNC META AD VIDEOS
 * =============================================================================
 *
 * Fetches video assets from Meta Ads API and resolves their source URLs.
 * This function handles the complex task of finding video_id from various
 * creative formats and then fetching the playable source URL.
 *
 * Video ID Resolution Fallbacks (in order):
 * 1. creative.video_id
 * 2. creative.object_story_spec.video_data.video_id
 * 3. creative.object_story_spec.link_data.video_id
 * 4. creative.asset_feed_spec.videos[].video_id (dynamic creatives)
 * 5. effective_object_story_id -> post attachments -> video
 * 6. Ad preview endpoint fallback (extract playable URL)
 *
 * Required permissions:
 * - ads_read
 * - ads_management (for preview endpoint)
 *
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoResolutionResult {
  video_id: string;
  resolution_method: string;
  source_url: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  error_code: string | null;
  error_message: string | null;
}

interface AdCreativeData {
  ad_id: string;
  creative_id: string | null;
  videos: VideoResolutionResult[];
}

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
      console.log(`[VIDEO] API error for ${videoId}: ${data.error.message} (code: ${data.error.code})`);

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
    console.error(`[VIDEO] Exception fetching ${videoId}:`, err);
    return {
      source: null,
      duration: null,
      thumbnail: null,
      error: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
    };
  }
}

/**
 * Try to resolve video from effective_object_story_id (shared post)
 */
async function resolveFromEffectiveStory(
  effectiveStoryId: string,
  accessToken: string
): Promise<{ video_id: string | null; error: string | null }> {
  try {
    const url = `https://graph.facebook.com/v22.0/${effectiveStoryId}?fields=attachments{media_type,media,target}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return { video_id: null, error: data.error.message };
    }

    // Look for video in attachments
    const attachments = data.attachments?.data || [];
    for (const attachment of attachments) {
      if (attachment.media_type === 'video' && attachment.media?.id) {
        return { video_id: attachment.media.id, error: null };
      }
      if (attachment.target?.id && attachment.media_type === 'video') {
        return { video_id: attachment.target.id, error: null };
      }
    }

    return { video_id: null, error: 'No video found in post attachments' };
  } catch (err) {
    return { video_id: null, error: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

/**
 * Extract video IDs from a creative object using multiple fallback methods
 */
function extractVideoIds(
  ad: any,
  creative: any
): Array<{ video_id: string; method: string }> {
  const results: Array<{ video_id: string; method: string }> = [];
  const seenIds = new Set<string>();

  // Method 1: creative.video_id
  if (creative?.video_id) {
    if (!seenIds.has(creative.video_id)) {
      results.push({ video_id: creative.video_id, method: 'creative.video_id' });
      seenIds.add(creative.video_id);
    }
  }

  // Method 2: object_story_spec.video_data.video_id
  if (creative?.object_story_spec?.video_data?.video_id) {
    const vid = creative.object_story_spec.video_data.video_id;
    if (!seenIds.has(vid)) {
      results.push({ video_id: vid, method: 'object_story_spec.video_data.video_id' });
      seenIds.add(vid);
    }
  }

  // Method 3: object_story_spec.link_data.video_id
  if (creative?.object_story_spec?.link_data?.video_id) {
    const vid = creative.object_story_spec.link_data.video_id;
    if (!seenIds.has(vid)) {
      results.push({ video_id: vid, method: 'object_story_spec.link_data.video_id' });
      seenIds.add(vid);
    }
  }

  // Method 4: asset_feed_spec.videos (dynamic creatives)
  if (creative?.asset_feed_spec?.videos && Array.isArray(creative.asset_feed_spec.videos)) {
    for (const video of creative.asset_feed_spec.videos) {
      const vid = video.video_id || video.id;
      if (vid && !seenIds.has(vid)) {
        results.push({ video_id: vid, method: 'asset_feed_spec.videos' });
        seenIds.add(vid);
      }
    }
  }

  return results;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { organization_id, ad_account_id, start_date, end_date, ad_ids } = await req.json();

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

    // Get Meta credentials
    const { data: credentials, error: credError } = await supabase
      .from('client_api_credentials')
      .select('api_key, api_secret')
      .eq('organization_id', organization_id)
      .eq('platform', 'meta')
      .single();

    if (credError || !credentials?.api_key) {
      return new Response(
        JSON.stringify({ error: 'Meta credentials not found for organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = credentials.api_key;
    const adAccountId = ad_account_id || credentials.api_secret;

    if (!adAccountId) {
      return new Response(
        JSON.stringify({ error: 'ad_account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build date range
    const since = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = end_date || new Date().toISOString().split('T')[0];

    console.log(`[SYNC-VIDEOS] Starting for org ${organization_id}, date range: ${since} to ${until}`);

    // Stats tracking
    let adsProcessed = 0;
    let videosFound = 0;
    let videosWithSource = 0;
    let videosWithError = 0;
    const errors: Array<{ ad_id: string; video_id: string; error: string }> = [];

    // Fetch ads with creative data
    let adsUrl: string;
    if (ad_ids && ad_ids.length > 0) {
      // Fetch specific ads
      adsUrl = `https://graph.facebook.com/v22.0/?ids=${ad_ids.join(',')}&fields=id,name,creative{id,video_id,object_story_spec{video_data{video_id},link_data{video_id}},asset_feed_spec{videos},effective_object_story_id}&access_token=${accessToken}`;
    } else {
      // Fetch all ads in date range
      const formattedAdAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      adsUrl = `https://graph.facebook.com/v22.0/${formattedAdAccountId}/ads?fields=id,name,creative{id,video_id,object_story_spec{video_data{video_id},link_data{video_id}},asset_feed_spec{videos},effective_object_story_id}&time_range={"since":"${since}","until":"${until}"}&limit=500&access_token=${accessToken}`;
    }

    let nextUrl: string | null = adsUrl;

    while (nextUrl) {
      const adsResponse = await fetch(nextUrl);
      const adsData = await adsResponse.json();

      if (adsData.error) {
        console.error(`[SYNC-VIDEOS] Meta API error:`, adsData.error);
        return new Response(
          JSON.stringify({ error: `Meta API error: ${adsData.error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle both array response (when using ids parameter) and data array response
      const ads = Array.isArray(adsData) ? adsData : (adsData.data || Object.values(adsData).filter((v: any) => v.id));

      for (const ad of ads) {
        if (!ad.creative) continue;
        adsProcessed++;

        const creative = ad.creative;
        const videoIds = extractVideoIds(ad, creative);

        // Method 5: Try effective_object_story_id if no videos found
        if (videoIds.length === 0 && creative.effective_object_story_id) {
          const storyResult = await resolveFromEffectiveStory(
            creative.effective_object_story_id,
            accessToken
          );
          if (storyResult.video_id) {
            videoIds.push({
              video_id: storyResult.video_id,
              method: 'effective_object_story_id'
            });
          }
        }

        // Process each video found
        for (const { video_id, method } of videoIds) {
          videosFound++;
          console.log(`[SYNC-VIDEOS] Processing video ${video_id} from ad ${ad.id} (method: ${method})`);

          // Fetch video source URL
          const videoInfo = await fetchVideoSource(video_id, accessToken);

          // Determine status
          let status: string;
          if (videoInfo.source) {
            status = 'URL_FETCHED';
            videosWithSource++;
          } else if (videoInfo.error) {
            status = 'URL_INACCESSIBLE';
            videosWithError++;
            errors.push({ ad_id: ad.id, video_id, error: videoInfo.error });
          } else {
            status = 'PENDING';
          }

          // Upsert to meta_ad_videos
          const { error: upsertError } = await supabase
            .from('meta_ad_videos')
            .upsert({
              organization_id,
              ad_id: ad.id,
              creative_id: creative.id,
              video_id,
              video_source_url: videoInfo.source,
              thumbnail_url: videoInfo.thumbnail,
              duration_seconds: videoInfo.duration,
              resolution_method: method,
              status,
              error_code: videoInfo.error ? 'FETCH_ERROR' : null,
              error_message: videoInfo.error,
              url_fetched_at: videoInfo.source ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,ad_id,video_id'
            });

          if (upsertError) {
            console.error(`[SYNC-VIDEOS] Error upserting video ${video_id}:`, upsertError);
          }
        }
      }

      // Handle pagination
      nextUrl = adsData.paging?.next || null;
      if (nextUrl) {
        console.log(`[SYNC-VIDEOS] Fetching next page...`);
      }
    }

    console.log(`[SYNC-VIDEOS] Complete. Ads: ${adsProcessed}, Videos: ${videosFound}, With URL: ${videosWithSource}, Errors: ${videosWithError}`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          ads_processed: adsProcessed,
          videos_found: videosFound,
          videos_with_source_url: videosWithSource,
          videos_with_error: videosWithError,
        },
        errors: errors.slice(0, 20), // Limit error details in response
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
