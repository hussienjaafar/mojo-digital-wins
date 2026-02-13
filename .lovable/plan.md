

# Rebuild Voter Impact Map: Muslim Voter Population Heatmap

## Overview

Replace the current "flippability score" choropleth with a **population-based heatmap** showing total Muslim voters per state, with a drill-down to congressional districts on click. The color scale will use a **continuous gradient with many shades** to clearly distinguish between zero, very few, moderate, and high-population areas.

## Current State

The map currently colors states/districts by a calculated "impact score" (flippability based on margin vs. mobilizable voters). The new design shifts focus entirely to **Muslim voter population counts** as the primary visual metric.

## New User Flow

1. **Initial view**: US states colored by total Muslim voters (continuous heatmap gradient)
2. **Hover**: Tooltip shows state name + Muslim voter count
3. **Click state**: Map zooms into that state and shows congressional districts, each colored by their Muslim voter count using the same gradient logic
4. **Click district**: Sidebar shows district details (existing behavior preserved)
5. **Back button**: Returns to US state-level view

## Color Scale Design

A continuous gradient with **9+ distinct color stops** to maximize sensitivity:

```text
0 voters        --> #1a1a2e (very dark / near-black)
1-500           --> #2d1b69 (dark indigo)
500-2,000       --> #4a1a8a (deep purple)
2,000-5,000     --> #6b21a8 (purple)
5,000-10,000    --> #7c3aed (violet)
10,000-25,000   --> #3b82f6 (blue)
25,000-50,000   --> #06b6d4 (cyan)
50,000-100,000  --> #10b981 (emerald)
100,000-200,000 --> #84cc16 (lime)
200,000+        --> #facc15 (yellow/gold)
```

This ensures:
- Zero is visually distinct (near-black)
- Small populations (500-5,000) have clear purple shades
- High populations "glow" in warm greens/yellows
- Adjacent states/districts with different counts are distinguishable

## Technical Changes

### 1. `src/types/voter-impact.ts`
- Add new population-based color constants and threshold arrays
- Remove or deprecate `IMPACT_THRESHOLDS` and `IMPACT_COLORS` usage for map coloring (keep for sidebar if needed)
- Add helper function `getPopulationColor(count: number): string`

### 2. `src/components/voter-impact/ImpactMap.tsx` (major rewrite)
- **State color expression**: Replace impact-score-based coloring with `muslim_voters` count-based `interpolate` expression using the gradient stops above
- **District color expression**: Same approach but with district-level thresholds (lower range since max is ~65k vs ~550k for states)
- **Enriched GeoJSON**: Inject `muslim_voters` directly into state feature properties (already partially done for districts)
- **Tooltip**: Simplify to show name + Muslim voter count (remove impact score percentage)
- **State click behavior**: Keep existing fit-to-bounds zoom behavior (already works well)
- Remove filter-based opacity logic for districts (simplify to always show all)

### 3. `src/components/voter-impact/MapLegend.tsx` (redesign)
- Replace 4-tier categorical legend with a continuous gradient bar
- Show labeled tick marks at key thresholds (0, 1k, 5k, 25k, 100k, 500k)
- Indicate "States" vs "Districts" context when zoomed in

### 4. `src/components/voter-impact/MapControls.tsx` (simplify)
- Remove party filter, impact filter, and presets (no longer relevant to population view)
- Keep search functionality
- Optionally keep the min population slider

### 5. `src/components/voter-impact/MetricToggle.tsx`
- Remove or hide for now -- the map has a single purpose (Muslim voter population)
- Can be re-added later if multiple metrics are desired

### 6. `src/pages/admin/VoterImpactMap.tsx`
- Remove metric state and MetricToggle from header
- Simplify filter state (fewer filter options)
- Update page title/description if needed

### 7. `src/components/voter-impact/RegionSidebar.tsx`
- Keep as-is mostly -- it already shows Muslim voter counts prominently
- Remove or de-emphasize impact score badges

## What Stays the Same
- MapLibre + Carto Dark Matter basemap
- GeoJSON data loading (states + districts)
- Click-to-zoom-into-state interaction
- Back button to return to US view
- Sidebar with region details
- Data fetching from database
- URL param syncing

## Estimated Scope
- ~6 files modified
- No database changes needed
- No new dependencies

