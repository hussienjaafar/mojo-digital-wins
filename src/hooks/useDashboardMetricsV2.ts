/**
 * useDashboardMetricsV2 - Adapter hook for ClientDashboard migration
 * 
 * This hook combines the unified ActBlue metrics with Meta/SMS spend data
 * to provide a compatible interface for the legacy buildHeroKpis utility.
 * 
 * Once ClientDashboard is fully migrated, this can be simplified or
 * the components can use useActBlueMetrics directly.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { useActBlueMetrics, type ActBlueMetricsDataWithSparklines } from "./useActBlueMetrics";
import type { 
  DashboardKPIs, 
  SparklineData, 
  DashboardTimeSeriesPoint,
  ChannelBreakdown,
} from "@/types/dashboard";

// ==================== Types ====================

interface DailySpendPoint {
  date: string;
  spend: number;
}

interface ChannelSpendData {
  metaSpend: number;
  smsSpend: number;
  metaConversions: number;
  smsConversions: number;
  metaImpressions: number;
  metaClicks: number;
  metaLinkClicks: number;
  dailyMetaSpend: DailySpendPoint[];
  dailySmsSpend: DailySpendPoint[];
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
  
  // Additional fields for ClientDashboardCharts
  channelBreakdown: ChannelBreakdown[];
  smsMessagesSent: number;
  
  // Original unified data (for components that can use it directly)
  _unified: ActBlueMetricsDataWithSparklines;
}

// ==================== Channel Spend Fetching ====================

async function fetchChannelSpend(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ChannelSpendData> {
  // Build Meta query - use meta_ad_metrics_daily for link clicks data
  const metaQuery = supabase
    .from('meta_ad_metrics_daily')
    .select('date, spend, conversions, impressions, clicks, link_clicks')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  // SMS query - also fetch daily data for graph
  const smsQuery = supabase
    .from('sms_campaigns')
    .select('send_date, cost, conversions')
    .eq('organization_id', organizationId)
    .gte('send_date', startDate)
    .lte('send_date', endDate)
    .neq('status', 'draft')
    .order('send_date');

  // Fetch in parallel
  const [metaResult, smsResult] = await Promise.all([
    metaQuery,
    smsQuery,
  ]);

  // Aggregate Meta spend (total)
  const metaSpend = (metaResult.data || []).reduce(
    (sum: number, m: any) => sum + Number(m.spend || 0),
    0
  );
  const metaConversions = (metaResult.data || []).reduce(
    (sum: number, m: any) => sum + Number(m.conversions || 0),
    0
  );
  const metaImpressions = (metaResult.data || []).reduce(
    (sum: number, m: any) => sum + Number(m.impressions || 0),
    0
  );
  const metaClicks = (metaResult.data || []).reduce(
    (sum: number, m: any) => sum + Number(m.clicks || 0),
    0
  );
  const metaLinkClicks = (metaResult.data || []).reduce(
    (sum: number, m: any) => sum + Number(m.link_clicks || 0),
    0
  );

  // Aggregate SMS spend (total)
  const smsSpend = (smsResult.data || []).reduce(
    (sum: number, s: any) => sum + Number(s.cost || 0),
    0
  );
  const smsConversions = (smsResult.data || []).reduce(
    (sum: number, s: any) => sum + Number(s.conversions || 0),
    0
  );

  // Build daily Meta spend map (aggregate by date in case of multiple rows per day)
  const metaDailyMap = new Map<string, number>();
  (metaResult.data || []).forEach((m: any) => {
    const date = m.date;
    metaDailyMap.set(date, (metaDailyMap.get(date) || 0) + Number(m.spend || 0));
  });
  const dailyMetaSpend: DailySpendPoint[] = Array.from(metaDailyMap.entries()).map(
    ([date, spend]) => ({ date, spend })
  );

  // Build daily SMS spend map (aggregate by send_date)
  const smsDailyMap = new Map<string, number>();
  (smsResult.data || []).forEach((s: any) => {
    // Extract date portion from send_date (which is timestamptz)
    const date = s.send_date?.split('T')[0];
    if (date) {
      smsDailyMap.set(date, (smsDailyMap.get(date) || 0) + Number(s.cost || 0));
    }
  });
  const dailySmsSpend: DailySpendPoint[] = Array.from(smsDailyMap.entries()).map(
    ([date, spend]) => ({ date, spend })
  );

  return { 
    metaSpend, 
    smsSpend, 
    metaConversions, 
    smsConversions,
    metaImpressions,
    metaClicks,
    metaLinkClicks,
    dailyMetaSpend,
    dailySmsSpend,
  };
}

// ==================== Data Transformation ====================

// Sparkline extras from the new RPC
interface SparklineExtras {
  dailyRoi?: Array<{ date: string; value: number }>;
  dailyNewMrr?: Array<{ date: string; value: number }>;
  dailyActiveMrr?: Array<{ date: string; value: number }>;
  newDonors?: number;
  returningDonors?: number;
}

function transformToLegacyFormat(
  unified: ActBlueMetricsDataWithSparklines,
  channelSpend: ChannelSpendData,
  sparklineExtras?: SparklineExtras
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
    newDonors: sparklineExtras?.newDonors || 0,
    returningDonors: sparklineExtras?.returningDonors || 0,
    recurringPercentage: summary.recurringRate,
    upsellConversionRate: 0, // Not available from unified yet
    roi,
    blendedRoi: totalSpend > 0 ? summary.totalNet / totalSpend : 0,
    metaAttributedRevenue,
    smsAttributedRevenue,
    totalAttributedRevenue,
    attributionRate: summary.totalNet > 0 ? (totalAttributedRevenue / summary.totalNet) * 100 : 0,
    totalSpend,
    totalImpressions: channelSpend.metaImpressions,
    totalClicks: channelSpend.metaLinkClicks, // Use link clicks for accurate CTR/CPC
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
    roi: sparklineExtras?.dailyRoi?.slice(-7) || [], // Daily ROI from new RPC
    refundRate: [], // Not computed per-day
    recurringHealth: sparklineExtras?.dailyActiveMrr?.slice(-7) || 
      dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.recurring_amount })), // Cumulative MRR from new RPC
    uniqueDonors: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.donors })),
    attributionQuality: [], // Not available
    newMrr: sparklineExtras?.dailyNewMrr?.slice(-7) || [], // Daily new MRR from new RPC
  };

  // Build lookup maps for daily spend data
  const metaSpendByDate = new Map<string, number>();
  (channelSpend.dailyMetaSpend || []).forEach((m) => {
    metaSpendByDate.set(m.date, m.spend);
  });
  const smsSpendByDate = new Map<string, number>();
  (channelSpend.dailySmsSpend || []).forEach((s) => {
    smsSpendByDate.set(s.date, s.spend);
  });

  // Map daily rollup to timeSeries with spend data
  const timeSeries: DashboardTimeSeriesPoint[] = dailyRollup.map((d) => ({
    name: d.date,
    donations: d.raised,
    netDonations: d.net,
    refunds: 0, // Would need separate refund data per day
    metaSpend: metaSpendByDate.get(d.date) || 0,
    smsSpend: smsSpendByDate.get(d.date) || 0,
    donationsPrev: 0,
    netDonationsPrev: 0,
    refundsPrev: 0,
    metaSpendPrev: 0,
    smsSpendPrev: 0,
  }));

  // Calculate direct donations from channel breakdown - use donation COUNT not revenue
  const directDonations = channelBreakdown
    .filter((c) => c.channel === 'other' || c.channel === 'unattributed')
    .reduce((sum, c) => sum + c.donations, 0);

  // Transform channelBreakdown to legacy format for ClientDashboardCharts
  const channelNameMap: Record<string, string> = {
    meta: 'Meta Ads',
    sms: 'SMS',
    email: 'Email',
    organic: 'Organic',
    other: 'Other',
    unattributed: 'Direct',
  };
  
  const legacyChannelBreakdown: ChannelBreakdown[] = channelBreakdown.map((c) => ({
    name: channelNameMap[c.channel] || c.channel,
    value: c.donations,
    label: `$${c.raised.toLocaleString()}`,
  }));

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
    channelBreakdown: legacyChannelBreakdown,
    smsMessagesSent: 0, // Will be populated from SMS metrics if needed
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

  // Fetch sparkline extras (daily ROI, new MRR, donor breakdowns)
  const sparklineQuery = useQuery({
    queryKey: ['dashboard-sparkline', organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_sparkline_data', {
        p_organization_id: organizationId!,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return data as unknown as SparklineExtras;
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Progressive loading: Don't block on channel spend or sparklines - show ActBlue data immediately
  const isLoading = actBlueQuery.isLoading;
  const isFetching = actBlueQuery.isFetching || channelSpendQuery.isFetching || sparklineQuery.isFetching;
  const error = actBlueQuery.error; // Only block on ActBlue errors
  const isChannelSpendLoading = channelSpendQuery.isLoading;

  // Default channel spend when still loading
  const defaultChannelSpend: ChannelSpendData = {
    metaSpend: 0,
    smsSpend: 0,
    metaConversions: 0,
    smsConversions: 0,
    metaImpressions: 0,
    metaClicks: 0,
    metaLinkClicks: 0,
    dailyMetaSpend: [],
    dailySmsSpend: [],
  };

  // Transform to legacy format - use defaults for channel spend if not ready
  const data = useMemo(() => {
    if (!actBlueQuery.data) return undefined;
    return transformToLegacyFormat(
      actBlueQuery.data as ActBlueMetricsDataWithSparklines,
      channelSpendQuery.data || defaultChannelSpend,
      sparklineQuery.data
    );
  }, [actBlueQuery.data, channelSpendQuery.data, sparklineQuery.data]);

  return {
    data,
    isLoading,
    isFetching,
    isChannelSpendLoading,
    error,
    refetch: async () => {
      await Promise.all([
        actBlueQuery.refetch(),
        channelSpendQuery.refetch(),
        sparklineQuery.refetch(),
      ]);
    },
    dataUpdatedAt: Math.max(
      actBlueQuery.dataUpdatedAt || 0,
      channelSpendQuery.dataUpdatedAt || 0,
      sparklineQuery.dataUpdatedAt || 0
    ),
  };
}
