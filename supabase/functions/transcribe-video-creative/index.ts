import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PHASE 2: Enhanced Video Transcription Pipeline
 * - Improved Meta Graph API video URL extraction
 * - Better error handling and retry logic
 * - Stores media source URLs for future access
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for API keys - prefer Lovable AI for Whisper-compatible transcription
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey && !lovableApiKey) {
      throw new Error('No transcription API key configured (OPENAI_API_KEY or LOVABLE_API_KEY)');
    }

    const { organization_id, batch_size = 5, creative_id } = await req.json();

    console.log(`[TRANSCRIBE] Starting video transcription${organization_id ? ` for org: ${organization_id}` : ''}`);

    // Get Meta API credentials - will fetch per-video if organization_id not provided
    let metaAccessToken: string | null = null;
    let orgCredentialsCache: Map<string, string> = new Map();
    
    if (organization_id) {
      const { data: credentials } = await supabase
        .from('client_api_credentials')
        .select('encrypted_credentials')
        .eq('organization_id', organization_id)
        .eq('platform', 'meta')
        .eq('is_active', true)
        .single();

      if (credentials?.encrypted_credentials) {
        const creds = credentials.encrypted_credentials as any;
        metaAccessToken = creds.access_token || creds.accessToken;
        if (metaAccessToken) {
          orgCredentialsCache.set(organization_id, metaAccessToken);
        }
      }
    }
    
    // Helper to get access token for a specific org
    const getAccessTokenForOrg = async (orgId: string): Promise<string | null> => {
      if (orgCredentialsCache.has(orgId)) {
        return orgCredentialsCache.get(orgId) || null;
      }
      
      const { data: creds } = await supabase
        .from('client_api_credentials')
        .select('encrypted_credentials')
        .eq('organization_id', orgId)
        .eq('platform', 'meta')
        .eq('is_active', true)
        .single();
      
      if (creds?.encrypted_credentials) {
        const token = (creds.encrypted_credentials as any).access_token || (creds.encrypted_credentials as any).accessToken;
        if (token) {
          orgCredentialsCache.set(orgId, token);
          return token;
        }
      }
      return null;
    };

    // Build query for videos needing transcription
    // PHASE 2: Include meta_video_id for direct API access, also check media_type='video'
    let query = supabase
      .from('meta_creative_insights')
      .select('id, video_url, campaign_id, creative_id, creative_type, meta_video_id, media_source_url, organization_id')
      .or('creative_type.eq.video,media_type.eq.video,meta_video_id.not.is.null')
      .is('audio_transcript', null)
      .or('transcription_status.is.null,transcription_status.eq.pending,transcription_status.eq.requires_meta_auth,transcription_status.eq.download_failed')
      .limit(batch_size);

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    if (creative_id) {
      query = query.eq('id', creative_id);
    }

    const { data: videos, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching videos: ${fetchError.message}`);
    }

    if (!videos || videos.length === 0) {
      console.log('[TRANSCRIBE] No videos pending transcription');
      return new Response(
        JSON.stringify({ success: true, transcribed: 0, message: 'No videos pending transcription' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TRANSCRIBE] Found ${videos.length} videos to process`);

    let transcribed = 0;
    let errors = 0;
    let skipped = 0;

    for (const video of videos) {
      try {
        console.log(`[TRANSCRIBE] Processing video ${video.id}`);

        // Mark as processing
        await supabase
          .from('meta_creative_insights')
          .update({ transcription_status: 'processing' })
          .eq('id', video.id);

        // PHASE 2 FIX: Get access token for this specific video's organization
        const videoOrgId = video.organization_id;
        let accessToken = metaAccessToken;
        if (!accessToken && videoOrgId) {
          accessToken = await getAccessTokenForOrg(videoOrgId);
        }
        
        // PHASE 2: Try multiple methods to get video URL
        let actualVideoUrl: string | null = video.media_source_url; // Check cached URL first
        
        // Method 1: Use stored direct URL if available
        if (actualVideoUrl) {
          console.log(`[TRANSCRIBE] Using cached media_source_url`);
        }
        
        // Method 2: Extract video_id from video_url if meta_video_id is null
        let videoId = video.meta_video_id;
        if (!videoId && video.video_url) {
          const match = video.video_url.match(/v=(\d+)/);
          if (match) {
            videoId = match[1];
            console.log(`[TRANSCRIBE] Extracted video_id from URL: ${videoId}`);
            
            // Update the record with extracted video_id
            await supabase
              .from('meta_creative_insights')
              .update({ meta_video_id: videoId, media_type: 'video' })
              .eq('id', video.id);
          }
        }
        
        // Method 3: Use meta_video_id with Graph API
        if (!actualVideoUrl && accessToken && videoId) {
          console.log(`[TRANSCRIBE] Fetching video URL from Meta API using video_id: ${videoId}`);
          
          try {
            const videoResponse = await fetch(
              `https://graph.facebook.com/v22.0/${videoId}?fields=source&access_token=${accessToken}`
            );
            
            if (videoResponse.ok) {
              const videoData = await videoResponse.json();
              if (videoData.source) {
                actualVideoUrl = videoData.source;
                console.log(`[TRANSCRIBE] Got video source URL from Meta API`);
                
                // Cache the URL for future use
                await supabase
                  .from('meta_creative_insights')
                  .update({ media_source_url: actualVideoUrl })
                  .eq('id', video.id);
              } else if (videoData.error) {
                console.log(`[TRANSCRIBE] Meta API error: ${videoData.error.message}`);
              }
            } else {
              const errorText = await videoResponse.text();
              console.log(`[TRANSCRIBE] Meta API returned ${videoResponse.status}: ${errorText.substring(0, 200)}`);
            }
          } catch (graphError) {
            console.error('[TRANSCRIBE] Meta Graph API error:', graphError);
          }
        }

        // Method 4: Try creative_id endpoint
        if (!actualVideoUrl && accessToken && video.creative_id) {
          console.log(`[TRANSCRIBE] Trying creative endpoint: ${video.creative_id}`);
          
          try {
            const creativeResponse = await fetch(
              `https://graph.facebook.com/v22.0/${video.creative_id}?fields=video_id,object_story_spec&access_token=${accessToken}`
            );
            
            if (creativeResponse.ok) {
              const creativeData = await creativeResponse.json();
              const extractedVideoId = creativeData.video_id || 
                             creativeData.object_story_spec?.video_data?.video_id ||
                             creativeData.object_story_spec?.link_data?.video_id;
              
              if (extractedVideoId) {
                const videoResponse = await fetch(
                  `https://graph.facebook.com/v22.0/${extractedVideoId}?fields=source&access_token=${accessToken}`
                );
                
                if (videoResponse.ok) {
                  const videoData = await videoResponse.json();
                  if (videoData.source) {
                    actualVideoUrl = videoData.source;
                    console.log(`[TRANSCRIBE] Got video URL via creative endpoint`);
                    
                    // Store video_id and URL for future use
                    await supabase
                      .from('meta_creative_insights')
                      .update({ 
                        meta_video_id: extractedVideoId,
                        media_source_url: actualVideoUrl 
                      })
                      .eq('id', video.id);
                  }
                }
              }
            }
          } catch (err) {
            console.error('[TRANSCRIBE] Creative endpoint error:', err);
          }
        }

        // Method 5: Check if video_url is already a direct video file
        if (!actualVideoUrl && video.video_url) {
          const isDirectVideo = /\.(mp4|m4a|webm|ogg|mp3|mov)(\?|$)/i.test(video.video_url);
          if (isDirectVideo) {
            actualVideoUrl = video.video_url;
            console.log(`[TRANSCRIBE] Using direct video URL`);
          }
        }

        if (!actualVideoUrl) {
          console.log(`[TRANSCRIBE] Cannot access video - requires Meta API credentials`);
          
          await supabase
            .from('meta_creative_insights')
            .update({ 
              transcription_status: 'requires_meta_auth',
            })
            .eq('id', video.id);
          
          skipped++;
          continue;
        }

        // Download the video with retry logic
        let audioBlob: Blob | null = null;
        let retries = 2;
        
        while (retries > 0 && !audioBlob) {
          try {
            console.log(`[TRANSCRIBE] Downloading video (attempt ${3 - retries}/2)...`);
            
            const videoResponse = await fetch(actualVideoUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CreativeAnalyzer/1.0)',
              }
            });

            if (!videoResponse.ok) {
              console.log(`[TRANSCRIBE] Download failed: HTTP ${videoResponse.status}`);
              retries--;
              if (retries === 0) {
                await supabase
                  .from('meta_creative_insights')
                  .update({ transcription_status: 'download_failed' })
                  .eq('id', video.id);
                errors++;
              }
              continue;
            }

            const contentType = videoResponse.headers.get('content-type') || '';
            
            if (contentType.includes('text/html')) {
              console.log('[TRANSCRIBE] Received HTML instead of video');
              await supabase
                .from('meta_creative_insights')
                .update({ transcription_status: 'requires_meta_auth' })
                .eq('id', video.id);
              skipped++;
              break;
            }

            const videoBuffer = await videoResponse.arrayBuffer();
            
            let mimeType = 'video/mp4';
            if (contentType.includes('webm')) mimeType = 'video/webm';
            else if (contentType.includes('ogg')) mimeType = 'audio/ogg';
            else if (contentType.includes('mp3')) mimeType = 'audio/mpeg';
            
            audioBlob = new Blob([videoBuffer], { type: mimeType });
            console.log(`[TRANSCRIBE] Downloaded ${(audioBlob.size / 1024).toFixed(1)}KB`);

          } catch (downloadError) {
            console.error('[TRANSCRIBE] Download error:', downloadError);
            retries--;
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        if (!audioBlob) continue;

        // Check file size (Whisper API has a 25MB limit)
        if (audioBlob.size > 25 * 1024 * 1024) {
          console.log(`[TRANSCRIBE] Video too large: ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB`);
          
          await supabase
            .from('meta_creative_insights')
            .update({ transcription_status: 'too_large' })
            .eq('id', video.id);
          
          skipped++;
          continue;
        }

        // Send to OpenAI Whisper API
        const formData = new FormData();
        const ext = audioBlob.type.includes('webm') ? 'webm' : 
                    audioBlob.type.includes('ogg') ? 'ogg' : 'mp4';
        formData.append('file', audioBlob, `video.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('response_format', 'verbose_json');

        console.log(`[TRANSCRIBE] Sending to Whisper API...`);

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        if (!whisperResponse.ok) {
          const errorText = await whisperResponse.text();
          console.error(`[TRANSCRIBE] Whisper API error:`, errorText);
          
          if (whisperResponse.status === 429) {
            console.log('[TRANSCRIBE] Rate limited, stopping batch');
            break;
          }
          
          await supabase
            .from('meta_creative_insights')
            .update({ transcription_status: 'transcription_failed' })
            .eq('id', video.id);
          
          errors++;
          continue;
        }

        const result = await whisperResponse.json();
        const transcript = result.text;
        const duration = result.duration || null;
        const confidence = result.segments?.[0]?.avg_logprob 
          ? Math.exp(result.segments[0].avg_logprob) 
          : null;

        console.log(`[TRANSCRIBE] Success: "${transcript.substring(0, 80)}..."`);

        // Extract key quotes
        const sentences = transcript.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        const keyQuotes = sentences
          .filter((s: string) => s.trim().split(/\s+/).length >= 5)
          .slice(0, 5)
          .map((s: string) => s.trim());

        // Update database with transcript and duration
        const { error: updateError } = await supabase
          .from('meta_creative_insights')
          .update({
            audio_transcript: transcript,
            transcript_confidence: confidence,
            transcription_status: 'completed',
            key_quotes: keyQuotes,
            video_duration_seconds: duration ? Math.round(duration) : null,
            // Clear analyzed_at to trigger re-analysis with transcript
            analyzed_at: null,
          })
          .eq('id', video.id);

        if (updateError) {
          console.error(`[TRANSCRIBE] Update error:`, updateError);
          errors++;
          continue;
        }

        transcribed++;

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (videoError) {
        console.error(`[TRANSCRIBE] Error processing ${video.id}:`, videoError);
        
        await supabase
          .from('meta_creative_insights')
          .update({ transcription_status: 'failed' })
          .eq('id', video.id);
        
        errors++;
      }
    }

    console.log(`[TRANSCRIBE] Complete. Transcribed: ${transcribed}, Skipped: ${skipped}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcribed,
        skipped,
        errors,
        total: videos.length,
        message: transcribed > 0 
          ? `Transcribed ${transcribed} videos` 
          : skipped > 0 
            ? `${skipped} videos require Meta API credentials`
            : `${errors} transcription errors occurred`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[TRANSCRIBE] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
