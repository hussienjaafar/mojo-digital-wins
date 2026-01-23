import { useState } from "react";
import { useAllBackfillJobs, BackfillJob } from "@/hooks/useBackfillStatus";
import { AdminCard } from "./v3";
import { V3Button } from "@/components/v3/V3Button";
import { V3Badge } from "@/components/v3";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  XCircle,
  Loader2,
  Play,
  RotateCcw,
  Ban
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

const statusConfig = {
  pending: { 
    label: "Pending", 
    variant: "muted" as const,
    icon: Clock,
  },
  running: { 
    label: "Running", 
    variant: "info" as const,
    icon: Loader2,
    animate: true,
  },
  completed: { 
    label: "Completed", 
    variant: "success" as const,
    icon: CheckCircle2,
  },
  completed_with_errors: { 
    label: "With Errors", 
    variant: "warning" as const,
    icon: AlertCircle,
  },
  failed: { 
    label: "Failed", 
    variant: "error" as const,
    icon: XCircle,
  },
  cancelled: { 
    label: "Cancelled", 
    variant: "muted" as const,
    icon: Ban,
  },
};

function extractOrgId(taskName: string): string {
  // Task name format: "actblue CSV backfill_<uuid>" or "actblue_csv_backfill_<uuid>"
  const match = taskName.match(/[_\s]([a-f0-9-]{36})$/i);
  return match ? match[1].substring(0, 8) + "..." : taskName;
}

function JobCard({ 
  job, 
  chunkSummary,
  onTriggerProcess,
  onResetChunks,
  onCancelJob,
  isProcessing,
  isCancelling,
}: { 
  job: BackfillJob; 
  chunkSummary?: { pending: number; completed: number; failed: number; total: number; totalRows: number };
  onTriggerProcess: (jobId: string) => void;
  onResetChunks: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  isProcessing: boolean;
  isCancelling: boolean;
}) {
  const config = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const progressPercent = chunkSummary 
    ? Math.round(((chunkSummary.completed + chunkSummary.failed) / chunkSummary.total) * 100)
    : 0;

  return (
    <div className="border border-[hsl(var(--portal-border))] rounded-lg p-4 bg-[hsl(var(--portal-bg-card))]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon 
            className={cn(
              "h-4 w-4",
              config.variant === "success" && "text-[hsl(var(--portal-success))]",
              config.variant === "error" && "text-[hsl(var(--portal-error))]",
              config.variant === "warning" && "text-[hsl(var(--portal-warning))]",
              config.variant === "info" && "text-[hsl(var(--portal-accent-blue))]",
              (config as any).animate && "animate-spin"
            )}
          />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Org: {extractOrgId(job.task_name)}
            </p>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              {job.started_at 
                ? `Started ${formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}`
                : "Not started"
              }
            </p>
          </div>
        </div>
        <V3Badge variant={config.variant} size="sm">
          {config.label}
        </V3Badge>
      </div>

      {/* Progress for running jobs */}
      {job.status === "running" && chunkSummary && (
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-xs text-[hsl(var(--portal-text-muted))]">
            <span>{chunkSummary.completed}/{chunkSummary.total} chunks</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
          {chunkSummary.totalRows > 0 && (
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              {chunkSummary.totalRows.toLocaleString()} rows imported
            </p>
          )}
        </div>
      )}

      {/* Completed stats */}
      {job.status === "completed" && job.completed_at && (
        <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-3">
          Completed {format(new Date(job.completed_at), "MMM d, h:mm a")}
        </p>
      )}

      {/* Failed message */}
      {job.status === "failed" && job.error_message && (
        <p className="text-xs text-[hsl(var(--portal-error))] mb-3 line-clamp-2">
          {job.error_message}
        </p>
      )}

      {/* Actions for running jobs */}
      {job.status === "running" && (
        <div className="flex gap-2 pt-2 border-t border-[hsl(var(--portal-border))]">
          <V3Button
            size="sm"
            variant="ghost"
            onClick={() => onTriggerProcess(job.id)}
            disabled={isProcessing || isCancelling}
            className="text-xs"
          >
            <Play className="h-3 w-3 mr-1" />
            Process Now
          </V3Button>
          <V3Button
            size="sm"
            variant="ghost"
            onClick={() => onResetChunks(job.id)}
            disabled={isProcessing || isCancelling}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset Stuck
          </V3Button>
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
                Cancel
              </V3Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel This Import?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will stop the import process. Chunks that have already been processed will be kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Running</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onCancelJob(job.id)}
                  className="bg-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.9)]"
                >
                  Cancel Import
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

export function BackfillMonitorPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, cancelJob, isCancellingJob } = useAllBackfillJobs();
  const [processing, setProcessing] = useState<string | null>(null);

  const runningJobs = data?.jobs.filter(j => j.status === "running") || [];
  const recentJobs = data?.jobs.filter(j => j.status !== "running").slice(0, 10) || [];

  const triggerChunkProcessing = async (jobId: string) => {
    setProcessing(jobId);
    try {
      const { error } = await (supabase as any).functions.invoke("process-actblue-chunk", {
        body: { job_id: jobId },
      });

      if (error) throw error;

      toast({
        title: "Processing triggered",
        description: "Chunk processing has been triggered manually.",
      });
      
      await refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger processing",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const resetStuckChunks = async (jobId: string) => {
    setProcessing(jobId);
    try {
      // Reset stuck chunks via direct update
      const { error } = await supabase
        .from("actblue_backfill_chunks")
        .update({
          status: "pending",
          attempt_count: 0,
          next_retry_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("job_id", jobId)
        .in("status", ["processing", "retrying"])
        .lt("started_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      if (error) throw error;

      toast({
        title: "Chunks reset",
        description: "Stuck chunks have been reset and will be retried.",
      });
      
      await refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset chunks",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <AdminCard
      title="ActBlue Backfill Monitor"
      description="Monitor and manage historical data imports across all organizations"
      icon={Database}
      interactive
    >
      <div className="space-y-4">
        {/* Header with refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--portal-text-muted))]">
            {runningJobs.length > 0 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--portal-accent-blue))]" />
                {runningJobs.length} active job{runningJobs.length !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                No active imports
              </>
            )}
          </div>
          <V3Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </V3Button>
        </div>

        {/* Active Jobs */}
        {runningJobs.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Active Imports
            </h4>
            <div className="grid gap-3">
              {runningJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  chunkSummary={data?.chunksByJob[job.id]}
                  onTriggerProcess={triggerChunkProcessing}
                  onResetChunks={resetStuckChunks}
                  onCancelJob={cancelJob}
                  isProcessing={processing === job.id}
                  isCancelling={isCancellingJob}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent Jobs Accordion */}
        {recentJobs.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="recent" className="border-none">
              <AccordionTrigger className="text-sm font-medium text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] py-2">
                Recent Jobs ({recentJobs.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 pt-2">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between text-xs p-2 rounded bg-[hsl(var(--portal-bg-elevated))]"
                    >
                      <div className="flex items-center gap-2">
                        {(() => {
                          const cfg = statusConfig[job.status] || statusConfig.pending;
                          const Icon = cfg.icon;
                          return (
                            <Icon className={cn(
                              "h-3 w-3",
                              cfg.variant === "success" && "text-[hsl(var(--portal-success))]",
                              cfg.variant === "error" && "text-[hsl(var(--portal-error))]",
                              cfg.variant === "warning" && "text-[hsl(var(--portal-warning))]"
                            )} />
                          );
                        })()}
                        <span className="text-[hsl(var(--portal-text-primary))]">
                          {extractOrgId(job.task_name)}
                        </span>
                      </div>
                      <span className="text-[hsl(var(--portal-text-muted))]">
                        {job.completed_at 
                          ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })
                          : job.started_at
                          ? formatDistanceToNow(new Date(job.started_at), { addSuffix: true })
                          : "Never"
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Empty state */}
        {!isLoading && data?.jobs.length === 0 && (
          <div className="text-center py-8 text-[hsl(var(--portal-text-muted))]">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No backfill jobs found</p>
          </div>
        )}
      </div>
    </AdminCard>
  );
}

export default BackfillMonitorPanel;
