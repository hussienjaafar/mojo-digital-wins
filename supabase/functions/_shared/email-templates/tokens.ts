/**
 * Email Design Tokens
 *
 * Aligned with the MOLITICO. V3 dashboard design system.
 * All values are email-safe (inline CSS compatible).
 */

export const colors = {
  // Primary - matches --portal-accent-blue hsl(213 90% 45%)
  primary: '#1570C8',
  primaryDark: '#115a9e',
  secondary: '#8B5CF6',

  // Status - WCAG AA compliant, darker for email
  success: '#228B4A',        // hsl(150 60% 35%)
  warning: '#B87D00',        // hsl(38 92% 40%)
  error: '#C22727',          // hsl(0 72% 45%)
  info: '#0077B3',           // hsl(200 90% 40%)

  // Neutrals - aligned with portal text tokens
  text: '#1E293B',           // --portal-text-primary
  textSecondary: '#52606D',  // --portal-text-secondary
  textMuted: '#7A8593',      // --portal-text-muted
  background: '#F8FAFC',     // --portal-bg-primary
  surface: '#FFFFFF',        // --portal-bg-secondary
  border: '#D1D9E0',         // --portal-border

  // Severity (for alerts)
  severity: {
    critical: '#C22727',
    high: '#D85D00',
    medium: '#B87D00',
    low: '#0077B3',
  },
} as const;

export const fonts = {
  primary: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Monaco, monospace",
} as const;

export const fontSizes = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
} as const;

export const fontWeights = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  tight: '1.2',
  snug: '1.3',
  normal: '1.5',
  relaxed: '1.625',
} as const;

export const spacing = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '40px',
} as const;

export const layout = {
  maxWidth: '600px',
  borderRadius: '12px',       // Match --portal-radius-md (0.75rem)
  buttonRadius: '8px',        // Match --portal-radius-sm (0.5rem)
  accentBorderWidth: '4px',
} as const;

export const brand = {
  name: 'MOLITICO',
  tagline: 'Turning grassroots energy into unstoppable progressive wins.',
  copyrightYear: new Date().getFullYear(),
} as const;

// Severity configuration for alerts
export const severityConfig = {
  critical: {
    color: colors.severity.critical,
    emoji: '🚨',
    label: 'CRITICAL',
  },
  high: {
    color: colors.severity.high,
    emoji: '⚠️',
    label: 'HIGH',
  },
  medium: {
    color: colors.severity.medium,
    emoji: '📊',
    label: 'MEDIUM',
  },
  low: {
    color: colors.severity.low,
    emoji: 'ℹ️',
    label: 'LOW',
  },
} as const;

export type Severity = keyof typeof severityConfig;
export type ButtonVariant = 'primary' | 'secondary' | 'destructive';
