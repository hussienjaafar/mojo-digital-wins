import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SourceType = 'rss' | 'google_news' | 'bluesky';
export type FreshnessStatus = 'live' | 'stale' | 'critical' | 'unknown';

const PIPELINE_JOB_TYPES: Record<SourceType, string[]> = {
  rss: ['fetch_rss', 'fetch_rss_feeds'],
  google_news: ['fetch_google_news'],
  bluesky: ['bluesky_stream', 'collect_bluesky'],
};

// SLA thresholds in minutes for each source type
const SOURCE_SLA_MINUTES: Record<SourceType, { stale: number; critical: number }> = {
  rss: { stale: 60, critical: 180 },           // RSS: stale after 1h, critical after 3h
  google_news: { stale: 60, critical: 180 },   // Google News: same as RSS
  bluesky: { stale: 30, critical: 120 },       // Bluesky: stale after 30m, critical after 2h
};

export interface SourceFreshnessRecord {
  source: SourceType;
  label: string;
  latestDataAt: Date | null;
  pipelineLastRun: Date | null;
  ageMinutes: number;
  status: FreshnessStatus;
  articleCount24h: number;
  icon: string;
}

export interface SourceFreshnessData {
  sources: Record<SourceType, SourceFreshnessRecord>;
  overallStatus: FreshnessStatus;
  stalestSource: SourceType | null;
  dataGapDays: number;
  lastDataTimestamp: Date | null;
  isAnySourceCritical: boolean;
  isAnySourceStale: boolean;
}

function getAgeMinutes(date: Date | null): number {
  if (!date) return Infinity;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60));
}

function getStatus(ageMinutes: number, sla: { stale: number; critical: number }): FreshnessStatus {
  if (ageMinutes === Infinity) return 'unknown';
  if (ageMinutes <= sla.stale) return 'live';
  if (ageMinutes <= sla.critical) return 'stale';
  return 'critical';
}

function getLatestPipelineRun(
  pipelineMap: Map<string, { lastRun: Date | null; status: string }>,
  jobTypes: string[]
): Date | null {
  const runs = jobTypes
    .map((jobType) => pipelineMap.get(jobType)?.lastRun || null)
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime());

  return runs[0] || null;
}

async function fetchSourceFreshness(): Promise<SourceFreshnessData> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Fetch latest data timestamps from each table in parallel
  const [
    rssLatestResult,
    rssCountResult,
    googleNewsLatestResult,
    googleNewsCountResult,
    blueskyLatestResult,
    blueskyCountResult,
    pipelinesResult,
  ] = await Promise.all([
    // RSS/Articles - latest published_date
    supabase
      .from('articles')
      .select('published_date')
      .order('published_date', { ascending: false })
      .limit(1)
      .single(),
    // RSS/Articles - 24h count
    supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .gte('published_date', yesterday.toISOString()),
    // Google News - latest published_at
    supabase
      .from('google_news_articles')
      .select('published_at')
      .order('published_at', { ascending: false })
      .limit(1)
      .single(),
    // Google News - 24h count
    supabase
      .from('google_news_articles')
      .select('id', { count: 'exact', head: true })
      .gte('published_at', yesterday.toISOString()),
    // Bluesky - latest created_at
    supabase
      .from('bluesky_posts')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    // Bluesky - 24h count
    supabase
      .from('bluesky_posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString()),
    // Pipeline last run times
    supabase
      .from('scheduled_jobs')
      .select('job_type, last_run_at, last_run_status')
      .in('job_type', [
        ...PIPELINE_JOB_TYPES.rss,
        ...PIPELINE_JOB_TYPES.google_news,
        ...PIPELINE_JOB_TYPES.bluesky,
      ]),
  ]);

  // Parse pipeline data
  const pipelineMap = new Map<string, { lastRun: Date | null; status: string }>();
  for (const job of pipelinesResult.data || []) {
    pipelineMap.set(job.job_type, {
      lastRun: job.last_run_at ? new Date(job.last_run_at) : null,
      status: job.last_run_status || 'unknown',
    });
  }

  // Build RSS source record
  const rssLatestData = rssLatestResult.data?.published_date 
    ? new Date(rssLatestResult.data.published_date) 
    : null;
  const rssPipelineLastRun = getLatestPipelineRun(pipelineMap, PIPELINE_JOB_TYPES.rss);
  const rssAgeMinutes = getAgeMinutes(rssLatestData);
  const rssRecord: SourceFreshnessRecord = {
    source: 'rss',
    label: 'RSS Feeds',
    latestDataAt: rssLatestData,
    pipelineLastRun: rssPipelineLastRun,
    ageMinutes: rssAgeMinutes,
    status: getStatus(rssAgeMinutes, SOURCE_SLA_MINUTES.rss),
    articleCount24h: rssCountResult.count || 0,
    icon: '📰',
  };

  // Build Google News source record
  const googleNewsLatestData = googleNewsLatestResult.data?.published_at 
    ? new Date(googleNewsLatestResult.data.published_at) 
    : null;
  const googleNewsPipelineLastRun = getLatestPipelineRun(pipelineMap, PIPELINE_JOB_TYPES.google_news);
  const googleNewsAgeMinutes = getAgeMinutes(googleNewsLatestData);
  const googleNewsRecord: SourceFreshnessRecord = {
    source: 'google_news',
    label: 'Google News',
    latestDataAt: googleNewsLatestData,
    pipelineLastRun: googleNewsPipelineLastRun,
    ageMinutes: googleNewsAgeMinutes,
    status: getStatus(googleNewsAgeMinutes, SOURCE_SLA_MINUTES.google_news),
    articleCount24h: googleNewsCountResult.count || 0,
    icon: '🔍',
  };

  // Build Bluesky source record
  const blueskyLatestData = blueskyLatestResult.data?.created_at 
    ? new Date(blueskyLatestResult.data.created_at) 
    : null;
  const blueskyPipelineLastRun = getLatestPipelineRun(pipelineMap, PIPELINE_JOB_TYPES.bluesky);
  const blueskyAgeMinutes = getAgeMinutes(blueskyLatestData);
  const blueskyRecord: SourceFreshnessRecord = {
    source: 'bluesky',
    label: 'Bluesky',
    latestDataAt: blueskyLatestData,
    pipelineLastRun: blueskyPipelineLastRun,
    ageMinutes: blueskyAgeMinutes,
    status: getStatus(blueskyAgeMinutes, SOURCE_SLA_MINUTES.bluesky),
    articleCount24h: blueskyCountResult.count || 0,
    icon: '🦋',
  };

  const sources: Record<SourceType, SourceFreshnessRecord> = {
    rss: rssRecord,
    google_news: googleNewsRecord,
    bluesky: blueskyRecord,
  };

  // Determine overall status
  const allStatuses = Object.values(sources).map(s => s.status);
  const isAnySourceCritical = allStatuses.includes('critical');
  const isAnySourceStale = allStatuses.includes('stale');
  const isAnySourceUnknown = allStatuses.includes('unknown');

  let overallStatus: FreshnessStatus = 'live';
  if (isAnySourceCritical) {
    overallStatus = 'critical';
  } else if (isAnySourceStale) {
    overallStatus = 'stale';
  } else if (isAnySourceUnknown) {
    overallStatus = 'unknown';
  }

  // Find stalest source
  const stalestSource = Object.values(sources).reduce((stalest, current) => {
    if (!stalest) return current;
    return current.ageMinutes > stalest.ageMinutes ? current : stalest;
  }, null as SourceFreshnessRecord | null);

  // Calculate data gap
  const latestTimestamps = Object.values(sources)
    .map(s => s.latestDataAt)
    .filter((d): d is Date => d !== null);
  
  const lastDataTimestamp = latestTimestamps.length > 0
    ? new Date(Math.max(...latestTimestamps.map(d => d.getTime())))
    : null;

  const dataGapDays = lastDataTimestamp 
    ? Math.floor((Date.now() - lastDataTimestamp.getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  return {
    sources,
    overallStatus,
    stalestSource: stalestSource?.source || null,
    dataGapDays,
    lastDataTimestamp,
    isAnySourceCritical,
    isAnySourceStale,
  };
}

export function useSourceFreshness() {
  return useQuery({
    queryKey: ['source-freshness'],
    queryFn: fetchSourceFreshness,
    refetchInterval: 60 * 1000, // Refetch every minute
    staleTime: 30 * 1000,       // Consider stale after 30 seconds
  });
}

// Utility function to format age in human-readable format
export function formatSourceAge(ageMinutes: number): string {
  if (ageMinutes === Infinity) return 'No data';
  if (ageMinutes < 1) return 'Just now';
  if (ageMinutes < 60) return `${Math.floor(ageMinutes)}m ago`;
  if (ageMinutes < 1440) return `${Math.floor(ageMinutes / 60)}h ago`;
  return `${Math.floor(ageMinutes / 1440)}d ago`;
}

// Get status badge color
export function getStatusColor(status: FreshnessStatus): { 
  text: string; 
  bg: string; 
  border: string;
  icon: string;
} {
  switch (status) {
    case 'live':
      return { 
        text: 'text-status-success', 
        bg: 'bg-status-success/10', 
        border: 'border-status-success/30',
        icon: '✓'
      };
    case 'stale':
      return { 
        text: 'text-status-warning', 
        bg: 'bg-status-warning/10', 
        border: 'border-status-warning/30',
        icon: '⚠'
      };
    case 'critical':
      return { 
        text: 'text-status-error', 
        bg: 'bg-status-error/10', 
        border: 'border-status-error/30',
        icon: '✗'
      };
    default:
      return { 
        text: 'text-muted-foreground', 
        bg: 'bg-muted/10', 
        border: 'border-muted/30',
        icon: '?'
      };
  }
}
