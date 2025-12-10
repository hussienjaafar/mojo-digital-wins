// Query key factories
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
