/**
 * =============================================================================
 * TRANSCRIBE META AD VIDEO - v2.0
 * =============================================================================
 *
 * Downloads a video from its source URL and transcribes it using OpenAI Whisper.
 * Then analyzes the transcript for specific political issues, stances, and targets.
 *
 * Modes:
 * - Single video: Provide video_id to transcribe one video
 * - Batch: Provide organization_id + limit to process pending videos
 *
 * Features analyzed (v2.0 - Specific Issue Extraction):
 * - issue_primary: Specific issue position (not generic topics)
 * - political_stances: Specific policy positions taken
 * - targets_attacked: People/organizations criticized
 * - targets_supported: People/organizations endorsed
 * - donor_pain_points: Fears/frustrations targeted
 * - values_appealed: Core values referenced
 * - urgency_drivers: Why action needed now
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
  // Specific issue extraction (v2.0)
  issue_primary: string;
  issue_tags: string[];
  political_stances: string[];
  targets_attacked: string[];
  targets_supported: string[];
  policy_positions: string[];
  donor_pain_points: string[];
  values_appealed: string[];
  urgency_drivers: string[];
  
  // Original fields
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
 * Extract filename from URL with valid Whisper-compatible extension
 */
function getFilenameFromUrl(url: string): string {
  const validExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'audio.m4a';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && validExtensions.includes(ext)) {
      return filename;
    }
    // Default to m4a if extension is unrecognized (common for extracted audio)
    return 'audio.m4a';
  } catch {
    return 'audio.m4a';
  }
}

/**
 * Download media to memory and return as blob with detected filename
 */
async function downloadMedia(sourceUrl: string): Promise<{ blob: Blob; filename: string } | null> {
  try {
    console.log(`[TRANSCRIBE] Downloading media from: ${sourceUrl.substring(0, 80)}...`);
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      console.error(`[TRANSCRIBE] Download failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const blob = await response.blob();
    const filename = getFilenameFromUrl(sourceUrl);
    console.log(`[TRANSCRIBE] Downloaded ${(blob.size / 1024 / 1024).toFixed(2)} MB as ${filename}`);
    return { blob, filename };
  } catch (err) {
    console.error(`[TRANSCRIBE] Download error:`, err);
    return null;
  }
}

/**
 * Transcribe media using OpenAI Whisper API
 */
async function transcribeWithWhisper(
  mediaBlob: Blob,
  filename: string,
  openaiApiKey: string
): Promise<TranscriptionResult | null> {
  try {
    console.log(`[TRANSCRIBE] Calling Whisper API with file: ${filename}...`);

    const formData = new FormData();
    formData.append('file', mediaBlob, filename);
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
 * Analyze transcript using GPT-4 for content features (v2.0 - Specific Issue Extraction)
 */
async function analyzeTranscript(
  transcript: string,
  openaiApiKey: string
): Promise<AnalysisResult | null> {
  try {
    console.log(`[TRANSCRIBE] Analyzing transcript with GPT-4 (v2.0)...`);

    const systemPrompt = `You are an expert political ad analyst. Analyze this video transcript and extract SPECIFIC insights that can be correlated with fundraising performance.

CRITICAL: Be SPECIFIC, not generic. Instead of "immigration", say "pro-immigrant anti-deportation" or "anti-illegal-immigration border-security".

Return a JSON object with:

## SPECIFIC ISSUE FIELDS (most important for v2.0):
- issue_primary: The SPECIFIC issue stance, not generic category. Examples:
  * "pro-immigrant anti-persecution" (not just "immigration")
  * "anti-corporate price-gouging" (not just "economy")
  * "pro-choice abortion-access" (not just "healthcare")
  * "anti-MAGA democracy-defense" (not just "democracy")
  
- issue_tags: Array of 2-5 specific issue positions taken in this ad

- political_stances: Array of specific policy positions. Examples:
  * "anti-deportation", "pro-sanctuary-cities", "path-to-citizenship"
  * "medicare-for-all", "public-option", "drug-price-caps"
  * "assault-weapons-ban", "universal-background-checks"
  
- targets_attacked: People or organizations criticized. Examples:
  * "Donald Trump", "MAGA Republicans", "Project 2025"
  * "Big Pharma", "Insurance Companies", "Billionaires"
  
- targets_supported: People or organizations endorsed/defended. Examples:
  * "immigrants", "working families", "veterans"
  * Specific candidate names if mentioned
  
- policy_positions: Specific policies advocated for:
  * "$15 minimum wage", "Green New Deal", "Roe codification"
  
- donor_pain_points: What fears/frustrations does this target?
  * "fear of family separation", "healthcare bankruptcy", "democracy collapse"
  * "children's safety", "economic insecurity", "loss of rights"
  
- values_appealed: Core values referenced:
  * "patriotism", "family", "freedom", "equality", "justice"
  * "faith", "community", "opportunity", "security"
  
- urgency_drivers: Why action is needed NOW:
  * "election deadline", "legislation pending", "crisis escalating"
  * "matching gift expiring", "milestone goal"

## ORIGINAL FIELDS (for backwards compatibility):
- topic_primary: Generic category (immigration, healthcare, economy, climate, democracy, social_justice, education, gun_safety, reproductive_rights, veterans, other)
- topic_tags: Array of generic topic categories
- tone_primary: Primary tone (urgent, hopeful, angry, compassionate, fearful, inspiring, informative, personal_story)
- tone_tags: Array of all detected tones
- sentiment_score: Number from -1 to 1
- sentiment_label: "positive", "negative", or "neutral"
- cta_text: The call-to-action phrase if present
- cta_type: "donate", "sign_petition", "share", "learn_more", "volunteer", "vote", or null
- urgency_level: "low", "medium", "high", or "extreme"
- emotional_appeals: Array of emotions targeted
- key_phrases: Top 5 most impactful phrases
- hook_text: First 15 words or first sentence
- hook_word_count: Number of words in hook
- speaker_count: Estimated number of distinct speakers`;

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
          { role: 'user', content: `Analyze this political video ad transcript:\n\n${transcript}` },
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
    console.log(`[TRANSCRIBE] Analysis complete. Issue: ${analysis.issue_primary}, Topic: ${analysis.topic_primary}, Tone: ${analysis.tone_primary}`);

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

    /**
     * Helper to check if video has been cancelled
     * Returns true if the video should stop processing
     */
    async function isCancelled(videoDbId: string): Promise<boolean> {
      const { data, error } = await supabase
        .from('meta_ad_videos')
        .select('status')
        .eq('id', videoDbId)
        .single();
      
      if (error || !data) return false;
      return data.status === 'CANCELLED';
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

      // Check if already cancelled before starting
      if (data.status === 'CANCELLED') {
        console.log(`[TRANSCRIBE] Video ${video_id} is cancelled, skipping`);
        return new Response(
          JSON.stringify({ success: true, message: 'Video was cancelled', results: [{ video_id, status: 'cancelled' }] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Check if cancelled before starting
      if (await isCancelled(video.id)) {
        console.log(`[TRANSCRIBE] Video ${video.video_id} was cancelled, skipping`);
        results.push({ video_id: video.video_id, status: 'cancelled' });
        continue;
      }

      // Check if source URL exists
      if (!video.video_source_url) {
        console.log(`[TRANSCRIBE] No source URL for video ${video.video_id}, skipping`);
        results.push({ video_id: video.video_id, status: 'skipped', error: 'No source URL' });
        continue;
      }

      // Download media
      const mediaResult = await downloadMedia(video.video_source_url);
      if (!mediaResult) {
        // Update status to URL_EXPIRED or error
        await supabase
          .from('meta_ad_videos')
          .update({
            status: 'URL_EXPIRED',
            error_code: 'DOWNLOAD_FAILED',
            error_message: 'Failed to download media - URL may have expired',
            last_error_at: new Date().toISOString(),
            retry_count: (video.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', video.id);

        failed++;
        results.push({ video_id: video.video_id, status: 'failed', error: 'Download failed' });
        continue;
      }
      
      const { blob: mediaBlob, filename } = mediaResult;

      // Check if cancelled after download (expensive operation)
      if (await isCancelled(video.id)) {
        console.log(`[TRANSCRIBE] Video ${video.video_id} was cancelled after download, stopping`);
        results.push({ video_id: video.video_id, status: 'cancelled' });
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

      // Transcribe with Whisper using correct filename
      const transcription = await transcribeWithWhisper(mediaBlob, filename, openaiApiKey);
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

      // Check if cancelled after transcription (expensive operation)
      if (await isCancelled(video.id)) {
        console.log(`[TRANSCRIBE] Video ${video.video_id} was cancelled after transcription, stopping`);
        results.push({ video_id: video.video_id, status: 'cancelled' });
        continue;
      }

      // Analyze transcript with v2.0 prompt
      const analysis = await analyzeTranscript(transcription.text, openaiApiKey);

      // Calculate speaking metrics
      const speakingMetrics = calculateSpeakingMetrics(
        transcription.text,
        transcription.duration,
        transcription.segments
      );

      // Extract hook
      const hook = extractHook(transcription.segments);

      // Store transcript with v2.0 fields
      const { error: transcriptError } = await supabase
        .from('meta_ad_transcripts')
        .upsert({
          organization_id,
          ad_id: video.ad_id,
          video_id: video.video_id,
          video_ref: video.id,
          transcript_text: transcription.text,
          transcript_segments: transcription.segments,
          duration_seconds: Math.round(transcription.duration), // Round to integer to avoid type error
          language: transcription.language,
          language_confidence: 0.95,
          speaker_count: analysis?.speaker_count || 1,
          words_total: speakingMetrics.wordsTotal,
          words_per_minute: Math.round(speakingMetrics.wordsPerMinute),
          silence_percentage: speakingMetrics.silencePercentage,
          
          // Hook fields
          hook_text: analysis?.hook_text || hook.text,
          hook_duration_seconds: hook.duration,
          hook_word_count: analysis?.hook_word_count || hook.wordCount,
          
          // v2.0 SPECIFIC ISSUE FIELDS
          issue_primary: analysis?.issue_primary || null,
          issue_tags: analysis?.issue_tags || [],
          political_stances: analysis?.political_stances || [],
          targets_attacked: analysis?.targets_attacked || [],
          targets_supported: analysis?.targets_supported || [],
          policy_positions: analysis?.policy_positions || [],
          donor_pain_points: analysis?.donor_pain_points || [],
          values_appealed: analysis?.values_appealed || [],
          urgency_drivers: analysis?.urgency_drivers || [],
          
          // Original fields (backwards compatibility)
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
          analysis_version: '2.0', // Updated to v2.0
          transcribed_at: new Date().toISOString(),
          analyzed_at: analysis ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,ad_id,video_id'
        });

      if (transcriptError) {
        console.error(`[TRANSCRIBE] Error storing transcript:`, transcriptError);
        failed++;
        results.push({ video_id: video.video_id, status: 'failed', error: `Database error: ${transcriptError.message}` });
        continue;
      }

      // Update video status
      await supabase
        .from('meta_ad_videos')
        .update({
          status: 'TRANSCRIBED',
          duration_seconds: Math.round(transcription.duration),
          transcribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', video.id);

      transcribed++;
      results.push({ video_id: video.video_id, status: 'transcribed' });
      console.log(`[TRANSCRIBE] Successfully transcribed video ${video.video_id} with v2.0 analysis`);
    }

    console.log(`[TRANSCRIBE] Complete. Transcribed: ${transcribed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        version: '2.0',
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
