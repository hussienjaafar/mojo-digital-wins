

# Fix: Hover Tooltip Not Reflecting Active Metric

## Problem

The hover callbacks (`handleStateHover` and `handleDistrictHover`) have stale closures. They reference `metricConfig` to look up the correct field value, but `metricConfig` is not listed in their dependency arrays. When you switch metrics, the callbacks still use the old metric's field, so the tooltip always shows population data.

## Fix

Update the dependency arrays of two `useCallback` hooks in `src/components/voter-impact/ImpactMap.tsx`:

1. **`handleStateHover`** (line ~372): Add `metricConfig` to the dependency array `[onRegionHover, states]` so it becomes `[onRegionHover, states, metricConfig]`.

2. **`handleDistrictHover`** (line ~407): Add `metricConfig` to the dependency array `[onRegionHover, districts]` so it becomes `[onRegionHover, districts, metricConfig]`.

## Scope
- 1 file modified: `src/components/voter-impact/ImpactMap.tsx`
- 2 lines changed (dependency arrays only)

