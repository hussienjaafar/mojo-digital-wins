

# Fix Unreadable Stacked Bar Chart Labels

## Problem

The stacked horizontal bar chart ("Sam Rasoul Favorability") has `showBarLabels` enabled with `position: 'right'`. For stacked bars, this places every segment's label at the right edge of that segment, causing all labels to overlap into an unreadable mess (visible in the screenshot: "27.0% 22.0% 10.0% ...%" all crammed together).

## Root Cause

In `EChartsBarChart.tsx` (lines 174-182), the label config applies uniformly:

```typescript
label: {
  show: true,
  position: horizontal ? 'right' : 'top',  // All labels go to 'right'
  formatter: (params) => formatTooltipValue(params.value),
}
```

For stacked bars, each segment's label is placed at the right end of that segment. Since segments are adjacent, labels overlap.

## Solution

### File: `src/components/charts/echarts/EChartsBarChart.tsx`

Detect stacked series and adjust label behavior:

1. **Position labels inside the bar segment** (`position: 'inside'`) when the series has a `stack` property
2. **Hide labels for small segments** -- if the segment value is below a threshold (e.g., less than 5% of the total or less than 8 units), return an empty string from the formatter to avoid cramming tiny labels
3. **Keep `position: 'right'` only for non-stacked bars** (current behavior, works fine)

```typescript
// In the showBarLabels block:
const isStacked = !!s.stack;
label: {
  show: true,
  position: isStacked
    ? 'inside'                          // Inside the segment for stacked
    : (horizontal ? 'right' : 'top'),   // Outside for non-stacked
  formatter: (params) => {
    const val = typeof params.value === 'object' ? params.value.value : params.value;
    // Hide label if segment is too small to fit text
    if (isStacked && val < 5) return '';
    return formatTooltipValue(val, s.name);
  },
  color: isStacked ? '#fff' : 'hsl(var(--portal-text-primary))',
  fontSize: 11,
  fontWeight: isStacked ? 600 : undefined,
}
```

This means:
- **27%** and **22%** segments: Labels show inside as white text (large enough)
- **10%** segment: Shows inside (value >= 5)
- **1%** segments: Labels hidden (too small to read anyway; data accessible via tooltip)

### No data file changes needed

The poll data and component wiring in `PollDetail.tsx` are correct. The fix is entirely in the bar chart component's label positioning logic.

## Files Modified

| File | Change |
|------|--------|
| `src/components/charts/echarts/EChartsBarChart.tsx` | Use `position: 'inside'` for stacked bar labels; hide labels on small segments; white text for contrast against colored bars |

