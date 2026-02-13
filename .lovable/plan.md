

# Add State-Relative Color Scale for District View

## Problem

When drilling into a state's districts, the color scale uses national-level thresholds (e.g., 0-500K for population). This means districts within a single state often appear in a narrow band of similar colors, making it hard to distinguish local differences.

## Solution

When viewing districts within a selected state, dynamically compute the min and max metric values across that state's districts and build a color expression that maps the full color ramp to that local range.

## Technical Changes

**File: `src/components/voter-impact/ImpactMap.tsx`**

1. **Compute local min/max** -- Add a `useMemo` that, when `showDistricts` is true and a state is selected, finds the min and max `metricValue` from the enriched districts GeoJSON (filtered to the selected state). Falls back to the global color stops when no state is selected or in state view.

2. **Build dynamic color stops** -- Create a helper function `buildLocalColorStops` that takes the global color ramp colors and remaps them evenly across the local `[min, max]` range. This preserves the same visual gradient but stretches it to fit the state's data range.

3. **Update `districtColorExpression`** -- Change the existing memo (line 272) to use the dynamically computed local color stops instead of the global `colorStops` when in district view.

4. **Update `MapLegend`** -- Pass the local min/max or local color stops to the legend so the tick labels reflect the state-relative scale. Add an optional `localColorStops` prop to `MapLegend`.

**File: `src/components/voter-impact/MapLegend.tsx`**

5. **Accept optional override stops** -- Add an optional `colorStopsOverride` prop. When provided, use these instead of the global metric config stops for rendering the gradient and tick labels. Add a small label like "(relative to state)" to indicate the scale is localized.

## Implementation Details

```text
buildLocalColorStops(globalStops, localMin, localMax):
  - Take the N colors from globalStops
  - Create N evenly-spaced thresholds from localMin to localMax
  - Return new ColorStop[] with same colors but local thresholds
  - Format labels appropriately (number or percentage)
```

The district color expression memo will depend on `[enrichedDistrictsGeoJSON, colorStops, showDistricts, selectedRegion]` to recompute when switching states.

## Scope
- 2 files modified: `ImpactMap.tsx`, `MapLegend.tsx`
- 1 new helper function (`buildLocalColorStops`)
- No database changes

