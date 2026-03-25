/**
 * useVariationFeedback - Hook for per-variation feedback and regeneration
 *
 * Manages feedback state, history, and API calls for iterative copy refinement.
 * Each variation is keyed by "videoId-segmentName-elementType-index".
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CopyElementType, VariationFeedback, FeedbackHistory } from '@/types/ad-copy-studio';

interface UseVariationFeedbackOptions {
  organizationId: string;
  onTextUpdated?: (
    videoId: string,
    segmentName: string,
    elementType: CopyElementType,
    index: number,
    newText: string
  ) => void;
}

function makeKey(videoId: string, segmentName: string, elementType: CopyElementType, index: number): string {
  return `${videoId}-${segmentName}-${elementType}-${index}`;
}

export function useVariationFeedback({ organizationId, onTextUpdated }: UseVariationFeedbackOptions) {
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackHistory>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Prevent double-submit
  const submittingRef = useRef<Set<string>>(new Set());

  const getFeedbackCount = useCallback((videoId: string, segmentName: string, elementType: CopyElementType, index: number): number => {
    const key = makeKey(videoId, segmentName, elementType, index);
    return feedbackHistory[key]?.length || 0;
  }, [feedbackHistory]);

  const getHistory = useCallback((videoId: string, segmentName: string, elementType: CopyElementType, index: number): VariationFeedback[] => {
    const key = makeKey(videoId, segmentName, elementType, index);
    return feedbackHistory[key] || [];
  }, [feedbackHistory]);

  const isLoading = useCallback((videoId: string, segmentName: string, elementType: CopyElementType, index: number): boolean => {
    const key = makeKey(videoId, segmentName, elementType, index);
    return loadingKeys.has(key);
  }, [loadingKeys]);

  const getError = useCallback((videoId: string, segmentName: string, elementType: CopyElementType, index: number): string | undefined => {
    const key = makeKey(videoId, segmentName, elementType, index);
    return errors[key];
  }, [errors]);

  const submitFeedback = useCallback(async (
    videoId: string,
    segmentName: string,
    elementType: CopyElementType,
    index: number,
    currentText: string,
    feedback: string,
    transcriptId: string,
    segmentDescription: string,
  ): Promise<string | null> => {
    const key = makeKey(videoId, segmentName, elementType, index);

    // Prevent double-submit
    if (submittingRef.current.has(key)) return null;
    submittingRef.current.add(key);

    setLoadingKeys(prev => new Set(prev).add(key));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

    try {
      const history = feedbackHistory[key] || [];

      const { data, error } = await supabase.functions.invoke('regenerate-variation', {
        body: {
          organization_id: organizationId,
          transcript_id: transcriptId,
          element_type: elementType,
          current_text: currentText,
          feedback: feedback.trim(),
          feedback_history: history.map(h => ({
            feedback: h.feedback,
            previous_text: h.previous_text,
            new_text: h.new_text,
          })),
          segment_name: segmentName,
          segment_description: segmentDescription,
        },
      });

      if (error) throw error;
      if (!data?.success || !data?.improved_text) {
        throw new Error(data?.error || 'Failed to regenerate');
      }

      const newText = data.improved_text as string;

      // Add to feedback history
      const entry: VariationFeedback = {
        feedback: feedback.trim(),
        timestamp: new Date().toISOString(),
        previous_text: currentText,
        new_text: newText,
      };

      setFeedbackHistory(prev => ({
        ...prev,
        [key]: [...(prev[key] || []), entry],
      }));

      // Notify parent to update copy state
      onTextUpdated?.(videoId, segmentName, elementType, index, newText);

      return newText;
    } catch (err: any) {
      const message = err?.message || 'Regeneration failed';
      setErrors(prev => ({ ...prev, [key]: message }));
      console.error('[useVariationFeedback] Error:', err);
      return null;
    } finally {
      setLoadingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      submittingRef.current.delete(key);
    }
  }, [organizationId, feedbackHistory, onTextUpdated]);

  const clearError = useCallback((videoId: string, segmentName: string, elementType: CopyElementType, index: number) => {
    const key = makeKey(videoId, segmentName, elementType, index);
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  return {
    feedbackHistory,
    setFeedbackHistory,
    getFeedbackCount,
    getHistory,
    isLoading,
    getError,
    submitFeedback,
    clearError,
  };
}
