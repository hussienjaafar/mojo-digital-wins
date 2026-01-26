/**
 * =============================================================================
 * TRANSCRIBE META AD VIDEO
 * =============================================================================
 *
 * Downloads a video from its source URL and transcribes it using OpenAI Whisper.
 * Then analyzes the transcript for tone, topic, hook structure, and other features.
 *
 * Modes:
 * - Single video: Provide video_id to transcribe one video
 * - Batch: Provide organization_id + limit to process pending videos
 *
 * Features analyzed:
 * - Speaker count and words per minute
 * - Hook (first 3 seconds)
 * - Topic classification
 * - Tone analysis (urgent, hopeful, angry, etc.)
 * - Sentiment score
 * - Call-to-action detection
 * - Key phrases extraction
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
  // Specific issue extraction (NEW - replaces generic categories)
  issue_primary: string;           // e.g., "anti-Israel military aid", "pro-immigration anti-Laken Riley"
  issue_tags: string[];            // All specific issues mentioned
  political_stances: string[];     // e.g., ["anti-AIPAC", "pro-ceasefire", "anti-incumbent"]
  targets_attacked: string[];      // People/orgs criticized: ["Ritchie Torres", "AIPAC", "Netanyahu"]
  targets_supported: string[];     // People/orgs praised: ["Michael Blake", "progressive movement"]
  policy_positions: string[];      // Specific policies: ["end military aid to Israel", "Medicare for All"]

  // Keep generic topic for backwards compatibility
  topic_primary: string;
  topic_tags: string[];

  // Tone and sentiment
  tone_primary: string;
  tone_tags: string[];
  sentiment_score: number;
  sentiment_label: string;

  // Donor psychology (from analyze-creative-motivation approach)
  donor_pain_points: string[];     // What problems/injustices compel donation
  values_appealed: string[];       // Core values triggered
  urgency_drivers: string[];       // Why donate NOW

  // CTA and structure
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
 * Download video to memory and return as blob
 */
async function downloadVideo(sourceUrl: string): Promise<Blob | null> {
  try {
    console.log(`[TRANSCRIBE] Downloading video from: ${sourceUrl.substring(0, 80)}...`);
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      console.error(`[TRANSCRIBE] Download failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const blob = await response.blob();
    console.log(`[TRANSCRIBE] Downloaded ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return blob;
  } catch (err) {
    console.error(`[TRANSCRIBE] Download error:`, err);
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
    console.log(`[TRANSCRIBE] Calling Whisper API...`);

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
      console.error(`[TRANSCRIBE] Whisper API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`[TRANSCRIBE] Transcription complete. Duration: ${result.duration}s, Language: ${result.language}`);

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
    console.error(`[TRANSCRIBE] Whisper error:`, err);
    return null;
  }
}

/**
 * Analyze transcript using GPT-4 for content features
 */
async function analyzeTranscript(
  transcript: string,
  openaiApiKey: string
): Promise<AnalysisResult | null> {
  try {
    console.log(`[TRANSCRIBE] Analyzing transcript with GPT-4...`);

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
  Examples: "AIPAC buying elections", "immigrants being persecuted", "politicians ignoring constituents"
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
      console.error(`[TRANSCRIBE] GPT-4 API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`[TRANSCRIBE] No content in GPT-4 response`);
      return null;
    }

    const analysis = JSON.parse(content);
    console.log(`[TRANSCRIBE] Analysis complete. Topic: ${analysis.topic_primary}, Tone: ${analysis.tone_primary}`);

    return analysis;
  } catch (err) {
    console.error(`[TRANSCRIBE] Analysis error:`, err);
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

  // Calculate silence percentage from segment gaps
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

  // Limit to first 15 words
  const limitedText = words.slice(0, 15).join(' ');

  return {
    text: limitedText,
    duration: hookSegments.length > 0 ? Math.min(hookSegments[hookSegments.length - 1].end, maxSeconds) : 0,
    wordCount: Math.min(words.length, 15),
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      organization_id,
      video_id,
      ad_id,
      limit = 5,
      mode = 'single', // 'single' or 'batch'
    } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get videos to process
    let videosToProcess: any[] = [];

    if (mode === 'single' && video_id) {
      // Single video mode
      const { data, error } = await supabase
        .from('meta_ad_videos')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('video_id', video_id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Video not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      videosToProcess = [data];
    } else {
      // Batch mode - get pending videos with source URLs
      const { data, error } = await supabase
        .from('meta_ad_videos')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('status', 'URL_FETCHED')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      videosToProcess = data || [];
    }

    console.log(`[TRANSCRIBE] Processing ${videosToProcess.length} videos`);

    // Stats
    let transcribed = 0;
    let failed = 0;
    const results: Array<{ video_id: string; status: string; error?: string }> = [];

    for (const video of videosToProcess) {
      console.log(`[TRANSCRIBE] Processing video ${video.video_id} for ad ${video.ad_id}`);

      // Check if source URL exists
      if (!video.video_source_url) {
        console.log(`[TRANSCRIBE] No source URL for video ${video.video_id}, skipping`);
        results.push({ video_id: video.video_id, status: 'skipped', error: 'No source URL' });
        continue;
      }

      // Download video
      const videoBlob = await downloadVideo(video.video_source_url);
      if (!videoBlob) {
        // Update status to URL_EXPIRED or error
        await supabase
          .from('meta_ad_videos')
          .update({
            status: 'URL_EXPIRED',
            error_code: 'DOWNLOAD_FAILED',
            error_message: 'Failed to download video - URL may have expired',
            last_error_at: new Date().toISOString(),
            retry_count: (video.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', video.id);

        failed++;
        results.push({ video_id: video.video_id, status: 'failed', error: 'Download failed' });
        continue;
      }

      // Update status to DOWNLOADED
      await supabase
        .from('meta_ad_videos')
        .update({
          status: 'DOWNLOADED',
          downloaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', video.id);

      // Transcribe with Whisper
      const transcription = await transcribeWithWhisper(videoBlob, openaiApiKey);
      if (!transcription) {
        await supabase
          .from('meta_ad_videos')
          .update({
            status: 'TRANSCRIPT_FAILED',
            error_code: 'WHISPER_FAILED',
            error_message: 'Whisper transcription failed',
            last_error_at: new Date().toISOString(),
            retry_count: (video.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', video.id);

        failed++;
        results.push({ video_id: video.video_id, status: 'failed', error: 'Transcription failed' });
        continue;
      }

      // Analyze transcript
      const analysis = await analyzeTranscript(transcription.text, openaiApiKey);

      // Calculate speaking metrics
      const speakingMetrics = calculateSpeakingMetrics(
        transcription.text,
        transcription.duration,
        transcription.segments
      );

      // Extract hook
      const hook = extractHook(transcription.segments);

      // Store transcript
      const { error: transcriptError } = await supabase
        .from('meta_ad_transcripts')
        .upsert({
          organization_id,
          ad_id: video.ad_id,
          video_id: video.video_id,
          video_ref: video.id,
          transcript_text: transcription.text,
          transcript_segments: transcription.segments,
          duration_seconds: transcription.duration,
          language: transcription.language,
          language_confidence: 0.95, // Whisper doesn't return confidence, assume high
          speaker_count: analysis?.speaker_count || 1,
          words_total: speakingMetrics.wordsTotal,
          words_per_minute: speakingMetrics.wordsPerMinute,
          silence_percentage: speakingMetrics.silencePercentage,
          hook_text: analysis?.hook_text || hook.text,
          hook_duration_seconds: hook.duration,
          hook_word_count: analysis?.hook_word_count || hook.wordCount,

          // SPECIFIC ISSUE EXTRACTION (NEW)
          issue_primary: analysis?.issue_primary || null,
          issue_tags: analysis?.issue_tags || [],
          political_stances: analysis?.political_stances || [],
          targets_attacked: analysis?.targets_attacked || [],
          targets_supported: analysis?.targets_supported || [],
          policy_positions: analysis?.policy_positions || [],
          donor_pain_points: analysis?.donor_pain_points || [],
          values_appealed: analysis?.values_appealed || [],
          urgency_drivers: analysis?.urgency_drivers || [],

          // Generic topic (backwards compatibility)
          topic_primary: analysis?.topic_primary || null,
          topic_tags: analysis?.topic_tags || [],

          // Tone and sentiment
          tone_primary: analysis?.tone_primary || null,
          tone_tags: analysis?.tone_tags || [],
          sentiment_score: analysis?.sentiment_score || null,
          sentiment_label: analysis?.sentiment_label || null,

          // CTA and structure
          cta_text: analysis?.cta_text || null,
          cta_type: analysis?.cta_type || null,
          urgency_level: analysis?.urgency_level || null,
          emotional_appeals: analysis?.emotional_appeals || [],
          key_phrases: analysis?.key_phrases || [],

          // Metadata
          transcription_model: 'whisper-1',
          transcription_confidence: 0.95,
          analysis_model: analysis ? 'gpt-4-turbo-preview' : null,
          analysis_version: '2.0', // Bumped version for specific issue extraction
          transcribed_at: new Date().toISOString(),
          analyzed_at: analysis ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,ad_id,video_id'
        });

      if (transcriptError) {
        console.error(`[TRANSCRIBE] Error storing transcript:`, transcriptError);
        failed++;
        results.push({ video_id: video.video_id, status: 'failed', error: 'Database error' });
        continue;
      }

      // Update video status
      await supabase
        .from('meta_ad_videos')
        .update({
          status: 'TRANSCRIBED',
          duration_seconds: transcription.duration,
          transcribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', video.id);

      transcribed++;
      results.push({ video_id: video.video_id, status: 'transcribed' });
      console.log(`[TRANSCRIBE] Successfully transcribed video ${video.video_id}`);
    }

    console.log(`[TRANSCRIBE] Complete. Transcribed: ${transcribed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          processed: videosToProcess.length,
          transcribed,
          failed,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[TRANSCRIBE] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
