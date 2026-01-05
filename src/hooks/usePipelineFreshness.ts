import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Critical pipelines that must be fresh for the system to show "LIVE"
 * If any of these are stale, the overall status is degraded
 */
const CRITICAL_PIPELINES = [
  'fetch_rss',
  'fetch_google_news', 
  'analyze_articles',
  'batch_analyze_content',
  'calculate_trend_clusters',
  'calculate_entity_trends',
] as const;

/**
 * SLA thresholds in minutes for each pipeline type
 */
const PIPELINE_SLA_MINUTES: Record<string, number> = {
  fetch_rss: 60,                    // RSS should run every hour
  fetch_google_news: 60,            // Google News every hour
  collect_bluesky: 30,              // Bluesky every 30 min
  analyze_bluesky: 60,              // Bluesky analysis every hour
  analyze_articles: 30,             // Article analysis every 30 min
  batch_analyze_content: 60,        // Batch analyze every hour
  calculate_trend_clusters: 60,     // Trend clusters every hour
  calculate_entity_trends: 60,      // Entity trends every hour
  calculate_news_trends: 60,        // News trends every hour
  detect_breaking_news: 30,         // Breaking news every 30 min
  generate_suggested_actions: 120,  // Actions every 2 hours
};

export type FreshnessStatus = 'live' | 'stale' | 'critical' | 'unknown';

export interface PipelineFreshnessRecord {
  jobType: string;
  jobName: string;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  ageMinutes: number;
  slaMinutes: number;
  isWithinSla: boolean;
  status: FreshnessStatus;
  isCritical: boolean;
  consecutiveFailures: number;
}

export interface PipelineFreshnessData {
  overallStatus: FreshnessStatus;
  overallStatusReason: string;
  pipelines: PipelineFreshnessRecord[];
  stalePipelines: PipelineFreshnessRecord[];
  oldestCriticalPipeline: PipelineFreshnessRecord | null;
  lastSuccessfulUpdate: Date | null;
  staleCount: number;
  criticalStaleCount: number;
}

function getAgeMinutes(lastRunAt: string | null): number {
  if (!lastRunAt) return Infinity;
  const lastRun = new Date(lastRunAt);
  const now = new Date();
  return Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 60));
}

function getStatus(ageMinutes: number, slaMinutes: number, lastRunStatus: string | null): FreshnessStatus {
  if (ageMinutes === Infinity) return 'unknown';
  if (lastRunStatus === 'error') return 'stale';
  if (ageMinutes <= slaMinutes) return 'live';
  if (ageMinutes <= slaMinutes * 2) return 'stale';
  return 'critical';
}

async function fetchPipelineFreshness(): Promise<PipelineFreshnessData> {
  const { data: jobs, error } = await supabase
    .from('scheduled_jobs')
    .select('job_name, job_type, last_run_at, last_run_status, consecutive_failures, is_active')
    .eq('is_active', true)
    .order('last_run_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const pipelines: PipelineFreshnessRecord[] = (jobs || []).map(job => {
    const ageMinutes = getAgeMinutes(job.last_run_at);
    const slaMinutes = PIPELINE_SLA_MINUTES[job.job_type] || 120;
    const status = getStatus(ageMinutes, slaMinutes, job.last_run_status);
    const isCritical = CRITICAL_PIPELINES.includes(job.job_type as any);

    return {
      jobType: job.job_type,
      jobName: job.job_name,
      lastRunAt: job.last_run_at ? new Date(job.last_run_at) : null,
      lastRunStatus: job.last_run_status,
      ageMinutes,
      slaMinutes,
      isWithinSla: ageMinutes <= slaMinutes,
      status,
      isCritical,
      consecutiveFailures: job.consecutive_failures || 0,
    };
  });

  const stalePipelines = pipelines.filter(p => p.status !== 'live');
  const criticalStalePipelines = stalePipelines.filter(p => p.isCritical);
  
  // Sort by age descending to find oldest
  const sortedCritical = [...criticalStalePipelines].sort((a, b) => b.ageMinutes - a.ageMinutes);
  const oldestCriticalPipeline = sortedCritical[0] || null;

  // Find the most recent successful run across all pipelines
  const successfulPipelines = pipelines.filter(p => p.lastRunAt && p.lastRunStatus === 'success');
  const latestSuccess = successfulPipelines.length > 0
    ? successfulPipelines.reduce((latest, p) => 
        p.lastRunAt! > latest ? p.lastRunAt! : latest, 
        successfulPipelines[0].lastRunAt!
      )
    : null;

  // Determine overall status based on critical pipelines
  let overallStatus: FreshnessStatus = 'live';
  let overallStatusReason = 'All critical pipelines are running on schedule';

  if (criticalStalePipelines.length > 0) {
    const criticalCount = criticalStalePipelines.filter(p => p.status === 'critical').length;
    
    if (criticalCount > 0) {
      overallStatus = 'critical';
      overallStatusReason = `${criticalCount} critical pipeline(s) severely stale: ${
        criticalStalePipelines
          .filter(p => p.status === 'critical')
          .map(p => p.jobName)
          .join(', ')
      }`;
    } else {
      overallStatus = 'stale';
      overallStatusReason = `${criticalStalePipelines.length} critical pipeline(s) behind SLA: ${
        criticalStalePipelines.map(p => p.jobName).join(', ')
      }`;
    }
  }

  return {
    overallStatus,
    overallStatusReason,
    pipelines,
    stalePipelines,
    oldestCriticalPipeline,
    lastSuccessfulUpdate: latestSuccess,
    staleCount: stalePipelines.length,
    criticalStaleCount: criticalStalePipelines.length,
  };
}

export function usePipelineFreshness() {
  return useQuery({
    queryKey: ['pipeline-freshness'],
    queryFn: fetchPipelineFreshness,
    refetchInterval: 60_000, // Refetch every minute
    staleTime: 30_000,
  });
}

/**
 * Format age in human-readable form
 */
export function formatAge(ageMinutes: number): string {
  if (ageMinutes === Infinity) return 'Never';
  if (ageMinutes < 1) return 'Just now';
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  if (ageMinutes < 1440) return `${Math.floor(ageMinutes / 60)}h ago`;
  return `${Math.floor(ageMinutes / 1440)}d ago`;
}
