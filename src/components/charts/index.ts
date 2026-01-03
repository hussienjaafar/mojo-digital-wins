// =============================================================================
// V3 Chart Design System - Primary Components
// =============================================================================
// All charts use ECharts. See docs/V3_CHART_STANDARDS.md for usage guidelines.

// ECharts components (V3 Standard)
export * from "./echarts";

// Chart shell components
export {
  ChartPanel,
  type ChartPanelProps,
  type ChartPanelStatus,
  type ChartPanelTrend
} from "./ChartPanel";

// Advanced charts
export { CalendarHeatmap, type CalendarHeatmapProps, type HeatmapDataPoint } from "./CalendarHeatmap";
export { 
  V3TimeHeatmap, 
  V3TimeHeatmapLegend, 
  V3TimeHeatmapPeakChips, 
  V3TimeHeatmapDetailsPanel,
  V3TimeHeatmapMetricToggle,
  type V3TimeHeatmapProps,
  type V3TimeHeatmapLegendProps,
  type V3TimeHeatmapPeakChipsProps,
  type V3TimeHeatmapDetailsPanelProps,
  type V3TimeHeatmapMetricToggleProps,
} from "./V3TimeHeatmap";

// V3 Premium Charts
export { V3BarChart, type V3BarChartProps, type V3BarValueType } from "./V3BarChart";
export { V3StageChart, type V3StageChartProps, type V3StageValueType } from "./V3StageChart";
export { V3FunnelChart, type V3FunnelChartProps, type V3FunnelValueType } from "./V3FunnelChart";

// Bar chart utilities
export {
  processBarChartData,
  truncateLabel,
  createLabelFormatter,
  calculatePercentOfTotal,
  normalizeCategory,
  mergeDuplicateCategories,
  type BarDataItem,
  type ProcessedBarData,
  type BarChartProcessOptions,
} from "@/lib/bar-chart-utils";

// Funnel chart utilities
export {
  analyzeFunnel,
  isSequentialFunnel,
  findInvalidStages,
  funnelToRankedBars,
  formatConversionRate,
  getDropOffSeverity,
  getSeverityColor,
  type FunnelStage,
  type ProcessedFunnelStage,
  type FunnelAnalysis,
} from "@/lib/funnel-chart-utils";

// Heatmap utilities
export {
  type HeatmapDataPoint as V3HeatmapDataPoint,
  type HeatmapMetric,
  type RankedCell,
  type ProcessedHeatmapData,
  type HeatmapStats,
  normalizeHeatmapData,
  transformGridForMetric,
  processHeatmapData,
  calculateHeatmapStats,
  getRankedCells,
  getCellRank,
  exportHeatmapToCSV,
  formatTimeSlot,
  formatTimeSlotShort,
  getMetricLabel,
  DAY_LABELS_SHORT,
  DAY_LABELS_FULL,
  HOUR_LABELS_SHORT,
  HOUR_LABELS_FULL,
  TOTAL_TIME_SLOTS,
} from "@/lib/heatmap-utils";

// US Choropleth Map (react-simple-maps based - recommended)
export { USChoroplethMap, type USChoroplethMapProps, type ChoroplethDataItem, type MapMetricMode } from "./USChoroplethMap";
export { USMapLegend, type USMapLegendProps, type LegendBucket } from "./USMapLegend";

// Tooltip utilities
export { ResponsiveChartTooltip, CurrencyTooltip, PercentTooltip, NumberTooltip } from "./ResponsiveChartTooltip";

// Re-export formatters for convenience
export { 
  formatCurrency, 
  formatNumber, 
  formatPercent, 
  formatRatio,
  formatCompact,
  formatValue,
  getYAxisFormatter,
  getTooltipFormatter,
  type ValueType 
} from "@/lib/chart-formatters";
