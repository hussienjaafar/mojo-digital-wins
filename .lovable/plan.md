

# Poll Visualization Optimization -- ECharts-Verified Fixes

## Research Summary

After reviewing the ECharts documentation and source code, the correct approaches are:

- **Bar value labels**: Use `series[].label.show = true` with `position: 'right'` for horizontal bars. The `formatter` callback receives `params.value` for custom formatting.
- **Reading order**: Use `yAxis.inverse = true` on the category axis so the first data item renders at the top (ECharts defaults to bottom-to-top for horizontal bars).
- **Hiding value axis**: Set `xAxis.show = false` (the value axis in horizontal mode) to reclaim space when inline labels are shown.

## Changes

### File 1: `src/components/charts/echarts/EChartsBarChart.tsx`

Add three new optional props:

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `showBarLabels` | boolean | false | Adds `label: { show: true, position: 'right', formatter }` to each series, rendering the value directly on the bar |
| `hideValueAxis` | boolean | false | Sets the value axis `show: false` to reclaim horizontal space |
| `inverseCategoryAxis` | boolean | false | Sets `inverse: true` on the category axis so data reads top-to-bottom |

Implementation details:
- In the `seriesConfig` map, when `showBarLabels` is true, add a `label` object to each series: `{ show: true, position: 'right', formatter: (params) => formatAxisValue(params.value), color: 'hsl(var(--portal-text-primary))', fontSize: 11 }`
- In `valueAxisConfig`, when `hideValueAxis` is true, set `show: false`
- In `categoryAxisConfig`, when `inverseCategoryAxis` is true, add `inverse: true`

### File 2: `src/pages/PollDetail.tsx`

**HorizontalBar renderer:**
- Enable `showBarLabels` always (values visible without hover)
- Enable `hideValueAxis` on mobile (reclaims ~40px for bars)
- Enable `inverseCategoryAxis` always (first item at top)
- Reduce `gridLeft` to `100` on mobile, keep `180` on desktop
- Truncate labels at 20 chars on mobile instead of 25

**GroupedBar renderer:**
- Enable `inverseCategoryAxis` always
- Enable `showBarLabels` always
- Reduce `gridLeft` to `120` on mobile

**Donut renderer:**
- Change `showLabels={!isMobile}` to `showLabels={true}` so mobile users can see percentages on slices
- Reduce `labelThreshold` to 5 so even smaller segments get labels

**StackedBar renderer:**
- Enable `showBarLabels` for value visibility

## Technical Detail: ECharts Label Configuration

Per ECharts docs, for horizontal bar charts the `label.position` supports: `'left'`, `'right'`, `'inside'`, `'insideLeft'`, `'insideRight'`. Using `'right'` places the label just past the end of the bar, which is ideal for poll percentages.

The `inverse` property on the category axis (yAxis for horizontal bars) flips the rendering order so `data[0]` appears at the top of the chart instead of the bottom.

## Visual Impact

- Users see exact percentages on every bar without needing to hover or tap
- Data reads top-to-bottom in the natural order it was defined (highest first, or logical grouping)
- Mobile gets more bar width by hiding the redundant x-axis when labels are already on bars
- Donut always shows segment percentages regardless of device

