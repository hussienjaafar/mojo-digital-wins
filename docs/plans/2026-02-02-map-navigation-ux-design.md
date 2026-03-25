# Map Navigation UX Improvements Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve map navigation for large states and enhance hover/selection visual feedback

**Architecture:** Add fit-to-bounds zoom using Turf.js, enhance border styling with glow layers, and maintain state context when viewing districts

**Tech Stack:** MapLibre GL, @turf/bbox, React

---

## Problem Statement

1. **Large state navigation**: When clicking Texas/California, map centers on click point - user can't see all districts
2. **Hover feedback too subtle**: Only 1-2px line width increase, no glow effects
3. **State context lost**: When zoomed into districts, selected state fades to 10% opacity
4. **Default borders invisible**: `#0f172a` has ~1.1:1 contrast ratio on dark basemap

## Solution Design

### 1. Fit-to-Bounds Zoom

When user clicks a state:
- Calculate bounding box from GeoJSON geometry using `@turf/bbox`
- Use `map.fitBounds(bbox, { padding: 50, maxZoom: 7 })` to animate
- Ensures entire state with all districts is visible
- `maxZoom: 7` prevents tiny states from excessive zoom

### 2. Enhanced Hover & Selection Borders

**Hover Effects:**
- Line width: 1px → 4px
- Line color: `#93c5fd` (brighter blue)
- Glow layer: 8px width, 0.4 opacity, `line-blur: 3`

**Selection Effects:**
- Line width: 5px
- Line color: `#3b82f6`
- Glow layer: 10px width, 0.5 opacity

**Default Border:**
- Change from `#0f172a` to `#334155` (~4:1 contrast)

### 3. Persistent State Context

**Selected State Outline:**
- Keep at 100% opacity even when viewing districts
- Dedicated layer that doesn't fade with other states

**State Header Component:**
- Shows "Viewing: Texas (38 districts)"
- Includes "× Back to US" button
- Only visible when zoomed into a state

## Implementation Tasks

### Task 1: Add @turf/bbox dependency
- Install: `npm install @turf/bbox`
- Import in ImpactMap.tsx

### Task 2: Implement fit-to-bounds zoom
- Add map ref using `useRef`
- Calculate bbox on state click
- Replace `setViewState` with `fitBounds`

### Task 3: Add glow layers for hover/selection
- Create `states-border-glow` layer
- Create `districts-border-glow` layer
- Position below main border layers

### Task 4: Update border colors and widths
- Default: `#0f172a` → `#334155`
- Hover: width 4px, color `#93c5fd`
- Selected: width 5px, color `#3b82f6`

### Task 5: Keep selected state outline visible
- Add dedicated outline layer for selected state
- Maintain 100% opacity when zoomed to districts

### Task 6: Add state context header
- Create StateHeader component
- Show state name and district count
- Add back button to zoom out
- Only render when viewing districts

## Files to Modify

- `src/components/voter-impact/ImpactMap.tsx` - main implementation
- `package.json` - add @turf/bbox dependency

## Success Criteria

- [ ] Clicking any state zooms to fit entire state in view
- [ ] All districts visible after state selection
- [ ] Hover shows 4px border with glow effect
- [ ] Selection shows 5px border with stronger glow
- [ ] Selected state outline visible when viewing districts
- [ ] State name header visible when zoomed in
- [ ] Back button returns to US view
- [ ] All existing tests pass
