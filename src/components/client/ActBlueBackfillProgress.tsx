import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Loader2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { ActBlueBackfillDatePicker } from "./ActBlueBackfillDatePicker";

interface BackfillJob {
  id: string;
  task_name: string;
  status: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  error_message: string | null;
}

interface ChunkSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  total: number;
}

interface DateRangeValue {
  startDate: string;
  endDate: string;
}

interface Props {
  organizationId: string;
  onComplete?: () => void;
  onStartBackfill?: (dateRange: DateRangeValue) => Promise<void>;
  isStarting?: boolean;
}

export const ActBlueBackfillProgress = ({ 
  organizationId, 
  onComplete,
  onStartBackfill,
  isStarting = false
}: Props) => {
  const { toast } = useToast();
  const [job, setJob] = useState<BackfillJob | null>(null);
  const [chunks, setChunks] = useState<ChunkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchProgress = useCallback(async () => {
    try {
      // Fetch the backfill job status
      const { data: jobData, error: jobError } = await supabase
        .from("backfill_status")
        .select("*")
        .eq("task_name", `actblue_csv_backfill_${organizationId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jobError) throw jobError;

      if (!jobData) {
        setJob(null);
        setChunks(null);
        setLoading(false);
        return;
      }

      setJob(jobData as BackfillJob);

      // If job is running, fetch chunk details
      if (jobData.status === "running") {
        const { data: chunkData, error: chunkError } = await supabase
          .from("actblue_backfill_chunks")
          .select("status")
          .eq("job_id", jobData.id);

        if (!chunkError && chunkData) {
          const summary: ChunkSummary = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            retrying: 0,
            total: chunkData.length,
          };

          chunkData.forEach((chunk: { status: string }) => {
            switch (chunk.status) {
              case "pending":
                summary.pending++;
                break;
              case "processing":
                summary.processing++;
                break;
              case "completed":
                summary.completed++;
                break;
              case "failed":
                summary.failed++;
                break;
              case "retrying":
                summary.retrying++;
                break;
            }
          });

          setChunks(summary);
        }
      }

      // Check if job just completed
      if (
        (jobData.status === "completed" || jobData.status === "completed_with_errors") &&
        job?.status === "running"
      ) {
        onComplete?.();
        toast({
          title: "Backfill Complete",
          description:
            jobData.status === "completed_with_errors"
              ? "Backfill completed with some errors. Check the details below."
              : "Historical ActBlue data has been imported successfully.",
        });
      }
    } catch (error: any) {
      console.error("Failed to fetch backfill progress:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, job?.status, onComplete, toast]);

  // Initial load
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Polling when job is running
  useEffect(() => {
    if (!job || job.status !== "running") {
      setPolling(false);
      return;
    }

    setPolling(true);
    const interval = setInterval(fetchProgress, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [job?.status, fetchProgress]);

  const progressPercent = job && chunks
    ? Math.round(((chunks.completed + chunks.failed) / chunks.total) * 100)
    : 0;

  const getStatusBadge = () => {
    if (!job) return null;

    switch (job.status) {
      case "running":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-accent/50 text-accent-foreground border-accent/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "completed_with_errors":
        return (
          <Badge variant="outline" className="border-warning text-warning">
            <AlertCircle className="h-3 w-3 mr-1" />
            Completed with Errors
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {job.status}
          </Badge>
        );
    }
  };

  // If no job exists, show option to start one
  if (!loading && !job) {
    if (!onStartBackfill) return null;
    
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6">
          <div className="flex flex-col gap-4">
            <div className="text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Import Historical Data</p>
              <p className="text-xs mt-1">
                Fetch transaction history from ActBlue to populate your dashboard
              </p>
            </div>
            <ActBlueBackfillDatePicker
              onStartBackfill={onStartBackfill}
              isStarting={isStarting}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading backfill status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!job) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            ActBlue Historical Import
            {getStatusBadge()}
          </CardTitle>
          {polling && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        {job.status === "running" && chunks && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Processing chunk {chunks.completed + chunks.failed + 1} of {chunks.total}
                </span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            {/* Chunk breakdown */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-accent" />
                {chunks.completed} completed
              </span>
              {chunks.processing > 0 && (
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  {chunks.processing} processing
                </span>
              )}
              {chunks.retrying > 0 && (
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  {chunks.retrying} retrying
                </span>
              )}
              {chunks.failed > 0 && (
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  {chunks.failed} failed
                </span>
              )}
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted" />
                {chunks.pending} pending
              </span>
            </div>

            {/* Estimated time */}
            {chunks.pending > 0 && (
              <p className="text-xs text-muted-foreground">
                Estimated time remaining: ~{Math.round(chunks.pending * 2.5)} minutes
              </p>
            )}
          </>
        )}

        {/* Completed state */}
        {(job.status === "completed" || job.status === "completed_with_errors") && (
          <Alert className={job.status === "completed_with_errors" ? "border-warning/30" : "border-accent/30"}>
            {job.status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
            ) : (
              <AlertCircle className="h-4 w-4 text-warning" />
            )}
            <AlertTitle>
              {job.status === "completed" ? "Import Complete" : "Import Complete with Issues"}
            </AlertTitle>
            <AlertDescription className="text-sm">
              <div className="space-y-1">
                <p>
                  Processed {job.processed_items} of {job.total_items} chunks
                  {job.failed_items > 0 && ` (${job.failed_items} failed)`}
                </p>
                {job.completed_at && (
                  <p className="text-xs text-muted-foreground">
                    Completed {format(new Date(job.completed_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Failed state */}
        {job.status === "failed" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Import Failed</AlertTitle>
            <AlertDescription>
              {job.error_message || "The backfill job failed. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {/* Job metadata */}
        {job.started_at && (
          <p className="text-xs text-muted-foreground">
            Started {format(new Date(job.started_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ActBlueBackfillProgress;
