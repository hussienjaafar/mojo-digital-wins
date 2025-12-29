/**
 * Design System Tokens
 *
 * TypeScript-friendly design tokens that mirror the CSS custom properties
 * defined in src/styles/portal-theme.css
 *
 * ## Quick Start
 * - Import `tokens` for raw values
 * - Import `cssVar()` to get CSS variable references for inline styles
 * - Import `portalClass()` to get portal-prefixed class names
 *
 * ## Typography Patterns
 *
 * ### Header Sizes (DashboardTopSection, TitleBlock)
 * | Size | Title                                      | Subtitle        |
 * |------|--------------------------------------------|--------------------|
 * | sm   | text-base font-semibold leading-snug       | text-xs            |
 * | md   | text-xl font-semibold leading-snug         | text-sm            |
 * | lg   | text-2xl font-bold leading-tight           | text-sm            |
 *
 * ### Text Colors
 * - Primary text: `text-[hsl(var(--portal-text-primary))]`
 * - Secondary text: `text-[hsl(var(--portal-text-secondary))]`
 * - Muted text: `text-[hsl(var(--portal-text-muted))]`
 *
 * ## Spacing Patterns
 *
 * ### Common Component Spacing
 * | Use Case             | Token                         | Value   |
 * |----------------------|-------------------------------|---------|
 * | Fine adjustments     | portal-space-2xs              | 4px     |
 * | Icon gaps            | portal-space-xs               | 8px     |
 * | Element gaps         | portal-space-sm               | 12px    |
 * | Section padding      | portal-space-md               | 16px    |
 * | Card padding         | portal-space-lg               | 24px    |
 * | Section gaps         | portal-space-xl               | 32px    |
 *
 * ### Responsive Layout Classes
 * ```tsx
 * // Mobile-first stacking with tablet/desktop row
 * className={cn(
 *   "flex flex-col gap-[var(--portal-space-md)]",
 *   "sm:flex-row sm:items-start sm:flex-wrap",
 *   "lg:items-center lg:flex-nowrap"
 * )}
 * ```
 *
 * ## Border & Shadow Patterns
 *
 * ### Elevation Levels (HeaderCard)
 * | Level     | Shadow Token              | Use Case             |
 * |-----------|---------------------------|----------------------|
 * | flat      | portal-shadow-none        | Inline elements      |
 * | raised    | portal-shadow-card        | Default cards        |
 * | elevated  | portal-shadow-card-elevated | Important sections |
 * | floating  | portal-shadow-lg          | Modals, popovers     |
 *
 * ### Border Styles
 * - subtle: `border-[hsl(var(--portal-border))]`
 * - accent: `border-[hsl(var(--portal-accent-blue))]`
 * - gradient: Use gradient wrapper component (see HeaderCard)
 *
 * ## Cross-Highlighting (KPI ↔ Chart)
 *
 * ### KPI_TO_SERIES_MAP Rules
 * - Only map KPIs to series that directly display the same data
 * - Calculated metrics (ROI, attribution) should map to empty arrays
 * - See `dashboardStore.ts` for current mappings
 */

// ============================================================================
// CSS Variable Utility
// ============================================================================

/**
 * Get a CSS variable reference for use in inline styles or CSS-in-JS
 * @example cssVar('portal-bg-primary') -> 'hsl(var(--portal-bg-primary))'
 */
export const cssVar = (name: string, alpha?: number): string => {
  if (alpha !== undefined) {
    return `hsl(var(--${name}) / ${alpha})`;
  }
  return `hsl(var(--${name}))`;
};

/**
 * Get a raw CSS variable reference (without hsl wrapper)
 * @example rawCssVar('portal-space-md') -> 'var(--portal-space-md)'
 */
export const rawCssVar = (name: string): string => `var(--${name})`;

/**
 * Get a portal-prefixed class name
 * @example portalClass('bg-primary') -> 'portal-bg-primary'
 */
export const portalClass = (name: string): string => `portal-${name}`;

// ============================================================================
// Color Tokens
// ============================================================================

export const colors = {
  bg: {
    primary: 'portal-bg-primary',
    secondary: 'portal-bg-secondary',
    tertiary: 'portal-bg-tertiary',
    elevated: 'portal-bg-elevated',
    hover: 'portal-bg-hover',
  },
  border: {
    default: 'portal-border',
    hover: 'portal-border-hover',
  },
  accent: {
    blue: 'portal-accent-blue',
    blueHover: 'portal-accent-blue-hover',
    blueLight: 'portal-accent-blue-light',
    purple: 'portal-accent-purple',
  },
  text: {
    primary: 'portal-text-primary',
    secondary: 'portal-text-secondary',
    muted: 'portal-text-muted',
  },
  status: {
    success: 'portal-success',
    error: 'portal-error',
    warning: 'portal-warning',
    info: 'portal-info',
  },
} as const;

// ============================================================================
// Spacing Tokens (8px grid system)
// ============================================================================

export const spacing = {
  '2xs': '0.25rem',  // 4px - fine adjustments
  xs: '0.5rem',      // 8px
  sm: '0.75rem',     // 12px
  md: '1rem',        // 16px
  lg: '1.5rem',      // 24px
  xl: '2rem',        // 32px
  '2xl': '2.5rem',   // 40px
  '3xl': '3rem',     // 48px
  '4xl': '4rem',     // 64px
} as const;

export const spacingVars = {
  '2xs': 'portal-space-2xs',
  xs: 'portal-space-xs',
  sm: 'portal-space-sm',
  md: 'portal-space-md',
  lg: 'portal-space-lg',
  xl: 'portal-space-xl',
  '2xl': 'portal-space-2xl',
  '3xl': 'portal-space-3xl',
  '4xl': 'portal-space-4xl',
} as const;

// ============================================================================
// Border Radius Tokens
// ============================================================================

export const radius = {
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  full: '9999px',
} as const;

export const radiusVars = {
  sm: 'portal-radius-sm',
  md: 'portal-radius-md',
  lg: 'portal-radius-lg',
  xl: 'portal-radius-xl',
} as const;

// ============================================================================
// Typography Tokens
// ============================================================================

export const typography = {
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',
    snug: '1.3',
    normal: '1.5',
    relaxed: '1.625',
  },
} as const;

export const fontSizeVars = {
  xs: 'portal-font-size-xs',
  sm: 'portal-font-size-sm',
  base: 'portal-font-size-base',
  lg: 'portal-font-size-lg',
  xl: 'portal-font-size-xl',
  '2xl': 'portal-font-size-2xl',
  '3xl': 'portal-font-size-3xl',
  '4xl': 'portal-font-size-4xl',
} as const;

// ============================================================================
// Shadow Tokens (Elevation System)
// ============================================================================

export const shadows = {
  // Elevation levels
  none: 'none',
  sm: '0 1px 3px hsl(215 25% 15% / 0.08), 0 1px 2px hsl(215 25% 15% / 0.06)',
  md: '0 4px 6px hsl(215 25% 15% / 0.08), 0 2px 4px hsl(215 25% 15% / 0.06)',
  lg: '0 10px 15px hsl(215 25% 15% / 0.1), 0 4px 6px hsl(215 25% 15% / 0.05)',
  xl: '0 20px 25px hsl(215 25% 15% / 0.12), 0 10px 10px hsl(215 25% 15% / 0.06)',
  // Glow effects
  glow: '0 0 20px hsl(213 90% 45% / 0.2)',
  glowStrong: '0 0 30px hsl(213 90% 45% / 0.25)',
  glowPurple: '0 0 20px hsl(270 70% 55% / 0.2)',
  glowSuccess: '0 0 16px hsl(150 70% 50% / 0.25)',
  // Inner shadows for depth
  inset: 'inset 0 1px 2px hsl(215 25% 15% / 0.05)',
  // Card elevation presets
  card: '0 1px 3px hsl(215 25% 15% / 0.06), 0 1px 2px hsl(215 25% 15% / 0.04)',
  cardHover: '0 8px 16px hsl(215 25% 15% / 0.1), 0 4px 8px hsl(215 25% 15% / 0.06)',
  cardElevated: '0 4px 12px hsl(215 25% 15% / 0.08), 0 2px 6px hsl(215 25% 15% / 0.05)',
} as const;

export const shadowVars = {
  none: 'portal-shadow-none',
  sm: 'portal-shadow-sm',
  md: 'portal-shadow-md',
  lg: 'portal-shadow-lg',
  xl: 'portal-shadow-xl',
  glow: 'portal-shadow-glow',
  glowStrong: 'portal-shadow-glow-strong',
  glowPurple: 'portal-shadow-glow-purple',
  glowSuccess: 'portal-shadow-glow-success',
  inset: 'portal-shadow-inset',
  card: 'portal-shadow-card',
  cardHover: 'portal-shadow-card-hover',
  cardElevated: 'portal-shadow-card-elevated',
} as const;

// ============================================================================
// Transition Tokens
// ============================================================================

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  elegant: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const transitionVars = {
  fast: 'portal-transition-fast',
  base: 'portal-transition-base',
  slow: 'portal-transition-slow',
  elegant: 'portal-transition-elegant',
} as const;

export const transitionDurations = {
  fast: 150,
  base: 200,
  slow: 300,
  elegant: 400,
} as const;

// ============================================================================
// Z-Index Tokens
// ============================================================================

export const zIndex = {
  base: 1,
  elevated: 10,
  sticky: 100,
  modal: 1000,
  tooltip: 1100,
} as const;

export const zIndexVars = {
  base: 'portal-z-base',
  elevated: 'portal-z-elevated',
  sticky: 'portal-z-sticky',
  modal: 'portal-z-modal',
  tooltip: 'portal-z-tooltip',
} as const;

// ============================================================================
// Chart Tokens
// ============================================================================

/**
 * Chart-specific color tokens for consistent data visualization
 * Use chartColors for Recharts/ECharts series colors
 */
export const chartColors = {
  /** Primary series colors - use for pie charts, bar series, line series */
  series: [
    colors.accent.blue,      // Primary - blue
    colors.accent.purple,    // Secondary - purple
    colors.status.success,   // Tertiary - green
    colors.status.warning,   // Quaternary - amber
    colors.status.error,     // Quinary - red
    colors.status.info,      // Senary - cyan
  ],
  /** Grid line color */
  grid: colors.border.default,
  /** Axis text color */
  axis: colors.text.muted,
  /** Tooltip background */
  tooltipBg: colors.bg.elevated,
  /** Tooltip border */
  tooltipBorder: colors.border.default,
} as const;

/**
 * Channel-specific color tokens for consistent channel visualization
 * Use for channel legends, badges, and charts
 */
export const channelColors = {
  meta: colors.accent.blue,
  sms: colors.accent.purple,
  actblue: colors.status.success,
  organic: colors.text.muted,
  email: colors.status.warning,
  direct: colors.status.info,
} as const;

/**
 * Get channel color as CSS variable value
 * @example getChannelColor('meta') -> 'hsl(var(--portal-accent-blue))'
 */
export const getChannelColor = (channel: keyof typeof channelColors): string =>
  cssVar(channelColors[channel]);

/**
 * Get all channel colors as an object with CSS variable values
 */
export const getChannelColorMap = (): Record<keyof typeof channelColors, string> => ({
  meta: cssVar(channelColors.meta),
  sms: cssVar(channelColors.sms),
  actblue: cssVar(channelColors.actblue),
  organic: cssVar(channelColors.organic),
  email: cssVar(channelColors.email),
  direct: cssVar(channelColors.direct),
});

/**
 * Get chart colors as CSS variable values (for inline styles)
 * @example getChartColors() -> ['hsl(var(--portal-accent-blue))', ...]
 */
export const getChartColors = (): string[] =>
  chartColors.series.map(token => cssVar(token));

/**
 * Get a single chart color by index (wraps around if index > series length)
 */
export const getChartColor = (index: number): string =>
  cssVar(chartColors.series[index % chartColors.series.length]);

// ============================================================================
// Icon Size Tokens
// ============================================================================

/**
 * Standardized icon sizes for consistent UI
 * Use with className like: iconSizes.sm -> "h-4 w-4"
 */
export const iconSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-12 w-12',
} as const;

/**
 * Performance tier color mappings using portal tokens
 * Use for badges, indicators, and highlights
 */
export const tierColors = {
  top: {
    bg: 'bg-[hsl(var(--portal-success)/0.15)]',
    text: 'text-[hsl(var(--portal-success))]',
    border: 'border-[hsl(var(--portal-success)/0.3)]',
  },
  high: {
    bg: 'bg-[hsl(var(--portal-accent-blue)/0.15)]',
    text: 'text-[hsl(var(--portal-accent-blue))]',
    border: 'border-[hsl(var(--portal-accent-blue)/0.3)]',
  },
  medium: {
    bg: 'bg-[hsl(var(--portal-warning)/0.15)]',
    text: 'text-[hsl(var(--portal-warning))]',
    border: 'border-[hsl(var(--portal-warning)/0.3)]',
  },
  low: {
    bg: 'bg-[hsl(var(--portal-error)/0.15)]',
    text: 'text-[hsl(var(--portal-error))]',
    border: 'border-[hsl(var(--portal-error)/0.3)]',
  },
} as const;

/**
 * Get tier color classes as a combined string
 * @example getTierClasses('top') -> 'bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]'
 */
export const getTierClasses = (tier: keyof typeof tierColors | string | null): string => {
  const normalizedTier = tier?.toLowerCase() as keyof typeof tierColors;
  const tierConfig = tierColors[normalizedTier];
  if (!tierConfig) return 'bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-muted))]';
  return `${tierConfig.bg} ${tierConfig.text}`;
};

/**
 * Heatmap color intensity mappings
 * Use for performance matrices and heatmaps
 */
export const heatmapColors = {
  high: 'bg-[hsl(var(--portal-success)/0.8)] text-white',
  mediumHigh: 'bg-[hsl(var(--portal-success)/0.4)]',
  medium: 'bg-[hsl(var(--portal-warning)/0.4)]',
  low: 'bg-[hsl(var(--portal-error)/0.2)]',
  none: 'bg-[hsl(var(--portal-bg-secondary))]',
} as const;

/**
 * Get heatmap color class based on intensity (0-1)
 */
export const getHeatmapColor = (intensity: number): string => {
  if (intensity >= 0.75) return heatmapColors.high;
  if (intensity >= 0.5) return heatmapColors.mediumHigh;
  if (intensity >= 0.25) return heatmapColors.medium;
  if (intensity > 0) return heatmapColors.low;
  return heatmapColors.none;
};

// ============================================================================
// Sidebar Navigation Types
// ============================================================================

export interface SidebarNavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: 'default' | 'destructive' | 'success' | 'warning';
}

export interface SidebarNavSection {
  label: string;
  items: SidebarNavItem[];
}

// ============================================================================
// Component-Specific Tokens
// ============================================================================

/**
 * StatusChip component tokens
 * Variants: live (pulsing green), updated (static blue), syncing (animated blue)
 */
export const statusChip = {
  /** Padding inside the chip */
  padding: { x: spacing.sm, y: spacing['2xs'] },
  /** Border radius for pill shape */
  radius: radius.full,
  /** Font size for chip text */
  fontSize: typography.fontSize.xs,
  /** Dot indicator size */
  dotSize: '6px',
  /** Minimum height for touch target */
  minHeight: '24px',
  /** Gap between dot and text */
  gap: spacing['2xs'],
  /** Variants with color tokens */
  variants: {
    live: {
      bg: 'portal-success',
      bgOpacity: 0.12,
      text: 'portal-success',
      dotColor: 'portal-success',
      hasPulse: true,
    },
    updated: {
      bg: 'portal-accent-blue',
      bgOpacity: 0.1,
      text: 'portal-text-muted',
      dotColor: null,
      hasPulse: false,
    },
    syncing: {
      bg: 'portal-accent-blue',
      bgOpacity: 0.1,
      text: 'portal-accent-blue',
      dotColor: 'portal-accent-blue',
      hasPulse: true,
    },
  },
} as const;

/**
 * HeaderCard component tokens
 * Elevation and border variants for card containers
 */
export const headerCard = {
  /** Padding options */
  padding: {
    sm: spacing.md,
    md: spacing.lg,
    lg: spacing.xl,
  },
  /** Border radius */
  radius: radius.lg,
  /** Background color token */
  bg: 'portal-bg-secondary',
  /** Border variants */
  borderVariants: {
    none: 'transparent',
    subtle: 'portal-border',
    accent: 'portal-accent-blue',
    gradient: 'linear-gradient(135deg, hsl(var(--portal-accent-blue)/0.3), hsl(var(--portal-accent-purple)/0.2))',
  },
  /** Elevation (shadow) variants */
  elevationVariants: {
    flat: shadows.none,
    raised: shadows.card,
    elevated: shadows.cardElevated,
    floating: shadows.lg,
  },
} as const;

/**
 * TitleBlock component tokens
 * Typography and layout for section headers
 */
export const titleBlock = {
  /** Icon container sizing */
  iconContainer: {
    size: '40px',
    radius: radius.md,
    padding: spacing.xs,
  },
  /** Title typography */
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.snug,
    color: 'portal-text-primary',
  },
  /** Subtitle typography */
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
    color: 'portal-text-muted',
  },
  /** Spacing between elements */
  spacing: {
    iconToText: spacing.sm,
    titleToSubtitle: spacing['2xs'],
    titleToStatus: spacing.sm,
  },
} as const;

// ============================================================================
// Combined Tokens Object
// ============================================================================

export const tokens = {
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
  chartColors,
  // Component-specific tokens
  statusChip,
  headerCard,
  titleBlock,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadows;
export type TransitionToken = keyof typeof transitions;
export type ZIndexToken = keyof typeof zIndex;
export type FontSizeToken = keyof typeof typography.fontSize;
export type StatusChipVariant = keyof typeof statusChip.variants;
export type HeaderCardBorderVariant = keyof typeof headerCard.borderVariants;
export type HeaderCardElevation = keyof typeof headerCard.elevationVariants;
