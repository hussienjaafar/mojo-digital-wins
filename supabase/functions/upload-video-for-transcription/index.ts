/**
 * =============================================================================
 * UPLOAD VIDEO FOR TRANSCRIPTION (v3.1)
 * =============================================================================
 *
 * Accepts video files and transcribes using OpenAI Whisper (audio only).
 * Analysis step migrated to Lovable AI Gateway (google/gemini-3-flash-preview).
 *
 * v3.1: Hallucination detection + auto-retry with language hint.
 *
 * Note: Whisper transcription still requires OPENAI_API_KEY (audio not supported
 * by Lovable AI Gateway). Analysis uses Lovable AI with tool calling.
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { callLovableAIWithTools, AIGatewayError } from "../_shared/ai-client.ts";
import { buildTranscriptAnalysisPrompt, TRANSCRIPT_ANALYSIS_TOOL } from "../_shared/prompts.ts";
import { detectHallucination, computeConfidence, checkSemanticCoherence } from "../_shared/hallucination-detection.ts";

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

/**
 * Download video from URL or Supabase Storage
 */
async function downloadVideo(source: string, supabase: any): Promise<Blob | null> {
  try {
    if (source.startsWith('videos/') || source.startsWith('/videos/')) {
      console.log(`[UPLOAD-TRANSCRIBE] Downloading from Supabase Storage: ${source}`);
      const { data, error } = await supabase.storage.from('uploads').download(source.replace(/^\//, ''));
      if (error) { console.error(`[UPLOAD-TRANSCRIBE] Storage download error:`, error); return null; }
      return data;
    }
    console.log(`[UPLOAD-TRANSCRIBE] Downloading from URL: ${source.substring(0, 80)}...`);
    const response = await fetch(source);
    if (!response.ok) { console.error(`[UPLOAD-TRANSCRIBE] Download failed: ${response.status}`); return null; }
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
  openaiApiKey: string,
  options?: { language?: string; prompt?: string },
): Promise<TranscriptionResult | null> {
  try {
    const retryLabel = options?.language ? ' (retry with language hint)' : '';
    console.log(`[UPLOAD-TRANSCRIBE] Calling Whisper API${retryLabel}...`);
    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UPLOAD-TRANSCRIBE] Whisper error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`[UPLOAD-TRANSCRIBE] Transcription complete. Duration: ${result.duration}s, Language: ${result.language}`);
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
  } catch (err) {
    console.error(`[UPLOAD-TRANSCRIBE] Whisper error:`, err);
    return null;
  }
}

/**
 * Analyze transcript using Lovable AI Gateway with tool calling
 */
async function analyzeTranscript(transcript: string): Promise<any | null> {
  try {
    console.log(`[UPLOAD-TRANSCRIBE] Analyzing with Lovable AI (gemini-3-flash-preview)...`);
    const systemPrompt = buildTranscriptAnalysisPrompt();

    const { result } = await callLovableAIWithTools<any>({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this video ad transcript:\n\n${transcript}` },
      ],
      temperature: 0.1,
      tools: [TRANSCRIPT_ANALYSIS_TOOL],
      toolChoice: { type: "function", function: { name: "analyze_transcript" } },
    });

    console.log(`[UPLOAD-TRANSCRIBE] Analysis complete. Issue: ${result.issue_primary}`);
    return result;
  } catch (err) {
    console.error(`[UPLOAD-TRANSCRIBE] Analysis error:`, err);
    return null;
  }
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
    const { organization_id, video_id, ad_id, video_source, video_base64, filename } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!video_source && !video_base64) {
      return new Response(JSON.stringify({ error: 'video_source or video_base64 is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Whisper still requires OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured (required for Whisper transcription)' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[UPLOAD-TRANSCRIBE] Starting for org ${organization_id}, video ${video_id || 'new'}`);

    // Get video blob
    let videoBlob: Blob | null = null;
    if (video_base64) {
      const binaryString = atob(video_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
      videoBlob = new Blob([bytes], { type: 'video/mp4' });
    } else {
      videoBlob = await downloadVideo(video_source, supabase);
    }

    if (!videoBlob) {
      return new Response(JSON.stringify({ error: 'Failed to download/decode video' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // First transcription attempt
    let transcription = await transcribeWithWhisper(videoBlob, openaiApiKey);
    if (!transcription) {
      return new Response(JSON.stringify({ error: 'Transcription failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Hallucination detection + auto-retry
    let autoRetryCount = 0;
    let hallucinationCheck = detectHallucination(transcription.segments, transcription.language, transcription.text);

    // Semantic coherence check for borderline cases
    const avgNoSpeechProb = transcription.segments
      .map(s => s.no_speech_prob ?? 0)
      .reduce((a, b) => a + b, 0) / (transcription.segments.length || 1);
    
    if (avgNoSpeechProb > 0.2 || hallucinationCheck.hallucinationRisk > 0) {
      console.log(`[UPLOAD-TRANSCRIBE] Running semantic coherence check...`);
      const semanticResult = await checkSemanticCoherence(transcription.text);
      if (!semanticResult.isCoherent) {
        console.log(`[UPLOAD-TRANSCRIBE] Semantic check: transcript is HALLUCINATED`);
        hallucinationCheck = {
          ...hallucinationCheck,
          hallucinationRisk: Math.max(hallucinationCheck.hallucinationRisk, 0.85),
          shouldRetry: true,
          reason: [hallucinationCheck.reason, 'LLM semantic check: hallucinated'].filter(Boolean).join('; '),
        };
      }
    }

    if (hallucinationCheck.shouldRetry) {
      console.log(`[UPLOAD-TRANSCRIBE] Hallucination detected (risk=${hallucinationCheck.hallucinationRisk.toFixed(2)}, reason: ${hallucinationCheck.reason}). Retrying with language hint...`);
      autoRetryCount = 1;

      const retryResult = await transcribeWithWhisper(videoBlob, openaiApiKey, {
        language: 'en',
        prompt: 'Political advocacy advertisement about policy and community organizing.',
      });

      if (retryResult) {
        const retryCheck = detectHallucination(retryResult.segments, retryResult.language, retryResult.text);
        const retrySemanticResult = await checkSemanticCoherence(retryResult.text);
        let retryRisk = retryCheck.hallucinationRisk;
        if (!retrySemanticResult.isCoherent) retryRisk = Math.max(retryRisk, 0.85);
        
        console.log(`[UPLOAD-TRANSCRIBE] Retry result: risk=${retryRisk.toFixed(2)}`);
        if (retryRisk < hallucinationCheck.hallucinationRisk) {
          transcription = retryResult;
        }
      }
    }

    // Final hallucination risk
    const finalCheck = detectHallucination(transcription.segments, transcription.language, transcription.text);
    let finalRisk = finalCheck.hallucinationRisk;
    // Final semantic check if still borderline
    if (finalRisk < 0.5 && avgNoSpeechProb > 0.2) {
      const finalSemantic = await checkSemanticCoherence(transcription.text);
      if (!finalSemantic.isCoherent) finalRisk = Math.max(finalRisk, 0.85);
    }
    const transcriptionConfidence = computeConfidence(finalRisk);

    // Only analyze if confidence is reasonable
    const analysis = finalRisk < 0.8
      ? await analyzeTranscript(transcription.text)
      : null;

    if (finalRisk >= 0.8) {
      console.log(`[UPLOAD-TRANSCRIBE] Skipping analysis for hallucinated transcript (risk=${finalRisk.toFixed(2)})`);
    }

    const speakingMetrics = calculateSpeakingMetrics(transcription.text, transcription.duration, transcription.segments);
    const hook = extractHook(transcription.segments);
    const finalVideoId = video_id || `manual_${Date.now()}`;
    const finalAdId = ad_id || `manual_${Date.now()}`;

    if (video_id) {
      await supabase.from('meta_ad_videos').update({
        status: 'TRANSCRIBED',
        video_source_url: video_source || 'base64_upload',
        duration_seconds: transcription.duration,
        transcribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      }).eq('video_id', video_id).eq('organization_id', organization_id);
    }

    const { error: transcriptError } = await supabase.from('meta_ad_transcripts').upsert({
      organization_id,
      ad_id: finalAdId,
      video_id: finalVideoId,
      transcript_text: transcription.text,
      transcript_segments: transcription.segments,
      duration_seconds: transcription.duration,
      language: transcription.language,
      language_confidence: transcriptionConfidence,
      speaker_count: analysis?.speaker_count || 1,
      words_total: speakingMetrics.wordsTotal,
      words_per_minute: speakingMetrics.wordsPerMinute,
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
      hallucination_risk: finalRisk,
      auto_retry_count: autoRetryCount,
      analysis_model: analysis ? 'google/gemini-3-flash-preview' : null,
      analysis_version: '3.1',
      transcribed_at: new Date().toISOString(),
      analyzed_at: analysis ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,ad_id,video_id' });

    if (transcriptError) {
      console.error(`[UPLOAD-TRANSCRIBE] Error storing transcript:`, transcriptError);
      return new Response(JSON.stringify({ error: `Database error: ${transcriptError.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[UPLOAD-TRANSCRIBE] Success! Video ${finalVideoId} transcribed (hallucination_risk=${finalRisk.toFixed(2)})`);

    return new Response(JSON.stringify({
      success: true,
      video_id: finalVideoId,
      ad_id: finalAdId,
      duration_seconds: transcription.duration,
      words_total: speakingMetrics.wordsTotal,
      issue_primary: analysis?.issue_primary || null,
      political_stances: analysis?.political_stances || [],
      targets_attacked: analysis?.targets_attacked || [],
      hallucination_risk: finalRisk,
      analysis_version: '3.1',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[UPLOAD-TRANSCRIBE] Unhandled error:', err);
    if (err instanceof AIGatewayError) {
      return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
