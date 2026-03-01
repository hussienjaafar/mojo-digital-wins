
# Fix: Bars Disappearing on Hover

## Problem

When hovering over a bar in any bar chart, other bars fade out dramatically due to ECharts' `emphasis.focus: "series"` setting. For single-series charts (most poll charts), this makes non-hovered bars appear to vanish since ECharts blurs sibling data points.

## Root Cause

In `EChartsBarChart.tsx` (lines 160-168), the emphasis config uses `focus: "series"`:

```typescript
emphasis: {
  focus: "series",       // <-- tells ECharts to blur everything except the hovered series
  itemStyle: {
    shadowBlur: 10,
    shadowColor: "rgba(0, 0, 0, 0.3)",
  },
},
```

Per ECharts docs, `focus: "series"` means: "when one element is hovered, fade out all other series." For multi-series grouped bars this can work, but for single-series charts it creates confusing visual behavior where bars seem to disappear.

## Fix

**File: `src/components/charts/echarts/EChartsBarChart.tsx`**

Change `focus: "series"` to `focus: "self"` (or remove it entirely). With `focus: "self"`, only the hovered bar gets the emphasis highlight effect, while all other bars remain at full opacity -- no blurring or fading.

```typescript
emphasis: disableHoverEmphasis
  ? { disabled: true }
  : {
      focus: "self",   // Only highlight the hovered bar, don't blur others
      itemStyle: {
        shadowBlur: 10,
        shadowColor: "rgba(0, 0, 0, 0.3)",
      },
    },
```

This is a one-line change (`"series"` to `"self"`) that fixes all bar charts using this component.

## Files Modified

| File | Change |
|------|--------|
| `src/components/charts/echarts/EChartsBarChart.tsx` | Change `emphasis.focus` from `"series"` to `"self"` |
