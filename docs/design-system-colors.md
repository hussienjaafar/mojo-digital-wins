# Design System Color Palette

This document outlines the colorblind-safe palette used throughout the dashboard.

## Colorblind-Safe Chart Palette

The chart colors are specifically chosen to be distinguishable by users with various types of color vision deficiency (CVD):

| Color Name | Hex Code | HSL | Usage |
|------------|----------|-----|-------|
| Blue | `#0EA5E9` | `199 89% 48%` | Primary data series, links |
| Green | `#10B981` | `160 84% 39%` | Positive trends, success states |
| Purple | `#8B5CF6` | `258 89% 66%` | Secondary data series |
| Amber | `#F59E0B` | `38 92% 50%` | Warning states, attention |
| Red | `#EF4444` | `0 84% 60%` | Negative trends, errors |
| Gray | `#6B7280` | `220 9% 46%` | Neutral, disabled states |

### Why These Colors Work

1. **Blue vs Orange/Amber**: High contrast for deuteranopia (green-blind) and protanopia (red-blind)
2. **Purple**: Distinguishable from blue and red for all CVD types
3. **Sufficient Luminance Contrast**: Each color has distinct brightness levels

## Semantic Color Tokens

### Portal Theme Variables

```css
/* Primary accents */
--portal-accent-blue: 199 89% 48%;      /* Primary actions, links */
--portal-accent-purple: 258 89% 66%;    /* Secondary emphasis */

/* Status colors */
--portal-success: 160 84% 39%;          /* Positive states */
--portal-warning: 38 92% 50%;           /* Warning states */
--portal-error: 0 84% 60%;              /* Error states */

/* Text hierarchy */
--portal-text-primary: 220 13% 91%;     /* Primary text */
--portal-text-secondary: 220 9% 70%;    /* Secondary text */
--portal-text-muted: 220 9% 55%;        /* Muted text */

/* Backgrounds */
--portal-bg-base: 222 47% 11%;          /* Page background */
--portal-bg-elevated: 220 41% 13%;      /* Cards, elevated surfaces */
--portal-bg-surface: 220 36% 17%;       /* Subtle surface distinction */

/* Borders */
--portal-border: 220 20% 25%;           /* Default borders */
--portal-border-hover: 220 20% 35%;     /* Hover state borders */
```

## Categorical Chart Palette (V3.1)

Scientifically validated 10-color colorblind-safe palette based on Okabe-Ito + Tableau research.
Colors alternate warm/cool for maximum adjacent-slice contrast.

| Position | CSS Variable | Hex | Name | Notes |
|----------|--------------|-----|------|-------|
| 0 | `--portal-chart-1` | `#0EA5E9` | Sky Blue | Primary (cool) |
| 1 | `--portal-chart-2` | `#F97316` | Orange | High contrast vs blue (warm) |
| 2 | `--portal-chart-3` | `#14B8A6` | Teal | Cool |
| 3 | `--portal-chart-4` | `#F43F5E` | Rose | Warm |
| 4 | `--portal-chart-5` | `#8B5CF6` | Violet | Purple family |
| 5 | `--portal-chart-6` | `#F59E0B` | Amber | Warning color |
| 6 | `--portal-chart-7` | `#10B981` | Emerald | Success color |
| 7 | `--portal-chart-8` | `#D946EF` | Fuchsia | Distinct pink |
| 8 | `--portal-chart-9` | `#06B6D4` | Cyan | Cool accent |
| 9 | `--portal-chart-10` | `#84CC16` | Lime | Distinct green |

### Color Assignment Logic

Pie/donut charts use **index-first assignment**:
- First 10 slices get colors 0-9 in order (ensures max contrast)
- Overflow slices (11+) use hash-based assignment for consistency
- "Other" category always uses muted gray

### Chart Color Usage Guidelines

#### Single Series
- Use **Sky Blue** (`--portal-chart-1`) as the default

#### Two Series Comparison
- **Sky Blue** + **Orange** for maximum contrast
- Example: Current period vs Previous period

#### Multi-Series (3+)
Colors are automatically assigned in order for optimal differentiation.

### Trend Indicators
- **Positive Trend**: Emerald (`--portal-chart-7` or `--portal-success`)
- **Negative Trend**: Rose (`--portal-chart-4` or `--portal-error`)
- **Neutral Trend**: Gray (muted)

## Accessibility Notes

### Contrast Ratios
All text colors meet WCAG AA standards:
- Primary text on base background: 13.2:1
- Secondary text on base background: 7.8:1
- Muted text on base background: 4.7:1

### Adjacent Color Contrast
The categorical palette alternates warm/cool hues:
- Blue (cool) → Orange (warm) → Teal (cool) → Rose (warm)
- Ensures deuteranopia (green-blind) and protanopia (red-blind) safety

### Additional Indicators
Never rely on color alone to convey information:
- Use icons alongside color (↑ for increase, ↓ for decrease)
- Include text labels with percentages
- Enable `useDecals` prop for pattern fills (stripes/dots) in accessibility-critical contexts

## Testing Resources

Test your implementations with these tools:
- [Coblis Color Blindness Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)
- [Stark Accessibility Plugin](https://www.getstark.co/)
- Chrome DevTools → Rendering → Emulate vision deficiencies
