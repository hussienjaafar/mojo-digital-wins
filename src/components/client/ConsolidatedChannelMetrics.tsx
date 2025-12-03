import { useState } from "react";
import { ChevronDown, ChevronRight, Target, MessageSquare, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalCard } from "@/components/portal/PortalCard";
import { Skeleton } from "@/components/ui/skeleton";
import MetaAdsMetrics from "./MetaAdsMetrics";
import SMSMetrics from "./SMSMetrics";
import DonationMetrics from "./DonationMetrics";
import { useChannelSummaries } from "@/hooks/useChannelSummaries";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type ChannelSection = "meta" | "sms" | "donations";

export function ConsolidatedChannelMetrics({ organizationId, startDate, endDate }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<ChannelSection>>(new Set());
  const summaries = useChannelSummaries(organizationId, startDate, endDate);

  const toggleSection = (section: ChannelSection) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  const sections = [
    {
      id: "meta" as ChannelSection,
      title: "Meta Ads",
      icon: Target,
      description: "Facebook & Instagram advertising performance",
      color: "hsl(var(--portal-accent-blue))",
      component: <MetaAdsMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
      getSummary: () => {
        if (summaries.meta.isLoading) return null;
        const roasDisplay = summaries.meta.hasConversionValueData 
          ? `${summaries.meta.roas.toFixed(1)}x` 
          : 'N/A';
        return [
          { label: "Spend", value: formatCurrency(summaries.meta.spend) },
          { label: "Conv", value: formatNumber(summaries.meta.conversions) },
          { label: "ROAS", value: roasDisplay, highlight: summaries.meta.roas >= 2 },
        ];
      },
    },
    {
      id: "sms" as ChannelSection,
      title: "SMS Campaigns",
      icon: MessageSquare,
      description: "Text message campaign metrics and engagement",
      color: "hsl(var(--portal-accent-purple))",
      component: <SMSMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
      getSummary: () => {
        if (summaries.sms.isLoading) return null;
        return [
          { label: "Sent", value: formatNumber(summaries.sms.sent) },
          { label: "Raised", value: formatCurrency(summaries.sms.raised) },
          { label: "ROI", value: `${summaries.sms.roi.toFixed(1)}x`, highlight: summaries.sms.roi >= 2 },
        ];
      },
    },
    {
      id: "donations" as ChannelSection,
      title: "Donations",
      icon: DollarSign,
      description: "Transaction history and donor insights",
      color: "hsl(var(--portal-success))",
      component: <DonationMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
      getSummary: () => {
        if (summaries.donations.isLoading) return null;
        return [
          { label: "Total", value: formatCurrency(summaries.donations.total) },
          { label: "Donors", value: formatNumber(summaries.donations.donors) },
          { label: "Avg", value: formatCurrency(summaries.donations.avgDonation) },
        ];
      },
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.id);
        const summaryData = section.getSummary();

        return (
          <PortalCard 
            key={section.id} 
            className={cn(
              "overflow-hidden transition-all duration-300",
              `portal-delay-${index * 100}`
            )}
          >
            {/* Section Header - Clickable */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-[hsl(var(--portal-bg-elevated))] transition-all duration-300 group"
              aria-expanded={isExpanded}
              aria-controls={`section-${section.id}`}
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div 
                  className="p-2.5 rounded-lg shrink-0 transition-all duration-300 group-hover:scale-110"
                  style={{ background: `${section.color}15` }}
                >
                  <Icon 
                    className="h-5 w-5 transition-all duration-300" 
                    style={{ color: section.color }}
                    aria-hidden="true" 
                  />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold portal-text-primary transition-colors duration-300 group-hover:text-[hsl(var(--portal-accent-blue))]">
                    {section.title}
                  </h3>
                  <p className="text-xs sm:text-sm portal-text-secondary mt-0.5 truncate hidden sm:block">
                    {section.description}
                  </p>
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="flex items-center gap-3 sm:gap-6 mr-3">
              {summaryData ? (
                  summaryData.map((metric, i) => (
                    <div key={i} className="text-right hidden sm:block">
                      <div className={cn(
                        "text-sm font-semibold",
                        'highlight' in metric && metric.highlight ? "text-[hsl(var(--portal-success))]" : "portal-text-primary"
                      )}>
                        {metric.value}
                      </div>
                      <div className="text-[10px] portal-text-muted uppercase tracking-wide">
                        {metric.label}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex gap-4 hidden sm:flex">
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                )}

                {/* Mobile: Show just key metric */}
                {summaryData && (
                  <div className="text-right sm:hidden">
                    <div className={cn(
                      "text-sm font-semibold",
                      summaryData[2] && 'highlight' in summaryData[2] && summaryData[2].highlight ? "text-[hsl(var(--portal-success))]" : "portal-text-primary"
                    )}>
                      {summaryData[2]?.value}
                    </div>
                    <div className="text-[10px] portal-text-muted uppercase">
                      {summaryData[2]?.label}
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <div 
                  className={cn(
                    "p-1.5 rounded-md transition-all duration-300",
                    isExpanded ? "bg-[hsl(var(--portal-accent-blue))]" : "bg-[hsl(var(--portal-bg-elevated))] group-hover:bg-[hsl(var(--portal-bg-tertiary))]"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown 
                      className={cn(
                        "h-4 w-4 transition-transform duration-300",
                        "text-white"
                      )} 
                      aria-hidden="true" 
                    />
                  ) : (
                    <ChevronRight 
                      className={cn(
                        "h-4 w-4 transition-all duration-300 group-hover:translate-x-0.5",
                        "portal-text-secondary group-hover:portal-text-primary"
                      )} 
                      aria-hidden="true" 
                    />
                  )}
                </div>
              </div>
            </button>

            {/* Section Content - Expandable */}
            {isExpanded && (
              <div
                id={`section-${section.id}`}
                className="px-4 sm:px-6 pb-6 pt-2 border-t border-[hsl(var(--portal-border))] portal-animate-fade-in"
              >
                {section.component}
              </div>
            )}
          </PortalCard>
        );
      })}
    </div>
  );
}
