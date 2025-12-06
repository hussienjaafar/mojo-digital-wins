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

    // Check for API keys
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!openaiApiKey && !lovableApiKey) {
      throw new Error('No transcription API key configured (OPENAI_API_KEY or LOVABLE_API_KEY)');
    }

    const { organization_id, batch_size = 5, creative_id } = await req.json();

    console.log(`Starting video transcription${organization_id ? ` for org: ${organization_id}` : ''}`);

    // Get Meta API credentials for the organization to access videos
    let metaAccessToken: string | null = null;
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
      }
    }

    // Build query for videos needing transcription
    let query = supabase
      .from('meta_creative_insights')
      .select('id, video_url, campaign_id, creative_id, creative_type')
      .eq('creative_type', 'video')
      .not('video_url', 'is', null)
      .is('audio_transcript', null)
      .or('transcription_status.is.null,transcription_status.eq.pending')
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
      console.log('No videos pending transcription');
      return new Response(
        JSON.stringify({ success: true, transcribed: 0, message: 'No videos pending transcription' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${videos.length} videos to transcribe`);

    let transcribed = 0;
    let errors = 0;
    let skipped = 0;

    for (const video of videos) {
      try {
        console.log(`Processing video ${video.id}: ${video.video_url?.substring(0, 50)}...`);

        // Mark as processing
        await supabase
          .from('meta_creative_insights')
          .update({ transcription_status: 'processing' })
          .eq('id', video.id);

        // Try to get actual video URL from Meta Graph API
        let actualVideoUrl: string | null = null;
        
        // Check if we have a Facebook video page URL (not a direct video file)
        const isFacebookVideoPage = video.video_url.includes('facebook.com/video.php') || 
                                     video.video_url.includes('fb.watch');
        
        if (isFacebookVideoPage && metaAccessToken && video.creative_id) {
          console.log(`Fetching actual video URL from Meta API for creative ${video.creative_id}`);
          
          try {
            // Try to get video source from the ad creative
            const graphResponse = await fetch(
              `https://graph.facebook.com/v18.0/${video.creative_id}?fields=video_id,effective_object_story_id,object_story_spec&access_token=${metaAccessToken}`
            );
            
            if (graphResponse.ok) {
              const graphData = await graphResponse.json();
              const videoId = graphData.video_id;
              
              if (videoId) {
                // Get the video source URL
                const videoResponse = await fetch(
                  `https://graph.facebook.com/v18.0/${videoId}?fields=source&access_token=${metaAccessToken}`
                );
                
                if (videoResponse.ok) {
                  const videoData = await videoResponse.json();
                  actualVideoUrl = videoData.source;
                  console.log(`Got actual video URL from Meta API`);
                }
              }
            }
          } catch (graphError) {
            console.error('Meta Graph API error:', graphError);
          }
        }

        // If we couldn't get a direct URL from Meta API, check if the URL is already a direct video
        if (!actualVideoUrl) {
          // Check if URL looks like a direct video file
          const isDirectVideo = /\.(mp4|m4a|webm|ogg|mp3)(\?|$)/i.test(video.video_url);
          if (isDirectVideo) {
            actualVideoUrl = video.video_url;
          }
        }

        if (!actualVideoUrl) {
          console.log(`Cannot access video - Facebook page URL requires Meta API access token`);
          
          await supabase
            .from('meta_creative_insights')
            .update({ 
              transcription_status: 'requires_meta_auth',
              verbal_themes: ['Video requires Meta API access token for transcription. Configure Meta credentials in API settings.']
            })
            .eq('id', video.id);
          
          skipped++;
          continue;
        }

        // Download the video
        let audioBlob: Blob | null = null;
        
        try {
          console.log(`Downloading video from: ${actualVideoUrl.substring(0, 80)}...`);
          
          const videoResponse = await fetch(actualVideoUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CreativeAnalyzer/1.0)'
            }
          });

          if (!videoResponse.ok) {
            console.log(`Video fetch failed with status ${videoResponse.status}`);
            
            await supabase
              .from('meta_creative_insights')
              .update({ 
                transcription_status: 'download_failed',
                verbal_themes: [`Video download failed: HTTP ${videoResponse.status}`]
              })
              .eq('id', video.id);
            
            errors++;
            continue;
          }

          // Check content type
          const contentType = videoResponse.headers.get('content-type') || '';
          console.log(`Video content-type: ${contentType}`);
          
          if (contentType.includes('text/html')) {
            console.log('Received HTML instead of video - URL requires authentication');
            
            await supabase
              .from('meta_creative_insights')
              .update({ 
                transcription_status: 'requires_meta_auth',
                verbal_themes: ['Video URL returned HTML page. Configure Meta API credentials for access.']
              })
              .eq('id', video.id);
            
            skipped++;
            continue;
          }

          const videoBuffer = await videoResponse.arrayBuffer();
          
          // Determine proper MIME type for Whisper
          let mimeType = 'video/mp4';
          if (contentType.includes('webm')) mimeType = 'video/webm';
          else if (contentType.includes('mpeg')) mimeType = 'video/mpeg';
          else if (contentType.includes('ogg')) mimeType = 'audio/ogg';
          else if (contentType.includes('mp3') || contentType.includes('mpeg')) mimeType = 'audio/mpeg';
          
          audioBlob = new Blob([videoBuffer], { type: mimeType });
          
          console.log(`Downloaded video ${video.id}, size: ${(audioBlob.size / 1024).toFixed(1)}KB, type: ${mimeType}`);

        } catch (downloadError) {
          console.error(`Failed to download video ${video.id}:`, downloadError);
          
          await supabase
            .from('meta_creative_insights')
            .update({ 
              transcription_status: 'download_failed',
              verbal_themes: ['Failed to download video for transcription']
            })
            .eq('id', video.id);
          
          errors++;
          continue;
        }

        // Check file size (Whisper API has a 25MB limit)
        if (audioBlob.size > 25 * 1024 * 1024) {
          console.log(`Video ${video.id} too large for transcription (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB)`);
          
          await supabase
            .from('meta_creative_insights')
            .update({ 
              transcription_status: 'too_large',
              verbal_themes: ['Video exceeds 25MB limit for transcription']
            })
            .eq('id', video.id);
          
          skipped++;
          continue;
        }

        // Send to OpenAI Whisper API
        const formData = new FormData();
        
        // Use correct file extension based on MIME type
        const ext = audioBlob.type.includes('webm') ? 'webm' : 
                    audioBlob.type.includes('ogg') ? 'ogg' : 'mp4';
        formData.append('file', audioBlob, `video.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('response_format', 'verbose_json');

        console.log(`Sending video ${video.id} to Whisper API...`);

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        if (!whisperResponse.ok) {
          const errorText = await whisperResponse.text();
          console.error(`Whisper API error for ${video.id}:`, errorText);
          
          if (whisperResponse.status === 429) {
            console.log('Rate limited, stopping batch');
            break;
          }
          
          await supabase
            .from('meta_creative_insights')
            .update({ 
              transcription_status: 'transcription_failed',
              verbal_themes: ['Whisper API transcription failed: ' + (JSON.parse(errorText)?.error?.message || 'Unknown error')]
            })
            .eq('id', video.id);
          
          errors++;
          continue;
        }

        const transcriptionResult = await whisperResponse.json();
        const transcript = transcriptionResult.text;
        const confidence = transcriptionResult.segments?.[0]?.avg_logprob 
          ? Math.exp(transcriptionResult.segments[0].avg_logprob) 
          : null;

        console.log(`Transcribed video ${video.id}: "${transcript.substring(0, 100)}..."`);

        // Extract key quotes (sentences over 5 words)
        const sentences = transcript.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        const keyQuotes = sentences
          .filter((s: string) => s.trim().split(/\s+/).length >= 5)
          .slice(0, 5)
          .map((s: string) => s.trim());

        // Update the database
        const { error: updateError } = await supabase
          .from('meta_creative_insights')
          .update({
            audio_transcript: transcript,
            transcript_confidence: confidence,
            transcription_status: 'completed',
            key_quotes: keyQuotes,
          })
          .eq('id', video.id);

        if (updateError) {
          console.error(`Failed to update video ${video.id}:`, updateError);
          errors++;
          continue;
        }

        transcribed++;
        console.log(`Successfully transcribed video ${video.id}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (videoError) {
        console.error(`Error processing video ${video.id}:`, videoError);
        
        await supabase
          .from('meta_creative_insights')
          .update({ transcription_status: 'failed' })
          .eq('id', video.id);
        
        errors++;
      }
    }

    // Now trigger re-analysis for transcribed videos
    if (transcribed > 0 && organization_id) {
      console.log(`Triggering re-analysis for ${transcribed} transcribed videos`);
      
      try {
        await supabase
          .from('meta_creative_insights')
          .update({ analyzed_at: null })
          .eq('organization_id', organization_id)
          .eq('transcription_status', 'completed')
          .not('audio_transcript', 'is', null);
      } catch (reanalysisError) {
        console.error('Failed to trigger re-analysis:', reanalysisError);
      }
    }

    console.log(`Transcription complete. Transcribed: ${transcribed}, Skipped: ${skipped}, Errors: ${errors}`);

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
            ? `${skipped} videos require Meta API credentials. Configure in API Settings.`
            : `${errors} transcription errors occurred`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in transcribe-video-creative:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
