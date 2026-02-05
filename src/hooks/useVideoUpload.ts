/**
 * useVideoUpload - Video upload management hook
 *
 * Handles video uploads for the Ad Copy Studio:
 * - File uploads to Supabase Storage
 * - Google Drive imports via edge function
 * - Upload progress tracking per video
 * - Maximum 5 videos validation
 * - State hydration from saved sessions
 * - Cancel/retry with durable backend status
 */

import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractAudio, shouldExtractAudio, isFFmpegSupported, type ExtractionStage } from '@/lib/audio-extractor';
import type {
  VideoUpload,
  ImportGDriveResponse,
  GDriveImportResult,
} from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface UseVideoUploadOptions {
  organizationId: string;
  batchId: string;
  userId: string;
  onUploadComplete?: (video: VideoUpload) => void;
  /** Initial videos to hydrate state from (e.g., from saved session) */
  initialVideos?: VideoUpload[];
}

export interface UseVideoUploadReturn {
  videos: VideoUpload[];
  isUploading: boolean;
  error: string | null;
  uploadFiles: (files: File[]) => Promise<void>;
  importGDriveUrls: (urls: string[]) => Promise<void>;
  removeVideo: (id: string) => void;
  clearError: () => void;
  updateVideoStatus: (videoDbId: string, status: VideoUpload['status'], errorMessage?: string) => void;
  cancelVideo: (id: string) => Promise<void>;
  retryTranscription: (id: string) => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_VIDEOS = 5;
const STORAGE_BUCKET = 'meta-ad-videos';
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
 const AUDIO_BUCKET = 'meta-ad-audio'; // Bucket for extracted audio files

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique ID for local video tracking
 */
function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sanitize filename for storage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/__+/g, '_')
    .substring(0, 100);
}

/**
 * Validate video file
 */
function validateVideoFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed: MP4, MOV, WebM, AVI`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 500MB`,
    };
  }

  return { valid: true };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useVideoUpload(
  options: UseVideoUploadOptions
): UseVideoUploadReturn {
  const { organizationId, batchId, userId, onUploadComplete, initialVideos } = options;
  const { toast } = useToast();

  // State
  const [videos, setVideos] = useState<VideoUpload[]>([]);
  const hasHydratedRef = React.useRef(false);

  // Hydrate from initialVideos on mount (once only)
  React.useEffect(() => {
    if (!hasHydratedRef.current && initialVideos && initialVideos.length > 0 && videos.length === 0) {
      hasHydratedRef.current = true;
      // Restore videos from session, setting file to null since File objects can't be serialized
      const hydratedVideos = initialVideos.map(v => ({
        ...v,
        file: null,
        // Set transcriptionStartTime if video is in transcribing state but doesn't have one
        transcriptionStartTime: v.transcriptionStartTime || 
          (v.status === 'transcribing' ? (v.backendUpdatedAt ? new Date(v.backendUpdatedAt).getTime() : Date.now()) : undefined),
      }));
      setVideos(hydratedVideos);
      console.log(`[useVideoUpload] Hydrated ${hydratedVideos.length} videos from session`);
    }
  }, [initialVideos, videos.length]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =========================================================================
  // Video State Management
  // =========================================================================

  /**
   * Update a specific video's state
   */
  const updateVideo = useCallback((id: string, updates: Partial<VideoUpload>) => {
    setVideos(prev => prev.map(v => (v.id === id ? { ...v, ...updates } : v)));
  }, []);

  /**
   * Add a new video to the list
   */
  const addVideo = useCallback((video: VideoUpload) => {
    setVideos(prev => [...prev, video]);
  }, []);

  // =========================================================================
  // File Upload
  // =========================================================================

  /**
   * Upload files directly to Supabase Storage
   */
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!organizationId || !batchId || !userId) {
      setError('Missing required parameters for upload');
      return;
    }

    // Check max videos limit
    const remainingSlots = MAX_VIDEOS - videos.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_VIDEOS} videos allowed. Remove some videos to add more.`);
      toast({
        title: 'Upload limit reached',
        description: `Maximum ${MAX_VIDEOS} videos allowed`,
        variant: 'destructive',
      });
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast({
        title: 'Some files skipped',
        description: `Only ${remainingSlots} more video(s) can be added`,
        variant: 'default',
      });
    }

    setIsUploading(true);
    setError(null);

    // Create local video entries with pending status
    const newVideos: VideoUpload[] = filesToProcess.map(file => ({
      id: generateLocalId(),
      file,
      source: 'uploaded' as const,
      filename: file.name,
      file_size_bytes: file.size,
      status: 'pending' as const,
      progress: 0,
    }));

    // Add videos to state
    setVideos(prev => [...prev, ...newVideos]);

    // Track successful uploads (avoid stale closure by counting directly)
    let uploadSuccessCount = 0;

    // Process each file
    for (const video of newVideos) {
      const file = video.file!;

      // Validate file
      const validation = validateVideoFile(file);
      if (!validation.valid) {
        updateVideo(video.id, {
          status: 'error',
          error_message: validation.error,
        });
        continue;
      }

      // Update status to uploading
      updateVideo(video.id, { status: 'uploading', progress: 0 });

      try {
        // Generate storage path
        const sanitizedFilename = sanitizeFilename(file.name);
        const videoId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
         
         // Determine if we should extract audio for large files
         const needsAudioExtraction = shouldExtractAudio(file) && isFFmpegSupported();
         let fileToUpload: File | Blob = file;
         let storageBucket = STORAGE_BUCKET;
         let storagePath = `${organizationId}/${batchId}/${videoId}_${sanitizedFilename}`;
         let contentType = file.type;
         let extractedAudioFilename: string | undefined;
         
         // Extract audio for large files
         if (needsAudioExtraction) {
           console.log(`[useVideoUpload] Large file detected (${(file.size / 1024 / 1024).toFixed(1)}MB), extracting audio...`);
           const extractionStartTime = Date.now();
           updateVideo(video.id, { 
             status: 'extracting', 
             progress: 0,
             extractionStage: 'loading',
             extractionStartTime,
           });
           
           // Enable diagnostics for slow extractions (> 30s threshold checked after)
           const enableDiagnostics = true; // Always collect, conditionally show
           
            try {
              const { audioFile, originalFilename, extractionMode, timings, diagnostics } = await extractAudio(file, {
                enableDiagnostics,
                timeoutMs: 3 * 60 * 1000, // 3 minute timeout
                onProgress: (progress) => {
                  // Map extraction progress to 0-40% of total progress
                  const mappedProgress = Math.round(progress.percent * 0.4);
                  updateVideo(video.id, { 
                    progress: mappedProgress,
                    extractionStage: progress.stage,
                    extractionElapsedMs: progress.elapsedMs,
                    extractionMessage: progress.message, // Pass real message from extractor
                  });
                },
              });
              
              const extractionDurationSec = timings.totalMs / 1000;
              console.log(`[useVideoUpload] Extraction complete in ${extractionDurationSec.toFixed(1)}s (${extractionMode} mode)`);
              
              // Store diagnostics if extraction was slow (> 20s)
              const wasSlowExtraction = extractionDurationSec > 20;
              if (wasSlowExtraction && diagnostics) {
                console.log('[useVideoUpload] Slow extraction detected, diagnostics available');
                updateVideo(video.id, {
                  extractionDiagnostics: diagnostics,
                  extractionMode,
                });
              }
             
              fileToUpload = audioFile;
              storageBucket = AUDIO_BUCKET;
              extractedAudioFilename = audioFile.name;
              storagePath = `${organizationId}/${batchId}/${videoId}_${sanitizeFilename(audioFile.name)}`;
              contentType = audioFile.type || 'audio/mpeg';
              
              console.log(`[useVideoUpload] Audio extracted: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)}MB), mode: ${extractionMode}`);
              updateVideo(video.id, { 
                status: 'uploading', 
                progress: 40,
                extractionStage: undefined,
                extractionElapsedMs: undefined,
                extractionMode,
              });
           } catch (extractError: any) {
             console.error('[useVideoUpload] Audio extraction failed:', extractError);
             
             // Determine error type and message
             let errorMessage = 'Audio extraction failed';
             let canSkip = false;
             
             if (extractError.message?.includes('FFMPEG_LOAD_TIMEOUT')) {
               errorMessage = 'Audio processor download/initialization timed out. Please check your network and retry.';
               canSkip = file.size <= 50 * 1024 * 1024; // Allow skip for files under 50MB
             } else if (extractError.message?.includes('EXTRACTION_TIMEOUT')) {
               errorMessage = 'Audio extraction timed out after 3 minutes. You can retry or upload the original video.';
               canSkip = file.size <= 50 * 1024 * 1024; // Allow skip for files under 50MB
             } else if (extractError.message?.includes('EXTRACTION_MEMORY')) {
               errorMessage = 'File too large for browser memory. Try a smaller video file.';
               canSkip = false;
             } else if (extractError.message?.includes('Failed to load audio processor')) {
               errorMessage = 'Could not download audio processor. Please check your network and retry.';
               canSkip = file.size <= 50 * 1024 * 1024;
             } else {
               errorMessage = extractError.message || 'Audio extraction failed';
               canSkip = file.size <= 50 * 1024 * 1024;
             }
             
             // For smaller files, fall back to original upload
             if (canSkip) {
               console.log('[useVideoUpload] Falling back to original file upload');
               fileToUpload = file;
               storageBucket = STORAGE_BUCKET;
               storagePath = `${organizationId}/${batchId}/${videoId}_${sanitizedFilename}`;
               contentType = file.type;
               updateVideo(video.id, { 
                 extractionStage: undefined,
                 extractionElapsedMs: undefined,
               });
             } else {
               // Can't skip - report error
               updateVideo(video.id, {
                 status: 'error',
                 error_message: errorMessage,
                 extractionStage: undefined,
                 extractionElapsedMs: undefined,
               });
               continue;
             }
           }
         }

         // Upload to Supabase Storage (either extracted audio or original video)
        const { error: uploadError } = await supabase.storage
           .from(storageBucket)
           .upload(storagePath, fileToUpload, {
             contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error('[useVideoUpload] Storage upload error:', uploadError);
          updateVideo(video.id, {
            status: 'error',
            error_message: `Upload failed: ${uploadError.message}`,
          });
          continue;
        }

         // Update progress (upload complete, now creating record)
         updateVideo(video.id, { progress: needsAudioExtraction ? 70 : 50 });

        // Get the public URL
        const { data: publicUrlData } = supabase.storage
           .from(storageBucket)
          .getPublicUrl(storagePath);

        const videoUrl = publicUrlData?.publicUrl;

        // Create record in meta_ad_videos table
        const { data: insertedVideo, error: dbError } = await (supabase as any)
          .from('meta_ad_videos')
          .insert({
            organization_id: organizationId,
            ad_id: `upload_${videoId}`,
            video_id: videoId,
            video_source_url: videoUrl,
            source: 'uploaded',
            original_filename: file.name,
            video_file_size_bytes: file.size,
             audio_extracted: needsAudioExtraction,
             audio_filename: extractedAudioFilename,
            uploaded_by: userId,
            status: 'PENDING',
            resolution_method: 'manual',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id, video_id')
          .single();

        if (dbError) {
          console.error('[useVideoUpload] Database insert error:', dbError);

          // Try to clean up the uploaded file
          try {
            const { error: deleteError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .remove([storagePath]);
            if (deleteError) {
              console.error('[useVideoUpload] Failed to clean up uploaded file:', deleteError);
            }
          } catch (cleanupErr) {
            console.error('[useVideoUpload] Cleanup error:', cleanupErr);
          }

          updateVideo(video.id, {
            status: 'error',
            error_message: `Failed to create video record: ${dbError.message}`,
          });
          continue;
        }

        // Update video with transcribing status (transcription will be triggered)
        const updatedVideo: Partial<VideoUpload> = {
          video_id: insertedVideo.id,
          status: 'transcribing',
          progress: 80,
          transcriptionStartTime: Date.now(), // Set start time for stuck detection
        };

        updateVideo(video.id, updatedVideo);

        console.log(`[useVideoUpload] Successfully uploaded: ${file.name} -> ${insertedVideo.id}`);

        // Trigger transcription edge function
        try {
          console.log(`[useVideoUpload] Triggering transcription for video_id: ${insertedVideo.video_id}`);
          const { error: transcribeError } = await supabase.functions.invoke('transcribe-meta-ad-video', {
            body: {
              organization_id: organizationId,
              video_id: insertedVideo.video_id, // Use video_id column, not id
              mode: 'single',
            },
          });

          if (transcribeError) {
            console.error('[useVideoUpload] Transcription trigger error:', transcribeError);
            // Don't fail the upload - just log the error
            // The transcription can be retried later
          } else {
            console.log('[useVideoUpload] Transcription triggered successfully');
          }
        } catch (transcribeErr) {
          console.error('[useVideoUpload] Failed to trigger transcription:', transcribeErr);
          // Don't fail the upload - transcription can be retried
        }

        uploadSuccessCount++;

        // Notify parent component
        if (onUploadComplete) {
          onUploadComplete({
            ...video,
            ...updatedVideo,
          } as VideoUpload);
        }
      } catch (err: any) {
        console.error('[useVideoUpload] Upload error:', err);
        updateVideo(video.id, {
          status: 'error',
          error_message: err?.message || 'Upload failed',
        });
      }
    }

    setIsUploading(false);

    // Show summary toast using tracked count (avoids stale closure issue)
    if (uploadSuccessCount > 0) {
      toast({
        title: 'Upload complete',
        description: `${uploadSuccessCount} of ${filesToProcess.length} video(s) uploaded successfully`,
      });
    } else if (filesToProcess.length > 0) {
      setError('All uploads failed');
    }
  }, [organizationId, batchId, userId, videos, updateVideo, onUploadComplete, toast]);

  // =========================================================================
  // Google Drive Import
  // =========================================================================

  /**
   * Import videos from Google Drive URLs via edge function
   */
  const importGDriveUrls = useCallback(async (urls: string[]) => {
    if (!organizationId || !batchId || !userId) {
      setError('Missing required parameters for import');
      return;
    }

    // Check max videos limit
    const remainingSlots = MAX_VIDEOS - videos.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_VIDEOS} videos allowed. Remove some videos to add more.`);
      toast({
        title: 'Import limit reached',
        description: `Maximum ${MAX_VIDEOS} videos allowed`,
        variant: 'destructive',
      });
      return;
    }

    const urlsToProcess = urls.slice(0, remainingSlots);
    if (urls.length > remainingSlots) {
      toast({
        title: 'Some URLs skipped',
        description: `Only ${remainingSlots} more video(s) can be added`,
        variant: 'default',
      });
    }

    setIsUploading(true);
    setError(null);

    // Create local video entries with pending status
    const newVideos: VideoUpload[] = urlsToProcess.map(url => ({
      id: generateLocalId(),
      file: null,
      gdrive_url: url,
      source: 'gdrive' as const,
      filename: 'Importing from Google Drive...',
      file_size_bytes: 0,
      status: 'uploading' as const,
      progress: 0,
    }));

    // Add videos to state
    setVideos(prev => [...prev, ...newVideos]);

    try {
      // Call the edge function
      const { data, error: functionError } = await supabase.functions.invoke<ImportGDriveResponse>(
        'import-gdrive-video',
        {
          body: {
            organization_id: organizationId,
            gdrive_urls: urlsToProcess,
            batch_id: batchId,
            user_id: userId,
          },
        }
      );

      if (functionError) {
        console.error('[useVideoUpload] Edge function error:', functionError);
        // Mark all as error
        newVideos.forEach(video => {
          updateVideo(video.id, {
            status: 'error',
            error_message: functionError.message || 'Import failed',
          });
        });
        setIsUploading(false);
        return;
      }

      if (!data) {
        console.error('[useVideoUpload] No data returned from edge function');
        newVideos.forEach(video => {
          updateVideo(video.id, {
            status: 'error',
            error_message: 'No response from import service',
          });
        });
        setIsUploading(false);
        return;
      }

      // Process results
      const results: GDriveImportResult[] = data.results || [];

      // Update each video based on result
      for (let i = 0; i < newVideos.length; i++) {
        const video = newVideos[i];
        const result = results.find(r => r.url === urlsToProcess[i]);

        if (!result) {
          updateVideo(video.id, {
            status: 'error',
            error_message: 'No result returned for this URL',
          });
          continue;
        }

        if (result.status === 'success') {
          const updatedVideo: Partial<VideoUpload> = {
            video_id: result.video_id,
            filename: result.filename || 'Google Drive Video',
            file_size_bytes: result.file_size_bytes || 0,
            status: 'ready',
            progress: 100,
          };

          updateVideo(video.id, updatedVideo);

          // Notify parent component
          if (onUploadComplete) {
            onUploadComplete({
              ...video,
              ...updatedVideo,
            } as VideoUpload);
          }

          console.log(`[useVideoUpload] Successfully imported: ${result.filename}`);
        } else {
          updateVideo(video.id, {
            status: 'error',
            error_message: result.error_message || 'Import failed',
          });
        }
      }

      // Show summary toast
      const successCount = results.filter(r => r.status === 'success').length;
      if (successCount > 0) {
        toast({
          title: 'Import complete',
          description: `${successCount} of ${urlsToProcess.length} video(s) imported successfully`,
        });
      } else {
        toast({
          title: 'Import failed',
          description: 'No videos were imported. Check the URLs and try again.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error('[useVideoUpload] Import error:', err);
      newVideos.forEach(video => {
        updateVideo(video.id, {
          status: 'error',
          error_message: err?.message || 'Import failed',
        });
      });
      toast({
        title: 'Import error',
        description: err?.message || 'Failed to import videos',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [organizationId, batchId, userId, videos, updateVideo, onUploadComplete, toast]);

  // =========================================================================
  // Video Management
  // =========================================================================

  /**
   * Remove a video from the list
   */
  const removeVideo = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Update video status by database ID (video_id)
   * Used by AdCopyWizard to sync status from polling
   */
  const updateVideoStatus = useCallback((videoDbId: string, status: VideoUpload['status'], errorMessage?: string) => {
    setVideos(prev => prev.map(v => 
      v.video_id === videoDbId 
        ? { ...v, status, error_message: errorMessage }
        : v
    ));
  }, []);

  /**
   * Cancel a video transcription
   * Marks the database record as CANCELLED and updates local state
   * The CANCELLED status prevents the edge function from overwriting
   */
  const cancelVideo = useCallback(async (id: string) => {
    const video = videos.find(v => v.id === id);
    
    if (!video?.video_id) {
      // Just remove from local state if no database record
      removeVideo(id);
      return;
    }

    try {
      // Update database status to CANCELLED (durable - edge function will respect this)
      await (supabase as any)
        .from('meta_ad_videos')
        .update({ 
          status: 'CANCELLED', 
          error_message: 'Cancelled by user',
          error_code: 'CANCELLED_BY_USER',
          updated_at: new Date().toISOString() 
        })
        .eq('id', video.video_id);

      // Update local state
      setVideos(prev => prev.map(v => 
        v.id === id 
          ? { ...v, status: 'error', error_message: 'Cancelled by user', transcriptionStartTime: undefined }
          : v
      ));

      toast({
        title: 'Transcription cancelled',
        description: 'You can remove the video or retry transcription.',
      });
    } catch (err: any) {
      console.error('[useVideoUpload] Cancel error:', err);
      toast({
        title: 'Failed to cancel',
        description: err?.message || 'Could not cancel transcription',
        variant: 'destructive',
      });
    }
  }, [videos, removeVideo, toast]);

  /**
   * Retry transcription for a failed/cancelled video
   * Resets database status to PENDING and re-triggers the edge function
   */
  const retryTranscription = useCallback(async (id: string) => {
    const video = videos.find(v => v.id === id);
    
    if (!video?.video_id) {
      toast({
        title: 'Cannot retry',
        description: 'Video does not have a database record',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Update local status first for immediate feedback
      setVideos(prev => prev.map(v => 
        v.id === id 
          ? { 
              ...v, 
              status: 'transcribing', 
              error_message: undefined,
              transcriptionStartTime: Date.now(), // Use transcriptionStartTime for stuck detection
            }
          : v
      ));

      // Update database status to PENDING
      await (supabase as any)
        .from('meta_ad_videos')
        .update({ 
          status: 'PENDING', 
          error_message: null,
          retry_count: 0,
          updated_at: new Date().toISOString() 
        })
        .eq('id', video.video_id);

      // Re-trigger transcription edge function
      const { error: transcribeError } = await supabase.functions.invoke('transcribe-meta-ad-video', {
        body: {
          organization_id: organizationId,
          video_id: video.video_id,
          mode: 'single',
        },
      });

      if (transcribeError) {
        console.error('[useVideoUpload] Retry transcription error:', transcribeError);
        setVideos(prev => prev.map(v => 
          v.id === id 
            ? { ...v, status: 'error', error_message: 'Failed to start transcription' }
            : v
        ));
        toast({
          title: 'Retry failed',
          description: transcribeError.message || 'Could not start transcription',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Retrying transcription',
          description: 'Transcription has been restarted.',
        });
      }
    } catch (err: any) {
      console.error('[useVideoUpload] Retry error:', err);
      setVideos(prev => prev.map(v => 
        v.id === id 
          ? { ...v, status: 'error', error_message: err?.message || 'Retry failed' }
          : v
      ));
      toast({
        title: 'Retry failed',
        description: err?.message || 'Could not retry transcription',
        variant: 'destructive',
      });
    }
  }, [videos, organizationId, toast]);

  // =========================================================================
  // Return
  // =========================================================================

  return {
    videos,
    isUploading,
    error,
    uploadFiles,
    importGDriveUrls,
    removeVideo,
    clearError,
    updateVideoStatus,
    cancelVideo,
    retryTranscription,
  };
}
