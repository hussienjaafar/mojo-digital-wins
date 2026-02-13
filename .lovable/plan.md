
# Fix Heatmap Color Distinguishability

## Problem

The current 10-stop gradient uses multiple purple/violet/blue shades in the low-to-mid range (`#1a1a2e`, `#2d1b69`, `#4a1a8a`, `#6b21a8`, `#7c3aed`, `#3b82f6`) that are nearly indistinguishable on the map, especially at the district level where most values cluster in that range.

## Solution: Sequential Single-Hue Ramp (Dark-to-Light)

Replace the current rainbow-ish palette with a **sequential luminance ramp** that varies primarily in brightness and saturation rather than hue. This is the approach used by professional cartography tools (Mapbox, D3, ColorBrewer).

The new palette will go from **near-black to bright saturated teal/cyan**, ensuring every step is distinguishable by lightness alone (works even for colorblind users):

```text
0           --> #0a0a1a  (near-black, zero/no data)
500         --> #0d2847  (very dark navy)
2,000       --> #0f4c75  (dark steel blue)
5,000       --> #1277a8  (medium blue)
10,000      --> #15a2c2  (teal)
25,000      --> #22c7a0  (cyan-green)
50,000      --> #4ae08a  (green)
100,000     --> #8ef06e  (lime green)
200,000     --> #c8f74d  (yellow-green)
500,000     --> #f9f535  (bright yellow)
```

Each step increases in luminance monotonically, making adjacent values clearly distinct regardless of display or color vision.

## Changes

### 1. `src/types/voter-impact.ts`
Update `POPULATION_COLOR_STOPS` with the new sequential palette. Update `getPopulationColor()` accordingly (it reads from the same array).

### 2. `src/components/voter-impact/MapLegend.tsx`
No code changes needed -- it already reads from `POPULATION_COLOR_STOPS` to build its gradient bar dynamically.

### 3. `src/components/voter-impact/ImpactMap.tsx`
No code changes needed -- `buildPopulationColorExpression` already iterates `POPULATION_COLOR_STOPS`.

## Scope
- 1 file modified (`src/types/voter-impact.ts` -- color array only)
- Legend and map update automatically since they read from the shared constant
