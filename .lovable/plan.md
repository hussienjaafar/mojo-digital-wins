

# Fix Cramped Legend Tick Labels

## Problem

The legend shows too many tick labels crammed together in a small space. Labels like "50K100K200K500K" overlap and become unreadable (visible in the screenshot).

## Solution

Simplify the legend to show only 3 tick labels (start, middle, end) and widen the container slightly for breathing room.

## Changes

**File: `src/components/voter-impact/MapLegend.tsx`**

1. **Reduce ticks to 3** -- Show only the first, middle, and last color stop labels. This eliminates overlap entirely regardless of how many color stops exist.

2. **Widen minimum width** -- Change `min-w-[220px]` to `min-w-[260px]` to give labels more horizontal space.

3. **Align edge labels** -- The first label aligns left (`translate-x-0`), the last aligns right (`translate-x-full` from right), and the middle stays centered. This prevents the first/last labels from being clipped or hanging off the edges.

## Scope
- 1 file modified: `MapLegend.tsx`
- Tick logic simplified from complex step calculation to simple 3-point display
