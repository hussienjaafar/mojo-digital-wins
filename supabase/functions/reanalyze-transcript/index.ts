import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { callLovableAIWithTools, AIGatewayError } from "../_shared/ai-client.ts";
import { buildTranscriptAnalysisPrompt, TRANSCRIPT_ANALYSIS_TOOL } from "../_shared/prompts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReanalyzeRequest {
  organization_id: string;
  transcript_id: string;
  transcript_text?: string;
  user_context_pre?: string;
  user_context_post?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      organization_id,
      transcript_id,
      transcript_text,
      user_context_pre,
      user_context_post,
    } = await req.json() as ReanalyzeRequest;

    if (!organization_id || !transcript_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id and transcript_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[REANALYZE] Starting reanalysis for transcript ${transcript_id}`);

    // Fetch existing transcript
    const { data: existingTranscript, error: fetchError } = await supabase
      .from('meta_ad_transcripts')
      .select('*')
      .eq('id', transcript_id)
      .single();

    if (fetchError || !existingTranscript) {
      return new Response(
        JSON.stringify({ error: 'Transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalTranscript = transcript_text?.trim() || existingTranscript.transcript_text;
    if (!finalTranscript) {
      return new Response(
        JSON.stringify({ error: 'No transcript text available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt with user context
    const systemPrompt = buildTranscriptAnalysisPrompt({
      userContextPre: user_context_pre || existingTranscript.user_context_pre,
      userContextPost: user_context_post || existingTranscript.user_context_post,
    });

    // Call Lovable AI with tool calling
    const { result: analysis } = await callLovableAIWithTools<any>({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this political video ad transcript:\n\n${finalTranscript}` },
      ],
      temperature: 0.1,
      tools: [TRANSCRIPT_ANALYSIS_TOOL],
      toolChoice: { type: "function", function: { name: "analyze_transcript" } },
    });

    console.log(`[REANALYZE] Analysis complete. Issue: ${analysis.issue_primary}, Topic: ${analysis.topic_primary}`);

    const now = new Date().toISOString();
    const newAnalysisCount = (existingTranscript.analysis_count || 1) + 1;

    const updateData: Record<string, any> = {
      ...(transcript_text?.trim() && { transcript_text: transcript_text.trim() }),
      issue_primary: analysis.issue_primary,
      issue_tags: analysis.issue_tags || [],
      political_stances: analysis.political_stances || [],
      targets_attacked: analysis.targets_attacked || [],
      targets_supported: analysis.targets_supported || [],
      policy_positions: analysis.policy_positions || [],
      donor_pain_points: analysis.donor_pain_points || [],
      values_appealed: analysis.values_appealed || [],
      urgency_drivers: analysis.urgency_drivers || [],
      topic_primary: analysis.topic_primary,
      topic_tags: analysis.topic_tags || [],
      tone_primary: analysis.tone_primary,
      tone_tags: analysis.tone_tags || [],
      sentiment_score: analysis.sentiment_score,
      sentiment_label: analysis.sentiment_label,
      cta_text: analysis.cta_text || null,
      cta_type: analysis.cta_type || null,
      urgency_level: analysis.urgency_level,
      emotional_appeals: analysis.emotional_appeals || [],
      key_phrases: analysis.key_phrases || [],
      hook_text: analysis.hook_text || null,
      hook_word_count: analysis.hook_word_count || null,
      speaker_count: analysis.speaker_count || null,
      ...(user_context_pre !== undefined && { user_context_pre }),
      ...(user_context_post !== undefined && { user_context_post }),
      analysis_count: newAnalysisCount,
      last_analyzed_at: now,
      updated_at: now,
    };

    const { error: updateError } = await supabase
      .from('meta_ad_transcripts')
      .update(updateData)
      .eq('id', transcript_id);

    if (updateError) {
      console.error(`[REANALYZE] Failed to update transcript:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[REANALYZE] Successfully reanalyzed transcript ${transcript_id}. Analysis #${newAnalysisCount}`);

    return new Response(
      JSON.stringify({ success: true, analysis, analysis_count: newAnalysisCount, analyzed_at: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`[REANALYZE] Unexpected error:`, err);
    if (err instanceof AIGatewayError) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: err.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
