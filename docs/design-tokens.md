# Design Tokens Reference

> **Last Updated:** December 2024
> **Source File:** [`src/lib/design-tokens.ts`](../src/lib/design-tokens.ts)
> **CSS Variables:** [`src/styles/portal-theme.css`](../src/styles/portal-theme.css)

---

## Overview

The Mojo Digital Wins design system uses a token-based approach that ensures consistency across the dashboard. All visual properties (colors, spacing, typography, etc.) are defined as tokens that can be consumed via:

1. **CSS custom properties** (`--portal-*`) in stylesheets
2. **TypeScript exports** for inline styles and CSS-in-JS
3. **Tailwind utilities** via `[var(--portal-*)]` syntax

### Why Tokens?

| Benefit | Description |
|---------|-------------|
| **Consistency** | Single source of truth for all visual properties |
| **Theming** | Easy dark/light mode switching via CSS variables |
| **Type Safety** | TypeScript exports with autocomplete |
| **Enforcement** | ESLint rule catches raw `hsl()` values |

---

## Utility Functions

Before diving into tokens, here are the utility functions for consuming them:

### `cssVar(name, alpha?)`

Wraps a token in `hsl(var(...))` for use in inline styles.

```typescript
import { cssVar, colors } from "@/lib/design-tokens";

// Basic usage
<div style={{ color: cssVar(colors.text.primary) }} />
// Output: color: hsl(var(--portal-text-primary))

// With alpha transparency
<div style={{ background: cssVar(colors.accent.blue, 0.1) }} />
// Output: background: hsl(var(--portal-accent-blue) / 0.1)
```

### `rawCssVar(name)`

Returns `var(--name)` without the `hsl()` wrapper. Use for non-color tokens.

```typescript
import { rawCssVar, spacingVars } from "@/lib/design-tokens";

<div style={{ padding: rawCssVar(spacingVars.md) }} />
// Output: padding: var(--portal-space-md)
```

### `portalClass(name)`

Generates a portal-prefixed class name.

```typescript
import { portalClass } from "@/lib/design-tokens";

<div className={portalClass('bg-primary')} />
// Output: class="portal-bg-primary"
```

---

## Color Tokens

Colors are organized by semantic purpose rather than raw values.

### Background Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| `colors.bg.primary` | `--portal-bg-primary` | Main page background |
| `colors.bg.secondary` | `--portal-bg-secondary` | Card backgrounds |
| `colors.bg.tertiary` | `--portal-bg-tertiary` | Nested card backgrounds |
| `colors.bg.elevated` | `--portal-bg-elevated` | Tooltips, dropdowns, modals |
| `colors.bg.hover` | `--portal-bg-hover` | Hover states for interactive elements |

**Example:**
```typescript
import { cssVar, colors } from "@/lib/design-tokens";

// Card with hover state
<div
  className="transition-colors"
  style={{
    background: cssVar(colors.bg.secondary),
  }}
  onMouseEnter={(e) => e.currentTarget.style.background = cssVar(colors.bg.hover)}
/>

// Tailwind approach
<div className="bg-[hsl(var(--portal-bg-secondary))] hover:bg-[hsl(var(--portal-bg-hover))]" />
```

### Border Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| `colors.border.default` | `--portal-border` | Default borders, dividers |
| `colors.border.hover` | `--portal-border-hover` | Hover state borders |

**Example:**
```typescript
<div
  className="border rounded-lg"
  style={{ borderColor: cssVar(colors.border.default) }}
/>
```

### Accent Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| `colors.accent.blue` | `--portal-accent-blue` | Primary actions, links, selected states |
| `colors.accent.blueHover` | `--portal-accent-blue-hover` | Hover state for blue accents |
| `colors.accent.blueLight` | `--portal-accent-blue-light` | Light blue backgrounds |
| `colors.accent.purple` | `--portal-accent-purple` | Secondary accent, charts |

**Example:**
```typescript
// Primary button
<button
  style={{
    background: cssVar(colors.accent.blue),
    color: 'white',
  }}
  className="hover:brightness-110 transition-all"
>
  Submit
</button>
```

### Text Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| `colors.text.primary` | `--portal-text-primary` | Headings, important text |
| `colors.text.secondary` | `--portal-text-secondary` | Body text, descriptions |
| `colors.text.muted` | `--portal-text-muted` | Labels, captions, placeholders |

**Example:**
```typescript
<h1 style={{ color: cssVar(colors.text.primary) }}>Dashboard</h1>
<p style={{ color: cssVar(colors.text.secondary) }}>Welcome back!</p>
<span style={{ color: cssVar(colors.text.muted) }}>Last updated: 5m ago</span>
```

### Status Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| `colors.status.success` | `--portal-success` | Positive trends, confirmations |
| `colors.status.error` | `--portal-error` | Errors, negative trends |
| `colors.status.warning` | `--portal-warning` | Warnings, caution states |
| `colors.status.info` | `--portal-info` | Informational messages |

**Example:**
```typescript
// Trend indicator
const trendColor = isPositive
  ? cssVar(colors.status.success)
  : cssVar(colors.status.error);

<span style={{ color: trendColor }}>
  {isPositive ? '+' : ''}{value}%
</span>
```

---

## Spacing Tokens

Consistent spacing scale based on 4px base unit.

| Token | CSS Variable | Raw Value | Pixels |
|-------|--------------|-----------|--------|
| `spacing.xs` / `spacingVars.xs` | `--portal-space-xs` | `0.5rem` | 8px |
| `spacing.sm` / `spacingVars.sm` | `--portal-space-sm` | `0.75rem` | 12px |
| `spacing.md` / `spacingVars.md` | `--portal-space-md` | `1rem` | 16px |
| `spacing.lg` / `spacingVars.lg` | `--portal-space-lg` | `1.5rem` | 24px |
| `spacing.xl` / `spacingVars.xl` | `--portal-space-xl` | `2rem` | 32px |
| `spacing['2xl']` / `spacingVars['2xl']` | `--portal-space-2xl` | `3rem` | 48px |

**Example:**
```typescript
import { spacing, spacingVars, rawCssVar } from "@/lib/design-tokens";

// Direct value
<div style={{ padding: spacing.md }}>Content</div>

// CSS variable (preferred for theming)
<div style={{ padding: rawCssVar(spacingVars.md) }}>Content</div>

// Tailwind
<div className="p-[var(--portal-space-md)]">Content</div>
```

---

## Border Radius Tokens

| Token | CSS Variable | Raw Value | Pixels |
|-------|--------------|-----------|--------|
| `radius.sm` / `radiusVars.sm` | `--portal-radius-sm` | `0.5rem` | 8px |
| `radius.md` / `radiusVars.md` | `--portal-radius-md` | `0.75rem` | 12px |
| `radius.lg` / `radiusVars.lg` | `--portal-radius-lg` | `1rem` | 16px |
| `radius.xl` / `radiusVars.xl` | `--portal-radius-xl` | `1.5rem` | 24px |
| `radius.full` | — | `9999px` | Pill/circle |

**Example:**
```typescript
import { radius, radiusVars, rawCssVar } from "@/lib/design-tokens";

// Card with medium radius
<div style={{ borderRadius: radius.md }}>Card</div>

// Using CSS variable
<div style={{ borderRadius: rawCssVar(radiusVars.lg) }}>Card</div>
```

---

## Typography Tokens

### Font Sizes

| Token | CSS Variable | Raw Value | Pixels |
|-------|--------------|-----------|--------|
| `typography.fontSize.xs` | `--portal-font-size-xs` | `0.75rem` | 12px |
| `typography.fontSize.sm` | `--portal-font-size-sm` | `0.875rem` | 14px |
| `typography.fontSize.base` | `--portal-font-size-base` | `1rem` | 16px |
| `typography.fontSize.lg` | `--portal-font-size-lg` | `1.125rem` | 18px |
| `typography.fontSize.xl` | `--portal-font-size-xl` | `1.25rem` | 20px |
| `typography.fontSize['2xl']` | `--portal-font-size-2xl` | `1.5rem` | 24px |
| `typography.fontSize['3xl']` | `--portal-font-size-3xl` | `1.875rem` | 30px |
| `typography.fontSize['4xl']` | `--portal-font-size-4xl` | `2.25rem` | 36px |

### Font Weights

| Token | Value |
|-------|-------|
| `typography.fontWeight.normal` | `400` |
| `typography.fontWeight.medium` | `500` |
| `typography.fontWeight.semibold` | `600` |
| `typography.fontWeight.bold` | `700` |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `typography.lineHeight.tight` | `1.2` | Headings |
| `typography.lineHeight.snug` | `1.3` | Subheadings |
| `typography.lineHeight.normal` | `1.5` | Body text |
| `typography.lineHeight.relaxed` | `1.625` | Long-form content |

**Example:**
```typescript
import { typography, fontSizeVars, rawCssVar } from "@/lib/design-tokens";

// KPI value styling
<span style={{
  fontSize: typography.fontSize['2xl'],
  fontWeight: typography.fontWeight.bold,
  lineHeight: typography.lineHeight.tight,
}}>
  $125,000
</span>
```

---

## Shadow Tokens

| Token | CSS Variable | Description |
|-------|--------------|-------------|
| `shadows.sm` | `--portal-shadow-sm` | Subtle elevation (cards) |
| `shadows.md` | `--portal-shadow-md` | Medium elevation (dropdowns) |
| `shadows.lg` | `--portal-shadow-lg` | High elevation (modals) |
| `shadows.glow` | `--portal-shadow-glow` | Blue glow effect (selected states) |
| `shadows.glowStrong` | `--portal-shadow-glow-strong` | Intense glow (focused inputs) |

**Example:**
```typescript
import { shadows, shadowVars, rawCssVar } from "@/lib/design-tokens";

// Card with hover shadow
<div
  className="transition-shadow"
  style={{ boxShadow: shadows.sm }}
  onMouseEnter={(e) => e.currentTarget.style.boxShadow = shadows.md}
/>

// Selected state with glow
<div style={{ boxShadow: `${shadows.md}, ${shadows.glow}` }}>
  Selected Card
</div>
```

---

## Transition Tokens

| Token | CSS Variable | Duration | Description |
|-------|--------------|----------|-------------|
| `transitions.fast` | `--portal-transition-fast` | 150ms | Micro-interactions (hover) |
| `transitions.base` | `--portal-transition-base` | 200ms | Standard transitions |
| `transitions.slow` | `--portal-transition-slow` | 300ms | Page transitions |
| `transitions.elegant` | `--portal-transition-elegant` | 400ms | Emphasis animations |

All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` (Material Design easing).

**Duration Values** (for JS animations):
```typescript
import { transitionDurations } from "@/lib/design-tokens";

// Use with framer-motion
<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: transitionDurations.base / 1000 }}
/>
```

**Example:**
```typescript
import { transitions } from "@/lib/design-tokens";

<div style={{
  transition: `background ${transitions.fast}, transform ${transitions.base}`
}}>
  Hover me
</div>

// Tailwind
<div className="transition-all duration-[150ms]" />
```

---

## Z-Index Tokens

| Token | CSS Variable | Value | Usage |
|-------|--------------|-------|-------|
| `zIndex.base` | `--portal-z-base` | `1` | Default stacking |
| `zIndex.elevated` | `--portal-z-elevated` | `10` | Cards, dropdowns |
| `zIndex.sticky` | `--portal-z-sticky` | `100` | Sticky headers, sidebars |
| `zIndex.modal` | `--portal-z-modal` | `1000` | Modals, dialogs |
| `zIndex.tooltip` | `--portal-z-tooltip` | `1100` | Tooltips (above modals) |

**Example:**
```typescript
import { zIndex } from "@/lib/design-tokens";

// Sticky header
<header style={{
  position: 'sticky',
  top: 0,
  zIndex: zIndex.sticky,
}}>
  Dashboard Header
</header>

// Modal
<div style={{ zIndex: zIndex.modal }}>
  <div style={{ zIndex: zIndex.tooltip }}>
    Tooltip inside modal
  </div>
</div>
```

---

## Chart Token Helpers

The design system includes specialized helpers for data visualization.

### `chartColors`

Pre-defined color palette for chart series:

```typescript
import { chartColors } from "@/lib/design-tokens";

chartColors.series    // Array of 6 color tokens for data series
chartColors.grid      // Grid line color (border.default)
chartColors.axis      // Axis text color (text.muted)
chartColors.tooltipBg // Tooltip background (bg.elevated)
chartColors.tooltipBorder // Tooltip border (border.default)
```

**Series Colors (in order):**
1. Blue (`portal-accent-blue`) - Primary series
2. Purple (`portal-accent-purple`) - Secondary series
3. Green (`portal-success`) - Tertiary series
4. Amber (`portal-warning`) - Quaternary series
5. Red (`portal-error`) - Quinary series
6. Cyan (`portal-info`) - Senary series

### `getChartColors()`

Returns an array of CSS variable values for all series colors.

```typescript
import { getChartColors } from "@/lib/design-tokens";

// ECharts pie chart example
const pieColors = getChartColors();
const option = {
  series: [{
    type: 'pie',
    data: data.map((item, index) => ({
      ...item,
      itemStyle: { color: pieColors[index % 6] }
    }))
  }]
};
```

### `getChartColor(index)`

Returns a single chart color by index. Automatically wraps around if index exceeds series length.

```typescript
import { getChartColor } from "@/lib/design-tokens";

// ECharts line series colors
const option = {
  series: [
    { name: 'Donations', type: 'line', color: getChartColor(0) }, // Blue
    { name: 'SMS', type: 'line', color: getChartColor(1) },       // Purple
    { name: 'Meta', type: 'line', color: getChartColor(2) },      // Green
  ]
};

// Safe for any index (wraps around)
getChartColor(7)  // Returns index 1 (purple) because 7 % 6 = 1
```

### Chart Configuration Example

```typescript
import {
  getChartColors,
  getChartColor,
  chartColors,
  cssVar
} from "@/lib/design-tokens";

// ECharts configuration with design tokens
const option = {
  grid: {
    borderColor: cssVar(chartColors.grid),
  },
  xAxis: {
    axisLabel: { color: cssVar(chartColors.axis) },
    axisLine: { lineStyle: { color: cssVar(chartColors.grid) } },
  },
  yAxis: {
    axisLabel: { color: cssVar(chartColors.axis) },
    splitLine: { lineStyle: { color: cssVar(chartColors.grid) } },
  },
  tooltip: {
    backgroundColor: cssVar(chartColors.tooltipBg),
    borderColor: cssVar(chartColors.tooltipBorder),
  },
  series: [
    { name: 'Donations', type: 'line', color: getChartColor(0) },
    { name: 'SMS', type: 'line', color: getChartColor(1) },
    { name: 'Meta', type: 'line', color: getChartColor(2) },
  ]
};
```

---

## ESLint Enforcement

The codebase includes an ESLint rule that warns against raw `hsl()` values in component files:

```javascript
// eslint.config.js
'no-restricted-syntax': [
  'warn',
  {
    selector: 'Literal[value=/^hsl\\(/]',
    message: 'Use design tokens (portal-* CSS vars) instead of raw hsl() values',
  },
],
```

**What triggers the warning:**
```typescript
// Bad - raw hsl() value
<div style={{ color: 'hsl(215 25% 90%)' }} />  // ESLint warning

// Good - design token
<div style={{ color: cssVar(colors.text.primary) }} />  // No warning
```

**How to fix violations:**

1. Find the appropriate token in this reference
2. Import from `@/lib/design-tokens`
3. Use `cssVar()` for colors or `rawCssVar()` for other values

---

## Type Exports

For TypeScript consumers, the following types are exported:

```typescript
import type {
  ColorToken,      // keyof typeof colors
  SpacingToken,    // keyof typeof spacing
  RadiusToken,     // keyof typeof radius
  ShadowToken,     // keyof typeof shadows
  TransitionToken, // keyof typeof transitions
  ZIndexToken,     // keyof typeof zIndex
  FontSizeToken,   // keyof typeof typography.fontSize
} from "@/lib/design-tokens";
```

---

## Quick Reference Card

```typescript
// Import everything you need
import {
  // Utilities
  cssVar,
  rawCssVar,
  portalClass,

  // Token objects
  colors,
  spacing,
  spacingVars,
  radius,
  radiusVars,
  typography,
  fontSizeVars,
  shadows,
  shadowVars,
  transitions,
  transitionVars,
  transitionDurations,
  zIndex,
  zIndexVars,

  // Chart helpers
  chartColors,
  getChartColors,
  getChartColor,

  // Combined object
  tokens,
} from "@/lib/design-tokens";

// Common patterns
cssVar(colors.text.primary)           // 'hsl(var(--portal-text-primary))'
cssVar(colors.accent.blue, 0.2)       // 'hsl(var(--portal-accent-blue) / 0.2)'
rawCssVar(spacingVars.md)             // 'var(--portal-space-md)'
getChartColor(0)                      // 'hsl(var(--portal-accent-blue))'
```

---

## Related Documentation

- [Client Dashboard Architecture](./client-dashboard-architecture.md) - How tokens integrate with components
- [World-Class Assessment](./WORLD_CLASS_ASSESSMENT.md) - Design system audit scores
