/**
 * useVideoUpload - Video upload management hook
 *
 * Handles video uploads for the Ad Copy Studio:
 * - File uploads to Supabase Storage
 * - Google Drive imports via edge function
 * - Upload progress tracking per video
 * - Maximum 5 videos validation
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
}

export interface UseVideoUploadReturn {
  videos: VideoUpload[];
  isUploading: boolean;
  error: string | null;
  uploadFiles: (files: File[]) => Promise<void>;
  importGDriveUrls: (urls: string[]) => Promise<void>;
  removeVideo: (id: string) => void;
  clearError: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_VIDEOS = 5;
const STORAGE_BUCKET = 'meta-ad-videos';
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

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
  const { organizationId, batchId, userId, onUploadComplete } = options;
  const { toast } = useToast();

  // State
  const [videos, setVideos] = useState<VideoUpload[]>([]);
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
        const storagePath = `${organizationId}/${batchId}/${videoId}_${sanitizedFilename}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type,
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

        // Update progress to 50% (upload complete, now creating record)
        updateVideo(video.id, { progress: 50 });

        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from(STORAGE_BUCKET)
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
            uploaded_by: userId,
            status: 'PENDING',
            resolution_method: 'manual',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
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

        // Update video with success state
        const updatedVideo: Partial<VideoUpload> = {
          video_id: insertedVideo.id,
          status: 'ready',
          progress: 100,
        };

        updateVideo(video.id, updatedVideo);
        uploadSuccessCount++;

        // Notify parent component
        if (onUploadComplete) {
          onUploadComplete({
            ...video,
            ...updatedVideo,
          } as VideoUpload);
        }

        console.log(`[useVideoUpload] Successfully uploaded: ${file.name} -> ${insertedVideo.id}`);
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
  };
}
