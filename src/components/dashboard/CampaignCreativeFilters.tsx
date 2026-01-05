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
  status?: string;
  isNameAvailable: boolean;
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

      // Fetch IDs from donation_attribution, meta_ad_metrics, AND name lookups
      const [attrResult, metaResult, campaignNamesResult, creativeNamesResult] = await Promise.all([
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
        // Campaign names from meta_campaigns
        sb
          .from('meta_campaigns')
          .select('campaign_id, campaign_name, status')
          .eq('organization_id', organizationId),
        // Creative names from refcode_mappings
        sb
          .from('refcode_mappings')
          .select('creative_id, creative_name')
          .eq('organization_id', organizationId),
      ]);

      if (attrResult.error) throw attrResult.error;
      if (metaResult.error) throw metaResult.error;
      // Name lookups are optional - don't throw on error
      const campaignNamesData = campaignNamesResult.data || [];
      const creativeNamesData = creativeNamesResult.data || [];

      // Build name lookup maps
      const campaignNameMap = new Map<string, { name: string; status: string }>();
      campaignNamesData.forEach((c: any) => {
        if (c.campaign_id && c.campaign_name) {
          campaignNameMap.set(c.campaign_id, {
            name: c.campaign_name,
            status: c.status || 'UNKNOWN',
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
          if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
          if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
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
                className={cn(
                  "text-xs flex items-center gap-1.5",
                  !campaign.isNameAvailable && "text-[hsl(var(--portal-text-muted))] font-mono text-[10px]"
                )}
              >
                {campaign.status && (
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      campaign.status === "ACTIVE"
                        ? "bg-[hsl(var(--portal-accent-green))]"
                        : "bg-[hsl(var(--portal-text-muted))]"
                    )}
                  />
                )}
                <span className="truncate">
                  {campaign.label.length > 22
                    ? `${campaign.label.slice(0, 22)}…`
                    : campaign.label}
                </span>
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
                className={cn(
                  "text-xs",
                  !creative.isNameAvailable && "text-[hsl(var(--portal-text-muted))] font-mono text-[10px]"
                )}
              >
                <span className="truncate">
                  {creative.label.length > 22
                    ? `${creative.label.slice(0, 22)}…`
                    : creative.label}
                </span>
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
