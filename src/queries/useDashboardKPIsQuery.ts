import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dashboardKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";

interface DashboardKPIs {
  totalRaised: number;
  totalDonors: number;
  averageDonation: number;
  recurringRevenue: number;
  metaSpend: number;
  smsSpend: number;
  totalSpend: number;
  roi: number;
  // Trends (vs previous period)
  totalRaisedTrend: number;
  totalDonorsTrend: number;
  averageDonationTrend: number;
  roiTrend: number;
}

async function fetchDashboardKPIs(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DashboardKPIs> {
  // Calculate previous period for comparison
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - daysDiff);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);

  // Parallel fetch all data
  const [
    currentDonations,
    previousDonations,
    metaMetrics,
    smsMetrics,
  ] = await Promise.all([
    // Current period donations
    supabase
      .from("actblue_transactions")
      .select("amount, net_amount, donor_email, is_recurring")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate),

    // Previous period donations
    supabase
      .from("actblue_transactions")
      .select("amount, net_amount, donor_email, is_recurring")
      .eq("organization_id", organizationId)
      .gte("transaction_date", prevStart.toISOString().split("T")[0])
      .lte("transaction_date", prevEnd.toISOString().split("T")[0]),

    // Meta ads spend
    supabase
      .from("meta_ad_metrics")
      .select("spend, impressions, clicks")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate),

    // SMS spend
    supabase
      .from("sms_campaigns")
      .select("cost, messages_sent")
      .eq("organization_id", organizationId)
      .gte("send_date", startDate)
      .lte("send_date", endDate),
  ]);

  // Calculate current period metrics
  const donations = currentDonations.data || [];
  const totalRaised = donations.reduce((sum, d) => sum + (d.net_amount || d.amount || 0), 0);
  const uniqueDonors = new Set(donations.map((d) => d.donor_email)).size;
  const averageDonation = donations.length > 0 ? totalRaised / donations.length : 0;
  const recurringRevenue = donations
    .filter((d) => d.is_recurring)
    .reduce((sum, d) => sum + (d.net_amount || d.amount || 0), 0);

  // Calculate previous period metrics for trends
  const prevDonations = previousDonations.data || [];
  const prevTotalRaised = prevDonations.reduce(
    (sum, d) => sum + (d.net_amount || d.amount || 0),
    0
  );
  const prevUniqueDonors = new Set(prevDonations.map((d) => d.donor_email)).size;
  const prevAverageDonation =
    prevDonations.length > 0 ? prevTotalRaised / prevDonations.length : 0;

  // Calculate previous period spend for ROI comparison
  const [prevMetaMetrics, prevSmsMetrics] = await Promise.all([
    supabase
      .from("meta_ad_metrics")
      .select("spend")
      .eq("organization_id", organizationId)
      .gte("date", prevStart.toISOString().split("T")[0])
      .lte("date", prevEnd.toISOString().split("T")[0]),
    supabase
      .from("sms_campaigns")
      .select("cost")
      .eq("organization_id", organizationId)
      .gte("send_date", prevStart.toISOString().split("T")[0])
      .lte("send_date", prevEnd.toISOString().split("T")[0]),
  ]);
  const prevMetaSpend = (prevMetaMetrics.data || []).reduce((sum, m) => sum + (m.spend || 0), 0);
  const prevSmsSpend = (prevSmsMetrics.data || []).reduce((sum, s) => sum + (s.cost || 0), 0);
  const prevTotalSpend = prevMetaSpend + prevSmsSpend;

  // Calculate spend
  const metaSpend = (metaMetrics.data || []).reduce(
    (sum, m) => sum + (m.spend || 0),
    0
  );
  const smsSpend = (smsMetrics.data || []).reduce(
    (sum, s) => sum + (s.cost || 0),
    0
  );
  const totalSpend = metaSpend + smsSpend;

  // Calculate ROI = Net Revenue / Spend (investment multiplier)
  const roi = totalSpend > 0 ? totalRaised / totalSpend : 0;
  const prevRoi = prevTotalSpend > 0 ? prevTotalRaised / prevTotalSpend : 0;

  // Calculate trends (percentage change)
  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return {
    totalRaised,
    totalDonors: uniqueDonors,
    averageDonation,
    recurringRevenue,
    metaSpend,
    smsSpend,
    totalSpend,
    roi,
    totalRaisedTrend: calcTrend(totalRaised, prevTotalRaised),
    totalDonorsTrend: calcTrend(uniqueDonors, prevUniqueDonors),
    averageDonationTrend: calcTrend(averageDonation, prevAverageDonation),
    roiTrend: calcTrend(roi, prevRoi),
  };
}

export function useDashboardKPIsQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: dashboardKeys.kpis(organizationId || "", dateRange),
    queryFn: () =>
      fetchDashboardKPIs(organizationId!, dateRange.startDate, dateRange.endDate),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
