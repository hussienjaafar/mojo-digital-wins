import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HeroKpiGrid, type HeroKpiData } from "./HeroKpiGrid";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

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
      ease: [0, 0, 0.2, 1] as const,
    },
  },
};

// ============================================================================
// Main Component
// ============================================================================

export const DashboardTopSection: React.FC<DashboardTopSectionProps> = ({
  title,
  subtitle,
  icon,
  isLive = false,
  lastUpdated,
  badges,
  controls,
  kpis,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = false,
  isRefreshing = false,
  gridColumns = { mobile: 2, tablet: 3, desktop: 6 },
  expansionMode = "drawer",
  className,
}) => {
  return (
    <motion.section
      className={cn(
        // Header-to-KPI spacing: exactly 16px using portal-space-md token
        "space-y-[var(--portal-space-md)]",
        className
      )}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      aria-label={title}
    >
      {/* Premium Header using DashboardHeader component */}
      <DashboardHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        isLive={isLive}
        lastUpdated={lastUpdated}
        badges={badges}
        dateControls={controls}
        showRefresh={showRefresh}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
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
        expansionMode={expansionMode}
      />
    </motion.section>
  );
};

DashboardTopSection.displayName = "DashboardTopSection";

export default DashboardTopSection;
