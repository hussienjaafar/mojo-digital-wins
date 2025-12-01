import { useState } from "react";
import { ChevronDown, ChevronRight, Target, MessageSquare, DollarSign, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      component: <ClientMetricsOverview organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
    {
      id: "meta" as ChannelSection,
      title: "Meta Ads",
      icon: Target,
      description: "Facebook & Instagram advertising performance",
      component: <MetaAdsMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
    {
      id: "sms" as ChannelSection,
      title: "SMS Campaigns",
      icon: MessageSquare,
      description: "Text message campaign metrics and engagement",
      component: <SMSMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
    {
      id: "donations" as ChannelSection,
      title: "Donations",
      icon: DollarSign,
      description: "Transaction history and donor insights",
      component: <DonationMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.id);

        return (
          <Card key={section.id} className="overflow-hidden">
            {/* Section Header - Clickable */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-all duration-300 group"
              aria-expanded={isExpanded}
              aria-controls={`section-${section.id}`}
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="portal-card p-2 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/10">
                  <Icon className="h-5 w-5 text-primary transition-all duration-300 group-hover:text-primary" aria-hidden="true" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold portal-text-primary">
                    {section.title}
                  </h3>
                  <p className="text-xs sm:text-sm portal-text-secondary mt-0.5 truncate">
                    {section.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0 ml-4">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:text-primary" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                )}
              </div>
            </button>

            {/* Section Content - Expandable */}
            {isExpanded && (
              <div
                id={`section-${section.id}`}
                className="px-4 sm:px-6 pb-6 pt-2 border-t animate-in slide-in-from-top-2"
              >
                {section.component}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
