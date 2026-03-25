/**
 * Regenerate Variation - Edge Function
 * 
 * Regenerates a single ad copy element (primary text, headline, or description)
 * based on user feedback, incorporating full feedback history for iterative improvement.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders } from "../_shared/security.ts";
import { callLovableAIWithTools, AIGatewayError } from "../_shared/ai-client.ts";

// =============================================================================
// Types
// =============================================================================

type CopyElementType = 'primary_text' | 'headline' | 'description';

interface FeedbackEntry {
  feedback: string;
  previous_text: string;
  new_text: string;
}

interface RegenerateRequest {
  organization_id: string;
  transcript_id: string;
  element_type: CopyElementType;
  current_text: string;
  feedback: string;
  feedback_history: FeedbackEntry[];
  segment_name: string;
  segment_description: string;
}

// =============================================================================
// Constants
// =============================================================================

const CHAR_LIMITS: Record<CopyElementType, number> = {
  primary_text: 900,
  headline: 27,
  description: 25,
};

const ELEMENT_LABELS: Record<CopyElementType, string> = {
  primary_text: 'Primary Text (600-900 chars target, hook in first 125)',
  headline: 'Headline (max 27 chars, mobile-safe)',
  description: 'Description (max 25 chars, mobile-safe)',
};

// =============================================================================
// Tool Definition
// =============================================================================

const REGENERATE_TOOL = {
  type: "function" as const,
  function: {
    name: "regenerate_copy_element",
    description: "Return exactly one improved copy element based on user feedback",
    parameters: {
      type: "object",
      properties: {
        improved_text: {
          type: "string",
          description: "The improved copy text addressing the user's feedback",
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of what was changed and why (1-2 sentences)",
        },
      },
      required: ["improved_text", "reasoning"],
      additionalProperties: false,
    },
  },
};

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RegenerateRequest = await req.json();
    const {
      organization_id,
      transcript_id,
      element_type,
      current_text,
      feedback,
      feedback_history = [],
      segment_name,
      segment_description,
    } = body;

    // Validate
    if (!organization_id || !transcript_id || !element_type || !current_text || !feedback?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['primary_text', 'headline', 'description'].includes(element_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid element_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch transcript context
    const { data: transcript, error: transcriptError } = await supabase
      .from('meta_ad_transcripts')
      .select('transcript_text, issue_primary, tone_primary, tone_tags, targets_attacked, targets_supported, donor_pain_points, key_phrases, urgency_level, values_appealed')
      .eq('id', transcript_id)
      .maybeSingle();

    if (transcriptError || !transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build feedback history section
    let historySection = '';
    if (feedback_history.length > 0) {
      historySection = '\n## FEEDBACK HISTORY (incorporate ALL lessons):\n';
      feedback_history.forEach((entry, i) => {
        historySection += `${i + 1}. Feedback: "${entry.feedback}"\n   Before: "${entry.previous_text}"\n   After: "${entry.new_text}"\n\n`;
      });
    }

    const charLimit = CHAR_LIMITS[element_type];
    const elementLabel = ELEMENT_LABELS[element_type];

    const systemPrompt = `You are a world-class political fundraising copywriter refining a single ad copy element based on user feedback.

## RULES:
1. Produce exactly ONE improved version of the ${element_type.replace('_', ' ')}
2. Character limit: ${charLimit} chars max
3. Address the user's feedback precisely
4. Maintain the political fundraising tone and urgency
5. NEVER fabricate claims, matching offers, donor counts, or deadlines
6. Learn from ALL previous feedback iterations — do not regress on earlier improvements
${element_type === 'primary_text' ? '7. First 125 characters must be a scroll-stopping hook\n8. Follow the 4-part arc: Hook (125 chars) → Bridge (~150 chars) → Emotional Deepening (~200 chars) → CTA (~100 chars)' : ''}`;

    const userMessage = `## ELEMENT TYPE: ${elementLabel}

## CURRENT TEXT:
${current_text}
${historySection}
## LATEST FEEDBACK:
"${feedback}"

## TRANSCRIPT CONTEXT:
Issue: ${transcript.issue_primary || 'Not specified'}
Tone: ${transcript.tone_primary || 'Not specified'}
Targets Attacked: ${(transcript.targets_attacked || []).join(', ') || 'None'}
Targets Supported: ${(transcript.targets_supported || []).join(', ') || 'None'}
Pain Points: ${(transcript.donor_pain_points || []).join(', ') || 'Not specified'}
Key Phrases: ${(transcript.key_phrases || []).join(', ') || 'None'}
Urgency: ${transcript.urgency_level || 'medium'}

## SEGMENT:
Name: ${segment_name}
Description: ${segment_description}

Produce ONE improved version that addresses the feedback while respecting the ${charLimit}-character limit.`;

    console.log(`[regenerate-variation] Regenerating ${element_type} for segment "${segment_name}" with feedback: "${feedback.slice(0, 100)}..."`);

    const { result, model } = await callLovableAIWithTools<{ improved_text: string; reasoning: string }>({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      maxTokens: 1000,
      tools: [REGENERATE_TOOL],
      toolChoice: "required",
    });

    // Validate and trim
    let improvedText = result.improved_text?.trim() || '';
    if (improvedText.length > charLimit) {
      improvedText = improvedText.substring(0, charLimit - 3) + '...';
    }

    console.log(`[regenerate-variation] Success: ${improvedText.length} chars, model: ${model}`);

    return new Response(
      JSON.stringify({
        success: true,
        improved_text: improvedText,
        reasoning: result.reasoning || '',
        model,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[regenerate-variation] Error:', err);

    if (err instanceof AIGatewayError) {
      const status = err.statusCode === 429 ? 429 : err.statusCode === 402 ? 402 : 500;
      return new Response(
        JSON.stringify({ error: err.message }),
        { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
