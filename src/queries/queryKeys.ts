// Query key factories for TanStack Query
// These ensure consistent, type-safe query keys across the application

export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...dashboardKeys.all, 'kpis', orgId, dateRange] as const,
  summary: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...dashboardKeys.all, 'summary', orgId, dateRange] as const,
  overview: (orgId: string) => [...dashboardKeys.all, 'overview', orgId] as const,
};

export const donationKeys = {
  all: ['donations'] as const,
  list: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...donationKeys.all, 'list', orgId, dateRange] as const,
  metrics: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...donationKeys.all, 'metrics', orgId, dateRange] as const,
  timeSeries: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...donationKeys.all, 'timeSeries', orgId, dateRange] as const,
  bySource: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...donationKeys.all, 'bySource', orgId, dateRange] as const,
  detail: (orgId: string, transactionId: string) =>
    [...donationKeys.all, 'detail', orgId, transactionId] as const,
};

export const metaKeys = {
  all: ['meta'] as const,
  campaigns: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...metaKeys.all, 'campaigns', orgId, dateRange] as const,
  metrics: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...metaKeys.all, 'metrics', orgId, dateRange] as const,
  creatives: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...metaKeys.all, 'creatives', orgId, dateRange] as const,
  performance: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...metaKeys.all, 'performance', orgId, dateRange] as const,
};

export const smsKeys = {
  all: ['sms'] as const,
  campaigns: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...smsKeys.all, 'campaigns', orgId, dateRange] as const,
  metrics: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...smsKeys.all, 'metrics', orgId, dateRange] as const,
  broadcasts: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...smsKeys.all, 'broadcasts', orgId, dateRange] as const,
};

export const channelKeys = {
  all: ['channels'] as const,
  summaries: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...channelKeys.all, 'summaries', orgId, dateRange] as const,
  comparison: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...channelKeys.all, 'comparison', orgId, dateRange] as const,
};

export const alertKeys = {
  all: ['alerts'] as const,
  active: (orgId: string) => [...alertKeys.all, 'active', orgId] as const,
  history: (orgId: string, limit?: number) =>
    [...alertKeys.all, 'history', orgId, limit] as const,
  anomalies: (orgId: string) => [...alertKeys.all, 'anomalies', orgId] as const,
};

export const intelligenceKeys = {
  all: ['intelligence'] as const,
  donors: (
    orgId: string,
    dateRange: { startDate: string; endDate: string },
    filters?: { campaignId?: string | null; creativeId?: string | null }
  ) =>
    [...intelligenceKeys.all, 'donors', orgId, dateRange, filters ?? {}] as const,
  attribution: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...intelligenceKeys.all, 'attribution', orgId, dateRange] as const,
  segments: (orgId: string) => [...intelligenceKeys.all, 'segments', orgId] as const,
  opportunities: (orgId: string) =>
    [...intelligenceKeys.all, 'opportunities', orgId] as const,
};

export const hubKeys = {
  all: ['hub'] as const,
  stats: (orgId: string) => [...hubKeys.all, 'stats', orgId] as const,
};

export const trendsKeys = {
  all: ['trends'] as const,
  topics: (limit?: number) => [...trendsKeys.all, 'topics', limit] as const,
  entities: (orgId: string) => [...trendsKeys.all, 'entities', orgId] as const,
  watchlist: (orgId: string) => [...trendsKeys.all, 'watchlist', orgId] as const,
};

export const syncKeys = {
  all: ['sync'] as const,
  status: (orgId: string) => [...syncKeys.all, 'status', orgId] as const,
  freshness: (orgId: string) => [...syncKeys.all, 'freshness', orgId] as const,
};

export const kpiKeys = {
  all: ['kpis'] as const,
  drilldown: (orgId: string, kpiKey: string, startDate: string, endDate: string) =>
    [...kpiKeys.all, 'drilldown', orgId, kpiKey, startDate, endDate] as const,
  summary: (orgId: string, dateRange: { startDate: string; endDate: string }) =>
    [...kpiKeys.all, 'summary', orgId, dateRange] as const,
};

export const adPerformanceKeys = {
  all: ['adPerformance'] as const,
  list: (params: { startDate: string; endDate: string }) =>
    [...adPerformanceKeys.all, 'list', params] as const,
};

// Standardized ActBlue query keys - single source of truth for cache management
export const actblueKeys = {
  all: ['actblue'] as const,
  dailyRollup: (orgId: string, startDate: string, endDate: string) =>
    [...actblueKeys.all, 'daily-rollup', orgId, startDate, endDate] as const,
  periodSummary: (orgId: string, startDate: string, endDate: string) =>
    [...actblueKeys.all, 'period-summary', orgId, startDate, endDate] as const,
  filteredRollup: (
    orgId: string,
    startDate: string,
    endDate: string,
    campaignId?: string | null,
    creativeId?: string | null
  ) =>
    [...actblueKeys.all, 'filtered-rollup', orgId, startDate, endDate, campaignId, creativeId] as const,
};

export const voterImpactKeys = {
  all: ['voter-impact'] as const,
  states: () => [...voterImpactKeys.all, 'states'] as const,
  districts: () => [...voterImpactKeys.all, 'districts'] as const,
  districtsByState: (stateCode: string) =>
    [...voterImpactKeys.districts(), stateCode] as const,
  district: (cdCode: string) =>
    [...voterImpactKeys.all, 'district', cdCode] as const,
};

// Unified queryKeys object for backwards compatibility
export const queryKeys = {
  dashboard: dashboardKeys,
  donations: donationKeys,
  meta: metaKeys,
  sms: smsKeys,
  channels: channelKeys,
  alerts: alertKeys,
  intelligence: intelligenceKeys,
  hub: hubKeys,
  trends: trendsKeys,
  sync: syncKeys,
  kpis: kpiKeys,
  adPerformance: adPerformanceKeys,
  actblue: actblueKeys,
  voterImpact: voterImpactKeys,
};
