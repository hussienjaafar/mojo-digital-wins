

# Fix: Bars Are Tiny Stubs Due to Double Label Spacing

## Root Cause

The `EChartsBarChart` has `containLabel: true` in its grid config (line 298). This tells ECharts to automatically reserve space for axis labels inside the grid boundaries. 

**However**, `PollDetail.tsx` is also passing large `gridLeft` values (90-160px) which act as ADDITIONAL padding before labels start. The result: on a 390px mobile screen, ~90px of dead padding + ~150px of label width = only ~100px left for actual bars. That's why they appear as tiny stubs.

## The Fix

**Stop passing large `gridLeft` values.** Since `containLabel: true` already handles label space, `gridLeft` should only be a small margin (8-12px). The labels will size themselves correctly.

### File 1: `src/pages/PollDetail.tsx`

**GroupedBar renderer (line 58):**
- Remove `gridLeft={isMobile ? 100 : 160}` -- let containLabel handle it
- Or set `gridLeft={8}` for a minimal outer margin

**HorizontalBar renderer (line 156):**
- Remove `gridLeft={isMobile ? 90 : 160}` -- same fix
- Or set `gridLeft={8}`

**Also increase `gridRight` to `50-60`** to ensure right-side bar labels ("41.4%") don't clip, since bars will now be wider and labels may extend further.

### File 2: `src/components/charts/echarts/EChartsBarChart.tsx`

**No structural changes needed.** The component is correct -- `containLabel: true` is the right approach. The bug was in the caller passing unnecessarily large `gridLeft` values.

**Optional improvement:** Change the default `gridLeft` from `12` to `8` for slightly tighter margins, and increase default `gridRight` from `40` to `55` when `showBarLabels` is true.

## Summary

| Change | Before | After |
|--------|--------|-------|
| HorizontalBar gridLeft (mobile) | 90px + containLabel padding | 8px + containLabel (auto) |
| HorizontalBar gridLeft (desktop) | 160px + containLabel padding | 8px + containLabel (auto) |
| GroupedBar gridLeft (mobile) | 100px + containLabel padding | 8px + containLabel (auto) |
| GroupedBar gridLeft (desktop) | 160px + containLabel padding | 8px + containLabel (auto) |
| gridRight with bar labels | 40px | 55px |

## Expected Result

- Bars will occupy ~60-70% of chart width instead of ~25%
- Labels still have adequate space (managed by ECharts containLabel)
- Percentage values ("41.4%") won't clip on the right
- Both mobile and desktop will look proportional

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/PollDetail.tsx` | Remove large gridLeft overrides from GroupedBar and HorizontalBar renderers; increase gridRight |
| `src/components/charts/echarts/EChartsBarChart.tsx` | Increase default gridRight for showBarLabels from 40 to 55 |

