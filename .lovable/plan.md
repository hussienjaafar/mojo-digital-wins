

# Fix Map Viewport, Legend Overlap, and Responsiveness

## Problems Identified

1. **Cannot zoom out enough**: `minZoom: 3` combined with tight `maxBounds` (`[[-130, 23], [-64, 50]]`) prevents seeing both coasts on smaller screens
2. **Legend covers inset maps**: Both the MapLegend (`absolute bottom-4 left-4`) and the Alaska/Hawaii insets (`absolute bottom-6 left-4`) are positioned in the same bottom-left corner, causing overlap
3. **Insets hidden on small screens**: Fixed-size insets (160px + 130px + gap) don't fit on narrow viewports

## Solution

### 1. Relax zoom and bounds constraints

**File: `src/components/voter-impact/ImpactMap.tsx`**

- Lower `minZoom` from `3` to `2.5` so users can zoom out enough to see both coasts on smaller screens
- Widen `LOWER_48_BOUNDS` slightly to `[[-135, 20], [-60, 52]]` to add breathing room at the edges and prevent coast clipping

### 2. Reposition legend to bottom-right to avoid overlap

**File: `src/components/voter-impact/MapLegend.tsx`**

- Change positioning from `bottom-4 left-4` to `bottom-4 right-4`
- This gives the inset maps exclusive use of the bottom-left corner, and the legend sits cleanly in the bottom-right (where the navigation controls are at the top-right, so there's no conflict)

### 3. Make insets responsive

**File: `src/components/voter-impact/ImpactMap.tsx`**

- Add responsive classes to the inset container: hide on very small screens (`hidden sm:flex`) where they'd be too cramped
- Reduce inset sizes slightly on medium screens using Tailwind responsive classes or slightly smaller default dimensions (140x95 for Alaska, 110x75 for Hawaii)

## Technical Details

```text
Changes by file:

src/components/voter-impact/ImpactMap.tsx
  - LOWER_48_BOUNDS: [[-130, 23], [-64, 50]] -> [[-135, 20], [-60, 52]]
  - minZoom: 3 -> 2.5
  - Inset container: add "hidden sm:flex" for responsive hiding
  - Reduce inset sizes slightly for better fit

src/components/voter-impact/MapLegend.tsx
  - Position: "bottom-4 left-4" -> "bottom-4 right-4"
```

## What stays the same

- All click, hover, and drill-down functionality
- Color scales and data enrichment
- Inset map interactivity (clickable for state/district selection)
- State context header and tooltip behavior
- Dark theme styling

