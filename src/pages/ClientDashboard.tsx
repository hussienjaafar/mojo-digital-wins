import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, BarChart3, Brain, LayoutDashboard, Layers, RefreshCw, Clock } from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { OnboardingWizard } from "@/components/client/OnboardingWizard";
import { ClientDashboardMetrics } from "@/components/client/ClientDashboardMetrics";
import { ConsolidatedChannelMetrics } from "@/components/client/ConsolidatedChannelMetrics";
import SyncControls from "@/components/client/SyncControls";
import { PortalErrorBoundary } from "@/components/portal/PortalErrorBoundary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3SectionHeader,
  V3LoadingState,
  V3DateRangePicker,
} from "@/components/v3";
import { cn } from "@/lib/utils";
import { useDashboardStore, useDateRange } from "@/stores/dashboardStore";
import { Button } from "@/components/ui/button";

// Lazy load Advanced Analytics, Donor Intelligence, and Heatmap for performance
const AdvancedAnalytics = lazy(() => import("@/components/analytics/AdvancedAnalytics"));
const DonorIntelligence = lazy(() => import("@/components/client/DonorIntelligence"));
const DonationHeatmap = lazy(() => import("@/components/client/DonationHeatmap"));

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
  const accentColors = {
    blue: {
      bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
      text: "text-[hsl(var(--portal-accent-blue))]",
    },
    green: {
      bg: "bg-[hsl(var(--portal-success)/0.1)]",
      text: "text-[hsl(var(--portal-success))]",
    },
    purple: {
      bg: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
      text: "text-[hsl(var(--portal-accent-purple))]",
    },
  };

  return (
    <V3Card accent={accent} interactive className="overflow-hidden">
      <button
        onClick={onToggle}
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
            <h3 className="text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))] transition-colors duration-200 group-hover:text-[hsl(var(--portal-accent-blue))]">
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
  const [showDonorIntelligence, setShowDonorIntelligence] = useState(false);
  const [showTimeAnalysis, setShowTimeAnalysis] = useState(false);

  // V3: Use Zustand store for global date range
  const dateRange = useDateRange();
  const triggerRefresh = useDashboardStore((s) => s.triggerRefresh);

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
    return <ClientShell />;
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
              {/* AT A GLANCE: Performance Overview */}
              <motion.section variants={sectionVariants}>
                <V3SectionHeader
                  title="Performance Overview"
                  subtitle="Key performance indicators for your campaign"
                  icon={LayoutDashboard}
                  actions={
                    <div className="flex items-center gap-2">
                      <V3DateRangePicker />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={triggerRefresh}
                            className="h-9 px-3 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-hover))]"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Refresh data</TooltipContent>
                      </Tooltip>
                    </div>
                  }
                  className="mb-4"
                />
                <ClientDashboardMetrics
                  organizationId={organizationId}
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                />
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

              {/* DONOR INTELLIGENCE: Attribution, Segments, Topics */}
              <motion.section variants={sectionVariants}>
                <CollapsibleSection
                  title="Donor Intelligence"
                  subtitle="Attribution, creative topics, donor segments & RFM scoring"
                  icon={Brain}
                  accent="green"
                  isExpanded={showDonorIntelligence}
                  onToggle={() => setShowDonorIntelligence(!showDonorIntelligence)}
                >
                  <Suspense fallback={<V3SectionSkeleton />}>
                    <DonorIntelligence
                      organizationId={organizationId}
                      startDate={dateRange.startDate}
                      endDate={dateRange.endDate}
                    />
                  </Suspense>
                </CollapsibleSection>
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
