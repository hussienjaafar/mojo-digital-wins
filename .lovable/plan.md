
# Fix Map Wrapping / Europe Glitch When Dragging Left

## Problem
Dragging the map too far left causes it to wrap around and show Europe/other continents. This happens because MapLibre renders duplicate copies of the world by default (`renderWorldCopies: true`), and the soft longitude clamp (`-170` to `-60`) alone doesn't prevent the visual wrapping and snapping behavior.

## Solution
Add two MapLibre properties to the `<Map>` component in `src/components/voter-impact/ImpactMap.tsx`:

1. **`renderWorldCopies={false}`** -- Prevents the map from rendering duplicate world tiles, so there's nothing to "wrap" into.
2. **`maxBounds`** -- Hard-constrains the viewport to a bounding box around the US (including Alaska and Hawaii). Unlike the soft clamp in `handleMove`, this is enforced at the MapLibre engine level, preventing any visual glitching.

## Technical Details

### File: `src/components/voter-impact/ImpactMap.tsx`

Add two props to the `<MapGL>` component (around line 425):

```tsx
<MapGL
  ref={mapRef}
  {...viewState}
  onMove={handleMove}
  mapStyle={MAP_STYLE}
  style={{ width: "100%", height: "100%" }}
  minZoom={2.5}
  renderWorldCopies={false}
  maxBounds={[[-190, 10], [-50, 75]]}
  // ... rest of props
>
```

The bounds `[[-190, 10], [-50, 75]]` cover:
- West: `-190` (enough to include western Alaska/Aleutian Islands)
- South: `10` (below Hawaii)
- East: `-50` (east of Maine)
- North: `75` (above Alaska)

The existing soft clamp in `handleMove` can remain as a secondary safeguard but will rarely trigger since `maxBounds` handles it at the engine level.
