import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { format, parseISO, isToday } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface HourlyMetric {
  hour: number;
  hour_label: string;
  donation_count: number;
  gross_amount: number;
  net_amount: number;
  unique_donors: number;
  avg_donation: number;
  recurring_count: number;
}

export interface ComparisonMetrics {
  period: "today" | "yesterday" | "last_week";
  donation_count: number;
  gross_amount: number;
  net_amount: number;
  unique_donors: number;
  avg_donation: number;
  recurring_count: number;
}

export interface RecentDonation {
  id: string;
  amount: number;
  donor_name: string | null;
  transaction_date: string;
  is_recurring: boolean;
  source_campaign: string | null;
  refcode: string | null;
}

export interface TodayMetricsData {
  hourlyMetrics: HourlyMetric[];
  comparisonMetrics: {
    today: ComparisonMetrics | null;
    yesterday: ComparisonMetrics | null;
    lastWeek: ComparisonMetrics | null;
  };
  recentDonations: RecentDonation[];
  currentHour: number;
}

// ============================================================================
// Query Keys
// ============================================================================

export const hourlyMetricsKeys = {
  all: ["hourly-metrics"] as const,
  hourly: (orgId: string, date: string) => 
    [...hourlyMetricsKeys.all, "hourly", orgId, date] as const,
  comparison: (orgId: string, date: string) => 
    [...hourlyMetricsKeys.all, "comparison", orgId, date] as const,
  recentDonations: (orgId: string, date: string) => 
    [...hourlyMetricsKeys.all, "recent", orgId, date] as const,
  combined: (orgId: string, date: string) => 
    [...hourlyMetricsKeys.all, "combined", orgId, date] as const,
};

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchHourlyMetrics(
  organizationId: string,
  date: string
): Promise<HourlyMetric[]> {
  const { data, error } = await supabase.rpc("get_actblue_hourly_metrics", {
    _organization_id: organizationId,
    _date: date,
    _timezone: "America/New_York",
  });

  if (error) throw error;
  return (data || []) as HourlyMetric[];
}

async function fetchComparisonMetrics(
  organizationId: string,
  date: string
): Promise<ComparisonMetrics[]> {
  const { data, error } = await supabase.rpc("get_today_comparison_metrics", {
    _organization_id: organizationId,
    _date: date,
    _timezone: "America/New_York",
  });

  if (error) throw error;
  return (data || []) as ComparisonMetrics[];
}

async function fetchRecentDonations(
  organizationId: string,
  date: string
): Promise<RecentDonation[]> {
  const { data, error } = await supabase.rpc("get_recent_donations", {
    _organization_id: organizationId,
    _date: date,
    _limit: 20,
    _timezone: "America/New_York",
  });

  if (error) throw error;
  return (data || []) as RecentDonation[];
}

async function fetchTodayMetrics(
  organizationId: string,
  date: string
): Promise<TodayMetricsData> {
  const [hourlyMetrics, comparisonData, recentDonations] = await Promise.all([
    fetchHourlyMetrics(organizationId, date),
    fetchComparisonMetrics(organizationId, date),
    fetchRecentDonations(organizationId, date),
  ]);

  // Parse comparison data into structured object
  const comparisonMetrics = {
    today: comparisonData.find((c) => c.period === "today") || null,
    yesterday: comparisonData.find((c) => c.period === "yesterday") || null,
    lastWeek: comparisonData.find((c) => c.period === "last_week") || null,
  };

  return {
    hourlyMetrics,
    comparisonMetrics,
    recentDonations,
    currentHour: new Date().getHours(),
  };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to detect if the current date range represents a single day
 */
export function useIsSingleDayView(): boolean {
  const dateRange = useDateRange();
  return dateRange.startDate === dateRange.endDate;
}

/**
 * Hook to detect if viewing "today"
 */
export function useIsTodayView(): boolean {
  const dateRange = useDateRange();
  if (dateRange.startDate !== dateRange.endDate) return false;
  
  try {
    const viewDate = parseISO(dateRange.startDate);
    return isToday(viewDate);
  } catch {
    return false;
  }
}

/**
 * Main hook to fetch all today's metrics including hourly data, comparisons, and recent activity
 */
export function useTodayMetrics(organizationId: string | undefined) {
  const dateRange = useDateRange();
  const isSingleDay = useIsSingleDayView();
  const isTodayView = useIsTodayView();

  return useQuery({
    queryKey: hourlyMetricsKeys.combined(
      organizationId || "",
      dateRange.startDate
    ),
    queryFn: () => fetchTodayMetrics(organizationId!, dateRange.startDate),
    enabled: !!organizationId && isSingleDay,
    // Refresh more frequently for "today" data
    refetchInterval: isTodayView ? 5 * 60 * 1000 : false, // 5 minutes for today
    staleTime: isTodayView ? 60 * 1000 : 2 * 60 * 1000, // 1 min for today, 2 min otherwise
  });
}

/**
 * Hook for just hourly metrics (lighter weight)
 */
export function useHourlyMetrics(organizationId: string | undefined) {
  const dateRange = useDateRange();
  const isSingleDay = useIsSingleDayView();

  return useQuery({
    queryKey: hourlyMetricsKeys.hourly(
      organizationId || "",
      dateRange.startDate
    ),
    queryFn: () => fetchHourlyMetrics(organizationId!, dateRange.startDate),
    enabled: !!organizationId && isSingleDay,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for recent donations feed
 */
export function useRecentDonations(organizationId: string | undefined) {
  const dateRange = useDateRange();
  const isSingleDay = useIsSingleDayView();
  const isTodayView = useIsTodayView();

  return useQuery({
    queryKey: hourlyMetricsKeys.recentDonations(
      organizationId || "",
      dateRange.startDate
    ),
    queryFn: () => fetchRecentDonations(organizationId!, dateRange.startDate),
    enabled: !!organizationId && isSingleDay,
    refetchInterval: isTodayView ? 30 * 1000 : false, // 30 seconds for today
    staleTime: 15 * 1000,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate percentage change between two values
 */
export function calculatePercentChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

/**
 * Get comparison label based on period
 */
export function getComparisonLabel(period: "yesterday" | "last_week"): string {
  return period === "yesterday" ? "vs yesterday" : "vs last week";
}

/**
 * Format hour for display (12-hour format with AM/PM)
 */
export function formatHourDisplay(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}
