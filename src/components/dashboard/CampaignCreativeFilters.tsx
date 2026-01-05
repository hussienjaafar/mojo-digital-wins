import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardStore, useSelectedCampaignId, useSelectedCreativeId, useDateRange } from "@/stores/dashboardStore";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface FilterOption {
  id: string;
  label: string;
}

interface CampaignCreativeFiltersProps {
  organizationId: string;
  className?: string;
}

// ============================================================================
// Data Fetching Hook
// ============================================================================

function useFilterOptions(organizationId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['filter-options', organizationId, startDate, endDate],
    queryFn: async () => {
      const sb = supabase as any;
      const endDateFull = `${endDate}T23:59:59`;

      // Fetch from BOTH donation_attribution AND meta_ad_metrics
      // This ensures campaigns/creatives with spend but zero donations still appear
      const [attrResult, metaResult] = await Promise.all([
        // Campaigns/creatives with attributed donations
        sb
          .from('donation_attribution')
          .select('attributed_campaign_id, attributed_creative_id')
          .eq('organization_id', organizationId)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDateFull)
          .eq('transaction_type', 'donation'),
        // Campaigns and creatives with spend (even if zero donations)
        sb
          .from('meta_ad_metrics')
          .select('campaign_id, ad_creative_id')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate),
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
        .map(id => ({ id, label: id }));

      const creatives: FilterOption[] = Array.from(creativeSet)
        .sort()
        .map(id => ({ id, label: id }));

      return { campaigns, creatives };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!organizationId,
  });
}

// ============================================================================
// Main Component
// ============================================================================

export const CampaignCreativeFilters: React.FC<CampaignCreativeFiltersProps> = ({
  organizationId,
  className,
}) => {
  const dateRange = useDateRange();
  const selectedCampaignId = useSelectedCampaignId();
  const selectedCreativeId = useSelectedCreativeId();
  const setSelectedCampaignId = useDashboardStore((s) => s.setSelectedCampaignId);
  const setSelectedCreativeId = useDashboardStore((s) => s.setSelectedCreativeId);

  const { data: filterOptions, isLoading } = useFilterOptions(
    organizationId,
    dateRange.startDate,
    dateRange.endDate
  );

  const campaigns = filterOptions?.campaigns || [];
  const creatives = filterOptions?.creatives || [];

  // Only show if there are options to filter
  const hasFilters = campaigns.length > 0 || creatives.length > 0;

  if (!hasFilters && !isLoading) return null;

  return (
    <div className={cn("flex items-center gap-1 xs:gap-1.5 min-w-0", className)}>
      {/* Filter icon only - dropdowns with placeholders are self-explanatory */}
      <div 
        className="flex h-9 w-9 rounded-[var(--portal-radius-sm)] border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] items-center justify-center text-[hsl(var(--portal-text-muted))] shrink-0"
        aria-hidden="true"
      >
        <Filter className="h-3.5 w-3.5" />
      </div>

      {/* Campaign Filter */}
      {campaigns.length > 0 && (
        <Select
          value={selectedCampaignId || "all"}
          onValueChange={(value) => setSelectedCampaignId(value === "all" ? null : value)}
        >
          <SelectTrigger
            className={cn(
              "h-9 min-w-0 w-[80px] xs:w-[100px] sm:w-[130px]",
              "rounded-[var(--portal-radius-sm)]",
              "border border-[hsl(var(--portal-border))]",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "text-xs",
              "text-[hsl(var(--portal-text-primary))]",
              "hover:bg-[hsl(var(--portal-bg-hover))]",
              "focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.3)]",
              "transition-colors",
              selectedCampaignId && "border-[hsl(var(--portal-accent-blue))]"
            )}
            aria-label="Filter by campaign"
          >
            <span className="truncate">
              <SelectValue placeholder="Campaigns" />
            </span>
          </SelectTrigger>
          <SelectContent
            className={cn(
              "z-[200]",
              "bg-[hsl(var(--portal-bg-elevated))]",
              "border-[hsl(var(--portal-border))]",
              "rounded-[var(--portal-radius-sm)]",
              "shadow-lg",
              "opacity-100"
            )}
          >
            <SelectItem value="all" className="text-xs">
              All Campaigns
            </SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem
                key={campaign.id}
                value={campaign.id}
                className="text-xs truncate"
              >
                {campaign.label.length > 18
                  ? `${campaign.label.slice(0, 18)}...`
                  : campaign.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Creative Filter */}
      {creatives.length > 0 && (
        <Select
          value={selectedCreativeId || "all"}
          onValueChange={(value) => setSelectedCreativeId(value === "all" ? null : value)}
        >
          <SelectTrigger
            className={cn(
              "h-9 min-w-0 w-[80px] xs:w-[100px] sm:w-[130px]",
              "rounded-[var(--portal-radius-sm)]",
              "border border-[hsl(var(--portal-border))]",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "text-xs",
              "text-[hsl(var(--portal-text-primary))]",
              "hover:bg-[hsl(var(--portal-bg-hover))]",
              "focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.3)]",
              "transition-colors",
              selectedCreativeId && "border-[hsl(var(--portal-accent-blue))]"
            )}
            aria-label="Filter by creative"
          >
            <span className="truncate">
              <SelectValue placeholder="Creatives" />
            </span>
          </SelectTrigger>
          <SelectContent
            className={cn(
              "z-[200]",
              "bg-[hsl(var(--portal-bg-elevated))]",
              "border-[hsl(var(--portal-border))]",
              "rounded-[var(--portal-radius-sm)]",
              "shadow-lg",
              "opacity-100"
            )}
          >
            <SelectItem value="all" className="text-xs">
              All Creatives
            </SelectItem>
            {creatives.map((creative) => (
              <SelectItem
                key={creative.id}
                value={creative.id}
                className="text-xs truncate"
              >
                {creative.label.length > 18
                  ? `${creative.label.slice(0, 18)}...`
                  : creative.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

CampaignCreativeFilters.displayName = "CampaignCreativeFilters";

export default CampaignCreativeFilters;
