/**
 * Reusable Email Components
 *
 * All components return inline-styled HTML strings for email compatibility.
 */

import {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  spacing,
  layout,
  severityConfig,
  type ButtonVariant,
  type Severity,
} from './tokens.ts';

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Button component
 */
export function button(
  text: string,
  url: string,
  variant: ButtonVariant = 'primary'
): string {
  const styles: Record<ButtonVariant, { bg: string; color: string; border: string }> = {
    primary: {
      bg: colors.primary,
      color: '#ffffff',
      border: colors.primary,
    },
    secondary: {
      bg: '#ffffff',
      color: colors.primary,
      border: colors.primary,
    },
    destructive: {
      bg: colors.error,
      color: '#ffffff',
      border: colors.error,
    },
  };

  const style = styles[variant];

  return `
    <a href="${escapeHtml(url)}"
       style="display: inline-block;
              background-color: ${style.bg};
              color: ${style.color};
              border: 2px solid ${style.border};
              padding: 12px 24px;
              border-radius: ${layout.buttonRadius};
              font-family: ${fonts.primary};
              font-size: ${fontSizes.sm};
              font-weight: ${fontWeights.semibold};
              text-decoration: none;
              text-align: center;
              mso-padding-alt: 0;
              <!--[if mso]>
              <i style="letter-spacing: 24px; mso-font-width: -100%; mso-text-raise: 24pt;">&nbsp;</i>
              <![endif]-->"
       target="_blank">
      ${escapeHtml(text)}
    </a>
  `;
}

/**
 * Card component with optional left accent border
 */
export function card(
  content: string,
  accentColor?: string
): string {
  const accentStyle = accentColor
    ? `border-left: ${layout.accentBorderWidth} solid ${accentColor};`
    : '';

  return `
    <div style="background-color: ${colors.surface};
                border: 1px solid ${colors.border};
                border-radius: ${layout.borderRadius};
                padding: ${spacing.md};
                margin: ${spacing.md} 0;
                ${accentStyle}">
      ${content}
    </div>
  `;
}

/**
 * Info box for key-value display
 */
export function infoBox(label: string, value: string): string {
  return `
    <div style="background-color: ${colors.background};
                border-radius: 6px;
                padding: ${spacing.sm} ${spacing.md};
                margin: ${spacing.md} 0;">
      <span style="color: ${colors.textMuted};
                   font-family: ${fonts.primary};
                   font-size: ${fontSizes.sm};">
        ${escapeHtml(label)}:
      </span>
      <span style="color: ${colors.text};
                   font-family: ${fonts.mono};
                   font-size: ${fontSizes.sm};
                   font-weight: ${fontWeights.medium};">
        ${escapeHtml(value)}
      </span>
    </div>
  `;
}

/**
 * Heading component
 */
export function heading(
  text: string,
  level: 1 | 2 | 3 = 1
): string {
  const sizes: Record<number, string> = {
    1: fontSizes['2xl'],
    2: fontSizes.xl,
    3: fontSizes.lg,
  };

  const margins: Record<number, string> = {
    1: `0 0 ${spacing.md} 0`,
    2: `${spacing.lg} 0 ${spacing.sm} 0`,
    3: `${spacing.md} 0 ${spacing.xs} 0`,
  };

  return `
    <h${level} style="color: ${colors.text};
                      font-family: ${fonts.primary};
                      font-size: ${sizes[level]};
                      font-weight: ${fontWeights.bold};
                      line-height: 1.2;
                      margin: ${margins[level]};">
      ${escapeHtml(text)}
    </h${level}>
  `;
}

/**
 * Paragraph component
 */
export function paragraph(text: string, muted = false): string {
  return `
    <p style="color: ${muted ? colors.textMuted : colors.textSecondary};
              font-family: ${fonts.primary};
              font-size: ${fontSizes.base};
              line-height: 1.5;
              margin: 0 0 ${spacing.md} 0;">
      ${text}
    </p>
  `;
}

/**
 * Divider component
 */
export function divider(): string {
  return `
    <hr style="border: 0;
               border-top: 1px solid ${colors.border};
               margin: ${spacing.lg} 0;" />
  `;
}

/**
 * Badge component
 */
export function badge(
  text: string,
  color: string = colors.primary
): string {
  // Calculate a lighter background from the color
  return `
    <span style="display: inline-block;
                 background-color: ${color}20;
                 color: ${color};
                 padding: 4px 12px;
                 border-radius: 9999px;
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes.xs};
                 font-weight: ${fontWeights.semibold};">
      ${escapeHtml(text)}
    </span>
  `;
}

/**
 * Severity badge for alerts
 */
export function severityBadge(severity: Severity): string {
  const config = severityConfig[severity];
  return `
    <span style="display: inline-block;
                 background-color: ${config.color};
                 color: #ffffff;
                 padding: 4px 12px;
                 border-radius: 9999px;
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes.xs};
                 font-weight: ${fontWeights.bold};">
      ${config.emoji} ${config.label}
    </span>
  `;
}

/**
 * Stat card for reports
 */
export function statCard(
  value: string,
  label: string,
  color: string = colors.primary
): string {
  return `
    <div style="background-color: ${colors.surface};
                border: 1px solid ${colors.border};
                border-radius: ${layout.borderRadius};
                padding: ${spacing.md};
                text-align: center;
                min-width: 100px;">
      <div style="color: ${color};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes['2xl']};
                  font-weight: ${fontWeights.bold};
                  line-height: 1.2;">
        ${escapeHtml(value)}
      </div>
      <div style="color: ${colors.textMuted};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.sm};
                  margin-top: 4px;">
        ${escapeHtml(label)}
      </div>
    </div>
  `;
}

/**
 * Stats row (horizontal layout for multiple stat cards)
 */
export function statsRow(stats: Array<{ value: string; label: string; color?: string }>): string {
  const cards = stats
    .map(s => `
      <td style="padding: 0 8px; vertical-align: top;">
        ${statCard(s.value, s.label, s.color)}
      </td>
    `)
    .join('');

  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin: ${spacing.md} auto;">
      <tr>
        ${cards}
      </tr>
    </table>
  `;
}

/**
 * Metric row for alerts (label: value format)
 */
export function metricRow(label: string, value: string): string {
  return `
    <div style="padding: 4px 0;
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};">
      <span style="color: ${colors.textMuted};">${escapeHtml(label)}:</span>
      <span style="color: ${colors.text}; font-weight: ${fontWeights.semibold}; margin-left: 8px;">
        ${escapeHtml(value)}
      </span>
    </div>
  `;
}

/**
 * List item
 */
export function listItem(text: string): string {
  return `
    <li style="color: ${colors.textSecondary};
               font-family: ${fonts.primary};
               font-size: ${fontSizes.base};
               line-height: 1.5;
               margin-bottom: 8px;">
      ${text}
    </li>
  `;
}

/**
 * Unordered list
 */
export function list(items: string[]): string {
  const listItems = items.map(item => listItem(item)).join('');
  return `
    <ul style="margin: ${spacing.md} 0;
               padding-left: ${spacing.lg};">
      ${listItems}
    </ul>
  `;
}

/**
 * Warning/notice box
 */
export function noticeBox(
  content: string,
  type: 'warning' | 'info' | 'success' | 'error' = 'info'
): string {
  const typeColors = {
    warning: { bg: '#fef3cd', border: colors.warning, text: '#856404' },
    info: { bg: '#cce5ff', border: colors.info, text: '#004085' },
    success: { bg: '#d4edda', border: colors.success, text: '#155724' },
    error: { bg: '#f8d7da', border: colors.error, text: '#721c24' },
  };

  const style = typeColors[type];

  return `
    <div style="background-color: ${style.bg};
                border-left: 4px solid ${style.border};
                border-radius: 4px;
                padding: ${spacing.md};
                margin: ${spacing.md} 0;">
      <p style="color: ${style.text};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: 0;">
        ${content}
      </p>
    </div>
  `;
}

/**
 * Link component
 */
export function link(text: string, url: string): string {
  return `
    <a href="${escapeHtml(url)}"
       style="color: ${colors.primary};
              text-decoration: underline;"
       target="_blank">
      ${escapeHtml(text)}
    </a>
  `;
}

/**
 * Small/muted text
 */
export function smallText(text: string): string {
  return `
    <p style="color: ${colors.textMuted};
              font-family: ${fonts.primary};
              font-size: ${fontSizes.xs};
              line-height: 1.5;
              margin: ${spacing.md} 0 0 0;">
      ${text}
    </p>
  `;
}
