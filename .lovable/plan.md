
# Audit: Fix Legend-to-Bar Color Mismatch Across All Charts

## Problem

In `EChartsBarChart.tsx`, bar colors are set **only** at the per-data-point level inside each series' `data` array. The ECharts legend component does not read per-item colors -- it reads the series-level `color` or `itemStyle.color` property. When these are missing, the legend falls back to ECharts' built-in default palette, causing mismatches.

**Visible bug (screenshot):** "Post-Info Ballot" legend icon shows GREEN, but bars are PURPLE.

## Root Cause

```typescript
// Current code (line 137-149) - color only on per-item itemStyle
seriesConfig = series.map((s, index) => ({
  name: s.name,
  data: data.map((d) => ({
    value,
    itemStyle: {
      color: s.color || colorPalette[index % colorPalette.length],  // per-item only
    },
  })),
  // NO series-level color property -- legend can't find it
}));
```

## Fix

### File: `src/components/charts/echarts/EChartsBarChart.tsx`

Add a top-level `color` (or `itemStyle.color`) property to each series config so the legend picks up the correct color:

```typescript
const seriesConfig = series.map((s, index) => {
  const seriesColor = s.color || colorPalette[index % colorPalette.length];
  return {
    name: s.name,
    type: "bar",
    color: seriesColor,   // <-- ADD THIS: series-level color for legend
    data: data.map((d) => {
      const value = d[s.dataKey] as number;
      const isHighlighted = enableCrossHighlight && hoveredDataPoint?.date === d[xAxisKey];
      return {
        value,
        itemStyle: {
          color: seriesColor,
          opacity: enableCrossHighlight && hoveredDataPoint && !isHighlighted ? 0.4 : 1,
        },
      };
    }),
    // ... rest unchanged
  };
});
```

### Pie Chart (`EChartsPieChart.tsx`) -- No Change Needed

Pie charts handle legend colors correctly because ECharts pie series use per-item colors for legend icons (each data point is its own legend entry). Verified the donut data in both polls:

- **VA-6 Candidate Type**: Progressive (blue), Experienced Leader (purple), Political Outsider (gray) -- colors are explicit in data
- **IL-9 AIPAC Impact**: Less Likely (red), Neither (gray), More Likely (green) -- colors are explicit in data

Both use `itemStyle.color` per data item, which ECharts pie legend reads correctly.

### Stacked Bar -- Same Fix Applies

The stacked bar (Rasoul Favorability) uses the same `EChartsBarChart` component, so the series-level color fix covers it too. Its series define explicit colors (`#22c55e`, `#86efac`, `#fbbf24`, `#fb923c`, `#ef4444`), which will now also appear correctly in the legend.

## Summary

| Chart Type | Issue | Fix |
|-----------|-------|-----|
| Grouped Bar (VA-6 Ballot Test) | Legend green, bars purple | Add series-level `color` property |
| Stacked Bar (Rasoul Favorability) | Same potential mismatch | Same fix (shared component) |
| Horizontal Bar (all) | Same potential mismatch | Same fix (shared component) |
| Donut/Pie (all) | No issue | No change needed |

## Files Modified

| File | Change |
|------|--------|
| `src/components/charts/echarts/EChartsBarChart.tsx` | Add series-level `color` property so legend icons match bar colors |
