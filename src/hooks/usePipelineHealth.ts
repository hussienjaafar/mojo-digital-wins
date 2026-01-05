import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineHealth {
  matchWatchlist: {
    status: 'ok' | 'stale' | 'error' | 'unknown';
    lastRun: string | null;
    lastError: string | null;
    alertsCreated: number;
  };
  generateActions: {
    status: 'ok' | 'stale' | 'error' | 'unknown';
    lastRun: string | null;
    lastError: string | null;
    actionsGenerated: number;
  };
  metrics: {
    actionableAlerts24h: number;
    actionsGenerated24h: number;
    aiGeneratedCount: number;
    templateGeneratedCount: number;
    aiRatio: number;
  };
  lastSnapshot: string | null;
}

// Expected interval in minutes for each job type
const JOB_INTERVALS: Record<string, number> = {
  'match_entity_watchlist': 5,
  'generate_suggested_actions': 30,
};

async function fetchPipelineHealth(organizationId: string): Promise<PipelineHealth> {
  // Fetch scheduled jobs status
  const { data: jobs } = await supabase
    .from('scheduled_jobs')
    .select('job_type, last_run_at, last_error, is_active, next_run_at')
    .in('job_type', ['match_entity_watchlist', 'generate_suggested_actions']);

  // Fetch latest action generator runs
  const { data: runs } = await supabase
    .from('action_generator_runs')
    .select('id, started_at, finished_at, alerts_processed, actions_created, ai_generated_count, template_generated_count, error_count, errors')
    .order('started_at', { ascending: false })
    .limit(10);

  // Calculate 24h metrics from runs
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentRuns = (runs || []).filter(
    (r: any) => new Date(r.started_at) >= twentyFourHoursAgo
  );
  
  const metrics24h = recentRuns.reduce(
    (acc: { alerts: number; actions: number; ai: number; template: number }, run: any) => ({
      alerts: acc.alerts + (run.alerts_processed || 0),
      actions: acc.actions + (run.actions_created || 0),
      ai: acc.ai + (run.ai_generated_count || 0),
      template: acc.template + (run.template_generated_count || 0),
    }),
    { alerts: 0, actions: 0, ai: 0, template: 0 }
  );

  // Process job status
  const jobsArray = jobs as any[] | null;
  const matchJob = (jobsArray || []).find((j: any) => j.job_type === 'match_entity_watchlist');
  const generateJob = (jobsArray || []).find((j: any) => j.job_type === 'generate_suggested_actions');

  const now = Date.now();
  
  function getJobStatus(job: any, jobType: string): 'ok' | 'stale' | 'error' | 'unknown' {
    if (!job) return 'unknown';
    if (job.last_error) return 'error';
    if (!job.last_run_at) return 'unknown';
    
    const lastRun = new Date(job.last_run_at).getTime();
    const intervalMinutes = JOB_INTERVALS[jobType] || 30;
    const intervalMs = intervalMinutes * 60 * 1000;
    const staleThreshold = intervalMs * 3; // Consider stale if 3x the interval
    
    if (now - lastRun > staleThreshold) return 'stale';
    return 'ok';
  }

  // Get latest run for most recent snapshot
  const latestRun = runs?.[0] as any;

  return {
    matchWatchlist: {
      status: getJobStatus(matchJob, 'match_entity_watchlist'),
      lastRun: matchJob?.last_run_at || null,
      lastError: matchJob?.last_error || null,
      alertsCreated: metrics24h.alerts,
    },
    generateActions: {
      status: getJobStatus(generateJob, 'generate_suggested_actions'),
      lastRun: latestRun?.started_at || generateJob?.last_run_at || null,
      lastError: latestRun?.errors?.[0]?.error || generateJob?.last_error || null,
      actionsGenerated: metrics24h.actions,
    },
    metrics: {
      actionableAlerts24h: metrics24h.alerts,
      actionsGenerated24h: metrics24h.actions,
      aiGeneratedCount: metrics24h.ai,
      templateGeneratedCount: metrics24h.template,
      aiRatio: metrics24h.ai + metrics24h.template > 0 
        ? Math.round((metrics24h.ai / (metrics24h.ai + metrics24h.template)) * 100) 
        : 0,
    },
    lastSnapshot: latestRun?.finished_at || null,
  };
}

export function usePipelineHealth(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['pipelineHealth', organizationId],
    queryFn: () => fetchPipelineHealth(organizationId!),
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

// Force Generate mutation
export function useForceGenerate(organizationId: string | undefined) {
  return useMutation({
    mutationFn: async (options: { lookbackDays?: number; minActionableScore?: number }) => {
      const response = await supabase.functions.invoke('generate-suggested-actions', {
        body: {
          force: true,
          organization_id: organizationId,
          lookback_days: options.lookbackDays || 7,
          min_actionable_score: options.minActionableScore || 30,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate actions');
      }

      return response.data;
    },
  });
}
