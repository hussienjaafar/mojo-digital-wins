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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';

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

// Types
import type { CampaignConfig, AudienceSegment, TranscriptAnalysis, VideoUpload } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface AdCopyWizardProps {
  organizationId: string;
  userId: string;
  organizations: Array<{ id: string; name: string }>;
  actblueForms: string[];
  onOrganizationChange: (orgId: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  actblue_form_name: '',
  refcode: '',
  refcode_auto_generated: true,
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

  // Track video statuses locally for UI updates
  const [videoStatuses, setVideoStatuses] = useState<Record<string, string>>({});

  // Track transcript IDs for each video (needed for copy generation)
  const [transcriptIds, setTranscriptIds] = useState<Record<string, string>>({});

  // Ref to track if step 4 auto-advance has already been triggered
  const hasCompletedStep4Ref = useRef(false);

  // Track which videos we've already started processing
  const processingVideosRef = useRef<Set<string>>(new Set());

  // Track failed/cancelled videos to prevent re-polling
  const failedVideosRef = useRef<Set<string>>(new Set());

  // Track if backend status sync has run (prevents infinite loops)
  const hasSyncedRef = useRef(false);

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
      setVideoStatuses(prev => ({ ...prev, [videoId]: status }));
    },
    onAnalysisReady: (videoId, analysis) => {
      console.log(`[AdCopyWizard] Analysis ready for video: ${videoId}`);
      setAnalyses(prev => ({ ...prev, [videoId]: analysis }));
      // Also update stepData
      updateStepData({ analyses: { ...analyses, [videoId]: analysis } });
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

  // Sync video statuses from backend on load (ONCE per mount)
  // This ensures UI reflects the true database state after refresh
  useEffect(() => {
    // Only sync once per session load
    if (hasSyncedRef.current) return;
    
    const syncBackendStatuses = async () => {
      // Use stepData.videos as the source since that's what persists across refreshes
      const videosToSync = stepData.videos || [];
      const videoDbIds = videosToSync
        .filter((v: VideoUpload) => v.video_id)
        .map((v: VideoUpload) => v.video_id);

      if (videoDbIds.length === 0) return;
      
      // Mark as synced to prevent re-runs
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

        // Map backend status to UI status
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
            
            // Update via hook
            updateVideoStatus(dbVideo.id, uiStatus, dbVideo.error_message);
            
            // Add to failed set if terminal failure
            if (uiStatus === 'error') {
              failedVideosRef.current.add(dbVideo.id);
            }
          }
        });

        console.log('[AdCopyWizard] Backend status sync complete');
      } catch (err) {
        console.error('[AdCopyWizard] Error syncing backend statuses:', err);
      }
    };

    // Run sync after a short delay to allow hydration to complete
    const timer = setTimeout(syncBackendStatuses, 500);
    return () => clearTimeout(timer);
  }, [stepData.videos, updateVideoStatus]);

  // Poll for transcription completion and fetch analyses for videos in transcribing state
  useEffect(() => {
    const currentVideos = videos.length > 0 ? videos : (stepData.videos || []);
    
    // Find videos that need processing (have video_id but no analysis yet)
    const videosNeedingProcessing = currentVideos.filter((v: VideoUpload) => {
      if (!v.video_id) return false;
      if (analyses[v.video_id]) return false; // Already have analysis
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
        setAnalyses(prev => ({ ...prev, [videoId]: analysis }));
        setTranscriptIds(prev => ({ ...prev, [videoId]: transcriptId }));
        updateStepData({ analyses: { ...analyses, [videoId]: analysis } });
      }

      processingVideosRef.current.delete(videoId);
    });
  }, [videos, stepData.videos, analyses, fetchAnalysis, pollForCompletion, updateStepData]);

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

  const handleGenerate = useCallback(async () => {
    // Reset step 4 completion tracking when starting a new generation
    hasCompletedStep4Ref.current = false;

    // Establish single source of truth: prefer videos from upload hook, fall back to stepData
    const sourceVideos = videos.length > 0 ? videos : (stepData.videos || []);
    const primaryVideo = sourceVideos[0];

    // Validate that we have a video before generating
    if (!primaryVideo) {
      console.error('[AdCopyWizard] No video available for generation');
      return;
    }

    // Get transcript_id from our tracked state (or from video object as fallback)
    const transcriptId = transcriptIds[primaryVideo.video_id!] || primaryVideo.transcript_id;

    if (!transcriptId) {
      console.error('[AdCopyWizard] Video does not have a transcript_id - transcription may still be in progress');
      return;
    }

    await generateCopy({
      transcriptId,
      videoId: primaryVideo.video_id,
      audienceSegments: campaignConfig.audience_segments,
      actblueFormName: campaignConfig.actblue_form_name,
      refcode: campaignConfig.refcode,
      amountPreset: campaignConfig.amount_preset,
      recurringDefault: campaignConfig.recurring_default,
    });
  }, [generateCopy, videos, stepData.videos, campaignConfig, transcriptIds]);

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
  }, [clearGeneration, resetSession]);

  const handleResetSession = useCallback(async () => {
    if (window.confirm('Are you sure you want to reset the session? All progress will be lost.')) {
      await handleStartNew();
    }
  }, [handleStartNew]);

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
            onRemoveVideo={removeVideo}
            onClearError={clearUploadError}
            onComplete={handleUploadComplete}
            onCancelVideo={handleCancelVideo}
            onRetryTranscription={handleRetryTranscription}
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
            setAnalyses(prev => ({ ...prev, [video.video_id!]: analysis }));
            updateStepData({ analyses: { ...analyses, [video.video_id!]: analysis } });
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
          />
        );

      case 3:
        return (
          <CampaignConfigStep
            config={campaignConfig}
            onConfigChange={handleCampaignConfigChange}
            actblueForms={actblueForms}
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
            currentSegment={undefined}
            error={generationError}
            onGenerate={handleGenerate}
            onBack={() => handleGoBack(3)}
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
            onStartNew={handleStartNew}
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

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-[#a855f7]">
            <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#e2e8f0]">Ad Copy Studio</h1>
            <p className="text-sm text-[#64748b]">Generate Meta ad copy from video content</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Organization Picker */}
          {organizations.length > 1 && (
            <Select
              value={organizationId}
              onValueChange={onOrganizationChange}
            >
              <SelectTrigger
                className="w-[200px] border-[#1e2a45] bg-[#141b2d] text-[#e2e8f0]"
                aria-label="Select organization"
              >
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent className="border-[#1e2a45] bg-[#141b2d]">
                {organizations.map((org) => (
                  <SelectItem
                    key={org.id}
                    value={org.id}
                    className="text-[#e2e8f0] focus:bg-[#1e2a45] focus:text-[#e2e8f0]"
                  >
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Reset Session Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetSession}
            disabled={isSaving}
            className="border-[#1e2a45] bg-transparent text-[#94a3b8] hover:bg-[#141b2d] hover:text-[#e2e8f0]"
            aria-label="Reset Ad Copy Studio session"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset
          </Button>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="rounded-lg border border-[#1e2a45] bg-[#141b2d] p-4">
        <WizardStepIndicator
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
          canNavigateToStep={canNavigateToStep}
        />
      </div>

      {/* Error Display */}
      {sessionError && (
        <div
          role="alert"
          className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-4"
        >
          <p className="text-sm text-[#ef4444]">{sessionError}</p>
        </div>
      )}

      {/* Step Content with Transitions */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-lg border border-[#1e2a45] bg-[#141b2d]"
          >
            {renderStepContent()}
          </motion.div>
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
    </div>
  );
}

export default AdCopyWizard;
