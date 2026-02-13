
# Enhance State Boundaries in District View

## Problem

When viewing districts, state borders look the same as district borders (both thin lines with the same color), making it hard to tell which state you're looking at.

## Solution

Make state borders significantly more prominent when the district view is active. This involves two changes to the existing state border layers:

**File: `src/components/voter-impact/ImpactMap.tsx`**

### 1. Thicker state borders in district mode

Update the `statesBorderLayer` to use a wider default line width when `showDistricts` is true:
- Default width: 1.5px (state view) --> 3px (district view)
- Use a brighter/more contrasting color for state borders in district mode, e.g. `#cbd5e1` (lighter slate) instead of `#94a3b8`

### 2. Persistent state border glow in district mode

Update the `statesBorderGlowLayer` to show a subtle glow on ALL state borders when in district view (not just hovered/selected):
- Default glow width: 0 --> 6px when `showDistricts` is true
- Default glow color: a subtle `#475569` (slate-600)
- Default glow opacity: 0.3
- This creates a soft "halo" effect around state boundaries that visually separates them from district lines

### 3. Add `showDistricts` dependency

Both layer memos need `showDistricts` added to their dependency arrays so they recompute when switching between state and district views.

## Result

State boundaries will appear as thick, slightly glowing lines that clearly separate groups of districts, while district borders remain thinner. The visual hierarchy makes it immediately obvious which state each district belongs to.

## Scope
- 1 file modified: `ImpactMap.tsx`
- 2 layer definitions updated (state border + state border glow)
- No new layers or components
