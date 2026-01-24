import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActBlueTimezone } from "@/stores/dashboardStore";

export interface ActBlueFilteredRollupParams {
  organizationId: string;
  startDate: string;
  endDate: string;
  campaignId?: string | null;
  creativeId?: string | null;
  timezone?: string;
  useUtc?: boolean; // Optional override for UTC mode
}

export interface ActBlueDailyMetrics {
  day: string;
  gross_raised: number;
  net_raised: number;
  refund_amount: number;
  transaction_count: number;
  refund_count: number;
  unique_donors: number;
  recurring_count: number;
  recurring_amount: number;
}

export interface ActBlueRollupSummary {
  grossRaised: number;
  netRaised: number;
  refundAmount: number;
  transactionCount: number;
  refundCount: number;
  uniqueDonors: number;
  recurringCount: number;
  recurringAmount: number;
  refundRate: number;
  recurringRate: number;
}

export interface UseActBlueFilteredRollupResult {
  data: ActBlueDailyMetrics[] | null;
  summary: ActBlueRollupSummary | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Hook to fetch ActBlue metrics using the server-side filtered rollup RPC.
 * Uses timezone-aware day bucketing and supports optional campaign/creative filtering.
 *
 * By default, uses Eastern Time boundaries to match ActBlue's Fundraising Performance dashboard.
 * Set useUtc: true to use UTC boundaries instead.
 *
 * This replaces client-side day bucketing with server-side aggregation for:
 * - Better performance (aggregation happens in DB)
 * - Consistent timezone handling (configured per-org)
 * - Reduced data transfer (only aggregated results)
 */
export function useActBlueFilteredRollup({
  organizationId,
  startDate,
  endDate,
  campaignId,
  creativeId,
  timezone = DEFAULT_TIMEZONE,
  useUtc,
}: ActBlueFilteredRollupParams): UseActBlueFilteredRollupResult {
  const hasFilters = !!(campaignId || creativeId);
  const storeUseActBlueTimezone = useActBlueTimezone();
  
  // When useActBlueTimezone is true, we want ET (p_use_utc=false)
  // When useActBlueTimezone is false, we want UTC (p_use_utc=true)
  const effectiveUseUtc = useUtc ?? !storeUseActBlueTimezone;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "actblue-filtered-rollup",
      organizationId,
      startDate,
      endDate,
      campaignId,
      creativeId,
      timezone,
      effectiveUseUtc,
    ],
    queryFn: async () => {
      // Call the RPC with optional parameters
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        "get_actblue_filtered_rollup",
        {
          p_org_id: organizationId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_campaign_id: campaignId || null,
          p_creative_id: creativeId || null,
          p_timezone: timezone,
          p_use_utc: effectiveUseUtc,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to fetch ActBlue rollup");
      }

      return (rpcData || []) as ActBlueDailyMetrics[];
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  // Calculate summary from daily data
  const summary: ActBlueRollupSummary | null = data
    ? data.reduce(
        (acc, day) => ({
          grossRaised: acc.grossRaised + Number(day.gross_raised || 0),
          netRaised: acc.netRaised + Number(day.net_raised || 0),
          refundAmount: acc.refundAmount + Number(day.refund_amount || 0),
          transactionCount: acc.transactionCount + Number(day.transaction_count || 0),
          refundCount: acc.refundCount + Number(day.refund_count || 0),
          uniqueDonors: acc.uniqueDonors + Number(day.unique_donors || 0),
          recurringCount: acc.recurringCount + Number(day.recurring_count || 0),
          recurringAmount: acc.recurringAmount + Number(day.recurring_amount || 0),
          refundRate: 0, // Calculated after reduce
          recurringRate: 0, // Calculated after reduce
        }),
        {
          grossRaised: 0,
          netRaised: 0,
          refundAmount: 0,
          transactionCount: 0,
          refundCount: 0,
          uniqueDonors: 0,
          recurringCount: 0,
          recurringAmount: 0,
          refundRate: 0,
          recurringRate: 0,
        }
      )
    : null;

  // Calculate rates if we have summary data
  if (summary) {
    summary.refundRate =
      summary.grossRaised > 0
        ? (summary.refundAmount / summary.grossRaised) * 100
        : 0;
    summary.recurringRate =
      summary.transactionCount > 0
        ? (summary.recurringCount / summary.transactionCount) * 100
        : 0;
  }

  return {
    data: data || null,
    summary,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Query key factory for ActBlue filtered rollup queries.
 * Use this to invalidate or prefetch queries.
 */
export const actBlueFilteredRollupKeys = {
  all: ["actblue-filtered-rollup"] as const,
  byOrg: (orgId: string) => [...actBlueFilteredRollupKeys.all, orgId] as const,
  filtered: (
    orgId: string,
    startDate: string,
    endDate: string,
    campaignId?: string | null,
    creativeId?: string | null
  ) =>
    [
      ...actBlueFilteredRollupKeys.byOrg(orgId),
      startDate,
      endDate,
      campaignId,
      creativeId,
    ] as const,
};
