import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActionGeneratorRun {
  id: string;
  organization_id: string | null;
  started_at: string;
  finished_at: string | null;
  alerts_processed: number;
  actions_created: number;
  ai_generated_count: number;
  template_generated_count: number;
  skipped_count: number;
  error_count: number;
  errors: any[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export function useLatestActionGeneratorRun(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["actionGeneratorRuns", "latest", organizationId],
    queryFn: async (): Promise<ActionGeneratorRun | null> => {
      const { data, error } = await supabase
        .from("action_generator_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[useLatestActionGeneratorRun] Error:", error);
        return null;
      }

      return data as ActionGeneratorRun | null;
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}
