import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to try multiple API endpoints for video source
async function fetchVideoSource(videoId: string, accessToken: string): Promise<{ source: string | null; thumbnail: string | null; error: string | null }> {
  try {
    const primaryUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=source,picture,thumbnails{uri,height,width}&access_token=${accessToken}`;
    console.log(`[BACKFILL] Trying primary endpoint for video ${videoId}`);
    
    const response = await fetch(primaryUrl);
    const data = await response.json();
    
    if (!data.error) {
      let thumbnail = data.picture;
      if (data.thumbnails?.data?.length > 0) {
        const sorted = data.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
        thumbnail = sorted[0]?.uri || thumbnail;
      }
      return { source: data.source || null, thumbnail, error: null };
    }
    
    console.log(`[BACKFILL] Primary endpoint error for ${videoId}: ${data.error.message}`);
    
    // Try alternate endpoint - without source field (some videos don't allow source download)
    const altUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=picture,thumbnails{uri,height,width}&access_token=${accessToken}`;
    const altResponse = await fetch(altUrl);
    const altData = await altResponse.json();
    
    if (!altData.error) {
      let thumbnail = altData.picture;
      if (altData.thumbnails?.data?.length > 0) {
        const sorted = altData.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
        thumbnail = sorted[0]?.uri || thumbnail;
      }
      return { source: null, thumbnail, error: `Source not available: ${data.error.message}` };
    }
    
    return { source: null, thumbnail: null, error: data.error.message };
  } catch (err) {
    console.error(`[BACKFILL] Exception fetching video ${videoId}:`, err);
    return { source: null, thumbnail: null, error: String(err) };
  }
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
    const { organization_id, limit = 50 } = body;

    console.log('[BACKFILL VIDEO SOURCES] Starting backfill...');

    // Find videos that need source URLs OR have blurry thumbnails
    let query = supabase
      .from('meta_creative_insights')
      .select('id, meta_video_id, organization_id, thumbnail_url, media_source_url')
      .not('meta_video_id', 'is', null)
      .or('media_source_url.is.null,thumbnail_url.ilike.%p64x64%')
      .limit(limit);

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
    const errors: string[] = [];

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
          const result = await fetchVideoSource(video.meta_video_id, accessToken);

          // Determine what needs updating
          const updateData: Record<string, any> = {};
          
          if (result.source && !video.media_source_url) {
            updateData.media_source_url = result.source;
          }
          
          // Update thumbnail if we got a better one and current is blurry
          if (result.thumbnail && video.thumbnail_url?.includes('p64x64')) {
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
              console.log(`[BACKFILL] Updated video ${video.meta_video_id}: source=${!!result.source}, thumbnail=${!!result.thumbnail}`);
            }
          } else if (result.error) {
            console.log(`[BACKFILL] No updates for video ${video.meta_video_id}: ${result.error}`);
            failCount++;
            errors.push(`Video ${video.meta_video_id}: ${result.error}`);
          } else {
            successCount++;
          }

          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`[BACKFILL] Error processing video ${video.meta_video_id}:`, err);
          failCount++;
        }
      }
    }

    console.log(`[BACKFILL] Complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        failed: failCount,
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
