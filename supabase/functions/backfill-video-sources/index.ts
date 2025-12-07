import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ENHANCED: Try multiple API methods to get video source URL
 * Method 1: Direct video endpoint with source field
 * Method 2: Ad creative endpoint to get video_id then fetch source
 * Method 3: Effective object story ID (page post)
 */
async function fetchVideoSource(
  videoId: string | null, 
  creativeId: string | null,
  accessToken: string
): Promise<{ source: string | null; thumbnail: string | null; videoId: string | null; error: string | null; method: string }> {
  
  // Method 1: Direct video endpoint if we have videoId
  if (videoId) {
    try {
      console.log(`[BACKFILL] Method 1: Trying direct video endpoint for ${videoId}`);
      const primaryUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=source,picture,thumbnails{uri,height,width}&access_token=${accessToken}`;
      
      const response = await fetch(primaryUrl);
      const data = await response.json();
      
      if (!data.error) {
        let thumbnail = data.picture;
        if (data.thumbnails?.data?.length > 0) {
          const sorted = data.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
          thumbnail = sorted[0]?.uri || thumbnail;
        }
        
        if (data.source) {
          console.log(`[BACKFILL] ✓ Method 1 SUCCESS: Got source for video ${videoId}`);
          return { source: data.source, thumbnail, videoId, error: null, method: 'direct_video' };
        } else {
          console.log(`[BACKFILL] Method 1: No source field (may be restricted), got thumbnail only`);
          return { source: null, thumbnail, videoId, error: 'No source field available', method: 'direct_video' };
        }
      } else {
        console.log(`[BACKFILL] Method 1 failed: ${data.error.message}`);
      }
    } catch (err) {
      console.error(`[BACKFILL] Method 1 exception:`, err);
    }
  }
  
  // Method 2: Use creative_id to get video details
  if (creativeId) {
    try {
      console.log(`[BACKFILL] Method 2: Trying creative endpoint for ${creativeId}`);
      const creativeUrl = `https://graph.facebook.com/v22.0/${creativeId}?fields=video_id,object_story_spec,asset_feed_spec,effective_object_story_id&access_token=${accessToken}`;
      
      const response = await fetch(creativeUrl);
      const data = await response.json();
      
      if (!data.error) {
        // Extract video_id from various locations
        let extractedVideoId = data.video_id || 
                              data.object_story_spec?.video_data?.video_id ||
                              data.object_story_spec?.link_data?.video_id;
        
        // Check asset_feed_spec for video IDs
        if (!extractedVideoId && data.asset_feed_spec?.videos?.length > 0) {
          extractedVideoId = data.asset_feed_spec.videos[0].video_id || data.asset_feed_spec.videos[0].id;
          console.log(`[BACKFILL] Method 2: Extracted video_id from asset_feed_spec: ${extractedVideoId}`);
        }
        
        if (extractedVideoId) {
          // Now fetch the source for this video
          const videoUrl = `https://graph.facebook.com/v22.0/${extractedVideoId}?fields=source,picture&access_token=${accessToken}`;
          const videoResponse = await fetch(videoUrl);
          const videoData = await videoResponse.json();
          
          if (!videoData.error && videoData.source) {
            console.log(`[BACKFILL] ✓ Method 2 SUCCESS: Got source for video ${extractedVideoId}`);
            return { 
              source: videoData.source, 
              thumbnail: videoData.picture || null, 
              videoId: extractedVideoId, 
              error: null, 
              method: 'creative_endpoint' 
            };
          }
        }
        
        // Method 3: Try effective_object_story_id (page post)
        if (data.effective_object_story_id) {
          console.log(`[BACKFILL] Method 3: Trying effective_object_story_id: ${data.effective_object_story_id}`);
          
          const postUrl = `https://graph.facebook.com/v22.0/${data.effective_object_story_id}?fields=source,full_picture&access_token=${accessToken}`;
          const postResponse = await fetch(postUrl);
          const postData = await postResponse.json();
          
          if (!postData.error && postData.source) {
            console.log(`[BACKFILL] ✓ Method 3 SUCCESS: Got source from page post`);
            return { 
              source: postData.source, 
              thumbnail: postData.full_picture || null, 
              videoId: extractedVideoId, 
              error: null, 
              method: 'page_post' 
            };
          }
        }
      }
    } catch (err) {
      console.error(`[BACKFILL] Method 2/3 exception:`, err);
    }
  }
  
  return { source: null, thumbnail: null, videoId, error: 'All methods failed', method: 'none' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id, limit = 50, force_refresh = false } = body;

    console.log('[BACKFILL VIDEO SOURCES] Starting enhanced backfill...');

    // Find videos that need source URLs OR have blurry thumbnails
    // ENHANCED: Also include videos with creative_id that we can try to fetch
    let query = supabase
      .from('meta_creative_insights')
      .select('id, meta_video_id, creative_id, organization_id, thumbnail_url, media_source_url, creative_type, media_type')
      .or('creative_type.eq.video,media_type.eq.video,meta_video_id.not.is.null')
      .limit(limit);
    
    if (!force_refresh) {
      // Only get ones missing source URL or with blurry thumbnails
      query = query.or('media_source_url.is.null,thumbnail_url.ilike.%p64x64%,thumbnail_url.ilike.%p64x720%');
    }

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: videosToProcess, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching videos: ${fetchError.message}`);
    }

    if (!videosToProcess || videosToProcess.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No videos need source URL backfill',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BACKFILL] Found ${videosToProcess.length} videos to process`);

    // Group by organization to fetch credentials once per org
    const orgGroups: Record<string, typeof videosToProcess> = {};
    for (const video of videosToProcess) {
      if (!orgGroups[video.organization_id]) {
        orgGroups[video.organization_id] = [];
      }
      orgGroups[video.organization_id].push(video);
    }

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const methodStats: Record<string, number> = {};

    for (const [orgId, videos] of Object.entries(orgGroups)) {
      // Fetch Meta credentials for this organization
      const { data: credData, error: credError } = await supabase
        .from('client_api_credentials')
        .select('encrypted_credentials')
        .eq('organization_id', orgId)
        .eq('platform', 'meta')
        .eq('is_active', true)
        .single();

      if (credError || !credData) {
        console.error(`[BACKFILL] No Meta credentials for org ${orgId}`);
        failCount += videos.length;
        errors.push(`No credentials for org ${orgId}`);
        continue;
      }

      const credentials = credData.encrypted_credentials as { access_token: string };
      const accessToken = credentials.access_token;

      // Process each video
      for (const video of videos) {
        try {
          const result = await fetchVideoSource(video.meta_video_id, video.creative_id, accessToken);
          
          // Track method usage
          methodStats[result.method] = (methodStats[result.method] || 0) + 1;

          // Determine what needs updating
          const updateData: Record<string, any> = {};
          
          if (result.source && (!video.media_source_url || force_refresh)) {
            updateData.media_source_url = result.source;
          }
          
          // Update video_id if we discovered one
          if (result.videoId && !video.meta_video_id) {
            updateData.meta_video_id = result.videoId;
          }
          
          // Update thumbnail if we got a better one and current is blurry
          if (result.thumbnail && (video.thumbnail_url?.includes('p64x64') || video.thumbnail_url?.includes('p64x720'))) {
            updateData.thumbnail_url = result.thumbnail;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from('meta_creative_insights')
              .update(updateData)
              .eq('id', video.id);

            if (updateError) {
              console.error(`[BACKFILL] Error updating video ${video.id}:`, updateError);
              failCount++;
              errors.push(`Update failed for ${video.id}`);
            } else {
              successCount++;
              console.log(`[BACKFILL] ✓ Updated video ${video.meta_video_id || video.creative_id}: source=${!!result.source}, thumbnail=${!!result.thumbnail}, method=${result.method}`);
            }
          } else if (result.error && result.method !== 'none') {
            // We tried but couldn't get source (may be permission issue)
            skippedCount++;
            console.log(`[BACKFILL] Skipped video ${video.meta_video_id || video.id}: ${result.error}`);
          } else if (!result.source && video.media_source_url) {
            // Already has source, nothing to do
            skippedCount++;
          } else {
            failCount++;
            errors.push(`Video ${video.meta_video_id || video.id}: ${result.error}`);
          }

          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.error(`[BACKFILL] Error processing video ${video.meta_video_id}:`, err);
          failCount++;
        }
      }
    }

    console.log(`[BACKFILL] Complete: ${successCount} success, ${skippedCount} skipped, ${failCount} failed`);
    console.log(`[BACKFILL] Method stats:`, methodStats);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        skipped: skippedCount,
        failed: failCount,
        methodStats,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BACKFILL VIDEO SOURCES] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});