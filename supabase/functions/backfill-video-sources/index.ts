import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Find videos that need source URLs
    let query = supabase
      .from('meta_creative_insights')
      .select('id, meta_video_id, organization_id, thumbnail_url')
      .is('media_source_url', null)
      .not('meta_video_id', 'is', null)
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
          // Fetch video details from Meta Graph API
          const videoUrl = `https://graph.facebook.com/v22.0/${video.meta_video_id}?fields=source,picture,thumbnails{uri,height,width}&access_token=${accessToken}`;
          const response = await fetch(videoUrl);
          const data = await response.json();

          if (data.error) {
            console.error(`[BACKFILL] Meta API error for video ${video.meta_video_id}:`, data.error.message);
            failCount++;
            errors.push(`Video ${video.meta_video_id}: ${data.error.message}`);
            continue;
          }

          // Get source URL and best thumbnail
          const mediaSourceUrl = data.source || null;
          let highResThumbnail = video.thumbnail_url;

          if (data.thumbnails?.data?.length > 0) {
            const sortedThumbs = data.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
            highResThumbnail = sortedThumbs[0]?.uri || data.picture || highResThumbnail;
          } else if (data.picture) {
            highResThumbnail = data.picture;
          }

          // Update the record
          const { error: updateError } = await supabase
            .from('meta_creative_insights')
            .update({
              media_source_url: mediaSourceUrl,
              thumbnail_url: highResThumbnail,
            })
            .eq('id', video.id);

          if (updateError) {
            console.error(`[BACKFILL] Error updating video ${video.id}:`, updateError);
            failCount++;
            errors.push(`Update failed for ${video.id}`);
          } else {
            successCount++;
            console.log(`[BACKFILL] Updated video ${video.meta_video_id} with source URL`);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
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
        errors: errors.slice(0, 10), // Return first 10 errors
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
