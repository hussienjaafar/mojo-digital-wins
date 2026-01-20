/**
 * Alert Email Templates
 *
 * Spike alerts, notifications.
 * Severity-coded colors, scannable metrics, quick context.
 */

import { alertTemplate } from '../base.ts';
import {
  heading,
  paragraph,
  button,
  card,
  metricRow,
  severityBadge,
  divider,
  smallText,
  escapeHtml,
} from '../components.ts';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
  severityConfig,
  type Severity,
} from '../tokens.ts';

interface SpikeAlertOptions {
  entityName: string;
  severity: Severity;
  velocityIncrease: string;
  mentionCount: number;
  timeWindow: string;
  context?: string;
  relatedArticles?: number;
  dashboardUrl?: string;
  timestamp: string;
  preferencesUrl?: string;
}

/**
 * Spike alert email
 */
export function spikeAlert(options: SpikeAlertOptions): string {
  const {
    entityName,
    severity,
    velocityIncrease,
    mentionCount,
    timeWindow,
    context,
    relatedArticles,
    dashboardUrl,
    timestamp,
    preferencesUrl,
  } = options;

  const config = severityConfig[severity];

  const metricsContent = `
    ${metricRow('Velocity', `+${velocityIncrease}`)}
    ${metricRow('Mentions', mentionCount.toLocaleString())}
    ${metricRow('Time window', timeWindow)}
    ${relatedArticles ? metricRow('Related articles', relatedArticles.toString()) : ''}
  `;

  const contextSection = context
    ? `
      ${divider()}
      <div style="margin: ${spacing.md} 0;">
        <p style="color: ${colors.textMuted};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.sm};
                  margin: 0 0 8px 0;">
          Context:
        </p>
        <p style="color: ${colors.textSecondary};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.base};
                  line-height: 1.5;
                  margin: 0;">
          ${escapeHtml(context)}
        </p>
      </div>
    `
    : '';

  const ctaSection = dashboardUrl
    ? `
      <div style="text-align: center; margin: ${spacing.lg} 0;">
        ${button('View in Dashboard', dashboardUrl, 'primary')}
      </div>
    `
    : '';

  const content = `
    <div style="margin-bottom: ${spacing.md};">
      ${severityBadge(severity)}
    </div>
    <h1 style="color: ${colors.text};
               font-family: ${fonts.primary};
               font-size: ${fontSizes['2xl']};
               font-weight: ${fontWeights.bold};
               margin: 0 0 ${spacing.md} 0;">
      ${config.emoji} ${escapeHtml(entityName)}
    </h1>
    ${paragraph(`Spike detected at ${escapeHtml(timestamp)} ET`)}
    ${card(metricsContent, config.color)}
    ${contextSection}
    ${ctaSection}
  `;

  const finalHtml = alertTemplate(
    content,
    config.color,
    `${config.label}: ${entityName} spike detected`
  );

  // Replace preferences URL placeholder
  return preferencesUrl
    ? finalHtml.replace('{{PREFERENCES_URL}}', preferencesUrl)
    : finalHtml.replace('{{PREFERENCES_URL}}', '#');
}

interface NotificationOptions {
  title: string;
  message: string;
  type: 'bill_update' | 'new_article' | 'bill_alert' | 'bookmark_update' | 'general';
  actionUrl?: string;
  actionText?: string;
  preferencesUrl?: string;
}

/**
 * General notification email
 */
export function notification(options: NotificationOptions): string {
  const {
    title,
    message,
    type,
    actionUrl,
    actionText = 'View Details',
    preferencesUrl,
  } = options;

  // Map notification type to color
  const typeColors: Record<string, string> = {
    bill_update: colors.primary,
    new_article: colors.info,
    bill_alert: colors.warning,
    bookmark_update: colors.secondary,
    general: colors.primary,
  };

  const accentColor = typeColors[type] || colors.primary;

  const ctaSection = actionUrl
    ? `
      <div style="text-align: center; margin: ${spacing.lg} 0;">
        ${button(actionText, actionUrl, 'primary')}
      </div>
    `
    : '';

  const content = `
    ${heading(title)}
    <div style="background-color: ${colors.surface};
                border-left: 4px solid ${accentColor};
                padding: ${spacing.md};
                margin: ${spacing.md} 0;
                border-radius: 4px;">
      <p style="color: ${colors.textSecondary};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.base};
                line-height: 1.5;
                margin: 0;">
        ${escapeHtml(message)}
      </p>
    </div>
    ${ctaSection}
  `;

  const finalHtml = alertTemplate(content, accentColor, title);

  return preferencesUrl
    ? finalHtml.replace('{{PREFERENCES_URL}}', preferencesUrl)
    : finalHtml.replace('{{PREFERENCES_URL}}', '#');
}

interface MultiAlertOptions {
  alerts: Array<{
    entityName: string;
    severity: Severity;
    velocityIncrease: string;
    mentionCount: number;
  }>;
  dashboardUrl?: string;
  timestamp: string;
  preferencesUrl?: string;
}

/**
 * Multiple alerts summary email
 */
export function multiAlertSummary(options: MultiAlertOptions): string {
  const {
    alerts,
    dashboardUrl,
    timestamp,
    preferencesUrl,
  } = options;

  // Find highest severity for header color
  const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
  const highestSeverity = severityOrder.find(s =>
    alerts.some(a => a.severity === s)
  ) || 'medium';

  const config = severityConfig[highestSeverity];

  const alertRows = alerts.map(alert => {
    const alertConfig = severityConfig[alert.severity];
    return `
      <tr>
        <td style="padding: 8px 12px;
                   border-bottom: 1px solid ${colors.border};
                   font-family: ${fonts.primary};">
          <span style="color: ${alertConfig.color}; font-weight: ${fontWeights.semibold};">
            ${alertConfig.emoji}
          </span>
          ${escapeHtml(alert.entityName)}
        </td>
        <td style="padding: 8px 12px;
                   border-bottom: 1px solid ${colors.border};
                   font-family: ${fonts.primary};
                   text-align: right;
                   color: ${alertConfig.color};
                   font-weight: ${fontWeights.semibold};">
          +${alert.velocityIncrease}
        </td>
        <td style="padding: 8px 12px;
                   border-bottom: 1px solid ${colors.border};
                   font-family: ${fonts.primary};
                   text-align: right;
                   color: ${colors.textSecondary};">
          ${alert.mentionCount.toLocaleString()}
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    ${heading(`${alerts.length} Active Alerts`)}
    ${paragraph(`Summary as of ${escapeHtml(timestamp)} ET`)}
    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           style="border: 1px solid ${colors.border};
                  border-radius: 8px;
                  margin: ${spacing.md} 0;">
      <thead>
        <tr style="background-color: ${colors.background};">
          <th style="padding: 12px;
                     text-align: left;
                     font-family: ${fonts.primary};
                     font-size: ${fontSizes.sm};
                     color: ${colors.textMuted};
                     border-bottom: 1px solid ${colors.border};">
            Entity
          </th>
          <th style="padding: 12px;
                     text-align: right;
                     font-family: ${fonts.primary};
                     font-size: ${fontSizes.sm};
                     color: ${colors.textMuted};
                     border-bottom: 1px solid ${colors.border};">
            Velocity
          </th>
          <th style="padding: 12px;
                     text-align: right;
                     font-family: ${fonts.primary};
                     font-size: ${fontSizes.sm};
                     color: ${colors.textMuted};
                     border-bottom: 1px solid ${colors.border};">
            Mentions
          </th>
        </tr>
      </thead>
      <tbody>
        ${alertRows}
      </tbody>
    </table>
    ${dashboardUrl ? `
      <div style="text-align: center; margin: ${spacing.lg} 0;">
        ${button('View All Alerts', dashboardUrl, 'primary')}
      </div>
    ` : ''}
  `;

  const finalHtml = alertTemplate(
    content,
    config.color,
    `${alerts.length} alerts detected`
  );

  return preferencesUrl
    ? finalHtml.replace('{{PREFERENCES_URL}}', preferencesUrl)
    : finalHtml.replace('{{PREFERENCES_URL}}', '#');
}
