/**
 * Email Design Tokens
 *
 * Matches the Molitico. dashboard design system.
 * All values are email-safe (inline CSS compatible).
 */

export const colors = {
  // Primary
  primary: '#1570C8',
  primaryDark: '#115a9e',
  secondary: '#8B5CF6',

  // Status
  success: '#16a34a',
  warning: '#ca8a04',
  error: '#dc2626',
  info: '#0EA5E9',

  // Neutrals
  text: '#1a1a1a',
  textSecondary: '#525252',
  textMuted: '#737373',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e5e7eb',

  // Severity (for alerts)
  severity: {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#0EA5E9',
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
  borderRadius: '8px',
  buttonRadius: '6px',
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
