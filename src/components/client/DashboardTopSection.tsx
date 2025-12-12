import * as React from "react";
import { type LucideIcon, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { V3SectionHeader } from "@/components/v3/V3SectionHeader";
import { HeroKpiGrid, type HeroKpiData } from "./HeroKpiGrid";
import { Button } from "@/components/ui/button";
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
            "h-9 w-9 p-0",
            "border-[hsl(var(--portal-border))]",
            "hover:bg-[hsl(var(--portal-bg-hover))]",
            "hover:border-[hsl(var(--portal-accent-blue))]"
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
      <TooltipContent side="bottom">
        <p>Refresh data</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

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
  className = undefined,
}) => {
  // Build the actions slot with refresh button and custom controls
  const actionsContent = React.useMemo(() => {
    if (!showRefresh && !controls) return null;

    return (
      <div className="flex items-center gap-2">
        {controls}
        {showRefresh && onRefresh && (
          <RefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
        )}
      </div>
    );
  }, [controls, showRefresh, onRefresh, isRefreshing]);

  return (
    <motion.section
      className={cn("space-y-6", className)}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      aria-label={title}
    >
      {/* Premium Header */}
      <V3SectionHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        size="lg"
        variant="premium"
        isLive={isLive}
        lastUpdated={lastUpdated}
        badges={badges}
        actions={actionsContent}
      />

      {/* Hero KPI Grid */}
      <HeroKpiGrid
        data={kpis}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        mobileColumns={gridColumns.mobile}
        tabletColumns={gridColumns.tablet}
        desktopColumns={gridColumns.desktop}
      />
    </motion.section>
  );
};

DashboardTopSection.displayName = "DashboardTopSection";

export default DashboardTopSection;
