// Query key factories
export * from "./queryKeys";

// Query hooks
export * from "./useClientDashboardMetricsQuery";
export * from "./useMetaAdsMetricsQuery";
export * from "./useSMSMetricsQuery";
export * from "./useIntelligenceHubQuery";
export * from "./useDonorIntelligenceQuery";
export * from "./useCreativeInsightsQuery";
export * from "./queryKeys";
export * from "./useClientDashboardMetricsQuery";

// Dashboard queries
export { useDashboardKPIsQuery } from "./useDashboardKPIsQuery";
export { useChannelSummariesQuery, type ChannelSummary } from "./useChannelSummariesQuery";
export {
  useDonationMetricsQuery,
  useDonationTimeSeriesQuery,
  type DonationMetrics,
  type DonationTimeSeries,
  type DonationBySource,
} from "./useDonationMetricsQuery";

// Channel-specific queries
export {
  useMetaAdsMetricsQuery,
  type MetaCampaign,
  type MetaMetrics,
  type MetaDailyMetric,
  type MetaAdsMetricsResult,
} from "./useMetaAdsMetricsQuery";
export {
  useSMSMetricsQuery,
  type SMSMetric,
  type SMSDailyMetric,
  type SMSMetricsResult,
} from "./useSMSMetricsQuery";

// Intelligence queries
export {
  useIntelligenceHubQuery,
  hubKeys,
  type IntelligenceHubStats,
} from "./useIntelligenceHubQuery";
export {
  useDonorIntelligenceQuery,
  type AttributionData,
  type DonorSegment,
  type SmsFunnel,
  type JourneyEvent,
  type LtvSummary,
  type DonorIntelligenceData,
} from "./useDonorIntelligenceQuery";
