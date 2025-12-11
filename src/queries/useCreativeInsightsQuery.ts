import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CreativeLearning = {
  id: string;
  channel: string;
  topic: string | null;
  tone: string | null;
  urgency_level: string | null;
  call_to_action: string | null;
  emotional_appeal: string | null;
  optimal_hour: number | null;
  optimal_day: number | null;
  avg_click_rate: number | null;
  avg_conversion_rate: number | null;
  avg_roas: number | null;
  effectiveness_score: number | null;
  confidence_level: number | null;
  sample_size: number | null;
};

export const creativeKeys = {
  all: ["creative"] as const,
  learnings: (orgId: string) => [...creativeKeys.all, "learnings", orgId] as const,
};

async function fetchCreativeLearnings(organizationId: string): Promise<CreativeLearning[]> {
  // Fetch org-specific learnings
  const { data: orgData, error: orgError } = await supabase
    .from("creative_performance_learnings")
    .select("*")
    .eq("organization_id", organizationId)
    .order("effectiveness_score", { ascending: false, nullsFirst: false })
    .limit(50);

  if (orgError) {
    console.error("Error loading org learnings:", orgError);
  }

  // Fetch global learnings
  const { data: globalData, error: globalError } = await supabase
    .from("creative_performance_learnings")
    .select("*")
    .is("organization_id", null)
    .order("effectiveness_score", { ascending: false, nullsFirst: false })
    .limit(20);

  if (globalError) {
    console.error("Error loading global learnings:", globalError);
  }

  // Combine and return
  return [...(orgData || []), ...(globalData || [])] as CreativeLearning[];
}

export function useCreativeInsightsQuery(organizationId: string) {
  return useQuery({
    queryKey: creativeKeys.learnings(organizationId),
    queryFn: () => fetchCreativeLearnings(organizationId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!organizationId,
  });
}

export function useRefreshCreativeInsights(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("calculate-creative-learnings", {
        body: { organization_id: organizationId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creativeKeys.learnings(organizationId) });
    },
  });
}
