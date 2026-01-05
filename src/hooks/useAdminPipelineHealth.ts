import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PipelineJobHealth {
  job_type: string;
  job_name: string | null;
  last_status: 'running' | 'success' | 'failed' | 'skipped' | null;
  last_run_at: string | null;
  last_completed_at: string | null;
  last_duration_ms: number | null;
  last_records_processed: number | null;
  last_records_created: number | null;
  last_error: string | null;
  runs_24h: number | null;
  successes_24h: number | null;
  failures_24h: number | null;
  records_created_24h: number | null;
  avg_duration_ms_24h: number | null;
  freshness_status: 'ok' | 'warning' | 'stale' | 'error';
  minutes_since_last_run: number | null;
}

export interface PipelineBacklogItem {
  pipeline: string;
  pending_count: number;
  processed_count: number;
  needs_extraction: number;
  ingested_24h: number;
  processed_24h: number;
}

export interface AdminPipelineHealthData {
  jobs: PipelineJobHealth[];
  backlog: PipelineBacklogItem[];
  overallStatus: 'healthy' | 'warning' | 'stale' | 'error';
  lastRefresh: string;
}

// Job display names and expected intervals
const JOB_CONFIG: Record<string, { displayName: string; expectedIntervalMinutes: number; category: string }> = {
  'fetch_rss': { displayName: 'RSS Feed Sync', expectedIntervalMinutes: 10, category: 'ingestion' },
  'fetch_executive_orders': { displayName: 'Executive Orders', expectedIntervalMinutes: 60, category: 'ingestion' },
  'track_state_actions': { displayName: 'State Actions', expectedIntervalMinutes: 60, category: 'ingestion' },
  'collect_bluesky': { displayName: 'Bluesky Collection', expectedIntervalMinutes: 5, category: 'ingestion' },
  'analyze_articles': { displayName: 'Article Analysis', expectedIntervalMinutes: 20, category: 'processing' },
  'analyze_bluesky': { displayName: 'Bluesky Analysis', expectedIntervalMinutes: 15, category: 'processing' },
  'extract_trending_topics': { displayName: 'Topic Extraction', expectedIntervalMinutes: 30, category: 'processing' },
  'calculate_news_trends': { displayName: 'News Trends', expectedIntervalMinutes: 30, category: 'trends' },
  'calculate_bluesky_trends': { displayName: 'Bluesky Trends', expectedIntervalMinutes: 30, category: 'trends' },
  'correlate_social_news': { displayName: 'Social Correlation', expectedIntervalMinutes: 30, category: 'trends' },
  'detect_anomalies': { displayName: 'Anomaly Detection', expectedIntervalMinutes: 30, category: 'trends' },
  'smart_alerting': { displayName: 'Smart Alerting', expectedIntervalMinutes: 30, category: 'alerting' },
  'match_entity_watchlist': { displayName: 'Watchlist Matching', expectedIntervalMinutes: 30, category: 'alerting' },
  'generate_suggested_actions': { displayName: 'Action Generation', expectedIntervalMinutes: 30, category: 'alerting' },
  'send_briefings': { displayName: 'Daily Briefing', expectedIntervalMinutes: 1440, category: 'notifications' },
};

export function useAdminPipelineHealth() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-pipeline-health'],
    queryFn: async (): Promise<AdminPipelineHealthData> => {
      // Try to fetch from the new pipeline_health view
      const { data: healthData, error: healthError } = await supabase
        .from('pipeline_health')
        .select('*');

      // Fetch backlog view
      const { data: backlogData, error: backlogError } = await supabase
        .from('pipeline_backlog')
        .select('*');

      // Also get scheduled_jobs for jobs that haven't run yet or if view doesn't exist
      const { data: scheduledJobs } = await supabase
        .from('scheduled_jobs')
        .select('job_type, job_name, is_active, last_run_at, last_run_status, next_run_at, consecutive_failures')
        .eq('is_active', true);

      // Merge scheduled_jobs with pipeline_health for comprehensive view
      const jobMap = new Map<string, PipelineJobHealth>();
      
      // First add from pipeline_health (actual runs) if available
      if (!healthError && healthData) {
        (healthData || []).forEach((job: any) => {
          jobMap.set(job.job_type, job as PipelineJobHealth);
        });
      }

      // Then add scheduled jobs (for jobs that haven't run or when view fails)
      (scheduledJobs || []).forEach((sj: any) => {
        if (!jobMap.has(sj.job_type)) {
          const minutesSinceRun = sj.last_run_at 
            ? Math.floor((new Date().getTime() - new Date(sj.last_run_at).getTime()) / 60000)
            : null;
          
          let freshnessStatus: 'ok' | 'warning' | 'stale' | 'error' = 'stale';
          if (sj.consecutive_failures > 2) {
            freshnessStatus = 'error';
          } else if (sj.last_run_at) {
            const hoursSinceRun = (minutesSinceRun || 0) / 60;
            if (hoursSinceRun > 2) freshnessStatus = 'stale';
            else if (hoursSinceRun > 0.5) freshnessStatus = 'warning';
            else freshnessStatus = 'ok';
          }
          
          jobMap.set(sj.job_type, {
            job_type: sj.job_type,
            job_name: sj.job_name,
            last_status: sj.last_run_status as any || null,
            last_run_at: sj.last_run_at,
            last_completed_at: null,
            last_duration_ms: null,
            last_records_processed: null,
            last_records_created: null,
            last_error: null,
            runs_24h: 0,
            successes_24h: 0,
            failures_24h: sj.consecutive_failures || 0,
            records_created_24h: 0,
            avg_duration_ms_24h: null,
            freshness_status: freshnessStatus,
            minutes_since_last_run: minutesSinceRun,
          });
        }
      });

      const jobs = Array.from(jobMap.values());

      // Calculate overall status
      let overallStatus: 'healthy' | 'warning' | 'stale' | 'error' = 'healthy';
      const hasErrors = jobs.some(j => j.freshness_status === 'error');
      const hasStale = jobs.some(j => j.freshness_status === 'stale');
      const hasWarnings = jobs.some(j => j.freshness_status === 'warning');

      if (hasErrors) overallStatus = 'error';
      else if (hasStale) overallStatus = 'stale';
      else if (hasWarnings) overallStatus = 'warning';

      return {
        jobs,
        backlog: (backlogData || []) as PipelineBacklogItem[],
        overallStatus,
        lastRefresh: new Date().toISOString(),
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  // Force run mutation
  const forceRunMutation = useMutation({
    mutationFn: async ({ jobType, backfillHours }: { jobType?: string; backfillHours?: number }) => {
      const { data, error } = await supabase.functions.invoke('run-scheduled-jobs', {
        body: {
          force: true,
          job_type: jobType,
          backfill_hours: backfillHours,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Refetch health data after force run
      queryClient.invalidateQueries({ queryKey: ['admin-pipeline-health'] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    forceRun: forceRunMutation.mutate,
    isForceRunning: forceRunMutation.isPending,
    forceRunError: forceRunMutation.error,
    jobConfig: JOB_CONFIG,
  };
}

export function getJobDisplayName(jobType: string): string {
  return JOB_CONFIG[jobType]?.displayName || jobType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getJobCategory(jobType: string): string {
  return JOB_CONFIG[jobType]?.category || 'other';
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}