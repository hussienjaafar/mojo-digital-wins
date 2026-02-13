

# Fix Buggy Drag and Missing Alaska/Hawaii Insets

## Problems

### 1. Buggy Click and Drag
The `maxBounds` prop on the main MapGL causes MapLibre to apply a hard elastic constraint. When you drag near the edge, it snaps back jarringly -- this is the "buggy" drag behavior. The original soft-clamping approach was planned but never implemented; instead `maxBounds` was kept.

### 2. Alaska and Hawaii Not Visible
Three contributing factors:
- **`hidden sm:flex`** hides the insets on screens narrower than 640px -- so on many laptops at certain zoom levels or smaller monitors, they disappear entirely
- **Near-black fill colors**: When Alaska/Hawaii have low metric values, the fill color is near-black (`#0a0a1a`) on a dark basemap (`#0a0f1a`), making them essentially invisible even when the insets render
- **Small container sizes** (140x95 and 110x75) combined with zoom levels that may not frame the states well

## Solution

### Fix 1: Replace `maxBounds` with Soft Clamping

**File: `src/components/voter-impact/ImpactMap.tsx`**

- Remove the `LOWER_48_BOUNDS` constant
- Remove `maxBounds` prop from the MapGL component
- Update `handleMove` to clamp the center coordinates:
  - Longitude: clamp to [-170, -60]
  - Latitude: clamp to [18, 72]
- This gives smooth, natural drag with no elastic snap-back

### Fix 2: Always Show Insets + Better Sizing

**File: `src/components/voter-impact/ImpactMap.tsx`**

- Change `hidden sm:flex` to just `flex` so insets are always visible
- Increase Alaska inset to 160x110, zoom 2.5 for better framing
- Increase Hawaii inset to 120x85, zoom 5.8 for better framing

### Fix 3: Ensure AK/HI Are Visible Against Dark Basemap

**File: `src/components/voter-impact/InsetMap.tsx`**

- Add a subtle background fill for the inset states so they always contrast with the basemap
- Override the fill opacity to a minimum of 0.4 in the inset fill layers so even low-value states are visible
- Add a subtle inner border highlight on the target state (AK or HI) using a filter expression

## Technical Details

```text
Changes by file:

src/components/voter-impact/ImpactMap.tsx:
  - Delete LOWER_48_BOUNDS constant
  - Remove maxBounds prop from MapGL
  - Update handleMove:
      longitude = Math.min(Math.max(evt.viewState.longitude, -170), -60)
      latitude = Math.min(Math.max(evt.viewState.latitude, 18), 72)
  - Inset container: "hidden sm:flex" -> "flex"
  - Alaska: width 160, height 110, zoom 2.5
  - Hawaii: width 120, height 85, zoom 5.8

src/components/voter-impact/InsetMap.tsx:
  - Override inset fill layer paint to set minimum fill-opacity of 0.4
  - Add a highlight border layer filtered to just the target state (AK FIPS "02" or HI FIPS "15")
    using a bright subtle color so the state shape is always visible
```

## What Stays the Same
- All click, hover, state drill-down, and district selection behavior
- Color scales and data enrichment logic
- Legend positioning (bottom-right)
- State context header and tooltip
- minZoom of 2.5
