import { useState } from "react";
import { ChevronDown, ChevronRight, Target, MessageSquare, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalCard } from "@/components/portal/PortalCard";
import ClientMetricsOverview from "./ClientMetricsOverview";
import MetaAdsMetrics from "./MetaAdsMetrics";
import SMSMetrics from "./SMSMetrics";
import DonationMetrics from "./DonationMetrics";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type ChannelSection = "overview" | "meta" | "sms" | "donations";

export function ConsolidatedChannelMetrics({ organizationId, startDate, endDate }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<ChannelSection>>(new Set(["overview"]));

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

  const sections = [
    {
      id: "overview" as ChannelSection,
      title: "All Channels Overview",
      icon: TrendingUp,
      description: "Aggregated performance across all marketing channels",
      color: "#10B981",
      component: <ClientMetricsOverview organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
    {
      id: "meta" as ChannelSection,
      title: "Meta Ads",
      icon: Target,
      description: "Facebook & Instagram advertising performance",
      color: "#0D84FF",
      component: <MetaAdsMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
    {
      id: "sms" as ChannelSection,
      title: "SMS Campaigns",
      icon: MessageSquare,
      description: "Text message campaign metrics and engagement",
      color: "#A78BFA",
      component: <SMSMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
    {
      id: "donations" as ChannelSection,
      title: "Donations",
      icon: DollarSign,
      description: "Transaction history and donor insights",
      color: "#F59E0B",
      component: <DonationMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.id);

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
                  <p className="text-xs sm:text-sm portal-text-secondary mt-0.5 truncate">
                    {section.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0 ml-4">
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