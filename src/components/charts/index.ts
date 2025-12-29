// =============================================================================
// V3 Chart Design System - Primary Components
// =============================================================================
// These are the recommended chart components for all new development.
// See docs/V3_CHART_STANDARDS.md for usage guidelines.

// ECharts components (V3 Standard - Use These)
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


// =============================================================================
// Legacy Components (Deprecated)
// =============================================================================
// These components are deprecated and will be removed in a future release.
// Migrate to ECharts equivalents as described in docs/V3_CHART_STANDARDS.md

// @deprecated - use EChartsLineChart from @/components/charts/echarts
export { ResponsiveLineChart } from "./ResponsiveLineChart";

// @deprecated - use EChartsBarChart from @/components/charts/echarts
export { ResponsiveBarChart } from "./ResponsiveBarChart";

// @deprecated - use EChartsPieChart from @/components/charts/echarts
export { ResponsivePieChart } from "./ResponsivePieChart";

// Legacy tooltip (deprecated - use ResponsiveChartTooltip)
export { 
  CustomChartTooltip, 
  CurrencyChartTooltip, 
  PercentageChartTooltip, 
  NumberChartTooltip 
} from "./CustomChartTooltip";

// Tremor components (external library - use for specific Tremor patterns only)
export * from "./tremor";
