// Responsive chart components
export { ResponsiveLineChart } from "./ResponsiveLineChart";
export { ResponsiveBarChart } from "./ResponsiveBarChart";
export { ResponsivePieChart } from "./ResponsivePieChart";
export { ResponsiveChartTooltip, CurrencyTooltip, PercentTooltip, NumberTooltip } from "./ResponsiveChartTooltip";

// Legacy tooltip (keeping for backward compatibility)
export { 
  CustomChartTooltip, 
  CurrencyChartTooltip, 
  PercentageChartTooltip, 
  NumberChartTooltip 
} from "./CustomChartTooltip";

// ECharts components
export * from "./echarts";

// Tremor components (modern dashboard charts)
export * from "./tremor";

// Advanced charts
export { CalendarHeatmap, type CalendarHeatmapProps, type HeatmapDataPoint } from "./CalendarHeatmap";

// Chart shell components
export {
  ChartPanel,
  type ChartPanelProps,
  type ChartPanelStatus,
  type ChartPanelTrend
} from "./ChartPanel";

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
