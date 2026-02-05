import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

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
  cta_text?: string;
  cta_type?: string;
  urgency_level: string;
  emotional_appeals: string[];
  key_phrases: string[];
  hook_text?: string;
  hook_word_count?: number;
  speaker_count?: number;
}

/**
 * Analyze transcript using GPT-4 with optional user context
 */
async function analyzeTranscriptWithContext(
  transcript: string,
  openaiApiKey: string,
  userContextPre?: string,
  userContextPost?: string
): Promise<AnalysisResult | null> {
  try {
    console.log(`[REANALYZE] Analyzing transcript with GPT-4 (v2.0 + context)...`);

    // Build context sections
    let contextSection = '';
    if (userContextPre?.trim()) {
      const truncatedPre = userContextPre.trim().slice(0, 500);
      contextSection += `\n## USER CONTEXT (provided before analysis):\n${truncatedPre}\n`;
    }
    if (userContextPost?.trim()) {
      const truncatedPost = userContextPost.trim().slice(0, 500);
      contextSection += `\n## ADDITIONAL CONTEXT (refinement notes):\n${truncatedPost}\n`;
    }

    const systemPrompt = `You are an expert political ad analyst. Analyze this video transcript and extract SPECIFIC insights that can be correlated with fundraising performance.
${contextSection}
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
      console.error(`[REANALYZE] GPT-4 API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`[REANALYZE] No content in GPT-4 response`);
      return null;
    }

    const analysis = JSON.parse(content);
    console.log(`[REANALYZE] Analysis complete. Issue: ${analysis.issue_primary}, Topic: ${analysis.topic_primary}, Tone: ${analysis.tone_primary}`);

    return analysis;
  } catch (err) {
    console.error(`[REANALYZE] Analysis error:`, err);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS
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

    // Use provided transcript_text or existing
    const finalTranscript = transcript_text?.trim() || existingTranscript.transcript_text;

    if (!finalTranscript) {
      return new Response(
        JSON.stringify({ error: 'No transcript text available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run GPT-4 analysis with context
    const analysis = await analyzeTranscriptWithContext(
      finalTranscript,
      openaiApiKey,
      user_context_pre || existingTranscript.user_context_pre,
      user_context_post || existingTranscript.user_context_post
    );

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: 'Analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    const newAnalysisCount = (existingTranscript.analysis_count || 1) + 1;

    // Update transcript with new analysis
    const updateData: Record<string, any> = {
      // Update transcript text if provided
      ...(transcript_text?.trim() && { transcript_text: transcript_text.trim() }),
      
      // Analysis fields
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
      
      // Context fields
      ...(user_context_pre !== undefined && { user_context_pre }),
      ...(user_context_post !== undefined && { user_context_post }),
      
      // Tracking fields
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
      JSON.stringify({
        success: true,
        analysis,
        analysis_count: newAnalysisCount,
        analyzed_at: now,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`[REANALYZE] Unexpected error:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
