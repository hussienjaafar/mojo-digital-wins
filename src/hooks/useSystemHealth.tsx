import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface JobExecution {
  id: string;
  job_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  items_processed: number | null;
  items_created: number | null;
  error_message: string | null;
}

export interface JobFailure {
  id: string;
  function_name: string;
  error_message: string | null;
  retry_count: number;
  is_resolved: boolean;
  created_at: string;
}

export interface ProcessingCheckpoint {
  function_name: string;
  last_processed_at: string | null;
  records_processed: number;
  updated_at: string;
}

export interface ScheduledJob {
  id: string;
  job_name: string;
  job_type: string;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_duration_ms: number | null;
  consecutive_failures: number;
  next_run_at: string | null;
  is_circuit_open: boolean | null;
  circuit_opened_at: string | null;
  circuit_failure_threshold: number | null;
}

export const useSystemHealth = () => {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<JobExecution[]>([]);
  const [failures, setFailures] = useState<JobFailure[]>([]);
  const [checkpoints, setCheckpoints] = useState<ProcessingCheckpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [jobsRes, executionsRes, failuresRes, checkpointsRes] = await Promise.all([
        (supabase as any)
          .from('scheduled_jobs')
          .select('*')
          .order('last_run_at', { ascending: false, nullsFirst: false }),
        (supabase as any)
          .from('job_executions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(50),
        (supabase as any)
          .from('job_failures')
          .select('*')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(20),
        (supabase as any)
          .from('processing_checkpoints')
          .select('*')
          .order('updated_at', { ascending: false })
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (executionsRes.error) throw executionsRes.error;
      
      setJobs(jobsRes.data || []);
      setRecentExecutions(executionsRes.data || []);
      setFailures(failuresRes.data || []);
      setCheckpoints(checkpointsRes.data || []);
    } catch (err) {
      console.error('Error fetching system health:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    
    // Refresh every minute
    const interval = setInterval(fetchHealth, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Calculate stats
  const activeJobs = jobs.filter(j => j.is_active && j.is_circuit_open !== true);
  const failingJobs = jobs.filter(j => j.consecutive_failures > 0);
  const circuitOpenJobs = jobs.filter(j => j.is_circuit_open === true);
  const recentFailures = recentExecutions.filter(e => e.status === 'failed');
  const recentSuccesses = recentExecutions.filter(e => e.status === 'success');
  
  const avgDuration = recentSuccesses.length > 0
    ? recentSuccesses.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / recentSuccesses.length
    : 0;

  const successRate = recentExecutions.length > 0
    ? (recentSuccesses.length / recentExecutions.length) * 100
    : 100;

  return {
    jobs,
    recentExecutions,
    failures,
    checkpoints,
    isLoading,
    error,
    refresh: fetchHealth,
    stats: {
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      failingJobs: failingJobs.length,
      circuitOpenJobs: circuitOpenJobs.length,
      unresolvedFailures: failures.length,
      recentExecutions: recentExecutions.length,
      successRate: Math.round(successRate),
      avgDurationMs: Math.round(avgDuration),
    }
  };
};

// Helper to format job status
export const getJobStatusColor = (job: ScheduledJob): string => {
  if (!job.is_active) return 'text-muted-foreground';
  if (job.consecutive_failures >= 3) return 'text-destructive';
  if (job.consecutive_failures > 0) return 'text-orange-500';
  if (job.last_run_status === 'success') return 'text-green-500';
  return 'text-muted-foreground';
};

export const getExecutionStatusBadge = (status: string): string => {
  switch (status) {
    case 'success': return 'bg-green-500/20 text-green-500';
    case 'failed': return 'bg-destructive/20 text-destructive';
    case 'running': return 'bg-blue-500/20 text-blue-500';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default useSystemHealth;