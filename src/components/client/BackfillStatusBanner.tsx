import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { V3Badge } from "@/components/v3";
import { Loader2, CheckCircle2, AlertCircle, Clock, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackfillStatus, ChunkSummary } from "@/hooks/useBackfillStatus";
import { useState } from "react";

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
};

function ChunkBreakdown({ summary }: { summary: ChunkSummary }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs mt-2">
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
      {summary.pending > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--portal-text-muted)/0.4)]" />
          {summary.pending} pending
        </span>
      )}
    </div>
  );
}

export function BackfillStatusBanner({ 
  organizationId, 
  className,
  onComplete 
}: BackfillStatusBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const { job, summary, isActive, progressPercent, estimatedMinutesRemaining, isLoading } = useBackfillStatus({
    organizationId,
    onComplete,
    enableToasts: true,
  });

  // Don't show if no job or job is old and completed
  if (isLoading || !job) return null;

  // Hide completed jobs after a short display period (show for 30 seconds after completion)
  const completedRecently = job.completed_at && 
    (new Date().getTime() - new Date(job.completed_at).getTime()) < 30_000;
  
  if (!isActive && !completedRecently && job.status !== "failed") return null;

  const config = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = config.icon;

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
                  variant={job.status === "running" ? "info" : job.status === "completed" ? "success" : job.status === "failed" ? "error" : "warning"}
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

            {/* Failed state */}
            {job.status === "failed" && job.error_message && (
              <p className="text-sm text-[hsl(var(--portal-error))]">
                {job.error_message}
              </p>
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
          </div>

          {/* Right side: expand toggle */}
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BackfillStatusBanner;
