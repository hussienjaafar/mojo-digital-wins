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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { organization_id, batch_size = 5, creative_id } = await req.json();

    console.log(`Starting video transcription${organization_id ? ` for org: ${organization_id}` : ''}`);

    // Build query for videos needing transcription
    let query = supabase
      .from('meta_creative_insights')
      .select('id, video_url, campaign_id, creative_type')
      .eq('creative_type', 'video')
      .not('video_url', 'is', null)
      .is('audio_transcript', null)
      .in('transcription_status', ['pending', null])
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

        // Try to fetch the video
        // Note: Facebook video URLs often require authentication
        // We'll attempt direct fetch first, then fallback
        let audioBlob: Blob | null = null;
        
        try {
          const videoResponse = await fetch(video.video_url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CreativeAnalyzer/1.0)'
            }
          });

          if (!videoResponse.ok) {
            console.log(`Video fetch failed with status ${videoResponse.status}, marking as requires auth`);
            
            // Update status to indicate auth needed
            await supabase
              .from('meta_creative_insights')
              .update({ 
                transcription_status: 'requires_auth',
                verbal_themes: ['Video requires Meta authentication to access']
              })
              .eq('id', video.id);
            
            skipped++;
            continue;
          }

          const videoBuffer = await videoResponse.arrayBuffer();
          
          // For now, we'll send the video directly to Whisper
          // In production, you might want to extract audio first using FFmpeg
          audioBlob = new Blob([videoBuffer], { type: 'video/mp4' });
          
          console.log(`Downloaded video ${video.id}, size: ${audioBlob.size} bytes`);

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
        formData.append('file', audioBlob, 'video.mp4');
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
              verbal_themes: ['Whisper API transcription failed']
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

        // Extract key quotes (sentences over 10 words)
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
        // Reset analyzed_at to trigger re-analysis with transcript
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
        message: `Transcribed ${transcribed} videos` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in transcribe-video-creative:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
