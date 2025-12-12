/**
 * Design System Tokens
 *
 * TypeScript-friendly design tokens that mirror the CSS custom properties
 * defined in src/styles/portal-theme.css
 *
 * Usage:
 * - Import `tokens` for raw values
 * - Import `cssVar()` to get CSS variable references for inline styles
 * - Import `portalClass()` to get portal-prefixed class names
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
// Spacing Tokens
// ============================================================================

export const spacing = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
} as const;

export const spacingVars = {
  xs: 'portal-space-xs',
  sm: 'portal-space-sm',
  md: 'portal-space-md',
  lg: 'portal-space-lg',
  xl: 'portal-space-xl',
  '2xl': 'portal-space-2xl',
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
// Shadow Tokens
// ============================================================================

export const shadows = {
  sm: '0 1px 3px hsl(215 25% 15% / 0.08), 0 1px 2px hsl(215 25% 15% / 0.06)',
  md: '0 4px 6px hsl(215 25% 15% / 0.08), 0 2px 4px hsl(215 25% 15% / 0.06)',
  lg: '0 10px 15px hsl(215 25% 15% / 0.1), 0 4px 6px hsl(215 25% 15% / 0.05)',
  glow: '0 0 20px hsl(213 90% 45% / 0.2)',
  glowStrong: '0 0 30px hsl(213 90% 45% / 0.25)',
} as const;

export const shadowVars = {
  sm: 'portal-shadow-sm',
  md: 'portal-shadow-md',
  lg: 'portal-shadow-lg',
  glow: 'portal-shadow-glow',
  glowStrong: 'portal-shadow-glow-strong',
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
} as const;

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
// Type Exports
// ============================================================================

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadows;
export type TransitionToken = keyof typeof transitions;
export type ZIndexToken = keyof typeof zIndex;
export type FontSizeToken = keyof typeof typography.fontSize;
