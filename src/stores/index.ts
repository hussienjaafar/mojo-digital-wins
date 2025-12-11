// Dashboard Store
export {
  useDashboardStore,
  // Date range
  useDateRange,
  // Channel filter
  useSelectedChannel,
  // View mode
  useViewMode,
  // Refresh
  useRefreshKey,
  // Comparison
  useComparisonEnabled,
  // KPI highlighting (new)
  useSelectedKpiKey,
  useHighlightedKpiKey,
  useHighlightedDate,
  useIsDrilldownOpen,
  useHighlightedSeriesKeys,
  useIsSeriesDimmed,
  // Mappings
  KPI_TO_SERIES_MAP,
  SERIES_TO_KPI_MAP,
} from "./dashboardStore";

// Types
export type {
  ChannelFilter,
  ViewMode,
  KpiKey,
  SeriesKey,
} from "./dashboardStore";

// Chart Interaction Store
export {
  useChartInteractionStore,
  useHoveredDataPoint,
  useSelectedTimeRange,
  useHighlightedSeries,
  useBrushMode,
} from "./chartInteractionStore";

export type {
  HoveredDataPoint,
  SelectedTimeRange,
} from "./chartInteractionStore";
