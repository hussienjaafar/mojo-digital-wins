/**
 * =============================================================================
 * GENERATE AD COPY - Edge Function (v4.0)
 * =============================================================================
 *
 * Generates Meta ad copy using Lovable AI Gateway (google/gemini-2.5-pro).
 * Creates 5 variations per segment using research-backed copywriting frameworks.
 *
 * v4.0 Changes:
 * - Added chain-of-thought reasoning (model analyzes transcript before writing)
 * - Per-variation metadata (framework, hook_strategy) for A/B testing
 * - Expanded segment tone guidance with psychological levers
 * - Comparative framing rule for enemy framing
 * - Hook-Bridge-CTA structure enforcement
 * - Temperature lowered to 0.85 for reliability within tight char limits
 * - JSON-formatted few-shot examples aligned with tool schema
 *
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.81.1";
import { getCorsHeaders } from "../_shared/security.ts";
import { callLovableAIWithTools, AIGatewayError } from "../_shared/ai-client.ts";
import {
  AD_COPY_SYSTEM_PROMPT,
  buildAdCopyUserMessage,
  AD_COPY_GENERATION_TOOL,
} from "../_shared/prompts.ts";

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

/** The new structured variation returned by the AI tool call */
interface AIVariation {
  framework: string;
  hook_strategy: string;
  primary_text: string;
  headline: string;
  description: string;
}

/** AI tool call result shape */
interface AIGenerationResult {
  reasoning: {
    core_conflict: string;
    emotional_lever: string;
    donor_identity: string;
    villain: string;
    stakes: string;
  };
  variations: AIVariation[];
}

/** Flattened segment copy for frontend compatibility */
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
  framework: string;
  hook_strategy: string;
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
  warnings?: string[];
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
  primary_text_visible: 125,
  primary_text_max: 900,
  headline_max: 27,
  description_max: 25,
};

const DEFAULT_CTA_TYPE = 'DONATE_NOW';

// =============================================================================
// Helper Functions
// =============================================================================

function buildTrackingUrl(
  orgSlug: string,
  actblueFormName: string,
  refcode: string,
  amount?: number,
  recurring?: boolean
): string {
  const baseUrl = `https://molitico.com/r/${orgSlug}/${actblueFormName}`;
  const params = new URLSearchParams();
  params.set('refcode', refcode);
  if (amount !== undefined) params.set('amount', amount.toString());
  if (recurring !== undefined) params.set('recurring', recurring.toString());
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Expanded segment tone guidance with psychological levers, dollar anchors, and CTA style.
 */
function getSegmentTone(segmentDescription: string): string {
  const desc = segmentDescription.toLowerCase();

  if (desc.includes('progressive') || desc.includes('activist') || desc.includes('liberal')) {
    return `PROGRESSIVE_BASE:
- Lead with shared values and movement identity
- Use collective language ("we", "together", "our movement")
- Frame donation as participation in systemic change
- Suggest amounts: $27 (Bernie anchor), $10, $5
- CTA tone: empowerment ("Be part of this", "Join the fight")
- Psychological lever: collective identity, in-group solidarity`;
  }

  if (desc.includes('swing') || desc.includes('persuadable') || desc.includes('independent')) {
    return `SWING_VOTERS:
- Lead with consequences and tangible impacts, NOT ideology
- Avoid partisan labels (no "progressive", "liberal", "MAGA")
- Focus on pocketbook issues and personal safety
- Use loss aversion: "You could lose X" > "We could gain Y"
- Suggest amounts: $10, $25 (moderate, not extreme)
- CTA tone: protective ("Protect your family", "Don't let this happen")
- Psychological lever: loss aversion, personal threat`;
  }

  if (desc.includes('high-dollar') || desc.includes('major donor') || desc.includes('whale')) {
    return `HIGH_DOLLAR:
- Frame as strategic investment, not emotional plea
- Insider language: "You understand what's at stake"
- Emphasize outsized impact and exclusive role
- Suggest amounts: $100, $250, $500
- CTA tone: strategic ("Make the decisive investment")
- Psychological lever: status, strategic impact, exclusivity`;
  }

  if (desc.includes('grassroots') || desc.includes('small-dollar') || desc.includes('first-time')) {
    return `GRASSROOTS:
- Maximum urgency, small amounts feel powerful
- "Your $5 is the backbone of this campaign"
- Collective power: "Millions of $5 gifts beat one billionaire"
- Suggest amounts: $5, $10, $3
- CTA tone: immediate ("Right now", "This moment")
- Psychological lever: collective power, every-dollar-counts`;
  }

  return `GENERAL:
- Balance urgency with values. Use "you" language heavily. Create personal stake.
- Suggest amounts: $10, $27, $5
- CTA tone: direct and empowering
- Psychological lever: personal agency, donor-as-hero`;
}

/**
 * Generate ad copy for a single segment using Lovable AI with tool calling.
 * Returns the new variations[] structure mapped back to flat arrays for frontend compat.
 */
async function generateCopyForSegment(
  transcript: TranscriptData,
  segment: AudienceSegment,
  model = 'google/gemini-2.5-pro',
  organizationProfile?: any
): Promise<{ copy: GeneratedCopySegment; reasoning: AIGenerationResult['reasoning']; rawVariations: AIVariation[]; model: string } | null> {
  try {
    const segmentTone = getSegmentTone(segment.description);
    const userMessage = buildAdCopyUserMessage({
      transcriptText: transcript.transcript_text,
      issuePrimary: transcript.issue_primary,
      politicalStances: transcript.political_stances,
      tonePrimary: transcript.tone_primary,
      toneTags: transcript.tone_tags,
      targetsAttacked: transcript.targets_attacked,
      targetsSupported: transcript.targets_supported,
      donorPainPoints: transcript.donor_pain_points,
      keyPhrases: transcript.key_phrases,
      ctaText: transcript.cta_text,
      urgencyLevel: transcript.urgency_level,
      valuesAppealed: transcript.values_appealed,
      segmentName: segment.name,
      segmentDescription: segment.description,
      segmentTone,
      organizationContext: organizationProfile || undefined,
    });

    const { result, model: usedModel } = await callLovableAIWithTools<AIGenerationResult>({
      model,
      messages: [
        { role: 'system', content: AD_COPY_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.85,
      maxTokens: 3000,
      tools: [AD_COPY_GENERATION_TOOL],
      toolChoice: "required",
    });

    // Handle new variations[] structure
    if (Array.isArray(result.variations) && result.variations.length > 0) {
      const variations = result.variations.slice(0, 5);
      return {
        copy: {
          primary_texts: variations.map(v => v.primary_text),
          headlines: variations.map(v => v.headline),
          descriptions: variations.map(v => v.description),
        },
        reasoning: result.reasoning,
        rawVariations: variations,
        model: usedModel,
      };
    }

    // Fallback: handle legacy flat array format (in case model returns old format)
    const legacy = result as any;
    if (Array.isArray(legacy.primary_texts) && Array.isArray(legacy.headlines) && Array.isArray(legacy.descriptions)) {
      console.warn('[generate-ad-copy] AI returned legacy flat array format, converting');
      return {
        copy: {
          primary_texts: legacy.primary_texts.slice(0, 5),
          headlines: legacy.headlines.slice(0, 5),
          descriptions: legacy.descriptions.slice(0, 5),
        },
        reasoning: result.reasoning || { core_conflict: '', emotional_lever: '', donor_identity: '', villain: '', stakes: '' },
        rawVariations: [],
        model: usedModel,
      };
    }

    console.error('[generate-ad-copy] Invalid response structure from AI');
    return null;
  } catch (err) {
    console.error('[generate-ad-copy] Error generating copy for segment:', err);
    return null;
  }
}

function validateAndFormat(text: string, maxLength: number): { text: string; meetsSpec: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return { text: trimmed, meetsSpec: true };
  return { text: trimmed.substring(0, maxLength - 3) + '...', meetsSpec: false };
}

function createMetaReadyCopy(
  generatedCopy: GeneratedCopySegment,
  rawVariations: AIVariation[],
  trackingUrl: string
): MetaReadyCopySegment {
  const variations: MetaReadyVariation[] = [];
  const numVariations = Math.min(generatedCopy.primary_texts.length, generatedCopy.headlines.length, generatedCopy.descriptions.length, 5);

  for (let i = 0; i < numVariations; i++) {
    const primaryValidated = validateAndFormat(generatedCopy.primary_texts[i] || '', META_COPY_LIMITS.primary_text_max);
    const headlineValidated = validateAndFormat(generatedCopy.headlines[i] || '', META_COPY_LIMITS.headline_max);
    const descriptionValidated = validateAndFormat(generatedCopy.descriptions[i] || '', META_COPY_LIMITS.description_max);

    const rawVar = rawVariations[i];

    variations.push({
      primary_text: primaryValidated.text,
      headline: headlineValidated.text,
      description: descriptionValidated.text,
      call_to_action_type: DEFAULT_CTA_TYPE,
      destination_url: trackingUrl,
      framework: rawVar?.framework || 'UNKNOWN',
      hook_strategy: rawVar?.hook_strategy || 'unknown',
      char_counts: {
        primary: primaryValidated.text.length,
        headline: headlineValidated.text.length,
        description: descriptionValidated.text.length,
      },
      meets_meta_specs: primaryValidated.meetsSpec && headlineValidated.meetsSpec && descriptionValidated.meetsSpec,
    });
  }

  return { variations };
}

function determineValidationStatus(metaReadyCopy: Record<string, MetaReadyCopySegment>): string {
  let allValid = true;
  for (const segmentName of Object.keys(metaReadyCopy)) {
    for (const variation of metaReadyCopy[segmentName].variations) {
      if (!variation.meets_meta_specs) { allValid = false; break; }
    }
    if (!allValid) break;
  }
  return allValid ? 'all_valid' : 'some_truncated';
}

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
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: GenerateAdCopyRequest = await req.json();
    const { organization_id, transcript_id, video_id, audience_segments, actblue_form_name, refcode, amount_preset, recurring_default } = body;

    // Validate required fields
    if (!organization_id) return new Response(JSON.stringify({ success: false, error: 'organization_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!transcript_id) return new Response(JSON.stringify({ success: false, error: 'transcript_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!audience_segments || !Array.isArray(audience_segments) || audience_segments.length === 0) return new Response(JSON.stringify({ success: false, error: 'audience_segments must be a non-empty array' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!actblue_form_name?.trim()) return new Response(JSON.stringify({ success: false, error: 'actblue_form_name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!refcode?.trim()) return new Response(JSON.stringify({ success: false, error: 'refcode is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log(`[generate-ad-copy] Starting v4.0 generation for org ${organization_id}, transcript ${transcript_id}`);

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('meta_ad_transcripts')
      .select('id, organization_id, transcript_text, issue_primary, political_stances, tone_primary, tone_tags, targets_attacked, targets_supported, donor_pain_points, key_phrases, cta_text, urgency_level, values_appealed')
      .eq('id', transcript_id)
      .maybeSingle();

    if (transcriptError || !transcript) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transcript not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveOrgId = transcript.organization_id;

    // Fetch org slug
    const { data: org, error: orgError } = await supabase
      .from('client_organizations')
      .select('slug')
      .eq('id', effectiveOrgId)
      .single();

    if (orgError || !org?.slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organization not found or missing slug' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trackingUrl = buildTrackingUrl(org.slug, actblue_form_name.trim(), refcode.trim(), amount_preset, recurring_default);

    // Fetch organization profile for context enrichment (graceful degradation)
    const { data: orgProfile } = await supabase
      .from('organization_profiles')
      .select('mission_summary, focus_areas, key_issues, allies, opponents, stakeholders, geographies, sensitivity_redlines, ai_extracted_data')
      .eq('organization_id', effectiveOrgId)
      .maybeSingle();

    if (orgProfile) {
      console.log(`[generate-ad-copy] Found organization profile for context enrichment`);
    } else {
      console.log(`[generate-ad-copy] No organization profile found, proceeding without org context`);
    }

    // Generate copy for each segment
    const generatedCopy: Record<string, GeneratedCopySegment> = {};
    const metaReadyCopy: Record<string, MetaReadyCopySegment> = {};

    const warnings: string[] = [];
    let successModel = 'google/gemini-2.5-pro';

    for (const segment of audience_segments) {
      console.log(`[generate-ad-copy] Generating copy for segment: ${segment.name}`);
      let result = await generateCopyForSegment(transcript as TranscriptData, segment, 'google/gemini-2.5-pro', orgProfile);

      // Model fallback: if Pro fails, try Flash
      if (!result) {
        console.warn(`[generate-ad-copy] Pro failed for "${segment.name}", trying Flash fallback`);
        result = await generateCopyForSegment(transcript as TranscriptData, segment, 'google/gemini-2.5-flash', orgProfile);
      }

      if (!result) {
        warnings.push(`Generation failed for segment "${segment.name}" after retry with fallback model`);
        generatedCopy[segment.name] = { primary_texts: [], headlines: [], descriptions: [] };
        metaReadyCopy[segment.name] = { variations: [] };
        continue;
      }

      if (result.model !== 'google/gemini-2.5-pro') {
        warnings.push(`Segment "${segment.name}" used fallback model: ${result.model}`);
      }
      successModel = result.model;

      generatedCopy[segment.name] = result.copy;
      metaReadyCopy[segment.name] = createMetaReadyCopy(result.copy, result.rawVariations, trackingUrl);

      console.log(`[generate-ad-copy] Segment "${segment.name}" (${result.model}): ${metaReadyCopy[segment.name].variations.length} variations | Reasoning: ${result.reasoning.core_conflict?.slice(0, 80)}`);
    }

    // Check if ALL segments produced empty results
    const totalVariations = Object.values(metaReadyCopy)
      .reduce((sum, seg) => sum + seg.variations.length, 0);

    if (totalVariations === 0) {
      console.error('[generate-ad-copy] All segments failed to generate copy');
      return new Response(
        JSON.stringify({ success: false, error: 'AI generation failed for all segments. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validationStatus = determineValidationStatus(metaReadyCopy);
    const generatedAt = new Date().toISOString();

    const { data: insertedGeneration, error: insertError } = await supabase
      .from('ad_copy_generations')
      .insert({
        organization_id: effectiveOrgId,
        video_ref: video_id || null,
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
        generation_model: successModel,
        generation_prompt_version: '4.1-org-context-impact-framing',
        generated_at: generatedAt,
        created_at: generatedAt,
        updated_at: generatedAt,
      })
      .select('id')
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to save generation: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-ad-copy] Successfully saved generation ${insertedGeneration.id}`);

    const response: GenerateAdCopyResponse = {
      success: true,
      generation_id: insertedGeneration.id,
      generated_copy: generatedCopy,
      meta_ready_copy: metaReadyCopy,
      tracking_url: trackingUrl,
      generated_at: generatedAt,
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[generate-ad-copy] Unhandled error:', error);

    if (error instanceof AIGatewayError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
