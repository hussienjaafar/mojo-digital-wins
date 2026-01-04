import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterOptions {
  campaigns: FilterOption[];
  creatives: FilterOption[];
}

/**
 * Hook to fetch available campaign and creative filter options
 * based on the organization and date range.
 */
export function useFilterOptions(
  organizationId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ["filter-options", organizationId, startDate, endDate],
    queryFn: async (): Promise<FilterOptions> => {
      if (!organizationId) {
        return { campaigns: [], creatives: [] };
      }

      const sb = supabase as any;
      const endDateFull = `${endDate}T23:59:59`;

      // Fetch from BOTH donation_attribution AND meta_ad_metrics
      // This ensures campaigns/creatives with spend but zero donations still appear
      const [attrResult, metaResult] = await Promise.all([
        // Campaigns/creatives with attributed donations
        sb
          .from("donation_attribution")
          .select("attributed_campaign_id, attributed_creative_id")
          .eq("organization_id", organizationId)
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDateFull)
          .eq("transaction_type", "donation"),
        // Campaigns and creatives with spend (even if zero donations)
        sb
          .from("meta_ad_metrics")
          .select("campaign_id, ad_creative_id")
          .eq("organization_id", organizationId)
          .gte("date", startDate)
          .lte("date", endDate),
      ]);

      if (attrResult.error) throw attrResult.error;
      if (metaResult.error) throw metaResult.error;

      // Extract unique campaign and creative IDs from both sources
      const campaignSet = new Set<string>();
      const creativeSet = new Set<string>();

      // From donation_attribution
      (attrResult.data || []).forEach((d: any) => {
        if (d.attributed_campaign_id) campaignSet.add(d.attributed_campaign_id);
        if (d.attributed_creative_id) creativeSet.add(d.attributed_creative_id);
      });

      // From meta_ad_metrics (campaigns and creatives with spend)
      (metaResult.data || []).forEach((d: any) => {
        if (d.campaign_id) campaignSet.add(d.campaign_id);
        if (d.ad_creative_id) creativeSet.add(d.ad_creative_id);
      });

      // Convert to arrays and sort
      const campaigns: FilterOption[] = Array.from(campaignSet)
        .sort()
        .map((id) => ({ id, label: id }));

      const creatives: FilterOption[] = Array.from(creativeSet)
        .sort()
        .map((id) => ({ id, label: id }));

      return { campaigns, creatives };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!organizationId,
  });
}
