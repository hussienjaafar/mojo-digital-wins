/**
 * VideoUploadStep - Step 1 of the Ad Copy Studio wizard
 *
 * Handles video upload through:
 * - Direct file upload with drag-and-drop support (primary)
 * - Google Drive import via URL paste (secondary)
 *
 * Issue A9: Added "Exit" back button for footer consistency
 * Issue D5: Status icons use distinct shapes (not just color)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Link,
  X,
  AlertCircle,
  Video,
  Cloud,
  CheckCircle,
  Loader2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  HardDrive,
  RotateCcw,
  XCircle,
  Clock,
  Circle,
  Eye,
} from 'lucide-react';
import type { VideoUpload } from '@/types/ad-copy-studio';
import { preloadFFmpeg, isFFmpegSupported, formatDiagnosticsReport } from '@/lib/audio-extractor';

// =============================================================================
// Types
// =============================================================================

export interface VideoUploadStepProps {
  videos: VideoUpload[];
  isUploading: boolean;
  error: string | null;
  onUploadFiles: (files: File[]) => Promise<void>;
  onImportGDrive: (urls: string[]) => Promise<void>;
  onRemoveVideo: (id: string) => Promise<void>;
  onClearError: () => void;
  onComplete: () => void;
  onCancelVideo?: (id: string) => Promise<void>;
  onRetryTranscription?: (id: string) => Promise<void>;
  onBackToAdmin?: () => void;
  organizationName?: string;
}

// =============================================================================
// Constants
// =============================================================================

const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEOS = 5;
const STUCK_THRESHOLD_MS = 60 * 1000;

// =============================================================================
// Helper Functions
// =============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getExtractionStageLabel(stage?: string): string {
  switch (stage) {
    case 'loading': return 'Loading audio processor...';
    case 'reading': return 'Reading video file...';
    case 'writing': return 'Preparing for extraction...';
    case 'copy-attempt': return 'Trying fast stream copy...';
    case 'reencode': return 'Converting audio...';
    case 'finalizing': return 'Finalizing...';
    default: return 'Extracting audio...';
  }
}

function ExtractionTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = minutes > 0 
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;

  return <span className="tabular-nums">{display}</span>;
}

// Issue D5: Status indicators with distinct icon shapes
function getStatusDisplay(status: VideoUpload['status']): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        color: 'text-[#64748b]',
        icon: <Circle className="h-4 w-4" />,
      };
    case 'uploading':
      return {
        label: 'Uploading',
        color: 'text-blue-400',
        icon: <Upload className="h-4 w-4 animate-pulse" />,
      };
     case 'extracting':
       return {
         label: 'Extracting audio',
         color: 'text-[#f59e0b]',
         icon: <Loader2 className="h-4 w-4 animate-spin" />,
       };
    case 'transcribing':
      return {
        label: 'Transcribing',
        color: 'text-[#a855f7]',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
      };
    case 'analyzing':
      return {
        label: 'Analyzing',
        color: 'text-[#f97316]',
        icon: <Eye className="h-4 w-4 animate-pulse" />,
      };
    case 'ready':
      return {
        label: 'Ready',
        color: 'text-[#22c55e]',
        icon: <CheckCircle className="h-4 w-4" />,
      };
    case 'error':
      return {
        label: 'Error',
        color: 'text-[#ef4444]',
        icon: <AlertCircle className="h-4 w-4" />,
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-[#64748b]',
        icon: null,
      };
  }
}

// =============================================================================
// Component
// =============================================================================

export function VideoUploadStep({
  videos,
  isUploading,
  error,
  onUploadFiles,
  onImportGDrive,
  onRemoveVideo,
  onClearError,
  onComplete,
  onCancelVideo,
  onRetryTranscription,
  onBackToAdmin,
  organizationName,
}: VideoUploadStepProps) {
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFFmpegSupported()) {
      const timer = setTimeout(() => { preloadFFmpeg(); }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const hasReadyVideos = videos.some((v) => v.status === 'ready');
  const canProceed = hasReadyVideos && !isUploading;
  const remainingSlots = MAX_VIDEOS - videos.length;
  const isMaxVideos = remainingSlots <= 0;

  const handleFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((file) =>
        ACCEPTED_VIDEO_TYPES.includes(file.type)
      );
      if (files.length > 0) await onUploadFiles(files);
    },
    [onUploadFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) await onUploadFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onUploadFiles]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleGDriveImport = useCallback(async () => {
    if (!gdriveUrl.trim()) return;
    const urls = gdriveUrl.split(/[\n,]+/).map((url) => url.trim()).filter((url) => url.length > 0);
    if (urls.length > 0) { await onImportGDrive(urls); setGdriveUrl(''); }
  }, [gdriveUrl, onImportGDrive]);

  const handleGDriveKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); handleGDriveImport(); }
    },
    [handleGDriveImport]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[#e2e8f0]">
          Upload Your Campaign Videos
        </h2>
        <p className="mt-2 text-[#94a3b8]">
          Upload up to 5 videos{organizationName ? <> for <span className="text-blue-400 font-medium">{organizationName}</span></> : ' for this campaign'}
        </p>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-[#ef4444]" />
            <p className="flex-1 text-sm text-[#ef4444]">{error}</p>
            <button
              type="button"
              onClick={onClearError}
              className="rounded-md p-1 text-[#ef4444]/80 hover:bg-[#ef4444]/20 hover:text-[#ef4444]"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Upload Drop Zone */}
      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer',
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-[#1e2a45] bg-[#0a0f1a] hover:border-[#3b82f6]/50',
          isMaxVideos && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !isMaxVideos && fileInputRef.current?.click()}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={isMaxVideos ? -1 : 0}
        aria-label="Drop zone for video files"
        aria-disabled={isMaxVideos}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_VIDEO_TYPES.join(',')}
          multiple
          onChange={handleFileSelect}
          className="sr-only"
          disabled={isMaxVideos}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
          <div className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-blue-500/20 text-blue-400' : 'bg-[#1e2a45] text-[#94a3b8]'
          )}>
            <Video className="h-8 w-8" aria-hidden="true" />
          </div>

          <div>
            <p className="text-lg font-medium text-[#e2e8f0]">
              {isDragging ? 'Drop your videos here' : 'Drag and drop videos here'}
            </p>
            <p className="mt-1 text-[#94a3b8]">
              or{' '}
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={isMaxVideos}
                className="text-blue-400 hover:text-blue-300 focus:outline-none focus:underline"
              >
                click to browse
              </button>
            </p>
          </div>

          <p className="text-xs text-[#64748b]">
            MP4, MOV, WebM &bull; Max 500MB &bull; Up to 5 videos
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-[#1e2a45]" />
        <span className="text-xs text-[#64748b]">or</span>
        <div className="h-px flex-1 bg-[#1e2a45]" />
      </div>

      {/* Google Drive Import */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-6" role="group" aria-labelledby="gdrive-import-label">
        <div className="flex items-center gap-2 mb-4">
          <Link className="h-5 w-5 text-[#94a3b8]" aria-hidden="true" />
          <span id="gdrive-import-label" className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
            Import from Google Drive
          </span>
        </div>

        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="Paste Google Drive link(s) here..."
            value={gdriveUrl}
            onChange={(e) => setGdriveUrl(e.target.value)}
            onKeyDown={handleGDriveKeyDown}
            disabled={isUploading || isMaxVideos}
            className="flex-1 bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b] focus-visible:ring-blue-500"
            aria-label="Google Drive URL input"
          />
          <Button
            type="button"
            onClick={handleGDriveImport}
            disabled={!gdriveUrl.trim() || isUploading || isMaxVideos}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
          </Button>
        </div>

        <p className="mt-3 text-xs text-[#64748b]">
          Files must be shared as &quot;Anyone with link&quot;
        </p>
      </div>

      {/* Video List */}
      <AnimatePresence>
        {videos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
                Videos ({videos.length}/{MAX_VIDEOS})
              </span>
              {remainingSlots > 0 && remainingSlots < MAX_VIDEOS && (
                <span className="text-xs text-[#94a3b8]">
                  {remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining
                </span>
              )}
            </div>

            {videos.map((video, index) => {
              const statusDisplay = getStatusDisplay(video.status);
              const isProcessing = ['uploading', 'transcribing', 'analyzing', 'extracting'].includes(video.status);
              const startTime = video.transcriptionStartTime || video.extractionStartTime;
              const isStuck = video.status === 'transcribing' && startTime && (Date.now() - startTime) > STUCK_THRESHOLD_MS;
              const isError = video.status === 'error';
              const showCancel = isProcessing && onCancelVideo;
              const showRetry = isError && onRetryTranscription;

              return (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#141b2d]">
                      <Video className="h-5 w-5 text-[#94a3b8]" aria-hidden="true" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-[#e2e8f0]">{video.filename}</p>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                          video.source === 'gdrive'
                            ? 'bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/30'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        )}>
                          {video.source === 'gdrive' ? (
                            <><Cloud className="h-3 w-3" /> Google Drive</>
                          ) : (
                            <><HardDrive className="h-3 w-3" /> Uploaded</>
                          )}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-[#94a3b8]">
                        {video.file_size_bytes > 0 && <span>{formatFileSize(video.file_size_bytes)}</span>}
                        {video.duration_sec && (
                          <span>{Math.floor(video.duration_sec / 60)}:{String(Math.floor(video.duration_sec % 60)).padStart(2, '0')}</span>
                        )}
                        {video.aspect_ratio && <span>{video.aspect_ratio}</span>}
                      </div>

                      {(isProcessing || video.status === 'extracting') && (
                        <div className="mt-3">
                          <Progress
                            value={video.progress}
                            className="h-2 bg-[#1e2a45]"
                            indicatorClassName={video.status === 'extracting' ? 'bg-[#f59e0b]' : 'bg-blue-500'}
                          />
                          {video.status === 'extracting' && (
                            <div className="mt-1 flex items-center justify-between text-xs text-[#94a3b8]">
                              <span>{video.extractionMessage || getExtractionStageLabel(video.extractionStage)}</span>
                              {video.extractionStartTime && <ExtractionTimer startTime={video.extractionStartTime} />}
                            </div>
                          )}
                        </div>
                      )}

                      {video.status === 'error' && video.error_message && (
                        <div className="mt-2">
                          <p className="text-xs text-[#ef4444]">{video.error_message}</p>
                          {video.error_message?.includes('exceeds') && video.source === 'gdrive' && (
                            <p className="mt-1 text-xs text-[#94a3b8]">
                              <strong>Tip:</strong> Download the video from Google Drive, then use the "Upload Files" option instead.
                            </p>
                          )}
                        </div>
                      )}

                      {isStuck && (
                        <div className="mt-2 flex items-center gap-2 text-[#f59e0b]">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs">Taking longer than expected</span>
                        </div>
                      )}

                      {(showCancel || showRetry) && (
                        <div className="mt-3 flex items-center gap-2">
                          {showCancel && (
                            <Button type="button" variant="outline" size="sm" onClick={() => onCancelVideo!(video.id)}
                              className="gap-1.5 border-[#ef4444]/30 bg-transparent text-[#ef4444] hover:bg-[#ef4444]/10">
                              <XCircle className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          )}
                          {showRetry && (
                            <Button type="button" variant="outline" size="sm" onClick={() => onRetryTranscription!(video.id)}
                              className="gap-1.5 border-blue-500/30 bg-transparent text-blue-400 hover:bg-blue-500/10">
                              <RotateCcw className="h-3.5 w-3.5" /> Retry
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-3">
                      {video.status === 'ready' && video.meets_meta_specs && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 px-2 py-0.5 text-xs text-[#22c55e]">
                          <CheckCircle className="h-3 w-3" /> Meta specs
                        </span>
                      )}
                      <div className={cn('flex items-center gap-1.5', statusDisplay.color)}>
                        {statusDisplay.icon}
                        <span className="text-xs font-medium">{statusDisplay.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveVideo(video.id)}
                        disabled={isProcessing}
                        className={cn(
                          'rounded-md p-1.5 transition-colors',
                          isProcessing
                            ? 'cursor-not-allowed text-[#64748b]/50'
                            : 'text-[#ef4444]/80 hover:bg-[#ef4444]/10 hover:text-[#ef4444]'
                        )}
                        aria-label={`Remove ${video.filename}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Issue A9: Footer with Back button for consistency */}
      <div className="flex items-center justify-between pt-4 border-t border-[#1e2a45]">
        {onBackToAdmin ? (
          <Button
            type="button"
            onClick={onBackToAdmin}
            variant="outline"
            className="gap-2 bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Button>
        ) : (
          <div />
        )}
        <Button
          type="button"
          onClick={onComplete}
          disabled={!canProceed}
          className={cn(
            'gap-2',
            canProceed
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-[#1e2a45] text-[#64748b] cursor-not-allowed'
          )}
        >
          Next: Review Transcripts
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default VideoUploadStep;
