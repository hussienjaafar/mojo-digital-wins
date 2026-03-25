/**
 * Report Email Templates
 *
 * Daily briefing, campaign reports.
 * Data-forward presentation, stat cards, organized sections.
 */

import { reportTemplate } from '../base.ts';
import {
  heading,
  paragraph,
  button,
  statsRow,
  divider,
  list,
  card,
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
} from '../tokens.ts';

interface DailyBriefingOptions {
  userName: string;
  date: string;
  threatLevel: {
    score: number;
    label: string;
  };
  stats: {
    criticalAlerts: number;
    highAlerts: number;
    newArticles: number;
    pendingBills: number;
  };
  topItems?: Array<{
    title: string;
    severity: string;
    mentions: number;
  }>;
  topOrganizations?: Array<{
    name: string;
    mentions: number;
  }>;
  dashboardUrl: string;
  preferencesUrl?: string;
}

/**
 * Daily intelligence briefing email
 */
export function dailyBriefing(options: DailyBriefingOptions): string {
  const {
    userName,
    date,
    threatLevel,
    stats,
    topItems = [],
    topOrganizations = [],
    dashboardUrl,
    preferencesUrl,
  } = options;

  // Threat level color
  const threatColor = threatLevel.score >= 75 ? colors.error
    : threatLevel.score >= 50 ? severityConfig.high.color
    : threatLevel.score >= 25 ? colors.warning
    : colors.success;

  const threatLevelSection = `
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: 0 0 8px 0;">
        Threat Level
      </p>
      <div style="display: inline-block;
                  background-color: ${threatColor};
                  color: #ffffff;
                  padding: ${spacing.md} ${spacing.xl};
                  border-radius: ${spacing.xs};
                  font-family: ${fonts.primary};">
        <span style="font-size: ${fontSizes['3xl']};
                     font-weight: ${fontWeights.bold};">
          ${threatLevel.score}
        </span>
        <span style="font-size: ${fontSizes.sm};
                     margin-left: 8px;
                     text-transform: uppercase;">
          ${escapeHtml(threatLevel.label)}
        </span>
      </div>
    </div>
  `;

  const statsSection = statsRow([
    { value: stats.criticalAlerts.toString(), label: 'Critical', color: colors.error },
    { value: stats.highAlerts.toString(), label: 'High', color: severityConfig.high.color },
    { value: stats.newArticles.toString(), label: 'Articles', color: colors.info },
    { value: stats.pendingBills.toString(), label: 'Bills', color: colors.primary },
  ]);

  const topItemsSection = topItems.length > 0 ? `
    ${divider()}
    <h2 style="color: ${colors.text};
               font-family: ${fonts.primary};
               font-size: ${fontSizes.lg};
               font-weight: ${fontWeights.semibold};
               margin: 0 0 ${spacing.md} 0;">
      🚨 Top Threats
    </h2>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           style="border: 1px solid ${colors.border};
                  border-radius: 8px;">
      ${topItems.map((item, i) => `
        <tr style="background-color: ${i % 2 === 0 ? colors.surface : colors.background};">
          <td style="padding: 12px;
                     font-family: ${fonts.primary};
                     font-size: ${fontSizes.sm};
                     border-bottom: ${i < topItems.length - 1 ? `1px solid ${colors.border}` : 'none'};">
            ${escapeHtml(item.title)}
          </td>
          <td style="padding: 12px;
                     text-align: right;
                     font-family: ${fonts.primary};
                     font-size: ${fontSizes.sm};
                     color: ${colors.textMuted};
                     border-bottom: ${i < topItems.length - 1 ? `1px solid ${colors.border}` : 'none'};">
            ${item.mentions.toLocaleString()} mentions
          </td>
        </tr>
      `).join('')}
    </table>
  ` : '';

  const topOrgsSection = topOrganizations.length > 0 ? `
    ${divider()}
    <h2 style="color: ${colors.text};
               font-family: ${fonts.primary};
               font-size: ${fontSizes.lg};
               font-weight: ${fontWeights.semibold};
               margin: 0 0 ${spacing.md} 0;">
      🏛️ Organization Mentions
    </h2>
    ${list(topOrganizations.map(org =>
      `<strong>${escapeHtml(org.name)}</strong> — ${org.mentions.toLocaleString()} mentions`
    ))}
  ` : '';

  const content = `
    <div style="text-align: center; margin-bottom: ${spacing.md};">
      <h1 style="color: ${colors.text};
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes['2xl']};
                 font-weight: ${fontWeights.bold};
                 margin: 0;">
        Daily Intelligence Briefing
      </h1>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: 8px 0 0 0;">
        ${escapeHtml(date)}
      </p>
    </div>
    ${paragraph(`Good morning, ${escapeHtml(userName)}. Here's your daily summary.`)}
    ${threatLevelSection}
    ${statsSection}
    ${topItemsSection}
    ${topOrgsSection}
    ${divider()}
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('View Full Dashboard', dashboardUrl, 'primary')}
    </div>
  `;

  return reportTemplate(
    content,
    `Daily Briefing: Threat Level ${threatLevel.score} (${threatLevel.label})`,
    preferencesUrl
  );
}

interface CampaignReportOptions {
  organizationName: string;
  organizationLogo?: string;
  dateRange: {
    start: string;
    end: string;
  };
  metrics: {
    fundsRaised?: number;
    totalSpend?: number;
    roi?: number;
    donations?: number;
    avgDonation?: number;
    impressions?: number;
    clicks?: number;
    smsSent?: number;
    smsConversions?: number;
  };
  customPrimaryColor?: string;
  customFooter?: string;
  dashboardUrl?: string;
}

/**
 * Campaign performance report email
 */
export function campaignReport(options: CampaignReportOptions): string {
  const {
    organizationName,
    organizationLogo,
    dateRange,
    metrics,
    customPrimaryColor,
    customFooter,
    dashboardUrl,
  } = options;

  const primaryColor = customPrimaryColor || colors.primary;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-US').format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const logoSection = organizationLogo ? `
    <div style="text-align: center; margin-bottom: ${spacing.md};">
      <img src="${escapeHtml(organizationLogo)}"
           alt="${escapeHtml(organizationName)}"
           style="max-height: 60px; max-width: 200px;" />
    </div>
  ` : '';

  // Build stats array based on available metrics
  const statsArray: Array<{ value: string; label: string; color?: string }> = [];

  if (metrics.fundsRaised !== undefined) {
    statsArray.push({ value: formatCurrency(metrics.fundsRaised), label: 'Raised', color: colors.success });
  }
  if (metrics.totalSpend !== undefined) {
    statsArray.push({ value: formatCurrency(metrics.totalSpend), label: 'Spend', color: colors.textSecondary });
  }
  if (metrics.roi !== undefined) {
    const roiColor = metrics.roi >= 0 ? colors.success : colors.error;
    statsArray.push({ value: formatPercent(metrics.roi), label: 'ROI', color: roiColor });
  }

  const primaryStats = statsArray.length > 0 ? statsRow(statsArray) : '';

  // Secondary metrics section
  const secondaryMetrics: string[] = [];

  if (metrics.donations !== undefined) {
    secondaryMetrics.push(`<strong>${formatNumber(metrics.donations)}</strong> donations`);
  }
  if (metrics.avgDonation !== undefined) {
    secondaryMetrics.push(`<strong>${formatCurrency(metrics.avgDonation)}</strong> avg donation`);
  }
  if (metrics.impressions !== undefined) {
    secondaryMetrics.push(`<strong>${formatNumber(metrics.impressions)}</strong> impressions`);
  }
  if (metrics.clicks !== undefined) {
    secondaryMetrics.push(`<strong>${formatNumber(metrics.clicks)}</strong> clicks`);
  }
  if (metrics.smsSent !== undefined) {
    secondaryMetrics.push(`<strong>${formatNumber(metrics.smsSent)}</strong> SMS sent`);
  }
  if (metrics.smsConversions !== undefined) {
    secondaryMetrics.push(`<strong>${formatNumber(metrics.smsConversions)}</strong> SMS conversions`);
  }

  const secondarySection = secondaryMetrics.length > 0 ? `
    ${divider()}
    <h2 style="color: ${colors.text};
               font-family: ${fonts.primary};
               font-size: ${fontSizes.lg};
               font-weight: ${fontWeights.semibold};
               margin: 0 0 ${spacing.md} 0;">
      Detailed Metrics
    </h2>
    ${list(secondaryMetrics)}
  ` : '';

  const ctaSection = dashboardUrl ? `
    ${divider()}
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('View Full Report', dashboardUrl, 'primary')}
    </div>
  ` : '';

  const footerSection = customFooter ? `
    <p style="color: ${colors.textMuted};
              font-family: ${fonts.primary};
              font-size: ${fontSizes.xs};
              text-align: center;
              margin: ${spacing.lg} 0 0 0;">
      ${escapeHtml(customFooter)}
    </p>
  ` : '';

  const content = `
    ${logoSection}
    <div style="text-align: center; margin-bottom: ${spacing.lg};">
      <h1 style="color: ${colors.text};
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes['2xl']};
                 font-weight: ${fontWeights.bold};
                 margin: 0;">
        ${escapeHtml(organizationName)}
      </h1>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.base};
                margin: 8px 0 0 0;">
        Performance Report
      </p>
      <p style="color: ${colors.textSecondary};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: 4px 0 0 0;">
        ${escapeHtml(dateRange.start)} — ${escapeHtml(dateRange.end)}
      </p>
    </div>
    ${primaryStats}
    ${secondarySection}
    ${ctaSection}
    ${footerSection}
  `;

  return reportTemplate(
    content,
    `${organizationName} Performance Report: ${dateRange.start} - ${dateRange.end}`
  );
}
