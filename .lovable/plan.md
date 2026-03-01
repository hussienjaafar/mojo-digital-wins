
# Audit: Poll Results Page Mobile & Desktop Optimization

## Issues Found

### Critical -- Mobile
1. **Bar label truncation**: Long y-axis labels (e.g., "President has too much unchecked power", "Palestinian movement part of larger freedom movement") are cut off at `fontSize: 10` on 390px screens
2. **Value axis overlap**: Percentage axis ticks (`0% 5% 10% 15%...`) overlap and become unreadable on small screens
3. **Fixed chart heights ignore data count**: `HorizontalBar` uses `height={220}` for all charts regardless of how many data items exist -- the IL-9 vote choice has 10 items crammed into 220px, causing bars to overlap
4. **Section descriptions outside chart cards**: The `section.description` text renders outside the `V3ChartWrapper`, creating a visual disconnect between the description and its chart

### Moderate -- Desktop
5. **Charts span full 1200px width needlessly**: Horizontal bar charts stretch across the full container but data only occupies a fraction of the space, leaving dead space on the right
6. **No max-width constraint on chart sections**: The layout would benefit from a `max-w-4xl` or similar constraint to keep charts scannable

### Minor -- Both Viewports
7. **Donut chart legend can collide with labels on small screens**: The bottom legend and outside labels compete for space at 320px height on mobile

## Proposed Fixes

### 1. Dynamic chart heights based on data count
Instead of fixed heights, calculate height from the number of data items so each bar gets adequate space.

**File: `src/pages/PollDetail.tsx`**
- `HorizontalBar`: Change `height={220}` to `height={Math.max(200, section.data.length * 36)}` -- gives each bar ~36px (room for bar + gap)
- `GroupedBar`: Change `height={280}` to `height={Math.max(240, section.data.length * 56)}` -- grouped bars need more space per item
- `StackedBar`: Keep `height={140}` (typically 1 row)

### 2. Responsive y-axis label handling for long text
**File: `src/pages/PollDetail.tsx`**
- Pass a custom `xAxisLabelFormatter` that truncates labels beyond 30 chars on mobile (using `useIsMobile` hook)
- Increase `gridLeft` for horizontal bars with long labels to prevent clipping
- Use `fontSize: 11` on desktop, `fontSize: 9` on mobile for category labels

### 3. Move section descriptions inside chart wrappers
**File: `src/pages/PollDetail.tsx`**
- Remove the standalone `<p>` that renders `section.description` before `<SectionRenderer>`
- The descriptions are already passed into `V3ChartWrapper` via the `description` prop (used for `aria-describedby`) -- but they're currently only used as screen-reader text
- Add a visible subtitle below the chart title inside each section renderer, or add a `subtitle` slot to `V3ChartWrapper`

### 4. Add max-width constraint for readability on desktop
**File: `src/pages/PollDetail.tsx`**
- Add `max-w-5xl mx-auto` to the chart sections container so charts don't stretch to 1200px on ultrawide screens

### 5. Responsive donut chart sizing
**File: `src/pages/PollDetail.tsx`**
- Reduce donut `height` from 320 to 280 on mobile
- Switch legend to bottom position (already default) and reduce `labelThreshold` so fewer labels show on small screens

### 6. Fix value axis tick density on mobile
**File: `src/pages/PollDetail.tsx`**
- The `EChartsBarChart` already handles this via `containLabel: true`, but the issue is too many ticks. Pass a custom axis interval or reduce tick density by adjusting the chart's `splitNumber` -- this requires a small enhancement to `EChartsBarChart` or using ECharts option overrides

Since the chart components don't expose `splitNumber`, the practical fix is to ensure adequate `gridLeft`/`gridRight` so labels have room, which `containLabel: true` should handle. The real fix is giving charts enough height so the axis doesn't compress.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/PollDetail.tsx` | Dynamic heights, move descriptions inside cards, responsive label formatting, max-width container, mobile-aware donut sizing |

## Summary of Visual Impact

- **Mobile**: Charts will be taller to accommodate all data items without overlap; labels will be readable; descriptions will be visually connected to their charts
- **Desktop**: Charts will be constrained to a comfortable reading width (~1024px) instead of stretching to full container width; descriptions will be inside chart cards
- **Both**: Better spacing, no truncated labels, professional polling-report appearance
