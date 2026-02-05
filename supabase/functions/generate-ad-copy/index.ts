/**
 * =============================================================================
 * GENERATE AD COPY - Edge Function
 * =============================================================================
 *
 * Generates Meta ad copy using GPT-4 based on video transcript analysis.
 * Creates multiple variations for each audience segment with proper character
 * limits and Meta-ready formatting.
 *
 * Features:
 * - Generates 5 variations per segment for primary_texts, headlines, descriptions
 * - Validates against Meta character limits
 * - Builds ActBlue tracking URLs
 * - Saves to ad_copy_generations table
 *
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.81.1";
import { getCorsHeaders } from "../_shared/security.ts";

// =============================================================================
// Types
// =============================================================================

interface AudienceSegment {
  id: string;
  name: string;
  description: string;
}

interface GenerateAdCopyRequest {
  organization_id: string;
  transcript_id: string;
  video_id?: string;
  audience_segments: AudienceSegment[];
  actblue_form_name: string;
  refcode: string;
  amount_preset?: number;
  recurring_default?: boolean;
}

interface GeneratedCopySegment {
  primary_texts: string[];
  headlines: string[];
  descriptions: string[];
}

interface MetaReadyVariation {
  primary_text: string;
  headline: string;
  description: string;
  call_to_action_type: string;
  destination_url: string;
  char_counts: {
    primary: number;
    headline: number;
    description: number;
  };
  meets_meta_specs: boolean;
}

interface MetaReadyCopySegment {
  variations: MetaReadyVariation[];
}

interface GenerateAdCopyResponse {
  success: boolean;
  generation_id: string;
  generated_copy: Record<string, GeneratedCopySegment>;
  meta_ready_copy: Record<string, MetaReadyCopySegment>;
  tracking_url: string;
  generated_at: string;
}

interface TranscriptData {
  id: string;
  transcript_text: string;
  issue_primary: string | null;
  political_stances: string[] | null;
  tone_primary: string | null;
  tone_tags: string[] | null;
  targets_attacked: string[] | null;
  targets_supported: string[] | null;
  donor_pain_points: string[] | null;
  key_phrases: string[] | null;
  cta_text: string | null;
  urgency_level: string | null;
  values_appealed: string[] | null;
}

// =============================================================================
// Constants
// =============================================================================

const META_COPY_LIMITS = {
  primary_text_visible: 125, // Hook must fit here (before "See More")
  primary_text_max: 300,     // Extended context after hook
  headline_max: 40,
  description_max: 30,
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_CTA_TYPE = 'DONATE_NOW';

// =============================================================================
// Copywriting Framework Definitions
// =============================================================================

const COPYWRITING_FRAMEWORKS = {
  PAS: {
    name: 'PAS (Problem-Agitate-Solution)',
    instruction: `
      - PROBLEM: Open with the threat/danger the opponent poses
      - AGITATE: Intensify the stakes - what happens if we fail?
      - SOLUTION: Position the candidate + donor's contribution as the solution
      Example flow: "[Threat] → [Consequences] → [Your donation stops this]"`,
  },
  BAB: {
    name: 'BAB (Before-After-Bridge)',
    instruction: `
      - BEFORE: Paint the current danger/injustice
      - AFTER: Visualize the future we're fighting for
      - BRIDGE: "Your donation makes this possible"
      Example flow: "[Dark present] → [Bright future] → [You make the difference]"`,
  },
  AIDA: {
    name: 'AIDA (Attention-Interest-Desire-Action)',
    instruction: `
      - ATTENTION: Pattern interrupt hook - stop the scroll
      - INTEREST: Compelling detail, stat, or reveal
      - DESIRE: What donor will feel/achieve
      - ACTION: Urgent CTA with specific ask
      Example flow: "[Shocking fact] → [Why it matters] → [Feel empowered] → [Donate now]"`,
  },
  SOCIAL_PROOF: {
    name: 'Social Proof + Urgency',
    instruction: `
      - MOMENTUM: Reference donor counts, grassroots movement ("23,847 donors this week")
      - DEADLINE: Create time pressure ("48 hours left", "midnight deadline")
      - COLLECTIVE: "Join [X] patriots/progressives who..."
      Example flow: "[Others are acting] → [Time is running out] → [Join the movement]"`,
  },
  IDENTITY: {
    name: 'Identity + Empowerment',
    instruction: `
      - IDENTITY: "If you believe in [value]...", "For every [identity] who..."
      - IMPACT: Specific dollar impact ("Your $27 provides...")
      - VALUES: Call to shared beliefs, not just wallet
      Example flow: "[You are this person] → [Your money does this] → [Live your values]"`,
  },
};

/**
 * Detect audience segment type for tone adaptation
 */
function getSegmentTone(segmentDescription: string): string {
  const desc = segmentDescription.toLowerCase();
  
  if (desc.includes('progressive') || desc.includes('activist') || desc.includes('liberal')) {
    return 'PROGRESSIVE_BASE: Use values-forward, movement language. Emphasize collective action and systemic change.';
  }
  if (desc.includes('swing') || desc.includes('persuadable') || desc.includes('independent')) {
    return 'SWING_VOTERS: Focus on fear of loss and specific tangible impacts. Avoid partisan language. Lead with consequences.';
  }
  if (desc.includes('high-dollar') || desc.includes('major donor') || desc.includes('whale')) {
    return 'HIGH-DOLLAR: Use empowerment and strategic framing. Make them feel like insiders. Emphasize outsized impact.';
  }
  if (desc.includes('grassroots') || desc.includes('small-dollar') || desc.includes('first-time')) {
    return 'GRASSROOTS: Maximum urgency, collective action. "$5 is all it takes." Make small feel powerful.';
  }
  
  return 'GENERAL: Balance urgency with values. Use "you" language heavily. Create personal stake.';
}

/**
 * Build the research-backed GPT-4 prompt for generating high-converting ad copy
 */
function buildPrompt(transcript: TranscriptData, segment: AudienceSegment): string {
  const segmentTone = getSegmentTone(segment.description);
  
  return `You are a world-class political fundraising copywriter who has raised $50M+ through Meta ads for progressive campaigns.

You deeply understand:
- Donor psychology and what triggers donations (urgency, identity, fear of loss, empowerment)
- Meta's algorithm and what drives engagement (emotional resonance, scroll-stopping hooks)
- ActBlue optimization and conversion tactics

## VIDEO ANALYSIS
Transcript: ${transcript.transcript_text || 'No transcript available'}
Primary Issue: ${transcript.issue_primary || 'Not specified'}
Political Stances: ${(transcript.political_stances || []).join(', ') || 'Not specified'}
Tone: ${transcript.tone_primary || 'Not specified'} (Tags: ${(transcript.tone_tags || []).join(', ') || 'None'})
Targets Attacked: ${(transcript.targets_attacked || []).join(', ') || 'None'}
Targets Supported: ${(transcript.targets_supported || []).join(', ') || 'None'}
Donor Pain Points: ${(transcript.donor_pain_points || []).join(', ') || 'Not specified'}
Key Phrases to Incorporate: ${(transcript.key_phrases || []).join(', ') || 'None'}
CTA from Video: ${transcript.cta_text || 'Not specified'}
Urgency Level: ${transcript.urgency_level || 'medium'}
Values Appealed: ${(transcript.values_appealed || []).join(', ') || 'Not specified'}

## TARGET AUDIENCE
Name: ${segment.name}
Description: ${segment.description}
Tone Guidance: ${segmentTone}

## CHARACTER LIMITS (CRITICAL - COUNT CAREFULLY)
- Primary Text: ${META_COPY_LIMITS.primary_text_max} characters MAX (but first ${META_COPY_LIMITS.primary_text_visible} chars are visible before "See More" - this is your HOOK)
- Headline: ${META_COPY_LIMITS.headline_max} characters MAX
- Description: ${META_COPY_LIMITS.description_max} characters MAX

## COPYWRITING FRAMEWORKS - USE EXACTLY ONE PER VARIATION

Generate 5 variations, each using a DIFFERENT framework:

**Variation 1 - ${COPYWRITING_FRAMEWORKS.PAS.name}:**${COPYWRITING_FRAMEWORKS.PAS.instruction}

**Variation 2 - ${COPYWRITING_FRAMEWORKS.BAB.name}:**${COPYWRITING_FRAMEWORKS.BAB.instruction}

**Variation 3 - ${COPYWRITING_FRAMEWORKS.AIDA.name}:**${COPYWRITING_FRAMEWORKS.AIDA.instruction}

**Variation 4 - ${COPYWRITING_FRAMEWORKS.SOCIAL_PROOF.name}:**${COPYWRITING_FRAMEWORKS.SOCIAL_PROOF.instruction}

**Variation 5 - ${COPYWRITING_FRAMEWORKS.IDENTITY.name}:**${COPYWRITING_FRAMEWORKS.IDENTITY.instruction}

## HOOK REQUIREMENTS (FIRST ${META_COPY_LIMITS.primary_text_visible} CHARACTERS - CRITICAL)

The first ${META_COPY_LIMITS.primary_text_visible} characters MUST stop the scroll. Use pattern interrupts:
- Lead with conflict, threat, or surprise
- Use "you" language - make it personal immediately
- Create curiosity gap or fear of missing out
- NEVER start with the candidate's name or generic statements
- NEVER start with "Join us" or "Help us" - start with THEM

HOOK PATTERNS (choose appropriate style):
- PAIN: "[Opponent] just [harmful action]. We can't let this stand."
- URGENCY: "DEADLINE: [Time]. [X] donors needed to hit our goal."
- CURIOSITY: "They don't want you to see this..."
- IDENTITY: "If you believe in [value], this is your moment."
- THREAT: "They're spending millions against us. We're fighting back."
- QUESTION: "What happens if [candidate] loses this race?"

## POLITICAL FUNDRAISING PSYCHOLOGY (APPLY TO ALL VARIATIONS)

URGENCY TACTICS:
- Deadlines ("midnight tonight", "24 hours left")
- Matching opportunities ("Every dollar = $2")
- Thresholds ("127 donors away from our goal")
- Opponent momentum ("They just raised $X")

IDENTITY REINFORCEMENT:
- "Donors like you" / "Patriots who care"
- Shared values language
- In-group signaling

ENEMY FRAMING:
- Clear villain (opponent, special interests)
- Contrast (us vs. them)
- Stakes if enemy wins

EMPOWERMENT:
- Specific donation impact ("Your $27 = [specific outcome]")
- Donor as hero of the story
- Agency and control

## META ALGORITHM OPTIMIZATION

- Emotionally resonant copy ranks higher (quality score)
- Clear benefit in first line improves click-through
- Authentic, passionate voice > polished marketing speak
- Match energy and tone to landing page intent
- Copy that drives engagement (likes, shares, comments) costs less

## OUTPUT REQUIREMENTS

Return ONLY valid JSON (no markdown, no explanation):
{
  "primary_texts": [
    "PAS variation (${META_COPY_LIMITS.primary_text_max} chars max, hook in first ${META_COPY_LIMITS.primary_text_visible})",
    "BAB variation...",
    "AIDA variation...",
    "Social Proof variation...",
    "Identity variation..."
  ],
  "headlines": [
    "PAS headline (${META_COPY_LIMITS.headline_max} chars max, action-oriented)",
    "BAB headline...",
    "AIDA headline...",
    "Social Proof headline...",
    "Identity headline..."
  ],
  "descriptions": [
    "PAS description (${META_COPY_LIMITS.description_max} chars max, urgency/proof/value)",
    "BAB description...",
    "AIDA description...",
    "Social Proof description...",
    "Identity description..."
  ]
}`;
}

/**
 * Call OpenAI GPT-4 to generate ad copy for a segment
 */
async function generateCopyForSegment(
  openaiApiKey: string,
  transcript: TranscriptData,
  segment: AudienceSegment
): Promise<GeneratedCopySegment | null> {
  try {
    const prompt = buildPrompt(transcript, segment);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a world-class political fundraising copywriter who has raised $50M+ through Meta ads for progressive campaigns. You understand donor psychology, Meta's algorithm, and ActBlue conversion tactics. 

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanation, no code blocks
2. Each variation must use a DIFFERENT copywriting framework (PAS, BAB, AIDA, Social Proof, Identity)
3. First 125 characters of primary_text MUST be a scroll-stopping hook
4. Never start with candidate's name - start with conflict, urgency, or "you"
5. Include urgency elements in EVERY variation
6. Count characters precisely - violations ruin Meta delivery`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8, // Slightly higher for more creative variation
        max_tokens: 3000, // More tokens for longer, richer copy
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-ad-copy] OpenAI API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[generate-ad-copy] No content in OpenAI response');
      return null;
    }

    const parsed = JSON.parse(content);

    // Validate the response structure
    if (!Array.isArray(parsed.primary_texts) || !Array.isArray(parsed.headlines) || !Array.isArray(parsed.descriptions)) {
      console.error('[generate-ad-copy] Invalid response structure from OpenAI');
      return null;
    }

    return {
      primary_texts: parsed.primary_texts.slice(0, 5),
      headlines: parsed.headlines.slice(0, 5),
      descriptions: parsed.descriptions.slice(0, 5),
    };
  } catch (err) {
    console.error('[generate-ad-copy] Error generating copy for segment:', err);
    return null;
  }
}

/**
 * Validate and truncate copy to meet Meta specs
 */
function validateAndFormat(text: string, maxLength: number): { text: string; meetsSpec: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return { text: trimmed, meetsSpec: true };
  }
  // Truncate to maxLength - 3 and add ellipsis
  return { text: trimmed.substring(0, maxLength - 3) + '...', meetsSpec: false };
}

/**
 * Convert generated copy to Meta-ready format with validation
 */
function createMetaReadyCopy(
  generatedCopy: GeneratedCopySegment,
  trackingUrl: string
): MetaReadyCopySegment {
  const variations: MetaReadyVariation[] = [];

  // Create 5 variations combining primary_texts, headlines, and descriptions
  const numVariations = Math.min(
    generatedCopy.primary_texts.length,
    generatedCopy.headlines.length,
    generatedCopy.descriptions.length,
    5
  );

  for (let i = 0; i < numVariations; i++) {
    // Use primary_text_max for validation (allows extended context beyond visible hook)
    const primaryValidated = validateAndFormat(
      generatedCopy.primary_texts[i] || '',
      META_COPY_LIMITS.primary_text_max
    );
    const headlineValidated = validateAndFormat(
      generatedCopy.headlines[i] || '',
      META_COPY_LIMITS.headline_max
    );
    const descriptionValidated = validateAndFormat(
      generatedCopy.descriptions[i] || '',
      META_COPY_LIMITS.description_max
    );

    const meetsSpecs = primaryValidated.meetsSpec && headlineValidated.meetsSpec && descriptionValidated.meetsSpec;

    variations.push({
      primary_text: primaryValidated.text,
      headline: headlineValidated.text,
      description: descriptionValidated.text,
      call_to_action_type: DEFAULT_CTA_TYPE,
      destination_url: trackingUrl,
      char_counts: {
        primary: primaryValidated.text.length,
        headline: headlineValidated.text.length,
        description: descriptionValidated.text.length,
      },
      meets_meta_specs: meetsSpecs,
    });
  }

  return { variations };
}

/**
 * Determine overall validation status based on all variations
 */
function determineValidationStatus(metaReadyCopy: Record<string, MetaReadyCopySegment>): string {
  let allValid = true;
  let anyInvalid = false;

  for (const segmentName of Object.keys(metaReadyCopy)) {
    for (const variation of metaReadyCopy[segmentName].variations) {
      if (!variation.meets_meta_specs) {
        allValid = false;
        anyInvalid = true;
      }
    }
  }

  if (allValid) return 'all_valid';
  if (anyInvalid) return 'some_truncated';
  return 'needs_review';
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[generate-ad-copy] Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openaiApiKey) {
      console.error('[generate-ad-copy] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: GenerateAdCopyRequest = await req.json();
    const {
      organization_id,
      transcript_id,
      video_id,
      audience_segments,
      actblue_form_name,
      refcode,
      amount_preset,
      recurring_default,
    } = body;

    // Validate required fields
    if (!organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'transcript_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!audience_segments || !Array.isArray(audience_segments) || audience_segments.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'audience_segments must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!actblue_form_name || !actblue_form_name.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'actblue_form_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!refcode || !refcode.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'refcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[generate-ad-copy] Starting generation for org ${organization_id}, transcript ${transcript_id}`);

    // Fetch transcript from database (fetch first, then validate org membership)
    const { data: transcript, error: transcriptError } = await supabase
      .from('meta_ad_transcripts')
      .select(`
        id,
        organization_id,
        transcript_text,
        issue_primary,
        political_stances,
        tone_primary,
        tone_tags,
        targets_attacked,
        targets_supported,
        donor_pain_points,
        key_phrases,
        cta_text,
        urgency_level,
        values_appealed
      `)
      .eq('id', transcript_id)
      .maybeSingle();

    if (transcriptError || !transcript) {
      console.error('[generate-ad-copy] Transcript not found:', transcriptError);
      return new Response(
        JSON.stringify({ success: false, error: 'Transcript not found. It may have been deleted.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the transcript's organization_id as source of truth (more secure than client-provided org)
    const effectiveOrgId = transcript.organization_id;
    
    if (effectiveOrgId !== organization_id) {
      console.log(`[generate-ad-copy] Note: Using transcript's org ${effectiveOrgId} (client sent ${organization_id})`);
    }

    // Fetch organization slug for URL generation
    const { data: org, error: orgError } = await supabase
      .from('client_organizations')
      .select('slug')
      .eq('id', effectiveOrgId)
      .single();

    if (orgError || !org?.slug) {
      console.error('[generate-ad-copy] Organization not found or missing slug:', orgError);
      return new Response(
        JSON.stringify({ success: false, error: 'Organization not found or missing slug' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build tracking URL
    const trackingUrl = buildTrackingUrl(
      org.slug,
      actblue_form_name.trim(),
      refcode.trim(),
      amount_preset,
      recurring_default
    );

    console.log(`[generate-ad-copy] Tracking URL: ${trackingUrl}`);

    // Generate copy for each audience segment
    const generatedCopy: Record<string, GeneratedCopySegment> = {};
    const metaReadyCopy: Record<string, MetaReadyCopySegment> = {};

    for (const segment of audience_segments) {
      console.log(`[generate-ad-copy] Generating copy for segment: ${segment.name}`);

      const segmentCopy = await generateCopyForSegment(openaiApiKey, transcript as TranscriptData, segment);

      if (!segmentCopy) {
        console.error(`[generate-ad-copy] Failed to generate copy for segment: ${segment.name}`);
        // Continue with other segments, but mark this one as failed
        generatedCopy[segment.name] = {
          primary_texts: [],
          headlines: [],
          descriptions: [],
        };
        metaReadyCopy[segment.name] = { variations: [] };
        continue;
      }

      generatedCopy[segment.name] = segmentCopy;
      metaReadyCopy[segment.name] = createMetaReadyCopy(segmentCopy, trackingUrl);

      console.log(`[generate-ad-copy] Generated ${metaReadyCopy[segment.name].variations.length} variations for ${segment.name}`);
    }

    // Determine validation status
    const validationStatus = determineValidationStatus(metaReadyCopy);

    // Save to database
    const generatedAt = new Date().toISOString();

    // Use video_id directly as the reference
    const videoRef = video_id || null;

    const { data: insertedGeneration, error: insertError } = await supabase
      .from('ad_copy_generations')
      .insert({
        organization_id: effectiveOrgId,
        video_ref: videoRef,
        transcript_ref: transcript_id,
        actblue_form_name: actblue_form_name.trim(),
        refcode: refcode.trim(),
        refcode_auto_generated: false,
        amount_preset,
        recurring_default: recurring_default || false,
        audience_segments,
        generated_copy: generatedCopy,
        meta_ready_copy: metaReadyCopy,
        tracking_url: trackingUrl,
        copy_validation_status: validationStatus,
        generation_model: 'gpt-4-turbo-preview',
        generation_prompt_version: '2.0-frameworks',
        generated_at: generatedAt,
        created_at: generatedAt,
        updated_at: generatedAt,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[generate-ad-copy] Database insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to save generation: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-ad-copy] Successfully saved generation ${insertedGeneration.id}`);

    // Build response
    const response: GenerateAdCopyResponse = {
      success: true,
      generation_id: insertedGeneration.id,
      generated_copy: generatedCopy,
      meta_ready_copy: metaReadyCopy,
      tracking_url: trackingUrl,
      generated_at: generatedAt,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-ad-copy] Unhandled error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
