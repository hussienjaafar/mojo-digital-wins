import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { V3Badge } from "@/components/v3";
import { V3Button } from "@/components/v3/V3Button";
import { Loader2, CheckCircle2, AlertCircle, Clock, XCircle, ChevronDown, ChevronUp, X, Ban, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackfillStatus, ChunkSummary, BackfillChunk } from "@/hooks/useBackfillStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface BackfillStatusBannerProps {
  organizationId: string;
  className?: string;
  onComplete?: () => void;
}

const statusConfig = {
  pending: {
    label: "Queued",
    icon: Clock,
    colorClass: "text-[hsl(var(--portal-text-muted))]",
    bgClass: "bg-[hsl(var(--portal-bg-elevated))]",
    borderClass: "border-[hsl(var(--portal-border))]",
  },
  running: {
    label: "Importing",
    icon: Loader2,
    colorClass: "text-[hsl(var(--portal-accent-blue))]",
    bgClass: "bg-[hsl(var(--portal-accent-blue)/0.08)]",
    borderClass: "border-[hsl(var(--portal-accent-blue)/0.3)]",
    animate: true,
  },
  completed: {
    label: "Complete",
    icon: CheckCircle2,
    colorClass: "text-[hsl(var(--portal-success))]",
    bgClass: "bg-[hsl(var(--portal-success)/0.08)]",
    borderClass: "border-[hsl(var(--portal-success)/0.3)]",
  },
  completed_with_errors: {
    label: "Completed with Issues",
    icon: AlertCircle,
    colorClass: "text-[hsl(var(--portal-warning))]",
    bgClass: "bg-[hsl(var(--portal-warning)/0.08)]",
    borderClass: "border-[hsl(var(--portal-warning)/0.3)]",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    colorClass: "text-[hsl(var(--portal-error))]",
    bgClass: "bg-[hsl(var(--portal-error)/0.08)]",
    borderClass: "border-[hsl(var(--portal-error)/0.3)]",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    colorClass: "text-[hsl(var(--portal-text-muted))]",
    bgClass: "bg-[hsl(var(--portal-bg-elevated))]",
    borderClass: "border-[hsl(var(--portal-border))]",
  },
};

function ChunkBreakdown({ summary }: { summary: ChunkSummary }) {
  const hasZeroInsertIssue = summary.completed > 0 && summary.totalRows === 0;
  
  return (
    <div className="space-y-2 mt-2">
      {hasZeroInsertIssue && (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-warning))] bg-[hsl(var(--portal-warning)/0.1)] px-2 py-1.5 rounded">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Data processing issue: chunks completed but 0 rows imported. Check database constraints.</span>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs">
        {summary.completed > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--portal-success))]" />
            {summary.completed} completed
          </span>
        )}
        {summary.processing > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--portal-accent-blue))] animate-pulse" />
            {summary.processing} processing
          </span>
        )}
        {summary.retrying > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--portal-warning))]" />
            {summary.retrying} retrying
          </span>
        )}
        {summary.failed > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--portal-error))]" />
            {summary.failed} failed
          </span>
        )}
        {summary.cancelled > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--portal-text-muted)/0.4)]" />
            {summary.cancelled} cancelled
          </span>
        )}
        {summary.pending > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--portal-text-muted)/0.4)]" />
            {summary.pending} pending
          </span>
        )}
      </div>
    </div>
  );
}

function FailedChunkDetails({ chunks }: { chunks: BackfillChunk[] }) {
  const failedChunks = chunks.filter(c => c.status === "failed");
  
  if (failedChunks.length === 0) return null;
  
  return (
    <div className="mt-3 p-3 bg-[hsl(var(--portal-error)/0.08)] rounded-md border border-[hsl(var(--portal-error)/0.2)]">
      <p className="font-medium text-sm text-[hsl(var(--portal-error))] mb-2">
        {failedChunks.length} chunk{failedChunks.length !== 1 ? "s" : ""} failed
      </p>
      <ul className="space-y-1.5 text-xs text-[hsl(var(--portal-text-muted))]">
        {failedChunks.slice(0, 5).map(chunk => (
          <li key={chunk.id} className="flex items-start gap-2">
            <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-[hsl(var(--portal-error))]" />
            <div>
              <span className="font-medium">
                {format(new Date(chunk.start_date), "MMM d")} - {format(new Date(chunk.end_date), "MMM d")}:
              </span>
              <span className="ml-1 text-[hsl(var(--portal-text-muted))]">
                {chunk.error_message?.slice(0, 80) || "Unknown error"}
                {(chunk.error_message?.length || 0) > 80 && "..."}
              </span>
            </div>
          </li>
        ))}
        {failedChunks.length > 5 && (
          <li className="text-[hsl(var(--portal-text-muted))] italic">
            +{failedChunks.length - 5} more failed chunks
          </li>
        )}
      </ul>
    </div>
  );
}

export function BackfillStatusBanner({ 
  organizationId, 
  className,
  onComplete 
}: BackfillStatusBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  const { 
    job, 
    chunks,
    summary, 
    isActive, 
    progressPercent, 
    estimatedMinutesRemaining, 
    isLoading,
    cancelBackfill,
    isCancelling,
    retryFailed,
    isRetrying,
  } = useBackfillStatus({
    organizationId,
    onComplete,
    enableToasts: true,
  });

  // Reset dismissed state when a new job starts or becomes active
  useEffect(() => {
    if (job?.status === "running" || job?.status === "pending") {
      setDismissed(false);
    }
  }, [job?.status]);

  // Auto-dismiss completed jobs after 30 seconds
  useEffect(() => {
    if (job?.status === "completed" && job.completed_at) {
      const completedTime = new Date(job.completed_at).getTime();
      const now = Date.now();
      const elapsed = now - completedTime;
      
      if (elapsed >= 30_000) {
        setDismissed(true);
      } else {
        const timer = setTimeout(() => setDismissed(true), 30_000 - elapsed);
        return () => clearTimeout(timer);
      }
    }
  }, [job?.status, job?.completed_at]);

  // Don't show if no job, loading, or dismissed
  if (isLoading || !job || dismissed) return null;

  // Determine visibility - show for active, recently completed, failed, or with errors
  const shouldShow = isActive || 
    job.status === "failed" || 
    job.status === "completed_with_errors" ||
    job.status === "cancelled" ||
    (job.status === "completed" && !dismissed);

  if (!shouldShow) return null;

  const config = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const canDismiss = !isActive;
  const canCancel = isActive;
  const canRetry = job.status === "failed" || job.status === "completed_with_errors";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "rounded-lg border p-4",
          config.bgClass,
          config.borderClass,
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left side: status and progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <StatusIcon 
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  config.colorClass,
                  (config as any).animate && "animate-spin"
                )} 
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                  ActBlue Historical Import
                </span>
                <V3Badge 
                  variant={
                    job.status === "running" ? "info" : 
                    job.status === "completed" ? "success" : 
                    job.status === "failed" ? "error" : 
                    job.status === "cancelled" ? "muted" :
                    "warning"
                  }
                  size="sm"
                >
                  {config.label}
                </V3Badge>
              </div>
            </div>

            {/* Progress bar for active jobs */}
            {isActive && summary.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-[hsl(var(--portal-text-muted))]">
                  <span>
                    Chunk {summary.completed + summary.failed + 1} of {summary.total}
                  </span>
                  <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                    {progressPercent}%
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                
                {estimatedMinutesRemaining && (
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                    ~{estimatedMinutesRemaining} min remaining
                  </p>
                )}
              </div>
            )}

            {/* Completed state */}
            {job.status === "completed" && (
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                Imported {summary.totalRows.toLocaleString()} transactions
              </p>
            )}

            {/* Completed with errors */}
            {job.status === "completed_with_errors" && (
              <div>
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                  Imported {summary.totalRows.toLocaleString()} transactions with {summary.failed} failed chunk{summary.failed !== 1 ? "s" : ""}
                </p>
                {expanded && <FailedChunkDetails chunks={chunks} />}
              </div>
            )}

            {/* Cancelled state */}
            {job.status === "cancelled" && (
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                Import was cancelled. {summary.totalRows > 0 ? `${summary.totalRows.toLocaleString()} transactions were imported before cancellation.` : "No transactions were imported."}
              </p>
            )}

            {/* Failed state */}
            {job.status === "failed" && (
              <div>
                <p className="text-sm text-[hsl(var(--portal-error))]">
                  {job.error_message || "Import failed unexpectedly"}
                </p>
                {expanded && <FailedChunkDetails chunks={chunks} />}
              </div>
            )}

            {/* Expandable chunk details */}
            {summary.total > 0 && (
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <ChunkBreakdown summary={summary} />
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Action buttons */}
            {(canCancel || canRetry) && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-[hsl(var(--portal-border))]">
                {canCancel && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <V3Button
                        size="sm"
                        variant="ghost"
                        disabled={isCancelling}
                        className="text-xs text-[hsl(var(--portal-error))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
                      >
                        {isCancelling ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Ban className="h-3 w-3 mr-1" />
                        )}
                        Cancel Import
                      </V3Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Import?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will stop the import process. Chunks that have already been processed will be kept, but remaining chunks will be cancelled.
                          {summary.completed > 0 && (
                            <span className="block mt-2">
                              {summary.completed} of {summary.total} chunks have already completed.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Running</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelBackfill(job.id)}
                          className="bg-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.9)]"
                        >
                          Cancel Import
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {canRetry && summary.failed > 0 && (
                  <V3Button
                    size="sm"
                    variant="ghost"
                    disabled={isRetrying}
                    onClick={() => retryFailed(job.id)}
                    className="text-xs"
                  >
                    {isRetrying ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3 mr-1" />
                    )}
                    Retry Failed Chunks
                  </V3Button>
                )}
              </div>
            )}
          </div>

          {/* Right side: expand toggle and dismiss */}
          <div className="flex items-center gap-1">
            {summary.total > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-md text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors"
                aria-label={expanded ? "Collapse details" : "Expand details"}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
            
            {canDismiss && (
              <button
                onClick={() => setDismissed(true)}
                className="p-1.5 rounded-md text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BackfillStatusBanner;
