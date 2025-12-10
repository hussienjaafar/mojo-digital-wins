import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Target, MessageSquare, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  V3Card,
  V3LoadingState,
} from "@/components/v3";
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

type V3Accent = "blue" | "purple" | "green";

interface SummaryMetric {
  label: string;
  value: string;
  highlight?: boolean;
}

interface ChannelConfig {
  id: ChannelSection;
  title: string;
  icon: typeof Target;
  description: string;
  accent: V3Accent;
  component: React.ReactNode;
  getSummary: () => SummaryMetric[] | null;
}

// Animation variants for smooth expand/collapse
const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.2 },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.3, delay: 0.1 },
    },
  },
};

// Stagger animation for cards
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

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

  // Check if any channel is still loading
  const isAnyLoading = summaries.meta.isLoading || summaries.sms.isLoading || summaries.donations.isLoading;

  const sections: ChannelConfig[] = useMemo(() => [
    {
      id: "meta" as ChannelSection,
      title: "Meta Ads",
      icon: Target,
      description: "Facebook & Instagram advertising performance",
      accent: "blue" as V3Accent,
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
      accent: "purple" as V3Accent,
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
      accent: "green" as V3Accent,
      component: <DonationMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
      getSummary: () => {
        if (summaries.donations.isLoading) return null;
        return [
          { label: "Net", value: formatCurrency(summaries.donations.totalNet) },
          { label: "Refunds", value: formatCurrency(summaries.donations.refundAmount || 0) },
          { label: "Donors", value: formatNumber(summaries.donations.donors) },
          { label: "Avg Net", value: formatCurrency(summaries.donations.avgNet) },
        ];
      },
    },
  ], [organizationId, startDate, endDate, summaries]);

  // Show loading state if all channels are still loading
  if (isAnyLoading && !expandedSections.size) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading channel metrics">
        {[1, 2, 3].map((i) => (
          <V3LoadingState key={i} variant="channel" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.id);
        const summaryData = section.getSummary();
        const isLoading = section.id === "meta" ? summaries.meta.isLoading :
                          section.id === "sms" ? summaries.sms.isLoading :
                          summaries.donations.isLoading;

        return (
          <motion.div key={section.id} variants={cardVariants}>
            <V3Card
              accent={section.accent}
              interactive
              className="overflow-hidden"
            >
              {/* Section Header - Clickable */}
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "w-full px-4 sm:px-6 py-4",
                  "flex items-center justify-between",
                  "transition-colors duration-200",
                  "hover:bg-[hsl(var(--portal-bg-elevated))]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  "focus-visible:ring-[hsl(var(--portal-accent-blue))]",
                  "group"
                )}
                aria-expanded={isExpanded}
                aria-controls={`section-content-${section.id}`}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Icon with accent color */}
                  <motion.div
                    className="p-2.5 rounded-lg shrink-0"
                    style={{
                      background:
                        section.accent === "blue"
                          ? "hsl(var(--portal-accent-blue) / 0.1)"
                          : section.accent === "purple"
                          ? "hsl(var(--portal-accent-purple) / 0.1)"
                          : "hsl(var(--portal-success) / 0.1)",
                    }}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        section.accent === "blue" && "text-[hsl(var(--portal-accent-blue))]",
                        section.accent === "purple" && "text-[hsl(var(--portal-accent-purple))]",
                        section.accent === "green" && "text-[hsl(var(--portal-success))]"
                      )}
                      aria-hidden="true"
                    />
                  </motion.div>

                  {/* Title & Description */}
                  <div className="text-left min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))] transition-colors duration-200 group-hover:text-[hsl(var(--portal-accent-blue))]">
                      {section.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mt-0.5 truncate hidden sm:block">
                      {section.description}
                    </p>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="flex items-center gap-3 sm:gap-6 mr-3">
                  {isLoading ? (
                    <div className="hidden sm:flex gap-4">
                      <div className="h-8 w-12 rounded bg-[hsl(var(--portal-bg-elevated))] animate-pulse" />
                      <div className="h-8 w-12 rounded bg-[hsl(var(--portal-bg-elevated))] animate-pulse" />
                      <div className="h-8 w-12 rounded bg-[hsl(var(--portal-bg-elevated))] animate-pulse" />
                    </div>
                  ) : summaryData ? (
                    <>
                      {/* Desktop: Show all metrics */}
                      <div className="hidden sm:flex gap-4 sm:gap-6">
                        {summaryData.map((metric, i) => (
                          <div key={i} className="text-right">
                            <div
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                metric.highlight
                                  ? "text-[hsl(var(--portal-success))]"
                                  : "text-[hsl(var(--portal-text-primary))]"
                              )}
                            >
                              {metric.value}
                            </div>
                            <div className="text-[10px] text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">
                              {metric.label}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Mobile: Show just key metric (usually 3rd - ROI/ROAS/Avg) */}
                      <div className="text-right sm:hidden">
                        {summaryData[2] && (
                          <>
                            <div
                              className={cn(
                                "text-sm font-semibold",
                                summaryData[2].highlight
                                  ? "text-[hsl(var(--portal-success))]"
                                  : "text-[hsl(var(--portal-text-primary))]"
                              )}
                            >
                              {summaryData[2].value}
                            </div>
                            <div className="text-[10px] text-[hsl(var(--portal-text-muted))] uppercase">
                              {summaryData[2].label}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Expand/Collapse Icon */}
                <motion.div
                  className={cn(
                    "shrink-0 p-1.5 rounded-md transition-colors duration-200",
                    isExpanded
                      ? "bg-[hsl(var(--portal-accent-blue))]"
                      : "bg-[hsl(var(--portal-bg-elevated))] group-hover:bg-[hsl(var(--portal-bg-tertiary))]"
                  )}
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4",
                      isExpanded
                        ? "text-white"
                        : "text-[hsl(var(--portal-text-secondary))] group-hover:text-[hsl(var(--portal-text-primary))]"
                    )}
                    aria-hidden="true"
                  />
                </motion.div>
              </button>

              {/* Section Content - Expandable with Animation */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    id={`section-content-${section.id}`}
                    variants={contentVariants}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-[hsl(var(--portal-border))]">
                      {section.component}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </V3Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
