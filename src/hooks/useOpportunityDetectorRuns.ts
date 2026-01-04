import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OpportunityDetectorRun {
  id: string;
  organization_id: string | null;
  started_at: string;
  finished_at: string | null;
  trends_processed: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  expired_count: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
  error_count: number;
  errors: any[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export function useLatestOpportunityRun(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["opportunityDetectorRuns", "latest", organizationId],
    queryFn: async (): Promise<OpportunityDetectorRun | null> => {
      const { data, error } = await supabase
        .from("opportunity_detector_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[useLatestOpportunityRun] Error:", error);
        return null;
      }

      return data as OpportunityDetectorRun | null;
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}
