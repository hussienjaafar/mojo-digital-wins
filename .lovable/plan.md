

# Fix Pie/Donut Chart Label Clipping and Visual Upgrades

## Problems

1. **Labels cut off**: The outer labels extend beyond the chart container because the pie `outerRadius` is "75%" -- too large, leaving insufficient room for "outside" labels and their connector lines.
2. **Label percentages lack precision**: The formatter uses `toFixed(0)`, showing "59%" instead of "59.3%".
3. **No label overflow handling**: ECharts clips labels that extend beyond the chart boundary. There is no `alignTo` or `overflow` config to manage long label text.

## Solution

### File 1: `src/components/charts/echarts/EChartsPieChart.tsx`

**Reduce pie radius to make room for labels:**
- Change `outerRadius` from `"75%"` to `"60%"` (or `"65%"` when legend is on the right)
- This gives labels ~35% of the container width on each side

**Use `alignTo: 'edge'` for label positioning:**
- ECharts supports `label.alignTo = 'edge'` which forces labels to align to the left/right edges of the chart container instead of floating freely. This prevents clipping.
- Add `label.edgeDistance: 10` for a small margin from the container edge

**Add `overflow: 'break'` to labels:**
- Long label names (like "Less Likely") will wrap instead of clipping

**Increase label precision:**
- Change `percent.toFixed(0)` to `percent.toFixed(1)` in the label formatter so "59%" becomes "59.3%"

**Increase label line length:**
- Set `labelLine.length: 15` and `labelLine.length2: 10` so connector lines reach the edge-aligned labels cleanly

**Specific code changes in the `option` useMemo (series[0]):**

```typescript
label: showLabels ? {
  show: true,
  position: "outside",
  alignTo: "edge",        // NEW: align to container edges
  edgeDistance: 10,        // NEW: margin from edge
  overflow: "break",      // NEW: wrap long names
  formatter: (params: any) => {
    const percent = ((params.value / total) * 100);
    if (percent < labelThreshold) return "";
    return `${params.name}\n${percent.toFixed(1)}%`;  // CHANGED: 1 decimal
  },
  color: "hsl(var(--portal-text-secondary))",
  fontSize: 11,
  lineHeight: 16,
} : { show: false },

labelLine: showLabels ? {
  show: true,
  length: 15,             // NEW: first segment length
  length2: 10,            // NEW: second segment length
  lineStyle: {
    color: "hsl(var(--portal-border))",
  },
} : { show: false },
```

**Update radius values:**
```typescript
const outerRadius = showLegend && legendPosition === "right" ? "55%" : "60%";
```

### File 2: `src/pages/PollDetail.tsx`

**Increase donut chart height to give labels more vertical room:**
- Change `height={isMobile ? 280 : 320}` to `height={isMobile ? 320 : 360}`

## Summary of Changes

| Change | Before | After |
|--------|--------|-------|
| outerRadius | 75% | 60% (65% with right legend) |
| Label alignment | Free-floating (clips) | `alignTo: 'edge'` with 10px margin |
| Label overflow | Clipped | `overflow: 'break'` (wraps) |
| Label precision | 59% | 59.3% |
| Label line lengths | Default | `length: 15`, `length2: 10` |
| Donut height (mobile) | 280px | 320px |
| Donut height (desktop) | 320px | 360px |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/charts/echarts/EChartsPieChart.tsx` | Smaller radius, edge-aligned labels, overflow wrap, 1-decimal precision, explicit label line lengths |
| `src/pages/PollDetail.tsx` | Taller donut chart heights |

