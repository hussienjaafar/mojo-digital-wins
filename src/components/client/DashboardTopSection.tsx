import * as React from "react";
import { type LucideIcon, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HeroKpiGrid, type HeroKpiData } from "./HeroKpiGrid";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/StatusChip";
import { HeaderCard } from "@/components/layout/HeaderCard";
import { TitleBlock } from "@/components/dashboard/TitleBlock";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

export interface DashboardTopSectionProps {
  /** Section title */
  title: string;
  /** Section subtitle */
  subtitle?: string;
  /** Icon for header */
  icon?: LucideIcon;
  /** Show live indicator */
  isLive?: boolean;
  /** Last data update time */
  lastUpdated?: Date;
  /** Additional metadata badges */
  badges?: React.ReactNode[];
  /** Right-side controls (date picker, filters, etc.) */
  controls?: React.ReactNode;
  /** KPI data for hero grid */
  kpis: HeroKpiData[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Retry handler for errors */
  onRetry?: () => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Is refresh in progress */
  isRefreshing?: boolean;
  /** Grid column configuration */
  gridColumns?: {
    mobile?: 1 | 2;
    tablet?: 2 | 3 | 4;
    desktop?: 3 | 4 | 5 | 6;
  };
  /** Expansion mode for KPI cards: "drawer" or "inline" */
  expansionMode?: "drawer" | "inline";
  /** Additional className */
  className?: string;
}

// ============================================================================
// Animation Variants
// ============================================================================

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

// ============================================================================
// Refresh Button Component
// ============================================================================

interface RefreshButtonProps {
  onClick: () => void;
  isRefreshing?: boolean;
}

const RefreshButton: React.FC<RefreshButtonProps> = ({ onClick, isRefreshing }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={onClick}
          disabled={isRefreshing}
          className={cn(
            // Size and shape
            "h-9 w-9 p-0",
            "rounded-[var(--portal-radius-sm)]",
            // Colors
            "bg-[hsl(var(--portal-bg-secondary))]",
            "border-[hsl(var(--portal-border))]",
            "text-[hsl(var(--portal-text-muted))]",
            // Hover state
            "hover:bg-[hsl(var(--portal-bg-hover))]",
            "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
            "hover:text-[hsl(var(--portal-text-primary))]",
            "hover:shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.08)]",
            // Transitions
            "transition-all duration-[var(--portal-transition-base)]",
            // Disabled state
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label="Refresh data"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              isRefreshing && "animate-spin"
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
      >
        <p>Refresh data</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ============================================================================
// Status Badge Builder
// ============================================================================

interface StatusBadgeProps {
  isLive?: boolean;
  lastUpdated?: Date;
  badges?: React.ReactNode[];
}

const StatusBadges: React.FC<StatusBadgeProps> = ({ isLive, lastUpdated, badges }) => {
  const hasStatus = isLive || lastUpdated || (badges && badges.length > 0);
  if (!hasStatus) return null;

  return (
    <div className="flex items-center gap-[var(--portal-space-xs)] flex-wrap">
      {isLive && <StatusChip variant="live" />}
      {!isLive && lastUpdated && (
        <StatusChip variant="updated" timestamp={lastUpdated} />
      )}
      {badges?.map((badge, index) => (
        <React.Fragment key={index}>{badge}</React.Fragment>
      ))}
    </div>
  );
};

// ============================================================================
// Controls Section Component
// ============================================================================

interface ControlsSectionProps {
  controls?: React.ReactNode;
  showRefresh?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const ControlsSection: React.FC<ControlsSectionProps> = ({
  controls,
  showRefresh,
  onRefresh,
  isRefreshing,
}) => {
  if (!controls && !showRefresh) return null;

  return (
    <div className="flex items-center gap-[var(--portal-space-xs)]">
      {controls}
      {showRefresh && onRefresh && (
        <RefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const DashboardTopSection: React.FC<DashboardTopSectionProps> = ({
  title,
  subtitle = undefined,
  icon = undefined,
  isLive = false,
  lastUpdated = undefined,
  badges = undefined,
  controls = null,
  kpis,
  isLoading = false,
  error = null,
  onRetry = undefined,
  onRefresh = undefined,
  showRefresh = false,
  isRefreshing = false,
  gridColumns = { mobile: 2, tablet: 3, desktop: 6 },
  expansionMode = "drawer",
  className = undefined,
}) => {
  // Build status badge for TitleBlock
  const statusBadge = React.useMemo(() => {
    if (!isLive && !lastUpdated) return undefined;
    if (isLive) return <StatusChip variant="live" />;
    if (lastUpdated) return <StatusChip variant="updated" timestamp={lastUpdated} />;
    return undefined;
  }, [isLive, lastUpdated]);

  return (
    <motion.section
      className={cn("space-y-[var(--portal-space-lg)]", className)}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      aria-label={title}
    >
      {/* Premium Header Card */}
      <HeaderCard
        elevation="elevated"
        border="gradient"
        padding="md"
        className="overflow-hidden"
      >
        {/* Header Layout: Title Left, Controls Right
            - Mobile (<640px): Stack vertically
            - Tablet (640-1024px): Row layout but controls may wrap
            - Desktop (>1024px): Full row layout */}
        <div className={cn(
          // Base: Stack vertically on mobile
          "flex flex-col gap-[var(--portal-space-md)]",
          // Tablet+: Row layout with wrap support
          "sm:flex-row sm:items-start sm:justify-between sm:flex-wrap",
          // Desktop: Align items center
          "lg:items-center lg:flex-nowrap"
        )}>
          {/* Left: Title Block with Icon and Status */}
          <div className="flex flex-col gap-[var(--portal-space-sm)] min-w-0 flex-shrink-0">
            <TitleBlock
              title={title}
              subtitle={subtitle}
              icon={icon}
              iconVariant="gradient"
              size="lg"
              statusBadge={statusBadge}
            />

            {/* Additional badges row (mobile & tablet: stacked below title) */}
            {badges && badges.length > 0 && (
              <div className="flex items-center gap-[var(--portal-space-xs)] flex-wrap lg:hidden">
                {badges.map((badge, index) => (
                  <React.Fragment key={index}>{badge}</React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div className={cn(
            // Base: Stack vertically on mobile
            "flex flex-col gap-[var(--portal-space-sm)]",
            // Tablet+: Row layout with items centered
            "sm:flex-row sm:items-center",
            // Ensure controls don't overflow on tablet
            "sm:flex-wrap lg:flex-nowrap"
          )}>
            {/* Additional badges (desktop only: inline with controls) */}
            {badges && badges.length > 0 && (
              <div className="hidden lg:flex items-center gap-[var(--portal-space-xs)]">
                {badges.map((badge, index) => (
                  <React.Fragment key={index}>{badge}</React.Fragment>
                ))}
              </div>
            )}

            {/* Date picker and refresh button */}
            <ControlsSection
              controls={controls}
              showRefresh={showRefresh}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
            />
          </div>
        </div>
      </HeaderCard>

      {/* Hero KPI Grid */}
      <HeroKpiGrid
        data={kpis}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        mobileColumns={gridColumns.mobile}
        tabletColumns={gridColumns.tablet}
        desktopColumns={gridColumns.desktop}
        expansionMode={expansionMode}
      />
    </motion.section>
  );
};

DashboardTopSection.displayName = "DashboardTopSection";

export default DashboardTopSection;
