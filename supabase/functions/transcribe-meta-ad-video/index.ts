/**
 * =============================================================================
 * TRANSCRIBE META AD VIDEO - v3.1
 * =============================================================================
 *
 * Downloads videos from Meta and transcribes using OpenAI Whisper.
 * Analysis step migrated to Lovable AI Gateway (google/gemini-3-flash-preview).
 *
 * v3.1: Hallucination detection + auto-retry with language hint.
 *
 * Note: Whisper transcription still requires OPENAI_API_KEY.
 * Analysis uses Lovable AI with tool calling for structured output.
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { callLovableAIWithTools, AIGatewayError } from "../_shared/ai-client.ts";
import { buildTranscriptAnalysisPrompt, TRANSCRIPT_ANALYSIS_TOOL } from "../_shared/prompts.ts";
import { detectHallucination, computeConfidence } from "../_shared/hallucination-detection.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
}

interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  duration: number;
}

function getFilenameFromUrl(url: string): string {
  const validExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
  try {
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split('/').pop() || 'audio.m4a';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && validExtensions.includes(ext)) return filename;
    return 'audio.m4a';
  } catch { return 'audio.m4a'; }
}

async function downloadMedia(sourceUrl: string): Promise<{ blob: Blob; filename: string } | null> {
  try {
    console.log(`[TRANSCRIBE] Downloading media from: ${sourceUrl.substring(0, 80)}...`);
    const response = await fetch(sourceUrl);
    if (!response.ok) { console.error(`[TRANSCRIBE] Download failed: ${response.status}`); return null; }
    const blob = await response.blob();
    const filename = getFilenameFromUrl(sourceUrl);
    console.log(`[TRANSCRIBE] Downloaded ${(blob.size / 1024 / 1024).toFixed(2)} MB as ${filename}`);
    return { blob, filename };
  } catch (err) { console.error(`[TRANSCRIBE] Download error:`, err); return null; }
}

async function transcribeWithWhisper(
  mediaBlob: Blob,
  filename: string,
  openaiApiKey: string,
  options?: { language?: string; prompt?: string },
): Promise<TranscriptionResult | null> {
  try {
    const retryLabel = options?.language ? ' (retry with language hint)' : '';
    console.log(`[TRANSCRIBE] Calling Whisper API${retryLabel} with file: ${filename}...`);
    const formData = new FormData();
    formData.append('file', mediaBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    if (options?.language) formData.append('language', options.language);
    if (options?.prompt) formData.append('prompt', options.prompt);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}` },
      body: formData,
    });

    if (!response.ok) { const t = await response.text(); console.error(`[TRANSCRIBE] Whisper error: ${response.status} - ${t}`); return null; }

    const result = await response.json();
    console.log(`[TRANSCRIBE] Transcription complete. Duration: ${result.duration}s, Language: ${result.language}`);
    return {
      text: result.text,
      segments: (result.segments || []).map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
        no_speech_prob: s.no_speech_prob,
      })),
      language: result.language,
      duration: result.duration,
    };
  } catch (err) { console.error(`[TRANSCRIBE] Whisper error:`, err); return null; }
}

/**
 * Analyze transcript using Lovable AI Gateway with tool calling
 */
async function analyzeTranscript(transcript: string): Promise<any | null> {
  try {
    console.log(`[TRANSCRIBE] Analyzing with Lovable AI (gemini-3-flash-preview)...`);
    const systemPrompt = buildTranscriptAnalysisPrompt();
    const { result } = await callLovableAIWithTools<any>({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this political video ad transcript:\n\n${transcript}` },
      ],
      temperature: 0.1,
      tools: [TRANSCRIPT_ANALYSIS_TOOL],
      toolChoice: { type: "function", function: { name: "analyze_transcript" } },
    });
    console.log(`[TRANSCRIBE] Analysis complete. Issue: ${result.issue_primary}, Topic: ${result.topic_primary}`);
    return result;
  } catch (err) { console.error(`[TRANSCRIBE] Analysis error:`, err); return null; }
}

function calculateSpeakingMetrics(transcript: string, durationSeconds: number, segments: TranscriptSegment[]) {
  const words = transcript.split(/\s+/).filter(w => w.length > 0);
  const wordsTotal = words.length;
  const durationMinutes = durationSeconds / 60;
  const wordsPerMinute = durationMinutes > 0 ? wordsTotal / durationMinutes : 0;
  let speakingTime = 0;
  for (const segment of segments) { speakingTime += segment.end - segment.start; }
  const silencePercentage = durationSeconds > 0 ? ((durationSeconds - speakingTime) / durationSeconds) * 100 : 0;
  return { wordsTotal, wordsPerMinute, silencePercentage };
}

function extractHook(segments: TranscriptSegment[], maxSeconds = 3) {
  const hookSegments = segments.filter(s => s.start < maxSeconds);
  const text = hookSegments.map(s => s.text).join(' ').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return {
    text: words.slice(0, 15).join(' '),
    duration: hookSegments.length > 0 ? Math.min(hookSegments[hookSegments.length - 1].end, maxSeconds) : 0,
    wordCount: Math.min(words.length, 15),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { organization_id, video_id, ad_id, limit = 5, mode = 'single' } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured (required for Whisper)' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    async function isCancelled(videoDbId: string): Promise<boolean> {
      const { data } = await supabase.from('meta_ad_videos').select('status').eq('id', videoDbId).single();
      return data?.status === 'CANCELLED';
    }

    let videosToProcess: any[] = [];

    if (mode === 'single' && video_id) {
      const { data, error } = await supabase.from('meta_ad_videos').select('*').eq('organization_id', organization_id).eq('id', video_id).single();
      if (error || !data) return new Response(JSON.stringify({ error: 'Video not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (data.status === 'CANCELLED') return new Response(JSON.stringify({ success: true, message: 'Video was cancelled', results: [{ video_id, status: 'cancelled' }] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      videosToProcess = [data];
    } else {
      const { data, error } = await supabase.from('meta_ad_videos').select('*').eq('organization_id', organization_id).eq('status', 'URL_FETCHED').order('created_at', { ascending: true }).limit(limit);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      videosToProcess = data || [];
    }

    console.log(`[TRANSCRIBE] Processing ${videosToProcess.length} videos`);

    let transcribed = 0;
    let failed = 0;
    const results: Array<{ video_id: string; status: string; error?: string; hallucination_risk?: number }> = [];

    for (const video of videosToProcess) {
      console.log(`[TRANSCRIBE] Processing video ${video.video_id}`);

      if (await isCancelled(video.id)) { results.push({ video_id: video.video_id, status: 'cancelled' }); continue; }
      if (!video.video_source_url) { results.push({ video_id: video.video_id, status: 'skipped', error: 'No source URL' }); continue; }

      const mediaResult = await downloadMedia(video.video_source_url);
      if (!mediaResult) {
        await supabase.from('meta_ad_videos').update({ status: 'URL_EXPIRED', error_code: 'DOWNLOAD_FAILED', error_message: 'Failed to download media', last_error_at: new Date().toISOString(), retry_count: (video.retry_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', video.id);
        failed++; results.push({ video_id: video.video_id, status: 'failed', error: 'Download failed' }); continue;
      }

      if (await isCancelled(video.id)) { results.push({ video_id: video.video_id, status: 'cancelled' }); continue; }

      await supabase.from('meta_ad_videos').update({ status: 'DOWNLOADED', downloaded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', video.id);

      // First transcription attempt
      let transcription = await transcribeWithWhisper(mediaResult.blob, mediaResult.filename, openaiApiKey);
      if (!transcription) {
        await supabase.from('meta_ad_videos').update({ status: 'TRANSCRIPT_FAILED', error_code: 'WHISPER_FAILED', error_message: 'Whisper transcription failed', last_error_at: new Date().toISOString(), retry_count: (video.retry_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', video.id);
        failed++; results.push({ video_id: video.video_id, status: 'failed', error: 'Transcription failed' }); continue;
      }

      // Hallucination detection
      let autoRetryCount = 0;
      const hallucinationCheck = detectHallucination(transcription.segments, transcription.language);

      if (hallucinationCheck.shouldRetry) {
        console.log(`[TRANSCRIBE] Hallucination detected (risk=${hallucinationCheck.hallucinationRisk.toFixed(2)}, reason: ${hallucinationCheck.reason}). Retrying with language hint...`);
        autoRetryCount = 1;

        const retryResult = await transcribeWithWhisper(mediaResult.blob, mediaResult.filename, openaiApiKey, {
          language: 'en',
          prompt: 'Political advocacy advertisement about policy and community organizing.',
        });

        if (retryResult) {
          const retryCheck = detectHallucination(retryResult.segments, retryResult.language);
          console.log(`[TRANSCRIBE] Retry result: risk=${retryCheck.hallucinationRisk.toFixed(2)}`);
          // Use retry if it's better
          if (retryCheck.hallucinationRisk < hallucinationCheck.hallucinationRisk) {
            transcription = retryResult;
          }
        }
      }

      // Final hallucination risk after potential retry
      const finalCheck = detectHallucination(transcription.segments, transcription.language);
      const transcriptionConfidence = computeConfidence(finalCheck.hallucinationRisk);

      if (await isCancelled(video.id)) { results.push({ video_id: video.video_id, status: 'cancelled' }); continue; }

      // Only analyze if confidence is reasonable
      const analysis = finalCheck.hallucinationRisk < 0.8
        ? await analyzeTranscript(transcription.text)
        : null;

      if (finalCheck.hallucinationRisk >= 0.8) {
        console.log(`[TRANSCRIBE] Skipping analysis for hallucinated transcript (risk=${finalCheck.hallucinationRisk.toFixed(2)})`);
      }

      const speakingMetrics = calculateSpeakingMetrics(transcription.text, transcription.duration, transcription.segments);
      const hook = extractHook(transcription.segments);

      const { error: transcriptError } = await supabase.from('meta_ad_transcripts').upsert({
        organization_id,
        ad_id: video.ad_id,
        video_id: video.video_id,
        video_ref: video.id,
        transcript_text: transcription.text,
        transcript_segments: transcription.segments,
        duration_seconds: Math.round(transcription.duration),
        language: transcription.language,
        language_confidence: transcriptionConfidence,
        speaker_count: analysis?.speaker_count || 1,
        words_total: speakingMetrics.wordsTotal,
        words_per_minute: Math.round(speakingMetrics.wordsPerMinute),
        silence_percentage: speakingMetrics.silencePercentage,
        hook_text: analysis?.hook_text || hook.text,
        hook_duration_seconds: hook.duration,
        hook_word_count: analysis?.hook_word_count || hook.wordCount,
        issue_primary: analysis?.issue_primary || null,
        issue_tags: analysis?.issue_tags || [],
        political_stances: analysis?.political_stances || [],
        targets_attacked: analysis?.targets_attacked || [],
        targets_supported: analysis?.targets_supported || [],
        policy_positions: analysis?.policy_positions || [],
        donor_pain_points: analysis?.donor_pain_points || [],
        values_appealed: analysis?.values_appealed || [],
        urgency_drivers: analysis?.urgency_drivers || [],
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
        transcription_model: 'whisper-1',
        transcription_confidence: transcriptionConfidence,
        hallucination_risk: finalCheck.hallucinationRisk,
        auto_retry_count: autoRetryCount,
        analysis_model: analysis ? 'google/gemini-3-flash-preview' : null,
        analysis_version: '3.1',
        transcribed_at: new Date().toISOString(),
        analyzed_at: analysis ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,ad_id,video_id' });

      if (transcriptError) {
        console.error(`[TRANSCRIBE] Error storing transcript:`, transcriptError);
        failed++; results.push({ video_id: video.video_id, status: 'failed', error: transcriptError.message }); continue;
      }

      await supabase.from('meta_ad_videos').update({ status: 'TRANSCRIBED', duration_seconds: Math.round(transcription.duration), transcribed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', video.id);

      transcribed++;
      results.push({ video_id: video.video_id, status: 'transcribed', hallucination_risk: finalCheck.hallucinationRisk });
      console.log(`[TRANSCRIBE] Successfully transcribed video ${video.video_id} (hallucination_risk=${finalCheck.hallucinationRisk.toFixed(2)})`);
    }

    console.log(`[TRANSCRIBE] Complete. Transcribed: ${transcribed}, Failed: ${failed}`);

    return new Response(JSON.stringify({
      success: true,
      version: '3.1',
      stats: { processed: videosToProcess.length, transcribed, failed },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[TRANSCRIBE] Unhandled error:', err);
    if (err instanceof AIGatewayError) {
      return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
