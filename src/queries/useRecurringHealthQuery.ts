import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";

export interface RecurringHealthV2Data {
  // Current state (point-in-time)
  current_active_mrr: number;
  current_active_donors: number;
  current_paused_donors: number;
  current_cancelled_donors: number;
  current_failed_donors: number;
  current_churned_donors: number;
  
  // Period metrics
  new_recurring_mrr: number;
  new_recurring_donors: number;
  period_recurring_revenue: number;
  period_recurring_transactions: number;
  
  // Derived
  avg_recurring_amount: number;
  upsell_shown: number;
  upsell_succeeded: number;
  upsell_rate: number;
}

export function useRecurringHealthQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: ['recurring-health-v2', organizationId, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recurring_health_v2', {
        _organization_id: organizationId!,
        _start_date: dateRange.startDate,
        _end_date: dateRange.endDate,
      });
      
      if (error) throw error;
      return data?.[0] as RecurringHealthV2Data | undefined;
    },
    enabled: !!organizationId && !!dateRange.startDate && !!dateRange.endDate,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
