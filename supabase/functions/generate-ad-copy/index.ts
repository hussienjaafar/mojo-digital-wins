/**
 * =============================================================================
 * GENERATE AD COPY - Edge Function (v3.0)
 * =============================================================================
 *
 * Generates Meta ad copy using Lovable AI Gateway (google/gemini-2.5-pro).
 * Creates 5 variations per segment using research-backed copywriting frameworks.
 *
 * v3.0 Changes:
 * - Migrated from OpenAI direct to Lovable AI Gateway
 * - Restructured prompts (system/user separation, no duplication)
 * - Added negative examples and few-shot gold-standard examples
 * - Updated Meta character limits for mobile-safe placements
 * - Switched to tool calling for structured JSON output
 * - Temperature increased to 0.95 for maximum creative diversity
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
  primary_text_visible: 125,
  primary_text_max: 300,
  headline_max: 27,      // Mobile-safe (was 40)
  description_max: 25,   // Mobile-safe (was 30)
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
 * Generate ad copy for a single segment using Lovable AI with tool calling.
 */
async function generateCopyForSegment(
  transcript: TranscriptData,
  segment: AudienceSegment
): Promise<GeneratedCopySegment | null> {
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
    });

    const { result } = await callLovableAIWithTools<GeneratedCopySegment>({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: AD_COPY_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.95,
      maxTokens: 3000,
      tools: [AD_COPY_GENERATION_TOOL],
      toolChoice: { type: "function", function: { name: "generate_ad_copy" } },
    });

    if (!Array.isArray(result.primary_texts) || !Array.isArray(result.headlines) || !Array.isArray(result.descriptions)) {
      console.error('[generate-ad-copy] Invalid response structure from AI');
      return null;
    }

    return {
      primary_texts: result.primary_texts.slice(0, 5),
      headlines: result.headlines.slice(0, 5),
      descriptions: result.descriptions.slice(0, 5),
    };
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

function createMetaReadyCopy(generatedCopy: GeneratedCopySegment, trackingUrl: string): MetaReadyCopySegment {
  const variations: MetaReadyVariation[] = [];
  const numVariations = Math.min(generatedCopy.primary_texts.length, generatedCopy.headlines.length, generatedCopy.descriptions.length, 5);

  for (let i = 0; i < numVariations; i++) {
    const primaryValidated = validateAndFormat(generatedCopy.primary_texts[i] || '', META_COPY_LIMITS.primary_text_max);
    const headlineValidated = validateAndFormat(generatedCopy.headlines[i] || '', META_COPY_LIMITS.headline_max);
    const descriptionValidated = validateAndFormat(generatedCopy.descriptions[i] || '', META_COPY_LIMITS.description_max);

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
    console.log(`[generate-ad-copy] Starting v3.0 generation for org ${organization_id}, transcript ${transcript_id}`);

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

    // Generate copy for each segment
    const generatedCopy: Record<string, GeneratedCopySegment> = {};
    const metaReadyCopy: Record<string, MetaReadyCopySegment> = {};

    for (const segment of audience_segments) {
      console.log(`[generate-ad-copy] Generating copy for segment: ${segment.name}`);
      const segmentCopy = await generateCopyForSegment(transcript as TranscriptData, segment);

      if (!segmentCopy) {
        generatedCopy[segment.name] = { primary_texts: [], headlines: [], descriptions: [] };
        metaReadyCopy[segment.name] = { variations: [] };
        continue;
      }

      generatedCopy[segment.name] = segmentCopy;
      metaReadyCopy[segment.name] = createMetaReadyCopy(segmentCopy, trackingUrl);
      console.log(`[generate-ad-copy] Generated ${metaReadyCopy[segment.name].variations.length} variations for ${segment.name}`);
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
        generation_model: 'google/gemini-2.5-pro',
        generation_prompt_version: '3.0-frameworks-toolcalling',
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
