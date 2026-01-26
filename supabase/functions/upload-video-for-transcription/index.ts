/**
 * =============================================================================
 * UPLOAD VIDEO FOR TRANSCRIPTION
 * =============================================================================
 *
 * Accepts video files directly (bypassing Meta API restrictions) and transcribes
 * them using OpenAI Whisper + GPT-4 for specific issue extraction.
 *
 * Usage:
 * 1. Upload video to Supabase Storage (or provide external URL)
 * 2. Call this function with the storage path or URL
 * 3. Function downloads, transcribes, and analyzes the video
 *
 * This solves the Meta API video source URL restriction by allowing manual
 * video downloads from Ads Manager to be transcribed.
 *
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  duration: number;
}

interface AnalysisResult {
  issue_primary: string;
  issue_tags: string[];
  political_stances: string[];
  targets_attacked: string[];
  targets_supported: string[];
  policy_positions: string[];
  donor_pain_points: string[];
  values_appealed: string[];
  urgency_drivers: string[];
  topic_primary: string;
  topic_tags: string[];
  tone_primary: string;
  tone_tags: string[];
  sentiment_score: number;
  sentiment_label: string;
  cta_text: string | null;
  cta_type: string | null;
  urgency_level: string;
  emotional_appeals: string[];
  key_phrases: string[];
  hook_text: string;
  hook_word_count: number;
  speaker_count: number;
}

/**
 * Download video from URL or Supabase Storage
 */
async function downloadVideo(
  source: string,
  supabase: any
): Promise<Blob | null> {
  try {
    // Check if it's a Supabase Storage path
    if (source.startsWith('videos/') || source.startsWith('/videos/')) {
      console.log(`[UPLOAD-TRANSCRIBE] Downloading from Supabase Storage: ${source}`);
      const { data, error } = await supabase.storage
        .from('uploads')
        .download(source.replace(/^\//, ''));

      if (error) {
        console.error(`[UPLOAD-TRANSCRIBE] Storage download error:`, error);
        return null;
      }
      return data;
    }

    // Otherwise treat as external URL
    console.log(`[UPLOAD-TRANSCRIBE] Downloading from URL: ${source.substring(0, 80)}...`);
    const response = await fetch(source);

    if (!response.ok) {
      console.error(`[UPLOAD-TRANSCRIBE] Download failed: ${response.status}`);
      return null;
    }

    const blob = await response.blob();
    console.log(`[UPLOAD-TRANSCRIBE] Downloaded ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return blob;
  } catch (err) {
    console.error(`[UPLOAD-TRANSCRIBE] Download error:`, err);
    return null;
  }
}

/**
 * Transcribe video using OpenAI Whisper API
 */
async function transcribeWithWhisper(
  videoBlob: Blob,
  openaiApiKey: string
): Promise<TranscriptionResult | null> {
  try {
    console.log(`[UPLOAD-TRANSCRIBE] Calling Whisper API...`);

    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UPLOAD-TRANSCRIBE] Whisper error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`[UPLOAD-TRANSCRIBE] Transcription complete. Duration: ${result.duration}s`);

    return {
      text: result.text,
      segments: (result.segments || []).map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
      language: result.language,
      duration: result.duration,
    };
  } catch (err) {
    console.error(`[UPLOAD-TRANSCRIBE] Whisper error:`, err);
    return null;
  }
}

/**
 * Analyze transcript using GPT-4 with v2.0 specific issue extraction
 */
async function analyzeTranscript(
  transcript: string,
  openaiApiKey: string
): Promise<AnalysisResult | null> {
  try {
    console.log(`[UPLOAD-TRANSCRIBE] Analyzing with GPT-4 v2.0 prompt...`);

    const systemPrompt = `You are an expert at analyzing political and nonprofit fundraising video ad scripts.
Your job is to extract SPECIFIC issues, stances, and targets - NOT generic categories.

CRITICAL: Be VERY SPECIFIC about what the ad is actually about:
- NOT "foreign policy" but "anti-Israel military aid" or "pro-ceasefire Gaza"
- NOT "immigration" but "anti-Laken Riley Act pro-immigrant" or "sanctuary city defense"
- NOT "democracy" but "anti-AIPAC money in politics" or "anti-Ritchie Torres sellout"

Return a JSON object with these fields:

SPECIFIC ISSUES (most important):
- issue_primary: The EXACT issue being discussed (e.g., "anti-Israel military aid", "pro-immigration anti-deportation", "anti-AIPAC corruption")
- issue_tags: Array of ALL specific issues mentioned
- political_stances: Array of stances taken (e.g., ["anti-AIPAC", "pro-ceasefire", "anti-incumbent", "pro-immigrant rights"])
- targets_attacked: People/orgs being criticized (e.g., ["Ritchie Torres", "AIPAC", "Netanyahu", "Trump"])
- targets_supported: People/orgs being praised (e.g., ["Michael Blake", "progressive movement", "immigrant community"])
- policy_positions: Specific policies advocated (e.g., ["end military aid to Israel", "stop deportations", "Medicare for All"])

DONOR PSYCHOLOGY:
- donor_pain_points: What specific problems/injustices would compel someone to donate? Be specific!
- values_appealed: Core values being triggered (e.g., ["justice", "solidarity", "anti-corruption", "community empowerment"])
- urgency_drivers: Why must they donate NOW? (e.g., ["primary election deadline", "matching gift expires", "crisis moment"])

GENERIC TOPIC (for backwards compatibility):
- topic_primary: General category (immigration, healthcare, economy, climate, foreign_policy, elections, civil_rights, other)
- topic_tags: Array of general topics

TONE AND SENTIMENT:
- tone_primary: Primary tone (urgent, hopeful, angry, compassionate, fearful, inspiring, informative, personal_story)
- tone_tags: Array of all detected tones
- sentiment_score: Number from -1 (very negative about status quo) to 1 (very positive/hopeful)
- sentiment_label: "positive", "negative", or "neutral"

CTA AND STRUCTURE:
- cta_text: The call-to-action phrase if present, or null
- cta_type: One of: "donate", "sign_petition", "share", "learn_more", "volunteer", "vote", or null
- urgency_level: "low", "medium", "high", or "extreme"
- emotional_appeals: Array of emotions targeted (fear, hope, anger, compassion, pride, guilt, solidarity, outrage)
- key_phrases: Top 5 most impactful phrases from the transcript
- hook_text: First 15 words or first sentence, whichever is shorter
- hook_word_count: Number of words in the hook
- speaker_count: Estimated number of distinct speakers (1 if single narrator)`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this video ad transcript:\n\n${transcript}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UPLOAD-TRANSCRIBE] GPT-4 error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`[UPLOAD-TRANSCRIBE] No content in GPT-4 response`);
      return null;
    }

    const analysis = JSON.parse(content);
    console.log(`[UPLOAD-TRANSCRIBE] Analysis complete. Issue: ${analysis.issue_primary}`);

    return analysis;
  } catch (err) {
    console.error(`[UPLOAD-TRANSCRIBE] Analysis error:`, err);
    return null;
  }
}

/**
 * Calculate speaking metrics from transcript
 */
function calculateSpeakingMetrics(
  transcript: string,
  durationSeconds: number,
  segments: TranscriptSegment[]
): { wordsTotal: number; wordsPerMinute: number; silencePercentage: number } {
  const words = transcript.split(/\s+/).filter(w => w.length > 0);
  const wordsTotal = words.length;
  const durationMinutes = durationSeconds / 60;
  const wordsPerMinute = durationMinutes > 0 ? wordsTotal / durationMinutes : 0;

  let speakingTime = 0;
  for (const segment of segments) {
    speakingTime += segment.end - segment.start;
  }
  const silencePercentage = durationSeconds > 0
    ? ((durationSeconds - speakingTime) / durationSeconds) * 100
    : 0;

  return { wordsTotal, wordsPerMinute, silencePercentage };
}

/**
 * Extract hook from first few seconds
 */
function extractHook(
  segments: TranscriptSegment[],
  maxSeconds: number = 3
): { text: string; duration: number; wordCount: number } {
  const hookSegments = segments.filter(s => s.start < maxSeconds);
  const text = hookSegments.map(s => s.text).join(' ').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const limitedText = words.slice(0, 15).join(' ');

  return {
    text: limitedText,
    duration: hookSegments.length > 0 ? Math.min(hookSegments[hookSegments.length - 1].end, maxSeconds) : 0,
    wordCount: Math.min(words.length, 15),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      organization_id,
      video_id,
      ad_id,
      video_source,      // URL or Supabase Storage path
      video_base64,      // Alternative: base64 encoded video
      filename,          // Original filename for base64 uploads
    } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!video_source && !video_base64) {
      return new Response(
        JSON.stringify({ error: 'video_source (URL/path) or video_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[UPLOAD-TRANSCRIBE] Starting for org ${organization_id}, video ${video_id || 'new'}`);

    // Get video blob
    let videoBlob: Blob | null = null;

    if (video_base64) {
      // Decode base64 video
      const binaryString = atob(video_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      videoBlob = new Blob([bytes], { type: 'video/mp4' });
      console.log(`[UPLOAD-TRANSCRIBE] Decoded base64 video: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      videoBlob = await downloadVideo(video_source, supabase);
    }

    if (!videoBlob) {
      return new Response(
        JSON.stringify({ error: 'Failed to download/decode video' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transcribe with Whisper
    const transcription = await transcribeWithWhisper(videoBlob, openaiApiKey);
    if (!transcription) {
      return new Response(
        JSON.stringify({ error: 'Transcription failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze transcript with GPT-4 v2.0
    const analysis = await analyzeTranscript(transcription.text, openaiApiKey);

    // Calculate metrics
    const speakingMetrics = calculateSpeakingMetrics(
      transcription.text,
      transcription.duration,
      transcription.segments
    );

    const hook = extractHook(transcription.segments);

    // Generate video_id if not provided
    const finalVideoId = video_id || `manual_${Date.now()}`;
    const finalAdId = ad_id || `manual_${Date.now()}`;

    // Update meta_ad_videos if video_id was provided
    if (video_id) {
      await supabase
        .from('meta_ad_videos')
        .update({
          status: 'TRANSCRIBED',
          video_source_url: video_source || 'base64_upload',
          duration_seconds: transcription.duration,
          transcribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_code: null,
          error_message: null,
        })
        .eq('video_id', video_id)
        .eq('organization_id', organization_id);
    }

    // Store transcript
    const { error: transcriptError } = await supabase
      .from('meta_ad_transcripts')
      .upsert({
        organization_id,
        ad_id: finalAdId,
        video_id: finalVideoId,
        transcript_text: transcription.text,
        transcript_segments: transcription.segments,
        duration_seconds: transcription.duration,
        language: transcription.language,
        language_confidence: 0.95,
        speaker_count: analysis?.speaker_count || 1,
        words_total: speakingMetrics.wordsTotal,
        words_per_minute: speakingMetrics.wordsPerMinute,
        silence_percentage: speakingMetrics.silencePercentage,
        hook_text: analysis?.hook_text || hook.text,
        hook_duration_seconds: hook.duration,
        hook_word_count: analysis?.hook_word_count || hook.wordCount,

        // v2.0 Specific issue extraction
        issue_primary: analysis?.issue_primary || null,
        issue_tags: analysis?.issue_tags || [],
        political_stances: analysis?.political_stances || [],
        targets_attacked: analysis?.targets_attacked || [],
        targets_supported: analysis?.targets_supported || [],
        policy_positions: analysis?.policy_positions || [],
        donor_pain_points: analysis?.donor_pain_points || [],
        values_appealed: analysis?.values_appealed || [],
        urgency_drivers: analysis?.urgency_drivers || [],

        // Generic fields
        topic_primary: analysis?.topic_primary || null,
        topic_tags: analysis?.topic_tags || [],
        tone_primary: analysis?.tone_primary || null,
        tone_tags: analysis?.tone_tags || [],
        sentiment_score: analysis?.sentiment_score || null,
        sentiment_label: analysis?.sentiment_label || null,
        cta_text: analysis?.cta_text || null,
        cta_type: analysis?.cta_type || null,
        urgency_level: analysis?.urgency_level || null,
        emotional_appeals: analysis?.emotional_appeals || [],
        key_phrases: analysis?.key_phrases || [],

        // Metadata
        transcription_model: 'whisper-1',
        transcription_confidence: 0.95,
        analysis_model: analysis ? 'gpt-4-turbo-preview' : null,
        analysis_version: '2.0',
        transcribed_at: new Date().toISOString(),
        analyzed_at: analysis ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,ad_id,video_id'
      });

    if (transcriptError) {
      console.error(`[UPLOAD-TRANSCRIBE] Error storing transcript:`, transcriptError);
      return new Response(
        JSON.stringify({ error: `Database error: ${transcriptError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[UPLOAD-TRANSCRIBE] Success! Video ${finalVideoId} transcribed with v2.0 analysis`);

    return new Response(
      JSON.stringify({
        success: true,
        video_id: finalVideoId,
        ad_id: finalAdId,
        duration_seconds: transcription.duration,
        words_total: speakingMetrics.wordsTotal,
        issue_primary: analysis?.issue_primary || null,
        political_stances: analysis?.political_stances || [],
        targets_attacked: analysis?.targets_attacked || [],
        analysis_version: '2.0',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[UPLOAD-TRANSCRIBE] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
