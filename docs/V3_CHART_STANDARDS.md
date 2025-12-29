# V3 Chart Design System Standards

This document defines the official chart design system for all client dashboard visualizations. All new charts must follow these standards, and existing charts should be migrated.

## 1. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Rendering** | ECharts 6.x (via `echarts-for-react`) | High-performance SVG charts |
| **Base Component** | `EChartsBase` | Portal theme, loading states, SVG renderer |
| **Wrapper** | `V3ChartWrapper` | Accessibility, title/description, actions |
| **Formatters** | `@/lib/chart-formatters` | Consistent number/currency/percent formatting |
| **Colors** | `@/lib/design-tokens` | Portal-themed color palette |

## 2. Component Hierarchy

```
V3ChartWrapper (accessibility, header, actions)
  └─ ECharts[Type]Chart (data visualization logic)
       └─ EChartsBase (portal theme, SVG renderer, resize handling)
```

**Always use this hierarchy** - never use raw `ReactECharts` directly.

## 3. Available Chart Components

### Core Charts

| Component | Import | Use Case | Key Props |
|-----------|--------|----------|-----------|
| `EChartsLineChart` | `@/components/charts/echarts` | Time series, trends | `xAxisType`, `dualYAxis`, `showRollingAverage` |
| `EChartsBarChart` | `@/components/charts/echarts` | Comparisons, rankings | `horizontal`, `valueType`, `enableCrossHighlight` |
| `EChartsPieChart` | `@/components/charts/echarts` | Distribution, composition | `variant` ("pie" \| "donut"), `showPercentage` |
| `EChartsFunnelChart` | `@/components/charts/echarts` | Conversion flows | `showConversionRates`, `orientation` |

### Tables

| Component | Import | Use Case | Key Props |
|-----------|--------|----------|-----------|
| `V3DataTable` | `@/components/v3` | Tabular data, lists | `columns`, `sortable`, `onRowClick` |

## 4. Color Standards

### Using the Color Palette

```typescript
import { getChartColors } from "@/lib/design-tokens";

const colors = getChartColors();
// Returns: ["hsl(var(--portal-accent-blue))", "hsl(var(--portal-accent-purple))", ...]
```

### Color Order (Semantic)

1. **Blue** (`--portal-accent-blue`) - Primary metric
2. **Purple** (`--portal-accent-purple`) - Secondary metric
3. **Green** (`--portal-success`) - Positive/success
4. **Amber** (`--portal-warning`) - Warning/caution
5. **Red** (`--portal-error`) - Negative/critical
6. **Cyan** (`--portal-accent-cyan`) - Tertiary

### Rules

- ✅ **DO**: Use `getChartColors()` for consistent palette
- ✅ **DO**: Use CSS variables for all colors
- ❌ **DON'T**: Hardcode hex colors in components
- ❌ **DON'T**: Create one-off color arrays

## 5. Tooltip Standards

All ECharts components use the portal-themed tooltip defined in `EChartsBase`:

```typescript
tooltip: {
  backgroundColor: "hsl(var(--portal-bg-secondary) / 0.95)",
  borderColor: "hsl(var(--portal-border) / 0.5)",
  borderWidth: 1,
  borderRadius: 8,
  padding: [12, 16],
  textStyle: {
    color: "hsl(var(--portal-text-primary))",
    fontSize: 13,
  },
  extraCssText: "backdrop-filter: blur(12px); box-shadow: 0 4px 24px hsl(var(--portal-shadow) / 0.15);",
}
```

### Custom Tooltip Formatting

Use `tooltipFormatter` prop for custom formatting:

```typescript
<EChartsLineChart
  tooltipFormatter={(params) => `${params.name}: ${formatCurrency(params.value)}`}
/>
```

## 6. Accessibility Requirements

### Mandatory

1. **Wrap in V3ChartWrapper** with:
   - `title` - Chart title for header
   - `ariaLabel` - Screen reader description of chart purpose
   - `description` - Hidden description for assistive tech (optional)
   - `dataSummary` - Text summary of data for screen readers (optional)

2. **SVG Renderer** - Default in EChartsBase (not Canvas)

3. **Color Contrast** - Minimum 4.5:1 for all text elements

### Example

```tsx
<V3ChartWrapper
  title="Monthly Revenue"
  icon={DollarSign}
  ariaLabel="Line chart showing monthly revenue trends over the past 12 months"
  description="Revenue increased 15% compared to the previous period"
  dataSummary="Total revenue: $1.2M. Peak month: December with $150K."
>
  <EChartsLineChart
    data={revenueData}
    xAxisKey="month"
    series={[{ dataKey: "revenue", name: "Revenue" }]}
  />
</V3ChartWrapper>
```

## 7. Responsive Behavior

### Automatic Handling

- Charts auto-resize via `ReactECharts` resize observer
- EChartsBase handles resize cleanup properly

### Mobile Considerations

| Situation | Recommendation |
|-----------|----------------|
| Chart has >8 data points | Use `showAllLabels={false}` |
| Chart has long labels | Use `horizontal={true}` layout |
| Chart is in a card | Set explicit `height` prop |
| Data is complex | Consider `V3DataTable` as mobile fallback |

### Example Mobile-Responsive Chart

```tsx
const isMobile = useIsMobile();

<EChartsBarChart
  data={data}
  horizontal={isMobile}  // Horizontal on mobile
  height={isMobile ? 250 : 350}
  showLegend={!isMobile}  // Hide legend on mobile
/>
```

## 8. Value Formatting

### Value Types

```typescript
type ValueType = "number" | "currency" | "percent" | "ratio" | "compact";
```

### Usage

```tsx
<EChartsBarChart
  data={data}
  valueType="currency"  // Formats as $1,234.56
/>
```

### Formatters Available

```typescript
import { 
  formatCurrency,   // $1,234.56
  formatNumber,     // 1,234
  formatPercent,    // 45.2%
  formatRatio,      // 1.23x
  formatCompact,    // 1.2K, 3.4M
  getYAxisFormatter,
  getTooltipFormatter,
} from "@/lib/chart-formatters";
```

## 9. Loading & Empty States

### Automatic via V3ChartWrapper

```tsx
<V3ChartWrapper
  title="Chart Title"
  isLoading={isLoading}  // Shows skeleton
>
  {data.length === 0 ? (
    <V3EmptyState message="No data available" />
  ) : (
    <EChartsLineChart data={data} />
  )}
</V3ChartWrapper>
```

### EChartsBase Loading

EChartsBase also has built-in ECharts loading animation:

```tsx
<EChartsLineChart
  isLoading={isFetching}  // Shows ECharts loading spinner
/>
```

## 10. Migration Guide

### From Recharts

```tsx
// Before (Recharts)
import { LineChart, Line, XAxis, YAxis } from "recharts";

<ResponsiveContainer>
  <LineChart data={data}>
    <XAxis dataKey="date" />
    <YAxis />
    <Line dataKey="value" stroke="#8884d8" />
  </LineChart>
</ResponsiveContainer>

// After (ECharts V3)
import { EChartsLineChart } from "@/components/charts/echarts";
import { V3ChartWrapper } from "@/components/v3";

<V3ChartWrapper title="Trend" ariaLabel="Line chart showing trend">
  <EChartsLineChart
    data={data}
    xAxisKey="date"
    series={[{ dataKey: "value", name: "Value" }]}
  />
</V3ChartWrapper>
```

### From Portal Charts

```tsx
// Before (PortalBarChart)
import { PortalBarChart } from "@/components/portal/PortalBarChart";

<PortalBarChart
  data={data}
  enableCrossHighlight
/>

// After (ECharts V3)
import { EChartsBarChart } from "@/components/charts/echarts";

<V3ChartWrapper title="Comparison" ariaLabel="Bar chart comparison">
  <EChartsBarChart
    data={data}
    xAxisKey="name"
    series={[{ dataKey: "value", name: "Value" }]}
    enableCrossHighlight
  />
</V3ChartWrapper>
```

## 11. Deprecated Components

The following components are **deprecated** and should not be used in new code:

| Deprecated | Replacement |
|------------|-------------|
| `ResponsiveLineChart` | `EChartsLineChart` |
| `ResponsiveBarChart` | `EChartsBarChart` |
| `ResponsivePieChart` | `EChartsPieChart` |
| `PortalLineChart` | `EChartsLineChart` |
| `PortalBarChart` | `EChartsBarChart` |
| `PortalPieChart` | `EChartsPieChart` |
| `PortalMultiBarChart` | `EChartsBarChart` |
| `MemoizedLineChart` | `EChartsLineChart` |
| `MemoizedBarChart` | `EChartsBarChart` |
| `MemoizedAreaChart` | `EChartsLineChart` (with `areaStyle`) |

## 12. Quick Reference

### Minimal Line Chart

```tsx
<V3ChartWrapper title="Trend" ariaLabel="Trend chart">
  <EChartsLineChart
    data={data}
    xAxisKey="date"
    series={[{ dataKey: "value", name: "Metric" }]}
  />
</V3ChartWrapper>
```

### Minimal Bar Chart

```tsx
<V3ChartWrapper title="Comparison" ariaLabel="Bar comparison">
  <EChartsBarChart
    data={data}
    xAxisKey="category"
    series={[{ dataKey: "count", name: "Count" }]}
  />
</V3ChartWrapper>
```

### Minimal Pie Chart

```tsx
<V3ChartWrapper title="Distribution" ariaLabel="Distribution pie chart">
  <EChartsPieChart
    data={data}
    nameKey="name"
    valueKey="value"
  />
</V3ChartWrapper>
```

### Minimal Funnel Chart

```tsx
<V3ChartWrapper title="Conversion Funnel" ariaLabel="Conversion funnel">
  <EChartsFunnelChart
    data={stages}
    nameKey="stage"
    valueKey="count"
    showConversionRates
  />
</V3ChartWrapper>
```

### Minimal Data Table

```tsx
<V3DataTable
  data={items}
  columns={[
    { key: "name", header: "Name", sortable: true },
    { key: "value", header: "Value", align: "right" },
  ]}
/>
```

---

## Changelog

- **v3.0.0** (2024-12) - Initial V3 chart design system
  - Added EChartsPieChart, EChartsFunnelChart
  - Added V3DataTable
  - Deprecated Recharts-based components
  - Established color and accessibility standards
