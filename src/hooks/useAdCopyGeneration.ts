/**
 * useAdCopyGeneration - Copy generation management hook
 *
 * Handles AI-powered ad copy generation for the Ad Copy Studio:
 * - Calls generate-ad-copy edge function per video
 * - Progress tracking during generation
 * - Stores and manages generated results per video
 * - Segment-level regeneration
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  GeneratedCopy,
  MetaReadyCopy,
  AudienceSegment,
  PerVideoGeneratedCopy,
  PerVideoMetaReadyCopy,
  GenerateAdCopyResponse,
} from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface UseAdCopyGenerationOptions {
  organizationId: string;
}

export interface VideoGenerationParams {
  videoId: string;
  transcriptId: string;
  refcode: string;
}

export interface GenerateCopyParams {
  videos: VideoGenerationParams[];
  audienceSegments: AudienceSegment[];
  actblueFormName: string;
  amountPreset?: number;
  recurringDefault?: boolean;
}

// Legacy single-video params (kept for regenerateSegment)
interface SingleVideoParams {
  transcriptId: string;
  videoId?: string;
  refcode: string;
  audienceSegments: AudienceSegment[];
  actblueFormName: string;
  amountPreset?: number;
  recurringDefault?: boolean;
}

export interface UseAdCopyGenerationReturn {
  isGenerating: boolean;
  progress: number;
  perVideoGeneratedCopy: PerVideoGeneratedCopy;
  perVideoMetaReadyCopy: PerVideoMetaReadyCopy;
  perVideoTrackingUrls: Record<string, string>;
  generationId: string | null;
  error: string | null;
  warnings: string[];
  generateCopy: (params: GenerateCopyParams) => Promise<void>;
  regenerateSegment: (videoId: string, segmentName: string) => Promise<void>;
  clearGeneration: () => void;
  // Legacy accessors for backward compat (first video's data)
  generatedCopy: GeneratedCopy | null;
  metaReadyCopy: MetaReadyCopy | null;
  trackingUrl: string | null;
}

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
  const [perVideoGeneratedCopy, setPerVideoGeneratedCopy] = useState<PerVideoGeneratedCopy>({});
  const [perVideoMetaReadyCopy, setPerVideoMetaReadyCopy] = useState<PerVideoMetaReadyCopy>({});
  const [perVideoTrackingUrls, setPerVideoTrackingUrls] = useState<Record<string, string>>({});
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Store the last params for regeneration
  const lastParamsRef = useRef<GenerateCopyParams | null>(null);

  // =========================================================================
  // Copy Generation (per-video loop)
  // =========================================================================

  const generateCopy = useCallback(async (params: GenerateCopyParams) => {
    if (!organizationId) {
      setError('Organization ID is required');
      return;
    }

    const { videos, audienceSegments, actblueFormName, amountPreset, recurringDefault } = params;

    if (!videos || videos.length === 0) {
      setError('At least one video with a transcript is required');
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

    // Store params for potential regeneration
    lastParamsRef.current = params;

    // Reset state
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setWarnings([]);
    setPerVideoGeneratedCopy({});
    setPerVideoMetaReadyCopy({});
    setPerVideoTrackingUrls({});
    setGenerationId(null);

    const totalVideos = videos.length;
    const accumulatedCopy: PerVideoGeneratedCopy = {};
    const accumulatedMeta: PerVideoMetaReadyCopy = {};
    const accumulatedUrls: Record<string, string> = {};
    const accumulatedWarnings: string[] = [];
    let lastGenId: string | null = null;

    try {
      for (let i = 0; i < totalVideos; i++) {
        const video = videos[i];
        const videoProgress = ((i) / totalVideos) * 100;
        setProgress(Math.round(videoProgress));

        try {
          console.log(`[useAdCopyGeneration] Generating copy for video ${i + 1}/${totalVideos}: ${video.videoId}`);

          const { data, error: functionError } = await supabase.functions.invoke<GenerateAdCopyResponse>(
            'generate-ad-copy',
            {
              body: {
                organization_id: organizationId,
                transcript_id: video.transcriptId,
                video_id: video.videoId,
                audience_segments: audienceSegments,
                actblue_form_name: actblueFormName.trim(),
                refcode: video.refcode.trim(),
                amount_preset: amountPreset,
                recurring_default: recurringDefault,
              },
            }
          );

          if (functionError) {
            console.error(`[useAdCopyGeneration] Edge function error for video ${video.videoId}:`, functionError);
            accumulatedWarnings.push(`Video ${i + 1}: ${functionError.message || 'Generation failed'}`);
            continue;
          }

          if (!data || !data.success) {
            accumulatedWarnings.push(`Video ${i + 1}: Generation was not successful`);
            continue;
          }

          accumulatedCopy[video.videoId] = data.generated_copy;
          accumulatedMeta[video.videoId] = data.meta_ready_copy;
          if (data.tracking_url) accumulatedUrls[video.videoId] = data.tracking_url;
          if (data.generation_id) lastGenId = data.generation_id;

          // Update state progressively so UI can show partial results
          setPerVideoGeneratedCopy({ ...accumulatedCopy });
          setPerVideoMetaReadyCopy({ ...accumulatedMeta });
          setPerVideoTrackingUrls({ ...accumulatedUrls });

        } catch (videoErr: unknown) {
          const msg = videoErr instanceof Error ? videoErr.message : 'Unknown error';
          console.error(`[useAdCopyGeneration] Error for video ${video.videoId}:`, videoErr);
          accumulatedWarnings.push(`Video ${i + 1}: ${msg}`);
        }
      }

      setProgress(100);
      setGenerationId(lastGenId);
      setWarnings(accumulatedWarnings);

      const successCount = Object.keys(accumulatedCopy).length;
      if (successCount === 0) {
        throw new Error('All video generations failed');
      }

      const totalVariations = Object.values(accumulatedMeta).reduce(
        (sum, videoMeta) => sum + Object.values(videoMeta).reduce(
          (vSum, segment) => vSum + (segment.variations?.length || 0), 0
        ), 0
      );

      console.log(`[useAdCopyGeneration] Generated copy for ${successCount}/${totalVideos} videos, ${totalVariations} total variations`);

      if (accumulatedWarnings.length > 0) {
        toast({
          title: `Generated copy for ${successCount}/${totalVideos} videos`,
          description: `${accumulatedWarnings.length} video(s) had issues`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Copy generated successfully',
          description: `Generated ${totalVariations} ad variations across ${successCount} video${successCount !== 1 ? 's' : ''}`,
        });
      }
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
  // Segment Regeneration (for a specific video)
  // =========================================================================

  const regenerateSegment = useCallback(async (videoId: string, segmentName: string) => {
    if (!lastParamsRef.current) {
      setError('No previous generation parameters available');
      return;
    }

    const params = lastParamsRef.current;
    const video = params.videos.find(v => v.videoId === videoId);
    if (!video) {
      setError(`Video not found in generation params`);
      return;
    }

    const segment = params.audienceSegments.find(s => s.name === segmentName);
    if (!segment) {
      setError(`Segment "${segmentName}" not found`);
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setError(null);

    try {
      setProgress(50);

      const { data, error: functionError } = await supabase.functions.invoke<GenerateAdCopyResponse>(
        'generate-ad-copy',
        {
          body: {
            organization_id: organizationId,
            transcript_id: video.transcriptId,
            video_id: video.videoId,
            audience_segments: [segment],
            actblue_form_name: params.actblueFormName.trim(),
            refcode: video.refcode.trim(),
            amount_preset: params.amountPreset,
            recurring_default: params.recurringDefault,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Regeneration failed');
      }

      if (!data?.success) {
        throw new Error('Regeneration was not successful');
      }

      setProgress(80);

      // Merge the regenerated segment into existing per-video data
      setPerVideoGeneratedCopy(prev => {
        const existingForVideo = prev[videoId] || {};
        return {
          ...prev,
          [videoId]: { ...existingForVideo, ...data.generated_copy },
        };
      });

      setPerVideoMetaReadyCopy(prev => {
        const existingForVideo = prev[videoId] || {};
        return {
          ...prev,
          [videoId]: { ...existingForVideo, ...data.meta_ready_copy },
        };
      });

      if (data.generation_id) {
        setGenerationId(data.generation_id);
      }

      setProgress(100);

      console.log(`[useAdCopyGeneration] Regenerated segment "${segmentName}" for video ${videoId}`);

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
  }, [organizationId, toast]);

  // =========================================================================
  // State Management
  // =========================================================================

  const clearGeneration = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setPerVideoGeneratedCopy({});
    setPerVideoMetaReadyCopy({});
    setPerVideoTrackingUrls({});
    setGenerationId(null);
    setError(null);
    setWarnings([]);
    lastParamsRef.current = null;
  }, []);

  // =========================================================================
  // Legacy accessors (first video's data for backward compat)
  // =========================================================================

  const firstVideoId = Object.keys(perVideoGeneratedCopy)[0] || null;
  const generatedCopy = firstVideoId ? perVideoGeneratedCopy[firstVideoId] : null;
  const metaReadyCopy = firstVideoId ? perVideoMetaReadyCopy[firstVideoId] : null;
  const trackingUrl = firstVideoId ? perVideoTrackingUrls[firstVideoId] || null : null;

  // =========================================================================
  // Return
  // =========================================================================

  return {
    isGenerating,
    progress,
    perVideoGeneratedCopy,
    perVideoMetaReadyCopy,
    perVideoTrackingUrls,
    generationId,
    error,
    warnings,
    generateCopy,
    regenerateSegment,
    clearGeneration,
    // Legacy
    generatedCopy,
    metaReadyCopy,
    trackingUrl,
  };
}
