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

## Chart Color Usage Guidelines

### Single Series
- Use **Blue** (`#0EA5E9`) as the default single-series color

### Two Series Comparison
- **Blue** + **Amber** for maximum contrast
- Example: Current period vs Previous period

### Multi-Series (3+)
Apply colors in this order for optimal differentiation:
1. Blue (`#0EA5E9`)
2. Green (`#10B981`)
3. Purple (`#8B5CF6`)
4. Amber (`#F59E0B`)
5. Red (`#EF4444`)
6. Gray (`#6B7280`)

### Trend Indicators
- **Positive Trend**: Green (`--portal-success`)
- **Negative Trend**: Red (`--portal-error`)
- **Neutral Trend**: Gray (muted)

## Accessibility Notes

### Contrast Ratios
All text colors meet WCAG AA standards:
- Primary text on base background: 13.2:1
- Secondary text on base background: 7.8:1
- Muted text on base background: 4.7:1

### Additional Indicators
Never rely on color alone to convey information:
- Use icons alongside color (↑ for increase, ↓ for decrease)
- Include text labels with percentages
- Use pattern fills in charts when possible

## Testing Resources

Test your implementations with these tools:
- [Coblis Color Blindness Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)
- [Stark Accessibility Plugin](https://www.getstark.co/)
- Chrome DevTools → Rendering → Emulate vision deficiencies
