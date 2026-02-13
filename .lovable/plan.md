

# Replace MapGL Insets with SVG-Based Alaska/Hawaii Cards

## The Problem

The current approach uses full MapGL map instances for Alaska and Hawaii insets. This has been unreliable because:
- MapGL requires precise coordinate/zoom tuning that's fragile across screen sizes
- The dark basemap makes low-value states nearly invisible
- Two extra map instances add rendering overhead
- Hover tooltips don't work well inside tiny map containers

## The Better Approach

Replace the MapGL-based insets with **simple, styled SVG cards** that show the state outline, name, and metric value -- colored using the same color scale as the main map. This is the approach used by most major election/data maps (NYT, 538, etc.).

### How it works:
- Each card is a small rounded rectangle with a colored background derived from the state's metric value
- The state abbreviation and formatted metric value are displayed as text
- Hovering triggers the same `onRegionHover` callback, so the sidebar/panel updates
- Clicking triggers `onRegionSelect` to drill down
- The cards **hide automatically** when `showDistricts` is true (zoomed into congressional district view)

## Changes

### 1. Create new `StateMiniCard` component
**New file: `src/components/voter-impact/StateMiniCard.tsx`**

A simple div-based card (~40 lines) that:
- Accepts state code, name, metric value, color, and click/hover handlers
- Renders as a small colored card with state abbreviation and value
- Has hover highlight effect
- Calls `onRegionSelect` on click and `onRegionHover` on mouse enter/leave

### 2. Update `ImpactMap.tsx`
- Remove the `InsetMap` imports and usage
- Import the new `StateMiniCard` component
- Compute the fill colors for AK and HI from the existing enriched data and color scale
- Render two `StateMiniCard` components in the bottom-left corner
- Wrap them in a conditional: only show when `!showDistricts` (hides during district drill-down)

### 3. Delete `InsetMap.tsx`
No longer needed since we're using the simpler card approach.

## Technical Details

```text
New file: src/components/voter-impact/StateMiniCard.tsx
  - Props: stateCode, stateName, metricValue, formattedValue, fillColor, onSelect, onHover
  - Renders a ~100x60px card with colored left border or background
  - Mouse events wire to onSelect/onHover

Modified: src/components/voter-impact/ImpactMap.tsx
  - Remove InsetMap import and all InsetMap JSX
  - Import StateMiniCard
  - Compute AK/HI colors from the same color interpolation used by the fill layers
  - Add helper: getStateColor(stateCode) that reads from the enriched GeoJSON features
  - Render:
    {!showDistricts && (
      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        <StateMiniCard stateCode="AK" ... />
        <StateMiniCard stateCode="HI" ... />
      </div>
    )}

Deleted: src/components/voter-impact/InsetMap.tsx
```

## What Stays the Same
- All main map click, hover, drill-down, and district selection behavior
- Color scales and data enrichment logic
- Legend positioning (bottom-right)
- State context header and tooltip
- Smooth drag with soft clamping
