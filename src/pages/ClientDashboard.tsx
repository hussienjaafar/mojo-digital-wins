import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, parse, isValid, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ChevronRight, BarChart3, Brain, LayoutDashboard, Layers, Clock, Info } from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { OnboardingWizard } from "@/components/client/OnboardingWizard";
import { ClientDashboardCharts } from "@/components/client/ClientDashboardCharts";
import { ConsolidatedChannelMetrics } from "@/components/client/ConsolidatedChannelMetrics";
import SyncControls from "@/components/client/SyncControls";
import { PortalErrorBoundary } from "@/components/portal/PortalErrorBoundary";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3SectionHeader,
  V3LoadingState,
  V3DataFreshnessPanel,
} from "@/components/v3";
import { PerformanceControlsToolbar } from "@/components/dashboard/PerformanceControlsToolbar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDashboardStore, useDateRange, useSelectedCampaignId, useSelectedCreativeId } from "@/stores/dashboardStore";
import { DashboardTopSection } from "@/components/client/DashboardTopSection";
import { useFilterOptions } from "@/hooks/useFilterOptions";
import { useClientDashboardMetricsQuery } from "@/queries";
import { buildHeroKpis } from "@/utils/buildHeroKpis";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

// Lazy load Advanced Analytics and Heatmap for performance
const AdvancedAnalytics = lazy(() => import("@/components/analytics/AdvancedAnalytics"));
const DonationHeatmap = lazy(() => import("@/components/client/DonationHeatmap"));

// Import Summary widget (lightweight, no need for lazy load)
import { DonorIntelligenceSummary } from "@/components/client/DonorIntelligenceSummary";

// Animation variants for page sections
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

// Expand/collapse animation variants
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

// V3 Section Loading Skeleton
const V3SectionSkeleton = () => (
  <div className="space-y-4">
    <V3LoadingState variant="kpi-grid" />
    <V3LoadingState variant="chart" />
  </div>
);

// ============================================================================
// CollapsibleSection Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  subtitle: string;
  icon: typeof Brain;
  accent: "blue" | "green" | "purple";
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection = ({
  title,
  subtitle,
  icon: Icon,
  accent,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) => {
  // Generate stable IDs from title
  const sectionId = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const headingId = `section-heading-${sectionId}`;
  const contentId = `section-content-${sectionId}`;

  const accentColors = {
    blue: {
      bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
      text: "text-[hsl(var(--portal-accent-blue))]",
      ring: "focus-visible:ring-[hsl(var(--portal-accent-blue))]",
      chevronBg: "bg-[hsl(var(--portal-accent-blue))]",
      titleHover: "group-hover:text-[hsl(var(--portal-accent-blue))]",
    },
    green: {
      bg: "bg-[hsl(var(--portal-success)/0.1)]",
      text: "text-[hsl(var(--portal-success))]",
      ring: "focus-visible:ring-[hsl(var(--portal-success))]",
      chevronBg: "bg-[hsl(var(--portal-success))]",
      titleHover: "group-hover:text-[hsl(var(--portal-success))]",
    },
    purple: {
      bg: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
      text: "text-[hsl(var(--portal-accent-purple))]",
      ring: "focus-visible:ring-[hsl(var(--portal-accent-purple))]",
      chevronBg: "bg-[hsl(var(--portal-accent-purple))]",
      titleHover: "group-hover:text-[hsl(var(--portal-accent-purple))]",
    },
  };

  return (
    <V3Card accent={accent} interactive className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full px-4 sm:px-6 py-4",
          "flex items-center justify-between",
          "transition-colors duration-200",
          "hover:bg-[hsl(var(--portal-bg-elevated))]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
          accentColors[accent].ring,
          "group"
        )}
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <motion.div
            className={cn("p-2.5 rounded-lg shrink-0", accentColors[accent].bg)}
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Icon
              className={cn("h-5 w-5", accentColors[accent].text)}
              aria-hidden="true"
            />
          </motion.div>
          <div className="text-left min-w-0 flex-1">
            <h3
              id={headingId}
              className={cn(
                "text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))] transition-colors duration-200",
                accentColors[accent].titleHover
              )}
            >
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mt-0.5 truncate hidden sm:block">
              {subtitle}
            </p>
          </div>
        </div>

        <motion.div
          className={cn(
            "shrink-0 p-1.5 rounded-md transition-colors duration-200",
            isExpanded
              ? accentColors[accent].chevronBg
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

      <div
        id={contentId}
        role="region"
        aria-labelledby={headingId}
        aria-hidden={!isExpanded}
      >
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-[hsl(var(--portal-border))]">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </V3Card>
  );
};

// ============================================================================
// ClientDashboard Page Component
// ============================================================================

const ClientDashboard = () => {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [showTimeAnalysis, setShowTimeAnalysis] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // V3: Use Zustand store for global date range and filters
  const dateRange = useDateRange();
  const selectedCampaignId = useSelectedCampaignId();
  const selectedCreativeId = useSelectedCreativeId();
  const triggerRefresh = useDashboardStore((s) => s.triggerRefresh);

  // Data fetching with TanStack Query
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useClientDashboardMetricsQuery(organizationId);

  // Fetch filter options for campaigns and creatives
  const { data: filterOptions } = useFilterOptions(
    organizationId,
    dateRange.startDate,
    dateRange.endDate
  );

  // Build hero KPIs from query data
  const heroKpis = useMemo(() => {
    if (!data?.kpis) return [];
    return buildHeroKpis({
      kpis: data.kpis,
      prevKpis: data.prevKpis || {},
      sparklines: data.sparklines,
      timeSeries: data.timeSeries || [],
      metaSpend: data.metaSpend,
      smsSpend: data.smsSpend,
      metaConversions: data.metaConversions,
      smsConversions: data.smsConversions,
      directDonations: data.directDonations,
      attributionFallbackMode: data.attributionFallbackMode,
    });
  }, [data]);

  // Real-time subscription for live donation updates
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`dashboard-realtime-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'actblue_transactions',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          logger.info('New donation received via realtime', payload.new);
          const newDonation = payload.new as any;

          // Check if donation falls within current date range
          // Robust date parsing: handle ISO, yyyy-MM-dd, and timestamp formats
          const txDateRaw = newDonation.transaction_date;
          let txDate: Date | null = null;

          if (typeof txDateRaw === 'number') {
            txDate = new Date(txDateRaw);
          } else if (typeof txDateRaw === 'string') {
            // Try ISO format first
            txDate = parseISO(txDateRaw);
            if (!isValid(txDate)) {
              // Try yyyy-MM-dd format
              txDate = parse(txDateRaw, 'yyyy-MM-dd', new Date());
            }
          }

          // Only trigger refetch if date is valid and within selected range
          if (txDate && isValid(txDate)) {
            const rangeStart = startOfDay(parseISO(dateRange.startDate));
            const rangeEnd = endOfDay(parseISO(dateRange.endDate));

            if (isWithinInterval(txDate, { start: rangeStart, end: rangeEnd })) {
              refetch();
              toast.success(`New donation: $${Number(newDonation.amount).toFixed(2)}`, {
                description: newDonation.donor_name || 'Anonymous donor',
              });
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
          logger.info('Dashboard realtime connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsRealtimeConnected(false);
          logger.warn('Dashboard realtime disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, dateRange.startDate, dateRange.endDate, refetch]);

  useEffect(() => {
    if (organizationId) {
      checkOnboardingStatus();
    }
  }, [organizationId]);

  const checkOnboardingStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .maybeSingle() as any;

    if (profile && !profile.onboarding_completed) {
      setShowOnboarding(true);
    }
  };

  // If organization is still loading, let ClientShell handle the loading state
  if (orgLoading || !organizationId) {
    return <ClientShell><div className="flex items-center justify-center min-h-[200px]" /></ClientShell>;
  }

  return (
    <ClientShell showDateControls={false}>
      <OnboardingWizard
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
      <div className="max-w-[1800px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 w-full">
        <PortalErrorBoundary>
          <TooltipProvider delayDuration={300}>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* AT A GLANCE: Performance Overview - Premium Header + KPIs */}
              <motion.section variants={sectionVariants}>
                <DashboardTopSection
                  title="Performance Overview"
                  subtitle="Campaign metrics at a glance"
                  icon={LayoutDashboard}
                  isLive={isRealtimeConnected}
                  lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : undefined}
                  controls={
                    <PerformanceControlsToolbar
                      organizationId={organizationId}
                      campaignOptions={filterOptions?.campaigns || []}
                      creativeOptions={filterOptions?.creatives || []}
                      showRefresh
                      onRefresh={() => {
                        triggerRefresh();
                        refetch();
                      }}
                      isRefreshing={isFetching}
                    />
                  }
                  kpis={heroKpis}
                  isLoading={isLoading}
                  error={error instanceof Error ? error.message : error ? String(error) : null}
                  onRetry={() => refetch()}
                  onRefresh={undefined}
                  showRefresh={false}
                  isRefreshing={false}
                  gridColumns={{ mobile: 2, tablet: 3, desktop: 6 }}
                  expansionMode="inline"
                />
              </motion.section>

              {/* Charts Section - Always render wrapper to prevent CLS */}
              <motion.section variants={sectionVariants}>
                {(data || (isLoading && !error)) && (
                  <V3SectionHeader
                    title="Trends & Drivers"
                    subtitle="Revenue trends and attribution breakdown"
                    icon={BarChart3}
                    className="mb-4"
                  />
                )}
                {data ? (
                  <ClientDashboardCharts
                    kpis={data.kpis}
                    timeSeries={data.timeSeries}
                    channelBreakdown={data.channelBreakdown}
                    metaSpend={data.metaSpend}
                    metaConversions={data.metaConversions}
                    smsConversions={data.smsConversions}
                    smsMessagesSent={data.smsMessagesSent}
                    directDonations={data.directDonations}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                ) : isLoading && !error ? (
                  /* CLS-safe skeleton matching ClientDashboardCharts 3-row layout */
                  <div className="space-y-[var(--portal-space-lg)]">
                    {/* Row 1: Fundraising Performance (standalone full-width hero) */}
                    <V3LoadingState variant="chart" height={360} />
                    {/* Row 2: Channel Performance (2/3) + Conversion Sources (1/3) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--portal-space-lg)]">
                      <V3LoadingState variant="chart" height={320} className="lg:col-span-2" />
                      <V3LoadingState variant="chart" height={320} />
                    </div>
                    {/* Row 3: Campaign Health (2/3) + Recurring Summary (1/3) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--portal-space-lg)]">
                      <V3LoadingState variant="chart" height={280} className="lg:col-span-2" />
                      <V3LoadingState variant="chart" height={240} />
                    </div>
                  </div>
                ) : null}
              </motion.section>

              {/* DEEP DIVE: Channel Details */}
              <motion.section variants={sectionVariants}>
                <V3SectionHeader
                  title="Channel Details"
                  subtitle="Expand for detailed channel insights"
                  icon={Layers}
                  className="mb-4"
                />
                <ConsolidatedChannelMetrics
                  organizationId={organizationId}
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                />
              </motion.section>

              {/* TIME ANALYSIS: Calendar Heatmap */}
              <motion.section variants={sectionVariants}>
                <CollapsibleSection
                  title="Time Analysis"
                  subtitle="Discover peak donation times by day and hour"
                  icon={Clock}
                  accent="blue"
                  isExpanded={showTimeAnalysis}
                  onToggle={() => setShowTimeAnalysis(!showTimeAnalysis)}
                >
                  <Suspense fallback={<V3SectionSkeleton />}>
                    <DonationHeatmap
                      organizationId={organizationId}
                      startDate={dateRange.startDate}
                      endDate={dateRange.endDate}
                    />
                  </Suspense>
                </CollapsibleSection>
              </motion.section>

              {/* DONOR INTELLIGENCE SUMMARY: Quick overview with link to full page */}
              <motion.section variants={sectionVariants}>
                <DonorIntelligenceSummary
                  organizationId={organizationId}
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                />
              </motion.section>

              {/* ADVANCED: Attribution, Forecasting, LTV/CAC */}
              <motion.section variants={sectionVariants}>
                <CollapsibleSection
                  title="Advanced Analytics"
                  subtitle="Attribution models, LTV/CAC, forecasting & comparisons"
                  icon={BarChart3}
                  accent="purple"
                  isExpanded={showAdvancedAnalytics}
                  onToggle={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
                >
                  <Suspense fallback={<V3SectionSkeleton />}>
                    <AdvancedAnalytics
                      organizationId={organizationId}
                      startDate={dateRange.startDate}
                      endDate={dateRange.endDate}
                    />
                  </Suspense>
                </CollapsibleSection>
              </motion.section>

              {/* Sync Controls */}
              <motion.section variants={sectionVariants}>
                <SyncControls
                  organizationId={organizationId}
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                />
              </motion.section>
            </motion.div>
          </TooltipProvider>
        </PortalErrorBoundary>
      </div>
    </ClientShell>
  );
};

export default ClientDashboard;
