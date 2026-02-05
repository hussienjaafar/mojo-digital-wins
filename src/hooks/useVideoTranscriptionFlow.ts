/**
 * useVideoTranscriptionFlow - Manages transcription workflow for Ad Copy Studio
 *
 * Handles:
 * - Triggering the transcribe-meta-ad-video edge function
 * - Polling video status until transcription completes
 * - Fetching transcript analysis from meta_ad_transcripts
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TranscriptAnalysis } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface TranscriptionFlowOptions {
  organizationId: string;
  onStatusChange?: (videoId: string, status: string) => void;
  onAnalysisReady?: (videoId: string, analysis: TranscriptAnalysis) => void;
  onError?: (videoId: string, error: string) => void;
}

export interface FetchAnalysisResult {
  analysis: TranscriptAnalysis;
  transcriptId: string;
}

export interface TranscriptionFlowReturn {
  triggerTranscription: (videoId: string) => Promise<boolean>;
  pollForCompletion: (videoId: string, maxWaitMs?: number) => Promise<string | null>;
  fetchAnalysis: (videoId: string) => Promise<FetchAnalysisResult | null>;
  processVideo: (videoId: string) => Promise<FetchAnalysisResult | null>;
  cancelPolling: (videoId: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes
const TERMINAL_STATUSES = ['TRANSCRIBED', 'ANALYZED', 'ERROR', 'FAILED', 'TRANSCRIPT_FAILED', 'COMPLETED', 'CANCELLED', 'error', 'URL_EXPIRED', 'URL_INACCESSIBLE'];

// =============================================================================
// Hook Implementation
// =============================================================================

export function useVideoTranscriptionFlow(
  options: TranscriptionFlowOptions
): TranscriptionFlowReturn {
  const { organizationId, onStatusChange, onAnalysisReady, onError } = options;
  
  // Track active polling operations for cleanup
  const pollingAbortControllers = useRef<Map<string, AbortController>>(new Map());

  /**
   * Trigger transcription for a video by calling the edge function
   */
  const triggerTranscription = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      console.log(`[useVideoTranscriptionFlow] Triggering transcription for video: ${videoId}`);
      
      const { data, error } = await supabase.functions.invoke('transcribe-meta-ad-video', {
        body: {
          organization_id: organizationId,
          video_id: videoId,
          mode: 'single',
        },
      });

      if (error) {
        console.error('[useVideoTranscriptionFlow] Edge function error:', error);
        onError?.(videoId, error.message || 'Transcription failed to start');
        return false;
      }

      console.log('[useVideoTranscriptionFlow] Transcription triggered successfully:', data);
      return true;
    } catch (err: any) {
      console.error('[useVideoTranscriptionFlow] Failed to trigger transcription:', err);
      onError?.(videoId, err.message || 'Failed to start transcription');
      return false;
    }
  }, [organizationId, onError]);

  /**
   * Poll meta_ad_videos.status until it reaches a terminal state
   */
  const pollForCompletion = useCallback(async (
    videoId: string,
    maxWaitMs: number = DEFAULT_MAX_WAIT_MS
  ): Promise<string | null> => {
    const abortController = new AbortController();
    pollingAbortControllers.current.set(videoId, abortController);

    const startTime = Date.now();
    let lastStatus = '';

    try {
      while (!abortController.signal.aborted) {
        // Check timeout
        if (Date.now() - startTime > maxWaitMs) {
          console.warn(`[useVideoTranscriptionFlow] Polling timeout for video: ${videoId}`);
          onError?.(videoId, 'Transcription timed out');
          return null;
        }

        // Query current status
        const { data, error } = await (supabase as any)
          .from('meta_ad_videos')
          .select('status')
          .eq('id', videoId)
          .single();

        if (error) {
          console.error('[useVideoTranscriptionFlow] Error fetching video status:', error);
          await new Promise(resolve => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
          continue;
        }

        const currentStatus = data?.status;

        // Notify on status change
        if (currentStatus && currentStatus !== lastStatus) {
          console.log(`[useVideoTranscriptionFlow] Status change: ${lastStatus} -> ${currentStatus}`);
          lastStatus = currentStatus;
          onStatusChange?.(videoId, currentStatus);
        }

        // Check for terminal status
        if (TERMINAL_STATUSES.includes(currentStatus)) {
          // Handle all failure/cancelled statuses
          const failureStatuses = ['ERROR', 'FAILED', 'TRANSCRIPT_FAILED', 'CANCELLED', 'error', 'URL_EXPIRED', 'URL_INACCESSIBLE'];
          if (failureStatuses.includes(currentStatus)) {
            const message = currentStatus === 'CANCELLED' ? 'Transcription cancelled' : `Transcription failed (status: ${currentStatus})`;
            onError?.(videoId, message);
            return null;
          }
          return currentStatus;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
      }

      return null; // Aborted
    } finally {
      pollingAbortControllers.current.delete(videoId);
    }
  }, [onStatusChange, onError]);

  /**
   * Fetch transcript analysis from meta_ad_transcripts
   * Returns both the analysis and the transcript_id
   * @param videoDbId - The primary key (id) from meta_ad_videos table
   */
  const fetchAnalysis = useCallback(async (videoDbId: string): Promise<{ analysis: TranscriptAnalysis; transcriptId: string } | null> => {
    try {
      console.log(`[useVideoTranscriptionFlow] Fetching analysis for video (db id): ${videoDbId}`);

      // Query by video_ref which stores the meta_ad_videos.id (primary key)
      const { data, error } = await (supabase as any)
        .from('meta_ad_transcripts')
        .select('*')
        .eq('video_ref', videoDbId)
        .single();

      if (error) {
        // PGRST116 means no rows found - not necessarily an error
        if (error.code === 'PGRST116') {
          console.log('[useVideoTranscriptionFlow] No transcript found yet for video:', videoDbId);
          return null;
        }
        console.error('[useVideoTranscriptionFlow] Error fetching transcript:', error);
        return null;
      }

      if (!data) {
        console.log('[useVideoTranscriptionFlow] No transcript data found');
        return null;
      }

      // Map database fields to TranscriptAnalysis type
      const analysis: TranscriptAnalysis = {
        transcript_text: data.transcript_text || '',
        issue_primary: data.issue_primary || '',
        issue_tags: data.issue_tags || [],
        political_stances: data.political_stances || [],
        targets_attacked: data.targets_attacked || [],
        targets_supported: data.targets_supported || [],
        policy_positions: data.policy_positions || [],
        donor_pain_points: data.donor_pain_points || [],
        values_appealed: data.values_appealed || [],
        urgency_drivers: data.urgency_drivers || [],
        topic_primary: data.topic_primary || '',
        topic_tags: data.topic_tags || [],
        tone_primary: data.tone_primary || '',
        tone_tags: data.tone_tags || [],
        sentiment_score: data.sentiment_score ?? 0,
        urgency_level: data.urgency_level || 'medium',
        key_phrases: data.key_phrases || [],
        cta_text: data.cta_text,
      };

      console.log('[useVideoTranscriptionFlow] Analysis fetched successfully, transcript_id:', data.id);
      onAnalysisReady?.(videoDbId, analysis);
      return { analysis, transcriptId: data.id };
    } catch (err: any) {
      console.error('[useVideoTranscriptionFlow] Failed to fetch analysis:', err);
      return null;
    }
  }, [onAnalysisReady]);

  /**
   * Complete workflow: trigger transcription, poll for completion, fetch analysis
   */
  const processVideo = useCallback(async (videoId: string): Promise<{ analysis: TranscriptAnalysis; transcriptId: string } | null> => {
    // Step 1: Trigger transcription
    const triggered = await triggerTranscription(videoId);
    if (!triggered) {
      return null;
    }

    // Step 2: Poll for completion
    const finalStatus = await pollForCompletion(videoId);
    if (!finalStatus) {
      return null;
    }

    // Step 3: Fetch analysis
    const result = await fetchAnalysis(videoId);
    return result;
  }, [triggerTranscription, pollForCompletion, fetchAnalysis]);

  /**
   * Cancel ongoing polling for a video
   */
  const cancelPolling = useCallback((videoId: string) => {
    const controller = pollingAbortControllers.current.get(videoId);
    if (controller) {
      controller.abort();
      pollingAbortControllers.current.delete(videoId);
    }
  }, []);

  return {
    triggerTranscription,
    pollForCompletion,
    fetchAnalysis,
    processVideo,
    cancelPolling,
  };
}
