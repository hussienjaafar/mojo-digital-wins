// Query key factories
export * from "./queryKeys";

// Dashboard Types (shared across components)
export type {
  DashboardKPIs,
  DashboardTimeSeriesPoint,
  ChannelBreakdown,
  SparklineData,
  SparklineDataPoint,
  DashboardMetricsResult,
} from "@/types/dashboard";

// Dashboard queries
export { useDashboardKPIsQuery } from "./useDashboardKPIsQuery";
export {
  useChannelSummariesQuery,
  isChannelStale,
  formatLastDataDate,
  type MetaSummary,
  type SmsSummary,
  type DonationsSummary,
  type ChannelSummariesData,
  type ChannelSummariesQueryResult,
  type ChannelType,
} from "./useChannelSummariesQuery";
export {
  useDonationMetricsQuery,
  useDonationTimeSeriesQuery,
  type DonationMetrics,
  type DonationTimeSeries,
  type DonationBySource,
  type TopDonor,
  type DonationRow,
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

// KPI drilldown queries
export {
  useKpiDrilldownQuery,
  type KpiBreakdownItem,
  type KpiTrendPoint,
  type KpiDrilldownData,
} from "./useKpiDrilldownQuery";

// Smart Insights queries
export {
  useInsightsQuery,
  type Insight,
  type InsightType,
  type InsightPriority,
  type InsightsData,
} from "./useInsightsQuery";

// Watchlist queries
export {
  useWatchlistQuery,
  useAddWatchlistEntity,
  useDeleteWatchlistEntity,
  useToggleSentimentAlerts,
  useUpdateAlertThreshold,
  watchlistKeys,
  type WatchlistEntity,
  type EntityType,
  type WatchlistStats,
  type WatchlistData,
  type WatchlistQueryResult,
  type AddEntityInput,
} from "./useWatchlistQuery";

// Client Alerts queries
export {
  useClientAlertsQuery,
  useMarkAlertRead,
  useMarkAllAlertsRead,
  useDismissAlert,
  useToggleAlertActionable,
  clientAlertsKeys,
  type ClientAlert,
  type AlertSeverity,
  type AlertType,
  type AlertStats,
  type ClientAlertsData,
  type ClientAlertsQueryResult,
} from "./useClientAlertsQuery";

// Suggested Actions queries
export {
  useSuggestedActionsQuery,
  useMarkActionUsed,
  useMarkAllActionsUsed,
  useDismissAction,
  useUndoDismissAction,
  suggestedActionsKeys,
  getUrgencyLevel,
  type SuggestedAction,
  type ActionStatus,
  type ActionType as SuggestedActionType,
  type UrgencyLevel,
  type ActionStats,
  type SuggestedActionsData,
  type SuggestedActionsQueryResult,
} from "./useSuggestedActionsQuery";

// Opportunities queries
export {
  useOpportunitiesQuery,
  useMarkOpportunityComplete,
  useDismissOpportunity,
  useAssignOpportunity,
  useUpdateOpportunityNotes,
  useReactivateOpportunity,
  opportunitiesKeys,
  getPriorityLevel,
  type Opportunity,
  type OpportunityStatus,
  type OpportunityType,
  type PriorityLevel,
  type OpportunityStats,
  type OpportunitiesData,
  type OpportunitiesQueryResult,
} from "./useOpportunitiesQuery";

// Donor Journey queries
export {
  useDonorJourneyQuery,
  useRefreshJourneyData,
  useFlagCohort,
  donorJourneyKeys,
  type JourneyStage,
  type CohortType,
  type SegmentHealth,
  type TouchpointSummary,
  type DonorJourneyRecord,
  type DonorSegmentSummary,
  type FunnelStage,
  type RetentionMetrics,
  type JourneyStats,
  type DonorJourneyData,
  type DonorJourneyQueryResult,
} from "./useDonorJourneyQuery";

// Recurring Health V2 queries
export {
  useRecurringHealthQuery,
  type RecurringHealthV2Data,
} from "./useRecurringHealthQuery";

// ActBlue Canonical Rollup (SINGLE SOURCE OF TRUTH for ActBlue metrics)
export {
  useActBlueDailyRollupQuery,
  useActBluePeriodSummaryQuery,
  actBlueRollupKeys,
  type DailyRollupRow,
  type PeriodSummary,
  type ActBlueRollupData,
} from "./useActBlueDailyRollupQuery";

// Unified ActBlue Metrics (NEW - Phase 2 consolidated hook)
export {
  useActBlueMetrics,
  useActBlueSummary,
  useActBlueChannels,
  useActBlueDailyData,
  useSMSMetricsUnified,
  useClientHealth,
  actBlueMetricsKeys,
  type ActBlueSummary,
  type ActBluePreviousPeriod,
  type ActBlueTrends,
  type ActBlueDailyRollup,
  type ActBlueChannelBreakdown,
  type ActBlueAttribution,
  type ActBlueMetadata,
  type ActBlueMetricsData,
  type ActBlueMetricsDataWithSparklines,
  type SparklineData as ActBlueSparklineData,
  type SMSMetricsData,
  type ClientHealthData,
} from "@/hooks/useActBlueMetrics";

// Channel Detection Utility
export {
  detectChannel,
  aggregateByChannel,
  countByChannel,
  getChannelLabel,
  getChannelColor,
  type AttributionChannel,
  type ChannelDetectionInput,
} from "@/utils/channelDetection";

// Voter Impact Map queries
export {
  useVoterImpactStates,
  useVoterImpactDistricts,
  useDistrictsByState,
  useVoterImpactDistrict,
  type VoterImpactState,
  type VoterImpactDistrict,
} from "./useVoterImpactQueries";
