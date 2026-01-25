/**
 * useDashboardMetricsV2 - Adapter hook for ClientDashboard migration
 * 
 * This hook combines the unified ActBlue metrics with Meta/SMS spend data
 * to provide a compatible interface for the legacy buildHeroKpis utility.
 * 
 * Once ClientDashboard is fully migrated, this can be simplified or
 * the components can use useActBlueMetrics directly.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { useActBlueMetrics, type ActBlueMetricsDataWithSparklines } from "./useActBlueMetrics";
import type { 
  DashboardKPIs, 
  SparklineData, 
  DashboardTimeSeriesPoint 
} from "@/queries/useClientDashboardMetricsQuery";

// ==================== Types ====================

interface ChannelSpendData {
  metaSpend: number;
  smsSpend: number;
  metaConversions: number;
  smsConversions: number;
}

interface DashboardMetricsV2Data {
  // Legacy-compatible fields for buildHeroKpis
  kpis: DashboardKPIs;
  prevKpis: Partial<DashboardKPIs>;
  sparklines: SparklineData;
  timeSeries: DashboardTimeSeriesPoint[];
  
  // Channel data
  metaSpend: number;
  smsSpend: number;
  metaConversions: number;
  smsConversions: number;
  directDonations: number;
  attributionFallbackMode: boolean;
  
  // Original unified data (for components that can use it directly)
  _unified: ActBlueMetricsDataWithSparklines;
}

// ==================== Channel Spend Fetching ====================

async function fetchChannelSpend(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ChannelSpendData> {
  // Build Meta query
  const metaQuery = supabase
    .from('meta_ad_metrics')
    .select('spend, conversions')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate);

  // SMS query (no campaign filter - SMS is independent)
  const smsQuery = supabase
    .from('sms_campaigns')
    .select('cost, conversions')
    .eq('organization_id', organizationId)
    .gte('send_date', startDate)
    .lte('send_date', endDate)
    .neq('status', 'draft');

  // Fetch in parallel
  const [metaResult, smsResult] = await Promise.all([
    metaQuery,
    smsQuery,
  ]);

  // Aggregate Meta spend
  const metaSpend = (metaResult.data || []).reduce(
    (sum: number, m: any) => sum + Number(m.spend || 0),
    0
  );
  const metaConversions = (metaResult.data || []).reduce(
    (sum: number, m: any) => sum + Number(m.conversions || 0),
    0
  );

  // Aggregate SMS spend
  const smsSpend = (smsResult.data || []).reduce(
    (sum: number, s: any) => sum + Number(s.cost || 0),
    0
  );
  const smsConversions = (smsResult.data || []).reduce(
    (sum: number, s: any) => sum + Number(s.conversions || 0),
    0
  );

  return { metaSpend, smsSpend, metaConversions, smsConversions };
}

// ==================== Data Transformation ====================

function transformToLegacyFormat(
  unified: ActBlueMetricsDataWithSparklines,
  channelSpend: ChannelSpendData
): DashboardMetricsV2Data {
  const { summary, previousPeriod, dailyRollup, sparklines, channelBreakdown } = unified;

  // Calculate ROI and attributed revenue from channel breakdown
  const metaChannel = channelBreakdown.find(c => c.channel === 'meta');
  const smsChannel = channelBreakdown.find(c => c.channel === 'sms');
  const totalSpend = channelSpend.metaSpend + channelSpend.smsSpend;
  const metaAttributedRevenue = metaChannel?.net || 0;
  const smsAttributedRevenue = smsChannel?.net || 0;
  const totalAttributedRevenue = metaAttributedRevenue + smsAttributedRevenue;
  const roi = totalSpend > 0 ? totalAttributedRevenue / totalSpend : 0;

  // Map summary to DashboardKPIs (legacy format)
  const kpis: DashboardKPIs = {
    totalRaised: summary.totalRaised,
    totalNetRevenue: summary.totalNet,
    totalFees: summary.totalFees,
    feePercentage: summary.totalRaised > 0 ? (summary.totalFees / summary.totalRaised) * 100 : 0,
    refundAmount: summary.refundAmount,
    refundRate: summary.refundRate,
    recurringRaised: summary.recurringAmount,
    recurringChurnRate: 0, // Not available from unified yet
    recurringDonations: summary.recurringCount,
    uniqueDonors: summary.uniqueDonors,
    newDonors: 0, // Not available from unified yet
    returningDonors: 0, // Not available from unified yet
    recurringPercentage: summary.recurringRate,
    upsellConversionRate: 0, // Not available from unified yet
    roi,
    blendedRoi: totalSpend > 0 ? summary.totalNet / totalSpend : 0,
    metaAttributedRevenue,
    smsAttributedRevenue,
    totalAttributedRevenue,
    attributionRate: summary.totalNet > 0 ? (totalAttributedRevenue / summary.totalNet) * 100 : 0,
    totalSpend,
    totalImpressions: 0, // Not available from unified yet
    totalClicks: 0, // Not available from unified yet
    avgDonation: summary.averageDonation,
    donationCount: summary.totalDonations,
    deterministicRate: 0, // Not available from unified yet
  };

  // Map previous period to prevKpis
  const prevKpis: Partial<DashboardKPIs> = {
    totalRaised: previousPeriod.totalRaised,
    totalNetRevenue: previousPeriod.totalNet,
    uniqueDonors: previousPeriod.uniqueDonors,
    recurringDonations: previousPeriod.recurringCount,
    recurringRaised: previousPeriod.recurringAmount,
    donationCount: previousPeriod.totalDonations,
  };

  // Convert sparklines to legacy format (SparklineDataPoint with date/value)
  // The unified hook provides {x, y} coordinates; we need to convert to {date, value}
  const legacySparklines: SparklineData = {
    netRevenue: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.net })),
    roi: [], // Not computed per-day
    refundRate: [], // Not computed per-day
    recurringHealth: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.recurring_amount })),
    uniqueDonors: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.donors })),
    attributionQuality: [], // Not available
    newMrr: [], // Not available
  };

  // Map daily rollup to timeSeries
  const timeSeries: DashboardTimeSeriesPoint[] = dailyRollup.map((d) => ({
    name: d.date,
    donations: d.raised,
    netDonations: d.net,
    refunds: 0, // Would need separate refund data per day
    metaSpend: 0, // Would need to join with Meta daily data
    smsSpend: 0, // Would need to join with SMS daily data
    donationsPrev: 0,
    netDonationsPrev: 0,
    refundsPrev: 0,
    metaSpendPrev: 0,
    smsSpendPrev: 0,
  }));

  // Calculate direct donations from channel breakdown
  const directDonations = channelBreakdown
    .filter((c) => c.channel === 'other' || c.channel === 'unattributed')
    .reduce((sum, c) => sum + c.raised, 0);

  return {
    kpis,
    prevKpis,
    sparklines: legacySparklines,
    timeSeries,
    metaSpend: channelSpend.metaSpend,
    smsSpend: channelSpend.smsSpend,
    metaConversions: channelSpend.metaConversions,
    smsConversions: channelSpend.smsConversions,
    directDonations,
    attributionFallbackMode: false, // Unified hook uses proper attribution
    _unified: unified,
  };
}

// ==================== Main Hook ====================

/**
 * Adapter hook that provides a legacy-compatible interface for ClientDashboard
 * while using the new unified ActBlue metrics under the hood.
 */
export function useDashboardMetricsV2(organizationId: string | undefined) {
  const { startDate, endDate } = useDateRange();

  // Fetch unified ActBlue metrics
  const actBlueQuery = useActBlueMetrics(organizationId);

  // Fetch channel spend data (Meta/SMS)
  const channelSpendQuery = useQuery({
    queryKey: ['channel-spend', organizationId, startDate, endDate],
    queryFn: () => fetchChannelSpend(
      organizationId!,
      startDate,
      endDate
    ),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Combine data when both queries are ready
  const isLoading = actBlueQuery.isLoading || channelSpendQuery.isLoading;
  const isFetching = actBlueQuery.isFetching || channelSpendQuery.isFetching;
  const error = actBlueQuery.error || channelSpendQuery.error;

  // Transform to legacy format
  const data = actBlueQuery.data && channelSpendQuery.data
    ? transformToLegacyFormat(
        actBlueQuery.data as ActBlueMetricsDataWithSparklines,
        channelSpendQuery.data
      )
    : undefined;

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch: async () => {
      await Promise.all([
        actBlueQuery.refetch(),
        channelSpendQuery.refetch(),
      ]);
    },
    dataUpdatedAt: Math.max(
      actBlueQuery.dataUpdatedAt || 0,
      channelSpendQuery.dataUpdatedAt || 0
    ),
  };
}
