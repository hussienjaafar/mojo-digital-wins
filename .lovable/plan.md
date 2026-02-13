

# Add Alaska and Hawaii Inset Maps

## Approach

Render three separate MapGL instances: a main map showing only the lower 48 states, and two smaller inset maps in the bottom-left corner for Alaska and Hawaii. All three maps share the same data, color scales, and interaction handlers.

## Why This Approach

- Preserves all existing MapLibre functionality (WebGL rendering, smooth zoom, dark tile basemap)
- Keeps real geographic coordinates (no coordinate hacking)
- Professional look matching standard US political maps
- Each inset is still interactive (clickable for state/district drill-down)

## Changes

### 1. Extract shared map logic into a hook -- New file: `src/hooks/useImpactMapLayers.ts`

Move the layer definitions (fill, border, glow for both states and districts) and GeoJSON enrichment logic out of `ImpactMap.tsx` into a reusable hook. This avoids duplicating ~200 lines of layer/color logic across 3 map instances.

The hook will accept:
- `states`, `districts`, `filters`, `activeMetric`, `localDistrictColorStops`
- `hoveredRegion`, `selectedRegion`, `showDistricts`

And return:
- `enrichedStatesGeoJSON`, `enrichedDistrictsGeoJSON`
- All layer specs (statesFillLayer, statesBorderLayer, etc.)

### 2. Create InsetMap component -- New file: `src/components/voter-impact/InsetMap.tsx`

A small, reusable map component for Alaska and Hawaii insets:
- Takes a `center` (lat/lng), `zoom`, `bounds` (to restrict view), and `label`
- Renders a MapGL instance with the same sources/layers as the main map
- Has click handlers that delegate to the parent's `onRegionSelect`
- Fixed size container (~180x120px for Alaska, ~150x100px for Hawaii)
- Styled with a subtle border and state label
- No NavigationControl (too small for zoom buttons)
- Non-interactive for pan/zoom (locked viewport) but clickable

### 3. Update ImpactMap.tsx

**Main map changes:**
- Remove `maxBounds` and the `US_BOUNDS` constant
- Set `maxBounds` to constrain to just the lower 48 states: `[[-130, 23], [-64, 50]]`
- Set `minZoom` to 3 so the lower 48 fill the viewport nicely
- Import and use the extracted `useImpactMapLayers` hook

**Add inset maps:**
- Render two `InsetMap` components in the bottom-left corner, positioned absolutely
- Alaska: centered at ~(-152, 64), zoom ~2.5, placed bottom-left
- Hawaii: centered at ~(-157, 20.5), zoom ~5.5, placed to the right of Alaska
- Both wrapped in a container with `pointer-events-auto` so clicks work

**Drill-down behavior:**
- When a user clicks Alaska or Hawaii in the inset, it triggers the same `onRegionSelect` as clicking a state on the main map
- If districts are shown for AK or HI, the inset map also shows the district layer (AK has 1 at-large district, HI has 2)

### 4. Styling

- Inset containers: dark background (`bg-[#0a0f1a]`), thin border (`border-[#1e2a45]`), rounded corners
- Small label below each inset ("Alaska", "Hawaii") in muted text
- Positioned in the bottom-left with some padding to avoid overlapping the map attribution
- Responsive: on very small screens, insets could be hidden or made smaller

## Technical Details

```text
File structure:
  src/hooks/useImpactMapLayers.ts          (NEW - extracted layer logic)
  src/components/voter-impact/InsetMap.tsx  (NEW - inset map component)
  src/components/voter-impact/ImpactMap.tsx (MODIFIED - use hook + add insets)

Main map bounds (lower 48 only):
  maxBounds: [[-130, 23], [-64, 50]]
  minZoom: 3

Alaska inset:
  center: [-152, 64]
  zoom: 2.5
  size: ~180x120px

Hawaii inset:
  center: [-157, 20.5]
  zoom: 5.5
  size: ~150x100px

Shared state between all 3 maps:
  - activeMetric, filters, color stops
  - enriched GeoJSON data
  - selectedRegion, hoveredRegion
  - showDistricts flag
```

## What stays the same

- All data enrichment and color scale logic (just moved to a hook)
- District drill-down behavior
- Region sidebar detail panel
- Filter and search functionality
- The dark basemap tile style
- Hover tooltips and click interactions

## Scope

- 2 new files: `useImpactMapLayers.ts`, `InsetMap.tsx`
- 1 file modified: `ImpactMap.tsx`
- No database changes
- No new dependencies

