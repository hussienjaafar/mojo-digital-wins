

# Fix: Bars Appearing to Disappear on Hover

## Problem

When hovering over a horizontal bar, the tooltip's `axisPointer` with `type: "shadow"` draws a dark semi-transparent rectangle across the entire row. This shadow overlays the bar itself, causing it to appear gray/faded (visible in the screenshot where "Daniel Biss" bar turns gray). The previous fix (`emphasis.focus: "self"`) addressed one layer of the problem but not this one.

## Root Cause

In `EChartsBarChart.tsx` line 270, the tooltip axis pointer is configured as:

```typescript
axisPointer: { type: "shadow" as const }
```

For horizontal bar charts, this shadow fills the entire y-axis band behind the hovered category row, which visually covers and darkens the bar.

## Fix

**File: `src/components/charts/echarts/EChartsBarChart.tsx`**

Change the axis pointer type from `"shadow"` to `"line"` for horizontal bar charts. For vertical bars, `"shadow"` is acceptable since the shadow sits behind the bar. For horizontal bars, a vertical line indicator (or `"none"`) avoids obscuring the data.

```typescript
axisPointer: disableHoverEmphasis
  ? { type: "none" as const }
  : { type: horizontal ? "line" as const : "shadow" as const }
```

Alternatively, if the line looks too noisy, use `"none"` universally since the tooltip itself provides enough context.

This is a single-line change in the tooltip configuration block.

## Files Modified

| File | Change |
|------|--------|
| `src/components/charts/echarts/EChartsBarChart.tsx` | Change axisPointer type to `"line"` (or `"none"`) for horizontal bars to prevent shadow from obscuring bars on hover |

