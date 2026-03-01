
# Fix: Bar Graying Out on Hover

## Problem

Even after changing `focus` to `"self"` and removing the axis pointer shadow, hovering a bar still causes it to appear grayed out. This is ECharts' default emphasis behavior -- it applies a built-in color shift (desaturation/lightening) to the hovered item.

## Fix

**File: `src/components/charts/echarts/EChartsBarChart.tsx`**

Update the `emphasis.itemStyle` to explicitly preserve the bar's original color and add a subtle brightness boost instead of the default gray shift. The key is adding `color: "inherit"` (which tells ECharts to keep the series color) and using `opacity` or `shadowBlur` for the hover indicator instead of letting ECharts apply its default color transformation.

```typescript
emphasis: disableHoverEmphasis
  ? { disabled: true }
  : {
      focus: "none" as const,
      itemStyle: {
        color: "inherit",
        borderColor: "rgba(255, 255, 255, 0.3)",
        borderWidth: 1,
        shadowBlur: 8,
        shadowColor: "rgba(0, 0, 0, 0.2)",
      },
    },
```

Changes:
- `focus: "none"` -- no blur/fade effect on any elements
- `color: "inherit"` -- keeps the bar's original color on hover instead of ECharts applying a gray tint
- Subtle white border and shadow provide hover feedback without changing the bar color

## Files Modified

| File | Change |
|------|--------|
| `src/components/charts/echarts/EChartsBarChart.tsx` | Update emphasis itemStyle to preserve bar color on hover |
