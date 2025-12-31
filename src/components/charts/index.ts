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
