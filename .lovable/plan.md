
# Fix Map Glitch When Zooming Out All the Way

## Problem
At `minZoom: 2.5`, MapLibre struggles to reconcile the `maxBounds` constraint with an extremely zoomed-out view. The map tries to fit the bounded area (`[-190, 10] to [-50, 75]`) into too small a tile area, causing visual glitches -- grey tiles, snapping, and rendering artifacts.

## Solution
Increase `minZoom` from `2.5` to `3.5` in `src/components/voter-impact/ImpactMap.tsx`. At zoom 3.5, the entire continental US (plus Alaska/Hawaii) is still fully visible, but the map never zooms out far enough to trigger the boundary-fitting glitch.

## Technical Details

**File: `src/components/voter-impact/ImpactMap.tsx`** (line 431)

Change:
```tsx
minZoom={2.5}
```
To:
```tsx
minZoom={3.5}
```

This single-line change prevents the glitch while keeping the full US view accessible. The `maxBounds` and `renderWorldCopies={false}` settings remain in place as additional safeguards.
