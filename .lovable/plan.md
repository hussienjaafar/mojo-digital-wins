
# Restrict Map View to United States Only

## Problem

The map currently shows the entire world, which is distracting and unnecessary since all data is US-only. Users can pan away from the US and lose context.

## Solution

Add a `maxBounds` constraint to the MapGL component that limits panning to the continental US (plus Alaska and Hawaii), and set `minZoom` to prevent zooming out too far. This keeps all existing functionality (zoom, click, fly-to, filters) intact while constraining the viewport to the US.

## Changes

**File: `src/components/voter-impact/ImpactMap.tsx`**

### 1. Add a US bounds constant

Define a bounding box that covers all US states including Alaska and Hawaii:

```text
US_BOUNDS = [
  [-175, 17],   // Southwest corner (covers Hawaii longitude + Puerto Rico latitude)
  [-64, 72]     // Northeast corner (covers Maine longitude + Alaska latitude)
]
```

### 2. Add `maxBounds` and `minZoom` to the MapGL component

Pass `maxBounds` to prevent panning outside the US, and set `minZoom` to ~2.5 so users can't zoom out to see the full globe:

- `maxBounds={US_BOUNDS}` -- constrains panning
- `minZoom={2.5}` -- prevents zooming out too far

These are native MapLibre GL properties that react-map-gl supports directly. No custom logic needed -- the map engine handles the constraint smoothly, including elastic bounce-back if the user tries to drag past the edge.

### 3. Update `ViewState` interface

Add optional `minZoom` to the interface if not already present (MapGL accepts it as a prop directly, so this may not be strictly necessary).

## What stays the same

- All click/hover/zoom interactions
- Fly-to animations for state/district selection
- District drill-down behavior
- Filter and search functionality
- The dark map tile style

## Scope
- 1 file modified: `ImpactMap.tsx`
- 2 props added to MapGL: `maxBounds`, `minZoom`
- 1 new constant: `US_BOUNDS`
