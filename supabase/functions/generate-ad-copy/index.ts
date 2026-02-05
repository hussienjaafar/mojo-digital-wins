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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
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
  primary_text_visible: 125,
  headline_max: 40,
  description_max: 30,
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_CTA_TYPE = 'DONATE_NOW';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build ActBlue tracking URL
 */
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
  if (amount !== undefined) {
    params.set('amount', amount.toString());
  }
  if (recurring !== undefined) {
    params.set('recurring', recurring.toString());
  }
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Build the GPT-4 prompt for generating ad copy
 */
function buildPrompt(transcript: TranscriptData, segment: AudienceSegment): string {
  return `You are an expert political fundraising copywriter specializing in Meta ads.
Generate high-converting ad copy based on this video transcript analysis.

## VIDEO ANALYSIS
Transcript: ${transcript.transcript_text || 'No transcript available'}
Primary Issue: ${transcript.issue_primary || 'Not specified'}
Political Stances: ${(transcript.political_stances || []).join(', ') || 'Not specified'}
Tone: ${transcript.tone_primary || 'Not specified'}
Tone Tags: ${(transcript.tone_tags || []).join(', ') || 'None'}
Targets Attacked: ${(transcript.targets_attacked || []).join(', ') || 'None'}
Targets Supported: ${(transcript.targets_supported || []).join(', ') || 'None'}
Donor Pain Points: ${(transcript.donor_pain_points || []).join(', ') || 'Not specified'}
Key Phrases: ${(transcript.key_phrases || []).join(', ') || 'Not specified'}
CTA from Video: ${transcript.cta_text || 'Not specified'}
Urgency Level: ${transcript.urgency_level || 'medium'}
Values Appealed: ${(transcript.values_appealed || []).join(', ') || 'Not specified'}

## TARGET AUDIENCE
Name: ${segment.name}
Description: ${segment.description}

## CHARACTER LIMITS (STRICT)
- Primary Text: Maximum ${META_COPY_LIMITS.primary_text_visible} characters (visible without "See More")
- Headline: Maximum ${META_COPY_LIMITS.headline_max} characters
- Description: Maximum ${META_COPY_LIMITS.description_max} characters

## INSTRUCTIONS
Generate 5 genuinely different variations for each element.
Each variation should take a different angle:
1. Pain point focus - highlight the problem/threat
2. Solution focus - emphasize what the candidate/cause will do
3. Enemy focus - attack the opposition
4. Values focus - appeal to core beliefs
5. Urgency focus - create immediate need to act

CRITICAL: Strictly adhere to character limits. Count characters carefully.
- Primary texts MUST be under ${META_COPY_LIMITS.primary_text_visible} characters
- Headlines MUST be under ${META_COPY_LIMITS.headline_max} characters
- Descriptions MUST be under ${META_COPY_LIMITS.description_max} characters

Return valid JSON only (no markdown, no explanation):
{
  "primary_texts": ["text1", "text2", "text3", "text4", "text5"],
  "headlines": ["headline1", "headline2", "headline3", "headline4", "headline5"],
  "descriptions": ["desc1", "desc2", "desc3", "desc4", "desc5"]
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
            content: 'You are an expert political ad copywriter. Return only valid JSON with no markdown formatting or explanation.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
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
    const primaryValidated = validateAndFormat(
      generatedCopy.primary_texts[i] || '',
      META_COPY_LIMITS.primary_text_visible
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

    // Fetch transcript from database
    const { data: transcript, error: transcriptError } = await supabase
      .from('meta_ad_transcripts')
      .select(`
        id,
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
      .eq('organization_id', organization_id)
      .single();

    if (transcriptError || !transcript) {
      console.error('[generate-ad-copy] Transcript not found:', transcriptError);
      return new Response(
        JSON.stringify({ success: false, error: 'Transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch organization slug for URL generation
    const { data: org, error: orgError } = await supabase
      .from('client_organizations')
      .select('slug')
      .eq('id', organization_id)
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
        organization_id,
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
        generation_prompt_version: '1.0',
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
