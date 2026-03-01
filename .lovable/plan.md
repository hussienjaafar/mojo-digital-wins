

# Fix Pie/Donut Chart Labels -- Best Practice Approach

## Root Cause

The `alignTo: 'edge'` + `overflow: 'break'` configuration forces labels into extremely narrow columns at the container edges. On a ~390px mobile screen with a 60% radius donut, there's only ~30px of horizontal space per label, causing vertical character-by-character wrapping ("N-e-i-t-h-e-r").

## ECharts Best Practice for Pie Labels

The recommended approach depends on screen size and number of data items:

- **Desktop**: Outside labels with `alignTo: 'labelLine'` (default) work well. The labels float near their connector lines with natural width.
- **Mobile**: For donut charts with 3-5 items, **hide outside labels entirely** and let the legend + tooltip convey the data. This is the standard pattern used in responsive chart implementations.

## Solution

### File 1: `src/components/charts/echarts/EChartsPieChart.tsx`

**Remove problematic label config and make labels responsive:**

1. Remove `alignTo: 'edge'`, `edgeDistance`, and `overflow: 'break'` -- these cause the vertical wrapping issue
2. Add an optional `hideLabels` prop (or detect from a new `compact` prop) so callers can disable labels on mobile
3. Restore `outerRadius` to `"70%"` (desktop) / keep `"60%"` only when labels are shown, to maximize chart size when labels are hidden
4. Use default `alignTo: 'labelLine'` positioning (ECharts default) which lets labels float naturally near their connector lines
5. Keep `labelLine.length` and `length2` at reasonable defaults (20, 15) for proper spacing

**Label config changes:**
```typescript
label: showLabels
  ? {
      show: true,
      position: "outside",
      // NO alignTo, NO edgeDistance, NO overflow -- use ECharts defaults
      formatter: (params) => {
        const percent = ((params.value / total) * 100);
        if (percent < labelThreshold) return "";
        return `{name|${params.name}}\n{value|${percent.toFixed(1)}%}`;
      },
      rich: {
        name: {
          fontSize: 11,
          color: "hsl(var(--portal-text-secondary))",
          lineHeight: 16,
        },
        value: {
          fontSize: 12,
          fontWeight: 600,
          color: "hsl(var(--portal-text-primary))",
          lineHeight: 18,
        },
      },
    }
  : { show: false },
```

**Radius logic:**
```typescript
const outerRadius = showLabels
  ? (showLegend && legendPosition === "right" ? "55%" : "65%")
  : (showLegend && legendPosition === "right" ? "65%" : "75%");
```

When labels are hidden, the donut can be larger since it doesn't need label clearance.

### File 2: `src/pages/PollDetail.tsx`

**Make donut labels responsive:**
- On mobile: `showLabels={false}` -- rely on legend (already shown) + tooltip for data
- On desktop: `showLabels={true}` -- outside labels work fine with sufficient space
- Revert height to `isMobile ? 280 : 320` since labels are hidden on mobile (less vertical space needed)

```typescript
<EChartsPieChart
  data={section.data}
  variant="donut"
  height={isMobile ? 280 : 340}
  showLabels={!isMobile}    // Hide labels on mobile, show on desktop
  showLegend
  valueType="percent"
  showPercentage
  labelThreshold={5}
/>
```

## Summary

| Aspect | Before (broken) | After (best practice) |
|--------|-----------------|----------------------|
| Mobile labels | Vertical char wrapping | Hidden; legend + tooltip instead |
| Desktop labels | Edge-aligned, cramped | Natural float near connector lines |
| Mobile radius | 60% (small, wasted space) | 75% (larger, fills card) |
| Desktop radius | 60% | 65% (room for floating labels) |
| Label formatting | Plain text | Rich text with name/value styling |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/charts/echarts/EChartsPieChart.tsx` | Remove alignTo/edge/overflow; use default label positioning; adjust radius based on showLabels; add rich text formatting |
| `src/pages/PollDetail.tsx` | Pass `showLabels={!isMobile}` for donut charts; adjust height |

