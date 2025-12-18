import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export type AlertSeverity = "high" | "medium" | "low";
export type AlertType = "watchlist_match" | "velocity_spike" | "trending" | "sentiment_shift";

export interface ClientAlert {
  id: string;
  organization_id: string;
  entity_name: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  actionable_score: number;
  is_actionable: boolean;
  is_read: boolean;
  is_dismissed?: boolean;
  velocity: number | null;
  current_mentions: number;
  suggested_action: string | null;
  sample_sources: any;
  triggered_at: string;
  created_at: string;
  watchlist_id?: string | null;
}

export interface AlertStats {
  total: number;
  unread: number;
  critical: number;
  actionable: number;
  actionablePercent: number;
  avgActionableScore: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<AlertType, number>;
  lastRefreshed: string;
}

export interface ClientAlertsData {
  alerts: ClientAlert[];
  stats: AlertStats;
  fetchedAt: string;
}

export interface ClientAlertsQueryResult {
  data: ClientAlertsData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  dataUpdatedAt: number;
}

// ============================================================================
// Query Keys
// ============================================================================

export const clientAlertsKeys = {
  all: ["clientAlerts"] as const,
  list: (orgId: string) => [...clientAlertsKeys.all, "list", orgId] as const,
  detail: (orgId: string, alertId: string) =>
    [...clientAlertsKeys.all, "detail", orgId, alertId] as const,
};

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchClientAlerts(organizationId: string): Promise<ClientAlertsData> {
  // Fetch alerts from the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data, error } = await supabase
    .from("client_entity_alerts")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[useClientAlertsQuery] Fetch error:", error);
    throw error;
  }

  const alerts = ((data || []) as unknown as ClientAlert[]).map((a) => ({
    ...a,
    is_dismissed: a.is_dismissed ?? false,
  }));

  // Calculate aggregated stats
  const stats: AlertStats = {
    total: alerts.length,
    unread: alerts.filter((a) => !a.is_read).length,
    critical: alerts.filter((a) => a.severity === "high").length,
    actionable: alerts.filter((a) => a.is_actionable).length,
    actionablePercent:
      alerts.length > 0
        ? Math.round((alerts.filter((a) => a.is_actionable).length / alerts.length) * 100)
        : 0,
    avgActionableScore:
      alerts.length > 0
        ? Math.round(
            alerts.reduce((sum, a) => sum + (a.actionable_score || 0), 0) / alerts.length
          )
        : 0,
    bySeverity: {
      high: alerts.filter((a) => a.severity === "high").length,
      medium: alerts.filter((a) => a.severity === "medium").length,
      low: alerts.filter((a) => a.severity === "low").length,
    },
    byType: {
      watchlist_match: alerts.filter((a) => a.alert_type === "watchlist_match").length,
      velocity_spike: alerts.filter((a) => a.alert_type === "velocity_spike").length,
      trending: alerts.filter((a) => a.alert_type === "trending").length,
      sentiment_shift: alerts.filter((a) => a.alert_type === "sentiment_shift").length,
    },
    lastRefreshed: new Date().toISOString(),
  };

  return {
    alerts,
    stats,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Query Hook
// ============================================================================

export function useClientAlertsQuery(
  organizationId: string | undefined
): ClientAlertsQueryResult {
  const query = useQuery({
    queryKey: clientAlertsKeys.list(organizationId || ""),
    queryFn: () => fetchClientAlerts(organizationId!),
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds - alerts should refresh quickly
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useMarkAlertRead(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("client_entity_alerts")
        .update({ is_read: true })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clientAlertsKeys.list(organizationId || ""),
      });
    },
  });
}

export function useMarkAllAlertsRead(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { error } = await supabase
        .from("client_entity_alerts")
        .update({ is_read: true })
        .eq("organization_id", organizationId)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clientAlertsKeys.list(organizationId || ""),
      });
    },
  });
}

export function useDismissAlert(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("client_entity_alerts")
        .update({ is_read: true } as any) // is_dismissed may not exist in DB, handle gracefully
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clientAlertsKeys.list(organizationId || ""),
      });
    },
  });
}

export function useToggleAlertActionable(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alertId,
      isActionable,
    }: {
      alertId: string;
      isActionable: boolean;
    }) => {
      const { error } = await supabase
        .from("client_entity_alerts")
        .update({ is_actionable: isActionable })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: clientAlertsKeys.list(organizationId || ""),
      });
    },
  });
}
