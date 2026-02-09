/**
 * AdCopyWizard - Main container component for the Ad Copy Studio wizard
 *
 * Orchestrates the 5-step workflow:
 * 1. Upload - Upload campaign videos
 * 2. Review - Review transcripts & analysis
 * 3. Configure - Configure campaign settings
 * 4. Generate - Generate ad copy
 * 5. Export - Review & export copy
 *
 * Features:
 * - Organization picker in header
 * - WizardStepIndicator for progress tracking
 * - Framer Motion transitions between steps
 * - State persistence through useAdCopyStudio hook
 * - Backend status synchronization on load
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence, type Easing } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RotateCcw, Sparkles, ChevronDown, Clock } from 'lucide-react';

// Picker
import { AdminOrganizationPicker } from './AdminOrganizationPicker';

// Hooks
import { useAdCopyStudio } from '@/hooks/useAdCopyStudio';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { useAdCopyGeneration } from '@/hooks/useAdCopyGeneration';
import { useVideoTranscriptionFlow } from '@/hooks/useVideoTranscriptionFlow';

// Components
import { WizardStepIndicator } from './WizardStepIndicator';
import { VideoUploadStep } from './steps/VideoUploadStep';
import { TranscriptReviewStep } from './steps/TranscriptReviewStep';
import { CampaignConfigStep } from './steps/CampaignConfigStep';
import { CopyGenerationStep } from './steps/CopyGenerationStep';
import { CopyExportStep } from './steps/CopyExportStep';
import { GenerationHistoryPanel } from './GenerationHistoryPanel';

// Types
import type { CampaignConfig, AudienceSegment, TranscriptAnalysis, VideoUpload } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface AdCopyWizardProps {
  organizationId: string;
  userId: string;
  organizations: Array<{ id: string; name: string; logo_url: string | null }>;
  actblueForms: string[];
  onOrganizationChange: (orgId: string) => void;
  onBackToAdmin: () => void;
}

// Helper to get step data summary for completed steps
function getStepSummary(step: number, stepData: Record<string, any>, videos: any[]): string | null {
  const currentVideos = videos.length > 0 ? videos : (stepData.videos || []);
  switch (step) {
    case 1: {
      const count = currentVideos.length;
      return count > 0 ? `${count} video${count !== 1 ? 's' : ''}` : null;
    }
    case 2: {
      const analyses = stepData.analyses || {};
      const count = Object.keys(analyses).length;
      return count > 0 ? `${count} reviewed` : null;
    }
    case 3: {
      const config = stepData.config;
      const count = config?.audience_segments?.length || 0;
      return count > 0 ? `${count} segment${count !== 1 ? 's' : ''}` : null;
    }
    case 4: {
      const copy = stepData.generated_copy as Record<string, { primary_texts?: string[] }> | undefined;
      if (!copy) return null;
      const total = Object.values(copy).reduce((sum: number, seg) => 
        sum + (seg?.primary_texts?.length || 0), 0);
      return total > 0 ? `${total} variations` : null;
    }
    default:
      return null;
  }
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  actblue_form_name: '',
  refcode: '',
  refcode_auto_generated: true,
  refcodes: {},
  amount_preset: undefined,
  recurring_default: false,
  audience_segments: [],
};

// Animation variants for step transitions
const stepVariants = {
  initial: {
    opacity: 0,
    x: 50,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
       ease: 'easeOut' as Easing,
    },
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: 0.2,
       ease: 'easeIn' as Easing,
    },
  },
};

// =============================================================================
// Component
// =============================================================================

export function AdCopyWizard({
  organizationId,
  userId,
  organizations,
  actblueForms,
  onOrganizationChange,
  onBackToAdmin,
}: AdCopyWizardProps) {
  // =========================================================================
  // Hooks
  // =========================================================================

  const {
    session,
    currentStep,
    completedSteps,
    stepData,
    isLoading,
    isSaving,
    error: sessionError,
    goToStep,
    completeStep,
    updateStepData,
    canNavigateToStep,
    isStepCompleted,
    resetSession,
  } = useAdCopyStudio({ organizationId, userId });

  const {
    videos,
    isUploading,
    error: uploadError,
    uploadFiles,
    importGDriveUrls,
    removeVideo,
    clearError: clearUploadError,
    updateVideoStatus,
    cancelVideo,
    retryTranscription,
  } = useVideoUpload({
    organizationId,
    batchId: session?.batch_id || crypto.randomUUID(),
    userId,
    // Pass session videos as initialVideos for hydration after refresh
    initialVideos: stepData.videos,
    onUploadComplete: (video) => {
      // Update step data when upload completes
      const updatedVideos = [...(stepData.videos || []), video];
      updateStepData({ videos: updatedVideos });
    },
  });

  const {
    generatedCopy,
    metaReadyCopy,
    trackingUrl,
    isGenerating,
    progress: generationProgress,
    error: generationError,
    generateCopy,
    regenerateSegment,
    clearGeneration,
  } = useAdCopyGeneration({ organizationId });

  // =========================================================================
  // Local State
  // =========================================================================

  // Campaign config state (persisted through stepData)
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig>(() => {
    return stepData.config || DEFAULT_CAMPAIGN_CONFIG;
  });

  // Track analyses (fetched from transcription service)
  const [analyses, setAnalyses] = useState<Record<string, TranscriptAnalysis>>(() => {
    return stepData.analyses || {};
  });

  // (videoStatuses state removed - was dead code never consumed by UI)

  // Track transcript IDs for each video (needed for copy generation)
  // Issue B2: Initialize from stepData for session persistence
  const [transcriptIds, setTranscriptIds] = useState<Record<string, string>>(() => {
    return stepData.transcriptIds || {};
  });

  // Ref to track if step 4 auto-advance has already been triggered
  // Issue B3: Initialize to true if restored to step 5
  const hasCompletedStep4Ref = useRef(currentStep === 5);

  // Track which videos we've already started processing
  const processingVideosRef = useRef<Set<string>>(new Set());

  // Track failed/cancelled videos to prevent re-polling
  const failedVideosRef = useRef<Set<string>>(new Set());

  // Track if backend status sync has run (prevents infinite loops)
  const hasSyncedRef = useRef(false);

  // Ref for analyses to avoid stale closures (Issue B1)
  const analysesRef = useRef(analyses);
  analysesRef.current = analyses;

  // Ref for transcriptIds to avoid stale closures
  const transcriptIdsRef = useRef(transcriptIds);
  transcriptIdsRef.current = transcriptIds;

  // Track current generating segment (Issue A8)
  const [currentGeneratingSegment, setCurrentGeneratingSegment] = useState<string | undefined>();

  // =========================================================================
  // Transcription Flow Hook
  // =========================================================================

  const {
    fetchAnalysis,
    pollForCompletion,
    cancelPolling,
    reanalyzeTranscript,
    saveTranscript,
  } = useVideoTranscriptionFlow({
    organizationId,
    onStatusChange: (videoId, status) => {
      console.log(`[AdCopyWizard] Video ${videoId} status changed to: ${status}`);
      // Map backend statuses to UI statuses and update the video card directly
      const uiStatusMap: Record<string, VideoUpload['status']> = {
        'PENDING': 'transcribing',
        'DOWNLOADED': 'transcribing',
        'URL_FETCHED': 'transcribing',
        'TRANSCRIBING': 'transcribing',
        'TRANSCRIBED': 'ready',
        'ANALYZED': 'ready',
        'COMPLETED': 'ready',
        'ERROR': 'error',
        'FAILED': 'error',
        'CANCELLED': 'error',
      };
      const uiStatus = uiStatusMap[status] || 'transcribing';
      updateVideoStatus(videoId, uiStatus);
    },
    onAnalysisReady: (videoId, analysis) => {
      console.log(`[AdCopyWizard] Analysis ready for video: ${videoId}`);
      // Issue B1: Use functional updater and ref to avoid stale closure
      setAnalyses(prev => {
        const updated = { ...prev, [videoId]: analysis };
        updateStepData({ analyses: updated });
        return updated;
      });
    },
    onError: (videoId, error) => {
      console.error(`[AdCopyWizard] Transcription error for video ${videoId}:`, error);
      // Add to failed set to prevent re-polling
      failedVideosRef.current.add(videoId);
      // Update local video status to error
      updateVideoStatus(videoId, 'error', error);
    },
  });

  // =========================================================================
  // Effects
  // =========================================================================

  // Sync campaign config from stepData when it changes
  useEffect(() => {
    if (stepData.config) {
      setCampaignConfig(stepData.config);
    }
  }, [stepData.config]);

  // Sync analyses from stepData
  useEffect(() => {
    if (stepData.analyses) {
      setAnalyses(stepData.analyses);
    }
  }, [stepData.analyses]);

  // Sync transcriptIds from stepData (Issue B2)
  useEffect(() => {
    if (stepData.transcriptIds) {
      setTranscriptIds(stepData.transcriptIds);
    }
  }, [stepData.transcriptIds]);

  // Issue B4: Sync video statuses from backend on load (ONCE per mount)
  // Delay ensures useVideoUpload hydration completes first
  useEffect(() => {
    if (hasSyncedRef.current) return;
    
    const timer = setTimeout(async () => {
      if (hasSyncedRef.current) return;

      const videosToSync = stepData.videos || [];
      const videoDbIds = videosToSync
        .filter((v: VideoUpload) => v.video_id)
        .map((v: VideoUpload) => v.video_id);

      if (videoDbIds.length === 0) return;
      
      hasSyncedRef.current = true;

      try {
        console.log('[AdCopyWizard] Syncing backend statuses for', videoDbIds.length, 'videos');
        const { data, error } = await (supabase as any)
          .from('meta_ad_videos')
          .select('id, status, error_message, updated_at')
          .in('id', videoDbIds);

        if (error || !data) {
          console.error('[AdCopyWizard] Failed to sync backend statuses:', error);
          return;
        }

        const statusMap: Record<string, VideoUpload['status']> = {
          'CANCELLED': 'error',
          'ERROR': 'error',
          'FAILED': 'error',
          'TRANSCRIPT_FAILED': 'error',
          'error': 'error',
          'URL_EXPIRED': 'error',
          'URL_INACCESSIBLE': 'error',
          'TRANSCRIBED': 'ready',
          'ANALYZED': 'ready',
          'COMPLETED': 'ready',
          'PENDING': 'transcribing',
          'URL_FETCHED': 'transcribing',
          'DOWNLOADED': 'transcribing',
          'TRANSCRIBING': 'transcribing',
        };

        data.forEach((dbVideo: any) => {
          const uiStatus = statusMap[dbVideo.status] || 'transcribing';
          const currentVideo = videosToSync.find((v: VideoUpload) => v.video_id === dbVideo.id);
          
          if (currentVideo && currentVideo.status !== uiStatus) {
            console.log(`[AdCopyWizard] Syncing video ${dbVideo.id}: ${currentVideo.status} -> ${uiStatus} (backend: ${dbVideo.status})`);
            updateVideoStatus(dbVideo.id, uiStatus, dbVideo.error_message);
            if (uiStatus === 'error') {
              failedVideosRef.current.add(dbVideo.id);
            }
          }
        });

        console.log('[AdCopyWizard] Backend status sync complete');
      } catch (err) {
        console.error('[AdCopyWizard] Error syncing backend statuses:', err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [stepData.videos, updateVideoStatus]);

  // Poll for transcription completion and fetch analyses for videos in transcribing state
  useEffect(() => {
    const currentVideos = videos.length > 0 ? videos : (stepData.videos || []);
    
    // Find videos that need processing (have video_id but no analysis yet)
    const videosNeedingProcessing = currentVideos.filter((v: VideoUpload) => {
      if (!v.video_id) return false;
      if (analysesRef.current[v.video_id]) return false; // Already have analysis
      if (processingVideosRef.current.has(v.video_id)) return false; // Already processing
      if (failedVideosRef.current.has(v.video_id)) return false; // Failed/cancelled - don't re-poll
      if (v.status === 'error') return false; // Error state - don't poll
      return v.status === 'transcribing' || v.status === 'analyzing' || v.status === 'ready';
    });

    // Start processing for each video
    videosNeedingProcessing.forEach(async (video: VideoUpload) => {
      const videoId = video.video_id!;
      processingVideosRef.current.add(videoId);

      console.log(`[AdCopyWizard] Starting to poll/fetch analysis for video: ${videoId}`);

      // First try to fetch existing analysis (in case transcription already completed)
      let result = await fetchAnalysis(videoId);
      
      if (!result) {
        // No analysis yet - poll for completion
        console.log(`[AdCopyWizard] No analysis found, polling for completion: ${videoId}`);
        const finalStatus = await pollForCompletion(videoId);
        
        if (finalStatus === 'TRANSCRIBED' || finalStatus === 'ANALYZED') {
          // Now fetch the analysis
          result = await fetchAnalysis(videoId);
        }
      }

      if (result) {
        const { analysis, transcriptId } = result;
        // FIX 1: Update video status to 'ready' so the video card transitions
        updateVideoStatus(videoId, 'ready');
        
        // Issue B1: Use functional updaters to avoid stale closures
        setAnalyses(prev => {
          const updated = { ...prev, [videoId]: analysis };
          updateStepData({ analyses: updated });
          return updated;
        });
        setTranscriptIds(prev => {
          const updated = { ...prev, [videoId]: transcriptId };
          // Issue B2: Persist transcriptIds to stepData
          updateStepData({ transcriptIds: updated });
          return updated;
        });
      }

      processingVideosRef.current.delete(videoId);
    });
  }, [videos, stepData.videos, fetchAnalysis, pollForCompletion, updateStepData]);

  // Handle cancel video - also cancels polling and updates stepData
  const handleCancelVideo = useCallback(async (id: string) => {
    const video = videos.find(v => v.id === id) || (stepData.videos || []).find((v: VideoUpload) => v.id === id);
    if (video?.video_id) {
      // Add to failed set to prevent re-polling
      failedVideosRef.current.add(video.video_id);
      // Cancel any active polling
      cancelPolling(video.video_id);
    }
    await cancelVideo(id);
    
    // Update stepData to persist cancelled state
    const updatedVideos = (stepData.videos || []).map((v: VideoUpload) =>
      v.id === id ? { ...v, status: 'error' as const, error_message: 'Cancelled by user' } : v
    );
    updateStepData({ videos: updatedVideos });
  }, [videos, stepData.videos, cancelVideo, cancelPolling, updateStepData]);

  // Handle retry transcription - clears failed state and updates stepData
  const handleRetryTranscription = useCallback(async (id: string) => {
    const video = videos.find(v => v.id === id) || (stepData.videos || []).find((v: VideoUpload) => v.id === id);
    if (video?.video_id) {
      // Remove from failed set to allow polling
      failedVideosRef.current.delete(video.video_id);
      // Remove from processing set too
      processingVideosRef.current.delete(video.video_id);
    }
    await retryTranscription(id);
    
    // Update stepData to persist transcribing state
    const updatedVideos = (stepData.videos || []).map((v: VideoUpload) =>
      v.id === id ? { ...v, status: 'transcribing' as const, error_message: undefined, transcriptionStartTime: Date.now() } : v
    );
    updateStepData({ videos: updatedVideos });
  }, [videos, stepData.videos, retryTranscription, updateStepData]);

  // =========================================================================
  // Handlers
  // =========================================================================

  // Wrapped removeVideo that also cleans up analyses, transcriptIds, and stepData
  const handleRemoveVideo = useCallback(async (id: string) => {
    const video = videos.find(v => v.id === id) || (stepData.videos || []).find((v: VideoUpload) => v.id === id);
    const dbId = video?.video_id;

    // Do the full DB + storage + local state cleanup
    await removeVideo(id);

    // Clean up analysis and transcript state if we have a DB ID
    if (dbId) {
      // Cancel any active polling
      cancelPolling(dbId);
      // Remove from processing/failed tracking
      processingVideosRef.current.delete(dbId);
      failedVideosRef.current.delete(dbId);

      setAnalyses(prev => {
        const updated = { ...prev };
        delete updated[dbId];
        updateStepData({ analyses: updated });
        return updated;
      });
      setTranscriptIds(prev => {
        const updated = { ...prev };
        delete updated[dbId];
        updateStepData({ transcriptIds: updated });
        return updated;
      });
    }

    // Update persisted video list in stepData
    const updatedVideos = (stepData.videos || []).filter((v: VideoUpload) => v.id !== id);
    updateStepData({ videos: updatedVideos });
  }, [videos, stepData.videos, removeVideo, cancelPolling, updateStepData]);

  const handleUploadComplete = useCallback(async () => {
    await completeStep(1, { videos });
  }, [completeStep, videos]);

  const handleTranscriptReviewComplete = useCallback(async () => {
    await completeStep(2, { analyses });
  }, [completeStep, analyses]);

  const handleCampaignConfigChange = useCallback((config: CampaignConfig) => {
    setCampaignConfig(config);
    // Persist to step data
    updateStepData({ config });
  }, [updateStepData]);

  const handleCampaignConfigComplete = useCallback(async () => {
    await completeStep(3, { config: campaignConfig });
  }, [completeStep, campaignConfig]);

  // Issue A1: Use ALL analyzed videos' transcripts, not just the first
  const handleGenerate = useCallback(async () => {
    // Reset step 4 completion tracking when starting a new generation
    hasCompletedStep4Ref.current = false;

    // Establish single source of truth: prefer videos from upload hook, fall back to stepData
    const sourceVideos = videos.length > 0 ? videos : (stepData.videos || []);
    
    // Get all videos that have transcripts (not just the first one)
    const videosWithTranscripts = sourceVideos.filter((v: VideoUpload) => {
      const tid = v.video_id ? (transcriptIdsRef.current[v.video_id] || v.transcript_id) : v.transcript_id;
      return !!tid;
    });

    if (videosWithTranscripts.length === 0) {
      console.error('[AdCopyWizard] No videos with transcripts available for generation');
      return;
    }

    // Use the first video's transcript as primary (the edge function takes a single transcriptId)
    // but log if multiple are available
    const primaryVideo = videosWithTranscripts[0];
    const transcriptId = primaryVideo.video_id 
      ? (transcriptIdsRef.current[primaryVideo.video_id] || primaryVideo.transcript_id)
      : primaryVideo.transcript_id;

    if (!transcriptId) {
      console.error('[AdCopyWizard] Primary video does not have a transcript_id');
      return;
    }

    if (videosWithTranscripts.length > 1) {
      console.log(`[AdCopyWizard] Using primary video transcript. ${videosWithTranscripts.length} videos have transcripts.`);
    }

    // Track current segment (Issue A8)
    const firstSegment = campaignConfig.audience_segments[0]?.name;
    setCurrentGeneratingSegment(firstSegment);

    await generateCopy({
      transcriptId,
      videoId: primaryVideo.video_id,
      audienceSegments: campaignConfig.audience_segments,
      actblueFormName: campaignConfig.actblue_form_name,
      refcode: campaignConfig.refcode,
      amountPreset: campaignConfig.amount_preset,
      recurringDefault: campaignConfig.recurring_default,
    });

    setCurrentGeneratingSegment(undefined);
  }, [generateCopy, videos, stepData.videos, campaignConfig, transcriptIdsRef]);

  // Auto-advance to export step when generation completes
  // eslint-disable-next-line react-hooks/exhaustive-deps -- completeStep is intentionally excluded
  // to prevent race conditions. The ref guards against multiple completions.
  useEffect(() => {
    if (
      generatedCopy &&
      metaReadyCopy &&
      trackingUrl &&
      currentStep === 4 &&
      !hasCompletedStep4Ref.current
    ) {
      hasCompletedStep4Ref.current = true;
      completeStep(4, {
        generated_copy: generatedCopy,
        tracking_url: trackingUrl,
      });
    }
  }, [generatedCopy, metaReadyCopy, trackingUrl, currentStep]);

  const handleGoBack = useCallback((toStep: number) => {
    goToStep(toStep as 1 | 2 | 3 | 4 | 5);
  }, [goToStep]);

  const handleStartNew = useCallback(async () => {
    // Clear generation state
    clearGeneration();
    // Reset the session
    await resetSession();
    // Reset local state
    setCampaignConfig(DEFAULT_CAMPAIGN_CONFIG);
    setAnalyses({});
    setTranscriptIds({});
  }, [clearGeneration, resetSession]);

  // Styled reset/org-switch confirmation dialogs
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [pendingOrgSwitch, setPendingOrgSwitch] = useState<string | null>(null);
  // Issue A7: Confirmation for "Start New" in export step
  const [showStartNewDialog, setShowStartNewDialog] = useState(false);
  // Organization picker dialog state
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  // History panel state
  const [showHistory, setShowHistory] = useState(false);

  // Cmd+K shortcut to open org picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowOrgPicker(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResetSession = useCallback(() => {
    setShowResetDialog(true);
  }, []);

  const confirmReset = useCallback(async () => {
    setShowResetDialog(false);
    await handleStartNew();
  }, [handleStartNew]);

  const handleOrgChange = useCallback((orgId: string) => {
    // If we have any progress (past step 1 or have videos), confirm
    if (currentStep > 1 || videos.length > 0 || (stepData.videos || []).length > 0) {
      setPendingOrgSwitch(orgId);
    } else {
      onOrganizationChange(orgId);
    }
  }, [currentStep, videos, stepData.videos, onOrganizationChange]);

  const confirmOrgSwitch = useCallback(async () => {
    if (pendingOrgSwitch) {
      await handleStartNew();
      onOrganizationChange(pendingOrgSwitch);
      setPendingOrgSwitch(null);
    }
  }, [pendingOrgSwitch, handleStartNew, onOrganizationChange]);

  // Issue A7: Handler for Start New with confirmation
  const handleStartNewWithConfirm = useCallback(() => {
    setShowStartNewDialog(true);
  }, []);

  const confirmStartNew = useCallback(async () => {
    setShowStartNewDialog(false);
    await handleStartNew();
  }, [handleStartNew]);

  // Issue A6: Per-segment regeneration handler
  const handleRegenerateSegment = useCallback(async (segmentName: string) => {
    setCurrentGeneratingSegment(segmentName);
    await regenerateSegment(segmentName);
    setCurrentGeneratingSegment(undefined);
  }, [regenerateSegment]);

  // =========================================================================
  // Render Helpers
  // =========================================================================

  const renderStepContent = () => {
    // Use videos from hook or stepData
    const currentVideos = videos.length > 0 ? videos : (stepData.videos || []);

    switch (currentStep) {
      case 1:
        return (
          <VideoUploadStep
            videos={currentVideos}
            isUploading={isUploading}
            error={uploadError}
            onUploadFiles={uploadFiles}
            onImportGDrive={importGDriveUrls}
            onRemoveVideo={handleRemoveVideo}
            onClearError={clearUploadError}
            onComplete={handleUploadComplete}
            onCancelVideo={handleCancelVideo}
            onRetryTranscription={handleRetryTranscription}
            onBackToAdmin={onBackToAdmin}
            organizationName={selectedOrg?.name}
          />
        );

      case 2:
        // Map analyses by video.id (local ID) for TranscriptReviewStep
        // Our analyses are keyed by video.video_id (database ID)
        const mappedAnalyses: Record<string, TranscriptAnalysis> = {};
        const mappedTranscriptIds: Record<string, string> = {};
        currentVideos.forEach((v: VideoUpload) => {
          if (v.video_id && analyses[v.video_id]) {
            mappedAnalyses[v.id] = analyses[v.video_id];
          }
          if (v.video_id && transcriptIds[v.video_id]) {
            mappedTranscriptIds[v.id] = transcriptIds[v.video_id];
          }
        });

        // Handler to update analysis after reanalyze
        const handleAnalysisUpdate = (videoId: string, analysis: TranscriptAnalysis) => {
          // Find the video_id (database ID) from the local video ID
          const video = currentVideos.find((v: VideoUpload) => v.id === videoId);
          if (video?.video_id) {
            setAnalyses(prev => {
              const updated = { ...prev, [video.video_id!]: analysis };
              updateStepData({ analyses: updated });
              return updated;
            });
          }
        };

        // Handler to retranscribe a single video
        const handleRetranscribeVideo = async (videoId: string) => {
          // videoId here is the local video ID; find the video to get video_id (DB ID)
          const video = currentVideos.find((v: VideoUpload) => v.id === videoId);
          if (!video?.video_id) {
            console.error('[AdCopyWizard] Cannot retranscribe: no video_id for', videoId);
            return;
          }
          const dbVideoId = video.video_id;

          // Clear old analysis for this video
          setAnalyses(prev => {
            const updated = { ...prev };
            delete updated[dbVideoId];
            updateStepData({ analyses: updated });
            return updated;
          });
          setTranscriptIds(prev => {
            const updated = { ...prev };
            delete updated[dbVideoId];
            updateStepData({ transcriptIds: updated });
            return updated;
          });

          // Remove from failed set and processing set to allow re-polling
          failedVideosRef.current.delete(dbVideoId);
          processingVideosRef.current.delete(dbVideoId);

          // Reset DB status to PENDING and re-trigger transcription
          await retryTranscription(video.id);

          // Update stepData to persist transcribing state
          const updatedVideos = (stepData.videos || []).map((v: VideoUpload) =>
            v.id === video.id ? { ...v, status: 'transcribing' as const, error_message: undefined, transcriptionStartTime: Date.now() } : v
          );
          updateStepData({ videos: updatedVideos });

          // Poll for completion and fetch new analysis
          const finalStatus = await pollForCompletion(dbVideoId);
          if (finalStatus === 'TRANSCRIBED' || finalStatus === 'ANALYZED') {
            const result = await fetchAnalysis(dbVideoId);
            if (result) {
              updateVideoStatus(dbVideoId, 'ready');
              setAnalyses(prev => {
                const updated = { ...prev, [dbVideoId]: result.analysis };
                updateStepData({ analyses: updated });
                return updated;
              });
              setTranscriptIds(prev => {
                const updated = { ...prev, [dbVideoId]: result.transcriptId };
                updateStepData({ transcriptIds: updated });
                return updated;
              });
            }
          }
        };

        return (
          <TranscriptReviewStep
            videos={currentVideos}
            analyses={mappedAnalyses}
            transcriptIds={mappedTranscriptIds}
            onBack={() => handleGoBack(1)}
            onComplete={handleTranscriptReviewComplete}
            onReanalyze={reanalyzeTranscript}
            onSaveTranscript={saveTranscript}
            onAnalysisUpdate={handleAnalysisUpdate}
            onRetranscribe={handleRetranscribeVideo}
            onRemoveVideo={handleRemoveVideo}
          />
        );

      case 3:
        return (
          <CampaignConfigStep
            config={campaignConfig}
            onConfigChange={handleCampaignConfigChange}
            actblueForms={actblueForms}
            videos={currentVideos}
            organizationName={selectedOrg?.name}
            onBack={() => handleGoBack(2)}
            onComplete={handleCampaignConfigComplete}
          />
        );

      case 4:
        return (
          <CopyGenerationStep
            config={campaignConfig}
            isGenerating={isGenerating}
            progress={generationProgress}
            currentSegment={currentGeneratingSegment}
            error={generationError}
            onGenerate={handleGenerate}
            onBack={() => handleGoBack(3)}
            organizationId={organizationId}
            organizationName={selectedOrg?.name}
            organizations={organizations}
          />
        );

      case 5:
        // Ensure we have generation data
        const finalGeneratedCopy = generatedCopy || stepData.generated_copy || {};
        const finalMetaReadyCopy = metaReadyCopy || {};
        const finalTrackingUrl = trackingUrl || stepData.tracking_url || '';

        return (
          <CopyExportStep
            generatedCopy={finalGeneratedCopy}
            metaReadyCopy={finalMetaReadyCopy}
            trackingUrl={finalTrackingUrl}
            audienceSegments={campaignConfig.audience_segments}
            onBack={() => handleGoBack(4)}
            onStartNew={handleStartNewWithConfirm}
            onRegenerateSegment={handleRegenerateSegment}
            isRegenerating={isGenerating}
            organizationName={selectedOrg?.name}
            videos={currentVideos}
            refcodes={campaignConfig.refcodes}
          />
        );

      default:
        return null;
    }
  };

  // =========================================================================
  // Loading State
  // =========================================================================

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-[#94a3b8]">Loading Ad Copy Studio...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render
  // =========================================================================

  // Get selected org for display
  const selectedOrg = organizations.find(o => o.id === organizationId);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#0a0f1a]">
      {/* Redesigned header: breadcrumb + org identity as primary element */}
      <header className="sticky top-0 z-30 -mx-6 -mt-6 px-6 py-4 bg-[#0a0f1a]/95 backdrop-blur-md border-b border-[#1e2a45]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Breadcrumb with org identity */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Breadcrumb: Admin / Ad Copy Studio / Org Name */}
            <button
              onClick={onBackToAdmin}
              className="text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors shrink-0"
            >
              Admin
            </button>
            <span className="text-[#64748b] text-sm shrink-0">/</span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-[#a855f7]">
                <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden="true" />
              </div>
              <span className="text-sm font-medium text-[#e2e8f0]">Ad Copy Studio</span>
            </div>
            <span className="text-[#64748b] text-sm shrink-0">/</span>

            {/* Org identity - clickable to switch */}
            <button
              onClick={() => setShowOrgPicker(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#1e2a45] transition-colors min-w-0 max-w-[260px] group"
              aria-label="Switch organization"
            >
              {selectedOrg?.logo_url ? (
                <img src={selectedOrg.logo_url} alt="" className="h-6 w-6 rounded-md object-contain shrink-0 bg-[#0a0f1a]" />
              ) : (
                <div className="h-6 w-6 rounded-md bg-[#0a0f1a] flex items-center justify-center text-[9px] font-medium text-[#94a3b8] shrink-0">
                  {selectedOrg?.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-blue-400 truncate">{selectedOrg?.name}</span>
              <ChevronDown className="h-3 w-3 text-[#64748b] shrink-0 group-hover:text-[#94a3b8]" />
            </button>
          </div>

          {/* Right: History + Cmd+K hint + Reset */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(true)}
              className="text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e2a45] h-8 w-8"
              aria-label="Generation history"
              title="Generation history"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
            </Button>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] text-[#64748b] bg-[#0a0f1a] border border-[#1e2a45] rounded font-mono">
              ⌘K
            </kbd>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetSession}
              disabled={isSaving}
              className="text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e2a45] h-8 w-8"
              aria-label="Reset session"
              title="Reset session"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Step Indicator with data summaries */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#141b2d] p-4">
        <WizardStepIndicator
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
          canNavigateToStep={canNavigateToStep}
          stepSummaries={{
            1: getStepSummary(1, stepData, videos),
            2: getStepSummary(2, stepData, videos),
            3: getStepSummary(3, stepData, videos),
            4: getStepSummary(4, stepData, videos),
          }}
        />
      </div>

      {/* Error Display */}
      {sessionError && (
        <div
          role="alert"
          className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4"
        >
          <p className="text-sm text-[#ef4444]">{sessionError}</p>
        </div>
      )}

      {/* Step Content with Transitions - Issue E1: borderless wrapper */}
      <main className="flex-1" aria-live="polite">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl bg-[#141b2d] p-6"
            >
              <GenerationHistoryPanel
                organizationId={organizationId}
                organizationName={selectedOrg?.name}
                organizations={organizations}
                onClose={() => setShowHistory(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key={currentStep}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="rounded-xl bg-[#141b2d] p-6"
              onAnimationComplete={() => {
                // Issue D3: Focus management after step transitions
                const heading = document.querySelector<HTMLElement>('[data-step-content] h2');
                if (heading) {
                  heading.setAttribute('tabindex', '-1');
                  heading.focus({ preventScroll: true });
                }
              }}
              data-step-content
            >
              {renderStepContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Saving Indicator */}
      {isSaving && (
        <div
          className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg border border-[#1e2a45] bg-[#141b2d] px-4 py-2 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm text-[#94a3b8]">Saving...</span>
        </div>
      )}

      {/* Reset Confirmation Dialog (Issue #16) */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="bg-[#141b2d] border-[#1e2a45]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#e2e8f0]">Reset Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#94a3b8]">
              This will clear all progress including uploaded videos, transcripts, and generated copy. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReset}
              className="bg-[#ef4444] hover:bg-[#ef4444]/80 text-white"
            >
              Reset Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Org Switch Confirmation Dialog */}
      <AlertDialog open={!!pendingOrgSwitch} onOpenChange={(open) => !open && setPendingOrgSwitch(null)}>
        <AlertDialogContent className="bg-[#141b2d] border-[#1e2a45]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#e2e8f0]">Switch Organization?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#94a3b8]">
              Switch from <strong className="text-[#e2e8f0]">{selectedOrg?.name}</strong> to <strong className="text-[#e2e8f0]">{organizations.find(o => o.id === pendingOrgSwitch)?.name}</strong>? This will reset your current session including uploaded videos, transcripts, and generated copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]">
              Stay
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmOrgSwitch}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              Switch & Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Organization Picker Dialog */}
      <AdminOrganizationPicker
        open={showOrgPicker}
        onOpenChange={setShowOrgPicker}
        organizations={organizations}
        selectedId={organizationId}
        onSelect={handleOrgChange}
      />

      {/* Start New Confirmation Dialog (Issue A7) */}
      <AlertDialog open={showStartNewDialog} onOpenChange={setShowStartNewDialog}>
        <AlertDialogContent className="bg-[#141b2d] border-[#1e2a45]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#e2e8f0]">Start New Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#94a3b8]">
              This will clear all your generated copy and start a fresh session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStartNew}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              Start New
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdCopyWizard;
