/**
 * useAdCopyGeneration - Copy generation management hook
 *
 * Handles AI-powered ad copy generation for the Ad Copy Studio:
 * - Calls generate-ad-copy edge function
 * - Progress tracking during generation
 * - Stores and manages generated results
 * - Segment-level regeneration
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  GeneratedCopy,
  MetaReadyCopy,
  AudienceSegment,
  GenerateAdCopyResponse,
} from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface UseAdCopyGenerationOptions {
  organizationId: string;
}

export interface GenerateCopyParams {
  transcriptId: string;
  videoId?: string;
  audienceSegments: AudienceSegment[];
  actblueFormName: string;
  refcode: string;
  amountPreset?: number;
  recurringDefault?: boolean;
}

export interface UseAdCopyGenerationReturn {
  isGenerating: boolean;
  progress: number;
  generatedCopy: GeneratedCopy | null;
  metaReadyCopy: MetaReadyCopy | null;
  trackingUrl: string | null;
  generationId: string | null;
  error: string | null;
  generateCopy: (params: GenerateCopyParams) => Promise<void>;
  regenerateSegment: (segmentName: string) => Promise<void>;
  clearGeneration: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const GENERATION_PROGRESS_STEPS = {
  STARTED: 10,
  FETCHING_TRANSCRIPT: 20,
  GENERATING_COPY: 50,
  VALIDATING: 80,
  SAVING: 90,
  COMPLETE: 100,
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAdCopyGeneration(
  options: UseAdCopyGenerationOptions
): UseAdCopyGenerationReturn {
  const { organizationId } = options;
  const { toast } = useToast();

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedCopy, setGeneratedCopy] = useState<GeneratedCopy | null>(null);
  const [metaReadyCopy, setMetaReadyCopy] = useState<MetaReadyCopy | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store the last params for regeneration
  const [lastParams, setLastParams] = useState<GenerateCopyParams | null>(null);

  // =========================================================================
  // Copy Generation
  // =========================================================================

  /**
   * Generate ad copy using the edge function
   */
  const generateCopy = useCallback(async (params: GenerateCopyParams) => {
    if (!organizationId) {
      setError('Organization ID is required');
      return;
    }

    const {
      transcriptId,
      videoId,
      audienceSegments,
      actblueFormName,
      refcode,
      amountPreset,
      recurringDefault,
    } = params;

    // Validate required params
    if (!transcriptId) {
      setError('Transcript ID is required');
      return;
    }

    if (!audienceSegments || audienceSegments.length === 0) {
      setError('At least one audience segment is required');
      return;
    }

    if (!actblueFormName?.trim()) {
      setError('ActBlue form name is required');
      return;
    }

    if (!refcode?.trim()) {
      setError('Refcode is required');
      return;
    }

    // Store params for potential regeneration
    setLastParams(params);

    // Reset state
    setIsGenerating(true);
    setProgress(GENERATION_PROGRESS_STEPS.STARTED);
    setError(null);
    setGeneratedCopy(null);
    setMetaReadyCopy(null);
    setTrackingUrl(null);
    setGenerationId(null);

    try {
      // Simulate progress while waiting for API
      setProgress(GENERATION_PROGRESS_STEPS.FETCHING_TRANSCRIPT);

      // Call the edge function
      const { data, error: functionError } = await supabase.functions.invoke<GenerateAdCopyResponse>(
        'generate-ad-copy',
        {
          body: {
            organization_id: organizationId,
            transcript_id: transcriptId,
            video_id: videoId,
            audience_segments: audienceSegments,
            actblue_form_name: actblueFormName.trim(),
            refcode: refcode.trim(),
            amount_preset: amountPreset,
            recurring_default: recurringDefault,
          },
        }
      );

      setProgress(GENERATION_PROGRESS_STEPS.GENERATING_COPY);

      if (functionError) {
        console.error('[useAdCopyGeneration] Edge function error:', functionError);
        throw new Error(functionError.message || 'Generation failed');
      }

      if (!data) {
        throw new Error('No response from generation service');
      }

      if (!data.success) {
        throw new Error('Generation was not successful');
      }

      setProgress(GENERATION_PROGRESS_STEPS.VALIDATING);

      // Update state with results
      setGeneratedCopy(data.generated_copy);
      setMetaReadyCopy(data.meta_ready_copy);
      setTrackingUrl(data.tracking_url);
      setGenerationId(data.generation_id);

      setProgress(GENERATION_PROGRESS_STEPS.COMPLETE);

      // Count total variations generated
      const totalVariations = Object.values(data.meta_ready_copy || {}).reduce(
        (sum, segment) => sum + (segment.variations?.length || 0),
        0
      );

      console.log(`[useAdCopyGeneration] Generated ${totalVariations} variations for ${Object.keys(data.generated_copy || {}).length} segments`);

      toast({
        title: 'Copy generated successfully',
        description: `Generated ${totalVariations} ad variations`,
      });
    } catch (err: unknown) {
      console.error('[useAdCopyGeneration] Generation error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate ad copy';
      setError(message);
      toast({
        title: 'Generation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [organizationId, toast]);

  // =========================================================================
  // Segment Regeneration
  // =========================================================================

  /**
   * Regenerate copy for a specific audience segment
   * Note: This requires re-calling the generation endpoint with a single segment
   */
  const regenerateSegment = useCallback(async (segmentName: string) => {
    if (!lastParams) {
      setError('No previous generation parameters available');
      return;
    }

    // Find the segment to regenerate
    const segment = lastParams.audienceSegments.find(s => s.name === segmentName);
    if (!segment) {
      setError(`Segment "${segmentName}" not found`);
      return;
    }

    setIsGenerating(true);
    setProgress(GENERATION_PROGRESS_STEPS.STARTED);
    setError(null);

    try {
      setProgress(GENERATION_PROGRESS_STEPS.GENERATING_COPY);

      // Call edge function with just this segment
      const { data, error: functionError } = await supabase.functions.invoke<GenerateAdCopyResponse>(
        'generate-ad-copy',
        {
          body: {
            organization_id: organizationId,
            transcript_id: lastParams.transcriptId,
            video_id: lastParams.videoId,
            audience_segments: [segment], // Only this segment
            actblue_form_name: lastParams.actblueFormName.trim(),
            refcode: lastParams.refcode.trim(),
            amount_preset: lastParams.amountPreset,
            recurring_default: lastParams.recurringDefault,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Regeneration failed');
      }

      if (!data?.success) {
        throw new Error('Regeneration was not successful');
      }

      setProgress(GENERATION_PROGRESS_STEPS.VALIDATING);

      // Merge the regenerated segment with existing data
      if (generatedCopy && data.generated_copy) {
        setGeneratedCopy({
          ...generatedCopy,
          ...data.generated_copy,
        });
      }

      if (metaReadyCopy && data.meta_ready_copy) {
        setMetaReadyCopy({
          ...metaReadyCopy,
          ...data.meta_ready_copy,
        });
      }

      // Update generation ID if changed
      if (data.generation_id) {
        setGenerationId(data.generation_id);
      }

      setProgress(GENERATION_PROGRESS_STEPS.COMPLETE);

      console.log(`[useAdCopyGeneration] Regenerated segment: ${segmentName}`);

      toast({
        title: 'Segment regenerated',
        description: `Updated copy for "${segmentName}"`,
      });
    } catch (err: any) {
      console.error('[useAdCopyGeneration] Regeneration error:', err);
      const message = err?.message || 'Failed to regenerate segment';
      setError(message);
      toast({
        title: 'Regeneration failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [organizationId, lastParams, generatedCopy, metaReadyCopy, toast]);

  // =========================================================================
  // State Management
  // =========================================================================

  /**
   * Clear all generation state
   */
  const clearGeneration = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setGeneratedCopy(null);
    setMetaReadyCopy(null);
    setTrackingUrl(null);
    setGenerationId(null);
    setError(null);
    setLastParams(null);
  }, []);

  // =========================================================================
  // Return
  // =========================================================================

  return {
    isGenerating,
    progress,
    generatedCopy,
    metaReadyCopy,
    trackingUrl,
    generationId,
    error,
    generateCopy,
    regenerateSegment,
    clearGeneration,
  };
}
