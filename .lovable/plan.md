

# Replace Mini Card Indicators with State SVG Outlines + Auto-Scroll on Click

## What Changes

### 1. SVG State Outlines Instead of Color Bars
Replace the plain colored rectangle in each `StateMiniCard` with a **simplified SVG outline** of the actual state shape (Alaska and Hawaii). The SVG paths will be filled with the metric-derived color, giving an instantly recognizable visual indicator.

### 2. Auto-Scroll to Sidebar on Click
When a user clicks an AK or HI card, the `RegionSidebar` will scroll into view. On wider screens the sidebar is already visible, but on smaller screens (or if focus is elsewhere) the page will smoothly scroll the sidebar panel into the viewport so the user immediately sees the state data.

## Technical Details

### File: `src/components/voter-impact/StateMiniCard.tsx`
- Add a lookup object mapping `"AK"` and `"HI"` to simplified SVG path data (compact `d` strings representing each state outline)
- Replace the `<div className="w-3 h-8 ...">` color bar with an inline `<svg>` element (~24x24px viewBox) rendering the state shape filled with `fillColor` and a subtle stroke
- Keep the same text layout (state code + formatted value) beside the SVG

### File: `src/components/voter-impact/ImpactMap.tsx`
- No changes needed here -- the click handler already calls `handleInsetRegionSelect` which triggers `onRegionSelect` in the parent

### File: `src/pages/admin/VoterImpactMap.tsx`
- Add a `ref` to the `RegionSidebar` wrapper (or the sidebar component itself)
- In `handleRegionSelect`, after setting state, call `sidebarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` so the sidebar scrolls into view when AK/HI (or any state) is selected
- This works for all selections, not just AK/HI, improving UX across the board

### SVG Path Approach
- Use highly simplified (~10-15 point) path data for Alaska and Hawaii outlines -- just enough to be recognizable at 24px
- These are hardcoded constants (no external files needed), keeping the component lightweight
- The fill color comes from the existing `fillColor` prop, and a thin `#64748b` stroke provides definition against the dark card background

