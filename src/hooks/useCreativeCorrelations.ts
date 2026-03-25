import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CreativeCorrelation = {
  id: string;
  organization_id: string | null;
  correlation_type: string;
  attribute_name: string;
  attribute_value: string;
  correlated_metric: string;
  correlation_coefficient: number | null;
  sample_size: number;
  confidence_level: number | null;
  p_value: number | null;
  insight_text: string | null;
  is_actionable: boolean;
  recommended_action: string | null;
  metric_avg_with_attribute: number | null;
  metric_avg_without_attribute: number | null;
  lift_percentage: number | null;
  detected_at: string;
};

export type AdFatigueAlert = {
  id: string;
  organization_id: string;
  ad_id: string;
  creative_id: string | null;
  baseline_ctr: number | null;
  current_ctr: number | null;
  decline_percent: number | null;
  days_declining: number;
  predicted_exhaustion_date: string | null;
  alert_severity: 'watch' | 'warning' | 'critical';
  is_acknowledged: boolean;
  created_at: string;
};

export const correlationKeys = {
  all: ["correlations"] as const,
  byOrg: (orgId: string) => [...correlationKeys.all, "org", orgId] as const,
  fatigue: (orgId: string) => [...correlationKeys.all, "fatigue", orgId] as const,
};

async function fetchCorrelations(organizationId: string): Promise<CreativeCorrelation[]> {
  try {
    const { data: orgData, error: orgError } = await supabase
      .from("creative_performance_correlations" as any)
      .select("*")
      .eq("organization_id", organizationId)
      .order("lift_percentage", { ascending: false, nullsFirst: false })
      .limit(50);

    if (orgError) {
      console.error("Error loading org correlations:", orgError);
      return [];
    }

    const { data: globalData, error: globalError } = await supabase
      .from("creative_performance_correlations" as any)
      .select("*")
      .is("organization_id", null)
      .order("lift_percentage", { ascending: false, nullsFirst: false })
      .limit(20);

    if (globalError) {
      console.error("Error loading global correlations:", globalError);
    }

    return [...(orgData || []), ...(globalData || [])] as unknown as CreativeCorrelation[];
  } catch (error) {
    console.error("Error fetching correlations:", error);
    return [];
  }
}

async function fetchFatigueAlerts(organizationId: string): Promise<AdFatigueAlert[]> {
  try {
    const { data, error } = await supabase
      .from("ad_fatigue_alerts" as any)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_acknowledged", false)
      .order("alert_severity", { ascending: false })
      .order("decline_percent", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error loading fatigue alerts:", error);
      return [];
    }

    return (data || []) as unknown as AdFatigueAlert[];
  } catch (error) {
    console.error("Error fetching fatigue alerts:", error);
    return [];
  }
}

export function useCreativeCorrelations(organizationId: string) {
  return useQuery({
    queryKey: correlationKeys.byOrg(organizationId),
    queryFn: () => fetchCorrelations(organizationId),
    staleTime: 5 * 60 * 1000,
    enabled: !!organizationId,
  });
}

export function useAdFatigueAlerts(organizationId: string) {
  return useQuery({
    queryKey: correlationKeys.fatigue(organizationId),
    queryFn: () => fetchFatigueAlerts(organizationId),
    staleTime: 2 * 60 * 1000,
    enabled: !!organizationId,
  });
}

export function useRefreshCorrelations(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("calculate-creative-learnings", {
        body: { organization_id: organizationId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: correlationKeys.byOrg(organizationId) });
    },
  });
}

export function useAcknowledgeFatigueAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, action }: { alertId: string; action: string }) => {
      const { error } = await supabase
        .from("ad_fatigue_alerts" as any)
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          resolution_action: action,
        })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: correlationKeys.all });
    },
  });
}
