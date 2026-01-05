import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FilterOption {
  id: string;
  label: string;
  status?: string;
  isNameAvailable: boolean;
}

export interface FilterOptions {
  campaigns: FilterOption[];
  creatives: FilterOption[];
}

/**
 * Hook to fetch available campaign and creative filter options
 * based on the organization and date range, with human-readable names.
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

      // Fetch IDs from donation_attribution, meta_ad_metrics, AND name lookups
      const [attrResult, metaResult, campaignNamesResult, creativeNamesResult] = await Promise.all([
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
        // Campaign names from meta_campaigns
        sb
          .from("meta_campaigns")
          .select("campaign_id, campaign_name, status")
          .eq("organization_id", organizationId),
        // Creative names from refcode_mappings
        sb
          .from("refcode_mappings")
          .select("creative_id, creative_name")
          .eq("organization_id", organizationId),
      ]);

      if (attrResult.error) throw attrResult.error;
      if (metaResult.error) throw metaResult.error;
      // Name lookups are optional - don't throw on error, just use empty
      const campaignNamesData = campaignNamesResult.data || [];
      const creativeNamesData = creativeNamesResult.data || [];

      // Build name lookup maps
      const campaignNameMap = new Map<string, { name: string; status: string }>();
      campaignNamesData.forEach((c: any) => {
        if (c.campaign_id && c.campaign_name) {
          campaignNameMap.set(c.campaign_id, {
            name: c.campaign_name,
            status: c.status || "UNKNOWN",
          });
        }
      });

      const creativeNameMap = new Map<string, string>();
      creativeNamesData.forEach((c: any) => {
        if (c.creative_id && c.creative_name) {
          creativeNameMap.set(c.creative_id, c.creative_name);
        }
      });

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

      // Build campaign options with names
      const campaigns: FilterOption[] = Array.from(campaignSet)
        .map((id) => {
          const meta = campaignNameMap.get(id);
          return {
            id,
            label: meta?.name || id,
            status: meta?.status,
            isNameAvailable: !!meta?.name,
          };
        })
        // Sort: Active first, then by name
        .sort((a, b) => {
          if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
          if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
          return a.label.localeCompare(b.label);
        });

      // Build creative options with names
      const creatives: FilterOption[] = Array.from(creativeSet)
        .map((id) => {
          let name = creativeNameMap.get(id);
          
          // Clean up template placeholders like "{{product.name}} 2025-09-11-hash"
          if (name && name.startsWith("{{")) {
            // Extract date portion if present (format: YYYY-MM-DD)
            const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              const date = new Date(dateMatch[1]);
              const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              name = `Product Ad (${formatted})`;
            } else {
              name = undefined; // Fall back to ID
            }
          }
          
          return {
            id,
            label: name || id,
            isNameAvailable: !!name,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      return { campaigns, creatives };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!organizationId,
  });
}
