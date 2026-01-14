/**
 * TranscriptionStatusBadge Component
 *
 * Shows the transcription status for a video ad with appropriate styling.
 * Provides tooltip with details and action button for transcription.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  FileText,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdVideoTranscription, VideoTranscriptionStatus } from '@/types/adPerformance';
import {
  getTranscriptionStatusLabel,
  getTranscriptionStatusColor,
} from '@/hooks/useVideoTranscription';

interface TranscriptionStatusBadgeProps {
  transcription: AdVideoTranscription | null | undefined;
  creativeType: string | null | undefined;
  onTranscribe?: () => void;
  isTranscribing?: boolean;
  compact?: boolean;
}

function getStatusIcon(status: VideoTranscriptionStatus | undefined) {
  switch (status) {
    case 'TRANSCRIBED':
      return <CheckCircle className="h-3 w-3" />;
    case 'PENDING':
    case 'URL_FETCHED':
    case 'DOWNLOADED':
      return <Clock className="h-3 w-3" />;
    case 'URL_EXPIRED':
    case 'URL_INACCESSIBLE':
      return <AlertCircle className="h-3 w-3" />;
    case 'TRANSCRIPT_FAILED':
    case 'ERROR':
      return <XCircle className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
}

export function TranscriptionStatusBadge({
  transcription,
  creativeType,
  onTranscribe,
  isTranscribing = false,
  compact = false,
}: TranscriptionStatusBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Don't show for non-video creatives
  if (creativeType !== 'video') {
    return null;
  }

  const status = transcription?.status || 'NO_VIDEO';
  const label = getTranscriptionStatusLabel(status);
  const colorClass = getTranscriptionStatusColor(status);
  const icon = getStatusIcon(status);

  // Compact mode: just show icon badge
  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(
                'h-5 w-5 p-0 flex items-center justify-center',
                colorClass
              )}
            >
              {isTranscribing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                icon
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[200px]">
            <p className="font-medium">{label}</p>
            {transcription?.error_message && (
              <p className="text-red-400 mt-1">{transcription.error_message}</p>
            )}
            {status === 'TRANSCRIBED' && transcription?.duration_seconds && (
              <p className="text-muted-foreground mt-1">
                {Math.round(transcription.duration_seconds)}s video
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full badge with popover for details
  return (
    <Popover open={showDetails} onOpenChange={setShowDetails}>
      <PopoverTrigger asChild>
        <Badge
          variant="secondary"
          className={cn(
            'cursor-pointer text-[10px] px-1.5 py-0 h-4 font-medium gap-1',
            colorClass
          )}
        >
          {isTranscribing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            icon
          )}
          {label}
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        side="bottom"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Video Transcription</h4>
            <Badge variant="secondary" className={cn('text-[10px]', colorClass)}>
              {label}
            </Badge>
          </div>

          {/* Transcribed: Show analysis details */}
          {status === 'TRANSCRIBED' && transcription && (
            <div className="space-y-2 text-xs">
              {/* Duration & Language */}
              <div className="flex gap-4 text-muted-foreground">
                {transcription.duration_seconds && (
                  <span>{Math.round(transcription.duration_seconds)}s</span>
                )}
                {transcription.language && (
                  <span className="uppercase">{transcription.language}</span>
                )}
                {transcription.words_per_minute && (
                  <span>{Math.round(transcription.words_per_minute)} wpm</span>
                )}
              </div>

              {/* Hook */}
              {transcription.hook_text && (
                <div>
                  <span className="text-muted-foreground">Hook: </span>
                  <span className="italic">"{transcription.hook_text}"</span>
                </div>
              )}

              {/* Topics & Tones */}
              <div className="flex flex-wrap gap-1">
                {transcription.topic_primary && (
                  <Badge variant="outline" className="text-[10px]">
                    {transcription.topic_primary}
                  </Badge>
                )}
                {transcription.tone_primary && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {transcription.tone_primary}
                  </Badge>
                )}
                {transcription.urgency_level && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {transcription.urgency_level} urgency
                  </Badge>
                )}
              </div>

              {/* CTA */}
              {transcription.cta_text && (
                <div>
                  <span className="text-muted-foreground">CTA: </span>
                  <span>{transcription.cta_text}</span>
                </div>
              )}

              {/* Key Phrases */}
              {transcription.key_phrases && transcription.key_phrases.length > 0 && (
                <div>
                  <span className="text-muted-foreground block mb-1">Key Phrases:</span>
                  <div className="flex flex-wrap gap-1">
                    {transcription.key_phrases.slice(0, 3).map((phrase, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Transcript Preview */}
              {transcription.transcript_text && (
                <div className="mt-2 pt-2 border-t">
                  <span className="text-muted-foreground block mb-1">Transcript:</span>
                  <p className="text-[11px] line-clamp-3 text-muted-foreground italic">
                    {transcription.transcript_text}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pending: Show progress info */}
          {(status === 'PENDING' || status === 'URL_FETCHED' || status === 'DOWNLOADED') && (
            <div className="text-xs text-muted-foreground">
              <p>Video is queued for transcription.</p>
              {onTranscribe && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  onClick={onTranscribe}
                  disabled={isTranscribing}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Transcribe Now
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Error: Show error details */}
          {(status === 'URL_EXPIRED' || status === 'URL_INACCESSIBLE' ||
            status === 'TRANSCRIPT_FAILED' || status === 'ERROR') && (
            <div className="text-xs">
              <p className="text-red-500">
                {transcription?.error_message || 'Failed to transcribe video'}
              </p>
              {status === 'URL_EXPIRED' && (
                <p className="text-muted-foreground mt-1">
                  The video URL has expired. Re-sync videos to get a fresh URL.
                </p>
              )}
              {status === 'URL_INACCESSIBLE' && (
                <p className="text-muted-foreground mt-1">
                  Video source URL is not accessible. This may be due to API restrictions.
                </p>
              )}
            </div>
          )}

          {/* No Video */}
          {status === 'NO_VIDEO' && (
            <div className="text-xs text-muted-foreground">
              <p>No video has been synced for this ad yet.</p>
              {onTranscribe && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  onClick={onTranscribe}
                  disabled={isTranscribing}
                >
                  Sync Video
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default TranscriptionStatusBadge;
