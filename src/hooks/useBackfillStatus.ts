import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Query key factory
export const backfillKeys = {
  all: ["backfill"] as const,
  status: (orgId: string) => [...backfillKeys.all, "status", orgId] as const,
  chunks: (jobId: string) => [...backfillKeys.all, "chunks", jobId] as const,
  allJobs: () => [...backfillKeys.all, "all-jobs"] as const,
};

export interface BackfillJob {
  id: string;
  task_name: string;
  status: "pending" | "running" | "completed" | "completed_with_errors" | "failed";
  total_items: number | null;
  processed_items: number | null;
  failed_items: number | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  error_message: string | null;
  batches_run: number | null;
}

export interface BackfillChunk {
  id: string;
  job_id: string;
  chunk_index: number;
  start_date: string;
  end_date: string;
  status: "pending" | "processing" | "completed" | "failed" | "retrying";
  attempt_count: number | null;
  max_attempts: number | null;
  processed_rows: number | null;
  inserted_rows: number | null;
  updated_rows: number | null;
  skipped_rows: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  next_retry_at: string | null;
}

export interface ChunkSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  total: number;
  totalRows: number;
}

export interface BackfillStatusData {
  job: BackfillJob | null;
  chunks: BackfillChunk[];
  summary: ChunkSummary;
  isActive: boolean;
  progressPercent: number;
  estimatedMinutesRemaining: number | null;
}

interface UseBackfillStatusOptions {
  organizationId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  enableToasts?: boolean;
}

export function useBackfillStatus({
  organizationId,
  onComplete,
  onError,
  enableToasts = true,
}: UseBackfillStatusOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<string | null>(null);

  // Main status query
  const query = useQuery({
    queryKey: backfillKeys.status(organizationId),
    queryFn: async (): Promise<BackfillStatusData> => {
      // Fetch the most recent backfill job for this org
      const { data: jobData, error: jobError } = await supabase
        .from("backfill_status")
        .select("*")
        .ilike("task_name", `%${organizationId}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jobError) throw jobError;

      if (!jobData) {
        return {
          job: null,
          chunks: [],
          summary: { pending: 0, processing: 0, completed: 0, failed: 0, retrying: 0, total: 0, totalRows: 0 },
          isActive: false,
          progressPercent: 0,
          estimatedMinutesRemaining: null,
        };
      }

      const job = jobData as BackfillJob;

      // Fetch chunks for the job
      const { data: chunkData, error: chunkError } = await supabase
        .from("actblue_backfill_chunks")
        .select("*")
        .eq("job_id", job.id)
        .order("chunk_index", { ascending: true });

      if (chunkError) throw chunkError;

      const chunks = (chunkData || []) as BackfillChunk[];

      // Calculate summary
      const summary: ChunkSummary = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retrying: 0,
        total: chunks.length,
        totalRows: 0,
      };

      chunks.forEach((chunk) => {
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
        summary.totalRows += (chunk.inserted_rows || 0) + (chunk.updated_rows || 0);
      });

      const isActive = job.status === "running" || job.status === "pending";
      const completedChunks = summary.completed + summary.failed;
      const progressPercent = summary.total > 0 
        ? Math.round((completedChunks / summary.total) * 100) 
        : 0;
      
      // With parallel processing (3 chunks per 2-min cron), estimate time more accurately
      const CHUNKS_PER_CRON = 3;
      const CRON_INTERVAL_MINUTES = 2;
      const remainingChunks = summary.total - completedChunks;
      const cronRunsRemaining = Math.ceil(remainingChunks / CHUNKS_PER_CRON);
      const estimatedMinutesRemaining = remainingChunks > 0 ? Math.round(cronRunsRemaining * CRON_INTERVAL_MINUTES) : null;

      return {
        job,
        chunks,
        summary,
        isActive,
        progressPercent,
        estimatedMinutesRemaining,
      };
    },
    // Poll every 10 seconds when active, otherwise every 60 seconds
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isActive ? 10_000 : 60_000;
    },
    staleTime: 5_000,
  });

  // Handle status transitions and show toasts
  useEffect(() => {
    const currentStatus = query.data?.job?.status || null;
    const previousStatus = previousStatusRef.current;

    if (!enableToasts || !currentStatus || currentStatus === previousStatus) {
      previousStatusRef.current = currentStatus;
      return;
    }

    // Status just changed
    if (previousStatus === "running" || previousStatus === "pending") {
      if (currentStatus === "completed") {
        toast({
          title: "Import Complete! ✓",
          description: `Imported ${query.data?.summary.totalRows?.toLocaleString() || 0} transactions successfully.`,
        });
        onComplete?.();
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ["donations"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } else if (currentStatus === "completed_with_errors") {
        toast({
          title: "Import Completed with Issues",
          description: `Imported ${query.data?.summary.totalRows?.toLocaleString() || 0} transactions. ${query.data?.summary.failed || 0} chunks had errors.`,
          variant: "destructive",
        });
        onComplete?.();
        queryClient.invalidateQueries({ queryKey: ["donations"] });
      } else if (currentStatus === "failed") {
        const errorMessage = query.data?.job?.error_message || "Import failed unexpectedly";
        toast({
          title: "Import Failed",
          description: errorMessage,
          variant: "destructive",
        });
        onError?.(errorMessage);
      }
    }

    previousStatusRef.current = currentStatus;
  }, [query.data?.job?.status, query.data?.summary, enableToasts, toast, onComplete, onError, queryClient]);

  return {
    ...query,
    job: query.data?.job || null,
    chunks: query.data?.chunks || [],
    summary: query.data?.summary || { pending: 0, processing: 0, completed: 0, failed: 0, retrying: 0, total: 0, totalRows: 0 },
    isActive: query.data?.isActive || false,
    progressPercent: query.data?.progressPercent || 0,
    estimatedMinutesRemaining: query.data?.estimatedMinutesRemaining || null,
  };
}

/**
 * Hook for admins to monitor all backfill jobs across organizations
 */
export function useAllBackfillJobs() {
  return useQuery({
    queryKey: backfillKeys.allJobs(),
    queryFn: async () => {
      // Get all recent backfill jobs
      const { data: jobs, error: jobsError } = await supabase
        .from("backfill_status")
        .select("*")
        .ilike("task_name", "actblue%")
        .order("created_at", { ascending: false })
        .limit(50);

      if (jobsError) throw jobsError;

      // Get chunk summary for running jobs
      const runningJobIds = (jobs || [])
        .filter((j: any) => j.status === "running")
        .map((j: any) => j.id);

      let chunksByJob: Record<string, ChunkSummary> = {};

      if (runningJobIds.length > 0) {
        const { data: chunks } = await supabase
          .from("actblue_backfill_chunks")
          .select("job_id, status, inserted_rows, updated_rows")
          .in("job_id", runningJobIds);

        if (chunks) {
          chunks.forEach((chunk: any) => {
            if (!chunksByJob[chunk.job_id]) {
              chunksByJob[chunk.job_id] = {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
                retrying: 0,
                total: 0,
                totalRows: 0,
              };
            }
            const summary = chunksByJob[chunk.job_id];
            summary.total++;
            summary[chunk.status as keyof Pick<ChunkSummary, "pending" | "processing" | "completed" | "failed" | "retrying">]++;
            summary.totalRows += (chunk.inserted_rows || 0) + (chunk.updated_rows || 0);
          });
        }
      }

      return {
        jobs: (jobs || []) as BackfillJob[],
        chunksByJob,
      };
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
