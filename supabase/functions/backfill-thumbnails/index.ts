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

    console.log('[BACKFILL THUMBNAILS] Starting backfill...');

    // Find creatives with blurry thumbnails (p64x64 in URL)
    let query = supabase
      .from('meta_creative_insights')
      .select('id, meta_video_id, organization_id, thumbnail_url, creative_id, creative_type')
      .or('thumbnail_url.ilike.%p64x64%,thumbnail_url.ilike.%p64x720%')
      .limit(limit);

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: creativesToProcess, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching creatives: ${fetchError.message}`);
    }

    if (!creativesToProcess || creativesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No creatives need thumbnail backfill',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BACKFILL] Found ${creativesToProcess.length} creatives with blurry thumbnails`);

    // Group by organization to fetch credentials once per org
    const orgGroups: Record<string, typeof creativesToProcess> = {};
    for (const creative of creativesToProcess) {
      if (!orgGroups[creative.organization_id]) {
        orgGroups[creative.organization_id] = [];
      }
      orgGroups[creative.organization_id].push(creative);
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const [orgId, creatives] of Object.entries(orgGroups)) {
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
        failCount += creatives.length;
        errors.push(`No credentials for org ${orgId}`);
        continue;
      }

      const credentials = credData.encrypted_credentials as { access_token: string };
      const accessToken = credentials.access_token;

      // Process each creative
      for (const creative of creatives) {
        try {
          let highResThumbnail: string | null = null;
          let mediaSourceUrl: string | null = null;

          // For video creatives, fetch from video endpoint
          if (creative.meta_video_id) {
            const videoUrl = `https://graph.facebook.com/v22.0/${creative.meta_video_id}?fields=source,picture,thumbnails{uri,height,width}&access_token=${accessToken}`;
            console.log(`[BACKFILL] Fetching video details for ${creative.meta_video_id}`);
            
            const response = await fetch(videoUrl);
            const data = await response.json();

            if (data.error) {
              console.error(`[BACKFILL] Meta API error for video ${creative.meta_video_id}:`, data.error.message);
              
              // Try alternative endpoint - video thumbnails
              const altUrl = `https://graph.facebook.com/v22.0/${creative.meta_video_id}/thumbnails?access_token=${accessToken}`;
              const altResponse = await fetch(altUrl);
              const altData = await altResponse.json();
              
              if (!altData.error && altData.data?.length > 0) {
                // Sort by height to get highest resolution
                const sortedThumbs = altData.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                highResThumbnail = sortedThumbs[0]?.uri;
                console.log(`[BACKFILL] Got thumbnail from alt endpoint: ${highResThumbnail?.substring(0, 50)}...`);
              }
            } else {
              // Get source URL
              if (data.source) {
                mediaSourceUrl = data.source;
                console.log(`[BACKFILL] Got video source URL for ${creative.meta_video_id}`);
              }

              // Get best thumbnail
              if (data.thumbnails?.data?.length > 0) {
                const sortedThumbs = data.thumbnails.data.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                highResThumbnail = sortedThumbs[0]?.uri;
              } else if (data.picture) {
                // Request high-res picture
                const pictureUrl = `https://graph.facebook.com/v22.0/${creative.meta_video_id}/picture?redirect=false&height=720&access_token=${accessToken}`;
                const picResponse = await fetch(pictureUrl);
                const picData = await picResponse.json();
                if (!picData.error && picData.data?.url) {
                  highResThumbnail = picData.data.url;
                } else {
                  highResThumbnail = data.picture;
                }
              }
            }
          } 
          // For non-video creatives, try to get higher res from creative endpoint
          else if (creative.creative_id) {
            const creativeUrl = `https://graph.facebook.com/v22.0/${creative.creative_id}?fields=thumbnail_url,image_url,object_story_spec&thumbnail_height=720&access_token=${accessToken}`;
            console.log(`[BACKFILL] Fetching creative details for ${creative.creative_id}`);
            
            const response = await fetch(creativeUrl);
            const data = await response.json();

            if (!data.error) {
              highResThumbnail = data.image_url || data.thumbnail_url;
              
              // Try to get from object_story_spec
              if (!highResThumbnail && data.object_story_spec) {
                const spec = data.object_story_spec;
                highResThumbnail = spec.link_data?.picture || 
                                   spec.photo_data?.url ||
                                   spec.video_data?.image_url;
              }
            } else {
              console.error(`[BACKFILL] Meta API error for creative ${creative.creative_id}:`, data.error.message);
            }
          }

          // Update the record if we got new data
          const updateData: Record<string, any> = {};
          
          if (highResThumbnail && highResThumbnail !== creative.thumbnail_url) {
            updateData.thumbnail_url = highResThumbnail;
          }
          if (mediaSourceUrl) {
            updateData.media_source_url = mediaSourceUrl;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from('meta_creative_insights')
              .update(updateData)
              .eq('id', creative.id);

            if (updateError) {
              console.error(`[BACKFILL] Error updating creative ${creative.id}:`, updateError);
              failCount++;
              errors.push(`Update failed for ${creative.id}`);
            } else {
              successCount++;
              console.log(`[BACKFILL] Updated creative ${creative.id} with new thumbnail/source`);
            }
          } else {
            console.log(`[BACKFILL] No updates needed for creative ${creative.id}`);
            successCount++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`[BACKFILL] Error processing creative ${creative.id}:`, err);
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
    console.error('[BACKFILL THUMBNAILS] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
