import { useState, useMemo, useCallback } from "react";
import {
  ChevronRight,
  Target,
  MessageSquare,
  DollarSign,
  RefreshCw,
  AlertCircle,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  V3Card,
  V3LoadingState,
} from "@/components/v3";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MetaAdsMetrics from "./MetaAdsMetrics";
import SMSMetrics from "./SMSMetrics";
import DonationMetrics from "./DonationMetrics";
import { useChannelSummariesQuery, type ChannelSummariesData } from "@/queries";

// ============================================================================
// Types
// ============================================================================

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
  /** Highlight with success color when true, error color when false */
  highlight?: boolean | "success" | "error";
}

interface ChannelConfig {
  id: ChannelSection;
  title: string;
  icon: typeof Target;
  description: string;
  accent: V3Accent;
  component: React.ReactNode;
  getSummary: (data: ChannelSummariesData | undefined) => SummaryMetric[] | null;
  hasData: (data: ChannelSummariesData | undefined) => boolean;
  getLastDataDate: (data: ChannelSummariesData | undefined) => string | null;
}

// ============================================================================
// Animation Variants
// ============================================================================

const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.2 },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.3, delay: 0.1 },
    },
  },
};

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
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

// ============================================================================
// Helper Components
// ============================================================================

interface SummaryHeaderProps {
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRetry: () => void;
  isDataStale: boolean;
}

const SummaryHeader: React.FC<SummaryHeaderProps> = ({
  isLoading,
  isFetching,
  error,
  onRetry,
  isDataStale,
}) => {
  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 mb-3",
          "rounded-lg border",
          "border-[hsl(var(--portal-error)/0.3)]",
          "bg-[hsl(var(--portal-error)/0.05)]"
        )}
        role="alert"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
          <span className="text-sm text-[hsl(var(--portal-error))]">
            Failed to load channel summaries
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-1.5 h-7 text-xs border-[hsl(var(--portal-error)/0.3)] text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 mb-3",
          "rounded-lg",
          "bg-[hsl(var(--portal-bg-elevated))]"
        )}
        role="status"
        aria-label="Loading channel summaries"
      >
        <div className="h-4 w-4 border-2 border-[hsl(var(--portal-accent-blue))] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[hsl(var(--portal-text-muted))]">
          Fetching channel summaries…
        </span>
      </div>
    );
  }

  if (isFetching || isDataStale) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-4 py-2 mb-3",
          "rounded-lg",
          "bg-[hsl(var(--portal-bg-elevated))]"
        )}
      >
        <div className="flex items-center gap-2">
          {isFetching ? (
            <>
              <div className="h-3 w-3 border-2 border-[hsl(var(--portal-accent-blue))] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                Refreshing…
              </span>
            </>
          ) : isDataStale ? (
            <>
              <Clock className="h-3.5 w-3.5 text-[hsl(var(--portal-warning))]" />
              <span className="text-xs text-[hsl(var(--portal-warning))]">
                Data may be stale
              </span>
            </>
          ) : null}
        </div>
        {isDataStale && !isFetching && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="gap-1 h-6 text-xs text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return null;
};

interface MetricChipProps {
  metric: SummaryMetric;
  compact?: boolean;
}

const MetricChip: React.FC<MetricChipProps> = ({ metric, compact = false }) => {
  const highlightClass = metric.highlight === true || metric.highlight === "success"
    ? "text-[hsl(var(--portal-success))]"
    : metric.highlight === "error"
    ? "text-[hsl(var(--portal-error))]"
    : "text-[hsl(var(--portal-text-primary))]";

  return (
    <div className={cn("text-right", compact && "flex items-baseline gap-1")}>
      <div
        className={cn(
          "font-semibold tabular-nums",
          compact ? "text-sm" : "text-sm",
          highlightClass
        )}
      >
        {metric.value}
      </div>
      <div
        className={cn(
          "text-[hsl(var(--portal-text-muted))] uppercase tracking-wide",
          compact ? "text-[9px]" : "text-[10px]"
        )}
      >
        {metric.label}
      </div>
    </div>
  );
};

const MetricChipSkeleton: React.FC = () => (
  <div className="text-right">
    <Skeleton className="h-5 w-12 mb-1" />
    <Skeleton className="h-3 w-8" />
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export function ConsolidatedChannelMetrics({ organizationId, startDate, endDate }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<ChannelSection>>(new Set());

  // Use new TanStack Query hook
  const {
    data: summaryData,
    isLoading,
    isFetching,
    error,
    refetch,
    isDataStale,
  } = useChannelSummariesQuery(organizationId, startDate, endDate);

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

  const formatCurrency = useCallback((value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }, []);

  const formatNumber = useCallback((value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  }, []);

  const sections: ChannelConfig[] = useMemo(() => [
    {
      id: "meta" as ChannelSection,
      title: "Meta Ads",
      icon: Target,
      description: "Facebook & Instagram advertising performance",
      accent: "blue" as V3Accent,
      component: <MetaAdsMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
      getSummary: (data) => {
        if (!data) return null;
        const { meta } = data;
        const roasDisplay = meta.hasConversionValueData
          ? `${meta.roas.toFixed(1)}x`
          : "N/A";
        return [
          { label: "Spend", value: formatCurrency(meta.spend) },
          { label: "Conv", value: formatNumber(meta.conversions) },
          {
            label: "ROAS",
            value: roasDisplay,
            highlight: meta.roas >= 2 ? "success" : meta.roas > 0 && meta.roas < 1 ? "error" : false,
          },
        ];
      },
      hasData: (data) => data?.meta.hasData ?? false,
      getLastDataDate: (data) => data?.meta.lastDataDate ?? null,
    },
    {
      id: "sms" as ChannelSection,
      title: "SMS Campaigns",
      icon: MessageSquare,
      description: "Text message campaign metrics and engagement",
      accent: "purple" as V3Accent,
      component: <SMSMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
      getSummary: (data) => {
        if (!data) return null;
        const { sms } = data;
        return [
          { label: "Sent", value: formatNumber(sms.sent) },
          { label: "Raised", value: formatCurrency(sms.raised) },
          {
            label: "ROI",
            value: `${sms.roi.toFixed(1)}x`,
            highlight: sms.roi >= 2 ? "success" : sms.roi > 0 && sms.roi < 1 ? "error" : false,
          },
        ];
      },
      hasData: (data) => data?.sms.hasData ?? false,
      getLastDataDate: (data) => data?.sms.lastDataDate ?? null,
    },
    {
      id: "donations" as ChannelSection,
      title: "Donations",
      icon: DollarSign,
      description: "Transaction history and donor insights",
      accent: "green" as V3Accent,
      component: <DonationMetrics organizationId={organizationId} startDate={startDate} endDate={endDate} />,
      getSummary: (data) => {
        if (!data) return null;
        const { donations } = data;
        return [
          { label: "Net", value: formatCurrency(donations.totalNet) },
          {
            label: "Refunds",
            value: formatCurrency(donations.refundAmount),
            highlight: donations.refundAmount > donations.totalGross * 0.05 ? "error" : false,
          },
          { label: "Donors", value: formatNumber(donations.donors) },
          { label: "Avg", value: formatCurrency(donations.avgNet) },
        ];
      },
      hasData: (data) => data?.donations.hasData ?? false,
      getLastDataDate: (data) => data?.donations.lastDataDate ?? null,
    },
  ], [organizationId, startDate, endDate, formatCurrency, formatNumber]);

  // Show loading skeleton if no data and loading
  if (isLoading && !summaryData) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading channel metrics">
        {[1, 2, 3].map((i) => (
          <V3LoadingState key={i} variant="channel" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status Header */}
      <SummaryHeader
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => refetch()}
        isDataStale={isDataStale(endDate)}
      />

      {/* Channel Cards */}
      <motion.div
        className="space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);
          const summaryMetrics = section.getSummary(summaryData);
          const channelHasData = section.hasData(summaryData);
          const lastDataDate = section.getLastDataDate(summaryData);
          const isChannelStale = lastDataDate && lastDataDate < endDate;

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
                    "hover:bg-[hsl(var(--portal-bg-hover))]",
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
                      className={cn(
                        "p-2.5 rounded-lg shrink-0 transition-colors duration-200",
                        section.accent === "blue" && "bg-[hsl(var(--portal-accent-blue)/0.1)]",
                        section.accent === "purple" && "bg-[hsl(var(--portal-accent-purple)/0.1)]",
                        section.accent === "green" && "bg-[hsl(var(--portal-success)/0.1)]"
                      )}
                      whileHover={{ scale: 1.05 }}
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))] transition-colors duration-200 group-hover:text-[hsl(var(--portal-accent-blue))]">
                          {section.title}
                        </h3>
                        {isChannelStale && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                              "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]"
                            )}
                            title={`Last data: ${lastDataDate}`}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            Stale
                          </span>
                        )}
                        {!channelHasData && !isLoading && (
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px]",
                              "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]"
                            )}
                          >
                            No data
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mt-0.5 truncate hidden sm:block">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="flex items-center gap-3 sm:gap-6 mr-3">
                    {isLoading ? (
                      <div className="hidden sm:flex gap-4">
                        <MetricChipSkeleton />
                        <MetricChipSkeleton />
                        <MetricChipSkeleton />
                      </div>
                    ) : summaryMetrics ? (
                      <>
                        {/* Desktop: Show all metrics */}
                        <div className="hidden sm:flex gap-4 sm:gap-6">
                          {summaryMetrics.map((metric, i) => (
                            <MetricChip key={i} metric={metric} />
                          ))}
                        </div>

                        {/* Mobile: Show just key metric (usually 3rd - ROI/ROAS/Avg) */}
                        <div className="text-right sm:hidden">
                          {summaryMetrics[2] && (
                            <MetricChip metric={summaryMetrics[2]} compact />
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
    </div>
  );
}
