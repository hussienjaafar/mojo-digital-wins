
# Fix Poll Chart Readability -- Final Pass

## Problems Identified

From the mobile and desktop screenshots:

1. **Labels truncated to meaninglessness on mobile**: "Israel is committi...", "President has too ..." -- users can't understand the data. Truncating at 18 chars destroys meaning.
2. **Bar values rounded too aggressively**: Shows "41%" instead of "41.4%" because `formatAxisValue` uses `formatPercent(value, 0)` (0 decimal places).
3. **Value axis redundant**: The x-axis showing 0%, 10%, 20%... is unnecessary when every bar already has its value labeled. This wastes horizontal space.
4. **gridLeft too large on mobile**: 100-120px for labels on a 390px screen leaves bars cramped.

## Solution

### File 1: `src/pages/PollDetail.tsx`

**Mobile label strategy -- multi-line wrapping instead of truncation:**
- Instead of truncating labels (which destroys meaning), use ECharts' `\n` line-break support in the `xAxisLabelFormatter` to wrap long labels into 2 lines at ~20 chars
- Example: "President has too much unchecked power" becomes "President has too much\nunchecked power"
- This preserves full meaning while fitting the space

**Hide value axis on ALL bar charts** (not just mobile horizontal bars):
- When `showBarLabels` is true, the value axis is always redundant
- Set `hideValueAxis={true}` on all horizontal bar charts (both mobile and desktop)
- This reclaims ~60px of horizontal space on desktop and ~40px on mobile

**Reduce gridLeft further on mobile:**
- HorizontalBar: `gridLeft={isMobile ? 90 : 160}`
- Top Issues / GroupedBar: `gridLeft={isMobile ? 100 : 160}`

### File 2: `src/components/charts/echarts/EChartsBarChart.tsx`

**Add `barLabelPrecision` prop (optional number, default 0):**
- Controls decimal places in bar label formatter
- Poll data passes `barLabelPrecision={1}` to show "41.4%" instead of "41%"
- The formatter will use `formatPercent(value, barLabelPrecision)` instead of `formatPercent(value, 0)`

**Alternatively (simpler approach):** Change the bar label formatter to use `formatTooltipValue` instead of `formatAxisValue`, since tooltip already uses 1 decimal for percent. This avoids adding a new prop.

### File 3: No new files needed

## Detailed Changes

### `EChartsBarChart.tsx`
- In the `showBarLabels` label config, change the formatter from `formatAxisValue(...)` to `formatTooltipValue(...)` so bar labels show "31.0%" instead of "31%"
- This gives users the precision they need to read exact poll results

### `PollDetail.tsx`

**xAxisLabelFormatter** -- Replace truncation with word-wrap:
```
// Old: truncate
(v: string) => v.length > 18 ? v.slice(0, 16) + "..." : v

// New: wrap at ~20 chars on mobile, ~30 on desktop
(v: string) => {
  if (v.length <= 20) return v;
  const mid = v.lastIndexOf(' ', 20);
  if (mid === -1) return v.slice(0, 18) + '...';
  return v.slice(0, mid) + '\n' + v.slice(mid + 1);
}
```

**hideValueAxis** -- Enable for all horizontal bar charts (not just mobile):
- `hideValueAxis` on HorizontalBar and Top Issues charts always, since bar labels make the axis redundant

**gridLeft adjustments:**
- HorizontalBar: `isMobile ? 90 : 160` (down from 100/180)
- GroupedBar: `isMobile ? 100 : 160` (down from 120/180)

**gridRight increase:** Add `gridRight={40}` so bar labels ("41.4%") don't clip at the right edge

## Technical Notes

- ECharts y-axis labels support `\n` for multi-line text natively
- `gridRight` needs to be increased when showing right-positioned bar labels, otherwise the percentage text can clip outside the chart area
- The `formatTooltipValue` for percent type uses 1 decimal place (`formatPercent(value, 1)`), which matches poll data precision

## Files Modified

| File | Changes |
|------|---------|
| `src/components/charts/echarts/EChartsBarChart.tsx` | Change bar label formatter to use tooltip precision; add `gridRight` prop support |
| `src/pages/PollDetail.tsx` | Word-wrap labels instead of truncating; hide value axis always; adjust gridLeft/gridRight; apply to all bar chart sections |

## Expected Visual Result

- **Mobile**: Full labels visible (wrapped to 2 lines), bars take more horizontal space, precise percentages shown
- **Desktop**: Clean layout without redundant axis, full labels, precise values like "31.0%" on each bar
- **Both**: No more "Israel is committi..." -- users see "Israel is committing\ngenocide" and can understand what the data means
