
# Add Metric Switching to Voter Impact Map

## Overview

Add a metric selector that lets users switch the heatmap visualization between **Population**, **Donors**, **Activists**, and **Turnout %**. Each metric will recolor the map using the same sequential luminance ramp but with thresholds tuned to the data range of that metric.

## Data Availability

| Metric | States | Districts |
|--------|--------|-----------|
| Muslim Voters (population) | `muslim_voters` (0-550k) | `muslim_voters` (0-65k) |
| Political Donors | `political_donors` (0-86k) | Not available |
| Political Activists | `political_activists` (0-2.8k) | Not available |
| Turnout % | `vote_2024_pct` (0-74%) | `turnout_pct` |

Since donors and activists data only exists at the state level, the district drill-down will show a "Data not available at district level" notice for those metrics and fall back to a neutral/empty coloring.

## New Metric Toggle UI

A pill-style toggle bar in the controls area (next to search/slider) with options:
- **Population** (default)
- **Donors**
- **Activists**
- **Turnout %**

## Technical Changes

### 1. `src/types/voter-impact.ts`
- Expand `MetricType` from `"population"` to `"population" | "donors" | "activists" | "turnout"`
- Add separate `COLOR_STOPS` configs per metric (tuned to each data range):
  - Donors: 0 to 86k (similar structure to population but lower max)
  - Activists: 0 to 3k (much smaller range, fewer stops)
  - Turnout: 0% to 75% (percentage-based, different labeling)
- Add a helper `getColorStopsForMetric(metric: MetricType)` that returns the correct stops array
- Add a helper `getMetricLabel(metric: MetricType)` for display names

### 2. `src/components/voter-impact/ImpactMap.tsx`
- Accept new prop `activeMetric: MetricType`
- Update `enrichedStatesGeoJSON` to inject the selected metric's value as the coloring property (e.g., `metricValue` property on each feature)
- Update `enrichedDistrictsGeoJSON` similarly -- for donors/activists where district data doesn't exist, inject 0 or null
- Update `buildPopulationColorExpression` to accept metric-specific color stops
- Update tooltip (`hoverInfo`) to show the correct label and value formatting (raw count vs percentage)

### 3. `src/components/voter-impact/MapLegend.tsx`
- Accept `activeMetric: MetricType` prop
- Use `getColorStopsForMetric(metric)` to build the gradient dynamically
- Update tick labels based on metric (e.g., "0%" to "75%" for turnout)

### 4. `src/components/voter-impact/MapControls.tsx`
- Add `activeMetric` and `onMetricChange` props
- Render a pill-style toggle group for the four metrics
- Style as compact buttons matching the existing dark UI theme

### 5. `src/pages/admin/VoterImpactMap.tsx`
- Add `activeMetric` state (default: `"population"`)
- Pass it down to `MapControls`, `ImpactMap`, and `MapLegend`
- Optionally persist to URL params (`metric=donors`)

### 6. Metric-specific color stops

```text
Population:  0 -> #0a0a1a ... 500k -> #f9f535  (existing)
Donors:      0 -> #0a0a1a, 100 -> #0d2847, 500 -> #0f4c75, 2k -> #1277a8, 5k -> #15a2c2, 10k -> #22c7a0, 25k -> #4ae08a, 50k -> #8ef06e, 86k -> #f9f535
Activists:   0 -> #0a0a1a, 10 -> #0d2847, 50 -> #0f4c75, 100 -> #1277a8, 250 -> #15a2c2, 500 -> #22c7a0, 1k -> #4ae08a, 2k -> #8ef06e, 3k -> #f9f535
Turnout:     0% -> #0a0a1a, 5% -> #0d2847, 15% -> #0f4c75, 25% -> #1277a8, 35% -> #15a2c2, 45% -> #22c7a0, 55% -> #4ae08a, 65% -> #8ef06e, 75% -> #f9f535
```

## Scope
- 5 files modified
- No database changes needed
- No new dependencies
