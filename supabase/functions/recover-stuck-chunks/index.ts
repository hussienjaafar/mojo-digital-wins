/**
 * recover-stuck-chunks
 * 
 * Self-healing job that runs every 10 minutes to detect and reset:
 * 1. Chunks stuck in "processing" status for >30 minutes (likely CPU timeout)
 * 2. Parent jobs stuck in "running" with no activity for >1 hour
 * 3. Stale scheduler next_run_at for chunk processor
 * 
 * This prevents backfills from silently stalling when users self-serve.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, validateCronSecret } from "../_shared/security.ts";
import { createLogger } from "../_shared/logger.ts";

/**
 * recover-stuck-chunks
 * 
 * Self-healing job that runs every 10 minutes to detect and reset:
 * 1. Chunks stuck in "processing" status for >30 minutes (likely CPU timeout)
 * 2. Parent jobs stuck in "running" with no activity for >1 hour
 * 3. Stale scheduler next_run_at for chunk processor
 * 
 * This prevents backfills from silently stalling when users self-serve.
 */

const STUCK_CHUNK_THRESHOLD_MINUTES = 30;
const STUCK_JOB_THRESHOLD_MINUTES = 60;

serve(async (req) => {
  const logger = createLogger("recover-stuck-chunks");
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron authentication
    if (!validateCronSecret(req)) {
      logger.warn("Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      stuckChunksReset: 0,
      stuckJobsDetected: 0,
      schedulerReset: false,
      errors: [] as string[],
    };

    // 1. Find and reset chunks stuck in "processing" for too long
    const stuckThreshold = new Date(Date.now() - STUCK_CHUNK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    const { data: stuckChunks, error: chunkError } = await supabase
      .from("actblue_backfill_chunks")
      .select("id, job_id, chunk_index, organization_id, started_at, attempt_count")
      .eq("status", "processing")
      .lt("started_at", stuckThreshold);

    if (chunkError) {
      logger.error("Failed to query stuck chunks", { error: chunkError.message });
      results.errors.push(`Chunk query error: ${chunkError.message}`);
    } else if (stuckChunks && stuckChunks.length > 0) {
      logger.warn(`Found ${stuckChunks.length} stuck chunks, resetting...`);

      for (const chunk of stuckChunks) {
        const newAttemptCount = (chunk.attempt_count || 0) + 1;
        const maxAttempts = 3;

        if (newAttemptCount >= maxAttempts) {
          // Mark as failed if max retries exceeded
          const { error } = await supabase
            .from("actblue_backfill_chunks")
            .update({
              status: "failed",
              error_message: `Auto-recovered: Timed out after ${STUCK_CHUNK_THRESHOLD_MINUTES}min, max retries exceeded`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", chunk.id);

          if (error) {
            results.errors.push(`Failed to mark chunk ${chunk.id} as failed: ${error.message}`);
          } else {
            logger.info(`Chunk ${chunk.chunk_index} marked as failed (max retries)`);
          }
        } else {
          // Reset to pending for retry
          const { error } = await supabase
            .from("actblue_backfill_chunks")
            .update({
              status: "pending",
              attempt_count: newAttemptCount,
              error_message: `Auto-recovered: Timed out after ${STUCK_CHUNK_THRESHOLD_MINUTES}min (attempt ${newAttemptCount}/${maxAttempts})`,
              started_at: null,
              next_retry_at: new Date().toISOString(),
            })
            .eq("id", chunk.id);

          if (error) {
            results.errors.push(`Failed to reset chunk ${chunk.id}: ${error.message}`);
          } else {
            results.stuckChunksReset++;
            logger.info(`Reset stuck chunk ${chunk.chunk_index} for retry (attempt ${newAttemptCount})`);
          }
        }
      }
    }

    // 2. Check for jobs stuck in "running" with no recent chunk activity
    const jobStuckThreshold = new Date(Date.now() - STUCK_JOB_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    const { data: runningJobs, error: jobError } = await supabase
      .from("backfill_status")
      .select("id, task_name, last_batch_at, started_at")
      .eq("status", "running")
      .lt("last_batch_at", jobStuckThreshold);

    if (jobError) {
      results.errors.push(`Job query error: ${jobError.message}`);
    } else if (runningJobs && runningJobs.length > 0) {
      for (const job of runningJobs) {
        // Check if all chunks are actually done
        const { data: pendingChunks } = await supabase
          .from("actblue_backfill_chunks")
          .select("id")
          .eq("job_id", job.id)
          .in("status", ["pending", "processing", "retrying"])
          .limit(1);

        if (!pendingChunks || pendingChunks.length === 0) {
          // All chunks done but job not updated - fix it
          const { data: chunkStats } = await supabase
            .from("actblue_backfill_chunks")
            .select("status")
            .eq("job_id", job.id);

          const allCompleted = chunkStats?.every(c => c.status === "completed");
          const hasFailed = chunkStats?.some(c => c.status === "failed");

          const finalStatus = hasFailed ? "completed_with_errors" : (allCompleted ? "completed" : "failed");

          await supabase
            .from("backfill_status")
            .update({
              status: finalStatus,
              completed_at: new Date().toISOString(),
              error_message: "Auto-recovered: Job was stuck with all chunks finished",
            })
            .eq("id", job.id);

          logger.info(`Auto-completed stuck job ${job.id} with status: ${finalStatus}`);
          results.stuckJobsDetected++;
        }
      }
    }

    // 3. Ensure scheduler next_run_at isn't stale (prevents scheduler from sleeping)
    const schedulerStaleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min
    
    const { data: schedulerJob } = await supabase
      .from("scheduled_jobs")
      .select("id, next_run_at")
      .eq("endpoint", "process-actblue-chunk")
      .eq("is_active", true)
      .single();

    if (schedulerJob && schedulerJob.next_run_at && schedulerJob.next_run_at < schedulerStaleThreshold) {
      // Check if there are pending chunks that need processing
      const { data: pendingChunks } = await supabase
        .from("actblue_backfill_chunks")
        .select("id")
        .in("status", ["pending", "retrying"])
        .limit(1);

      if (pendingChunks && pendingChunks.length > 0) {
        await supabase
          .from("scheduled_jobs")
          .update({ next_run_at: new Date().toISOString() })
          .eq("id", schedulerJob.id);

        logger.warn("Reset stale scheduler next_run_at - pending chunks exist");
        results.schedulerReset = true;
      }
    }

    // Log summary
    const hasIssues = results.stuckChunksReset > 0 || results.stuckJobsDetected > 0 || results.schedulerReset;
    if (hasIssues) {
      logger.warn("Recovery completed", results);
    } else {
      logger.info("Health check passed - no stuck chunks found");
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        message: hasIssues 
          ? `Recovered: ${results.stuckChunksReset} chunks, ${results.stuckJobsDetected} jobs` 
          : "No recovery needed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logger.error("Recovery job failed", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
