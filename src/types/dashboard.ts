/**
 * Dashboard Types - Shared type definitions for dashboard metrics
 * 
 * Extracted from useClientDashboardMetricsQuery.ts to enable type sharing
 * across components without depending on the deprecated hook.
 */

export interface DashboardKPIs {
  totalRaised: number;
  totalNetRevenue: number;
  totalFees: number;
  feePercentage: number;
  refundAmount: number;
  refundRate: number;
  recurringRaised: number;
  recurringChurnRate: number;
  recurringDonations: number;
  uniqueDonors: number;
  newDonors: number;
  returningDonors: number;
  recurringPercentage: number;
  upsellConversionRate: number;
  roi: number;
  /** Blended ROI using total net revenue (for reference) */
  blendedRoi: number;
  /** Revenue attributed to Meta ads via refcode matching */
  metaAttributedRevenue: number;
  /** Revenue attributed to SMS via refcode matching */
  smsAttributedRevenue: number;
  /** Total attributed revenue (Meta + SMS) */
  totalAttributedRevenue: number;
  /** Percentage of net revenue that is attributed to paid channels */
  attributionRate: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgDonation: number;
  donationCount: number;
  deterministicRate: number;
}

export interface DashboardTimeSeriesPoint {
  name: string;
  donations: number;
  netDonations: number;
  refunds: number;
  metaSpend: number;
  smsSpend: number;
  donationsPrev: number;
  netDonationsPrev: number;
  refundsPrev: number;
  metaSpendPrev: number;
  smsSpendPrev: number;
}

export interface ChannelBreakdown {
  name: string;
  value: number;
  label: string;
}

export interface SparklineDataPoint {
  date: string;
  value: number;
}

export interface SparklineData {
  netRevenue: SparklineDataPoint[];
  roi: SparklineDataPoint[];
  refundRate: SparklineDataPoint[];
  recurringHealth: SparklineDataPoint[];
  uniqueDonors: SparklineDataPoint[];
  attributionQuality: SparklineDataPoint[];
  newMrr: SparklineDataPoint[];
}

export interface DashboardMetricsResult {
  kpis: DashboardKPIs;
  prevKpis: Partial<DashboardKPIs>;
  timeSeries: DashboardTimeSeriesPoint[];
  channelBreakdown: ChannelBreakdown[];
  sparklines: SparklineData;
  metaConversions: number;
  smsConversions: number;
  directDonations: number;
  metaSpend: number;
  smsSpend: number;
  smsMessagesSent: number;
  /** True if attribution data comes from fallback (transaction fields) instead of donation_attribution view */
  attributionFallbackMode: boolean;
}
