import * as React from "react";
import { type LucideIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/StatusChip";
import { HeaderCard } from "@/components/layout/HeaderCard";
import { TitleBlock } from "@/components/dashboard/TitleBlock";
import { DateInputGroup } from "@/components/ui/DateInputGroup";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

export interface DashboardHeaderProps {
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
  /** Date controls (expected to be <DateRangeControl ... />) */
  dateControls?: React.ReactNode;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Is refresh in progress */
  isRefreshing?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Refresh Button Component (Internal)
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
            // Size and shape - Mobile: 44px touch target, Tablet+: 36px
            "h-11 w-11 sm:h-9 sm:w-9 p-0",
            "rounded-[var(--portal-radius-sm)]",
            // Border - override outline variant's border-2 to match 1px date controls
            "border",
            // Colors
            "bg-[hsl(var(--portal-bg-secondary))]",
            "border-[hsl(var(--portal-border))]",
            "text-[hsl(var(--portal-text-muted))]",
            // Hover state
            "hover:bg-[hsl(var(--portal-bg-hover))]",
            "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
            "hover:text-[hsl(var(--portal-text-primary))]",
            "hover:shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.08)]",
            // Focus state - portal-branded ring
            "focus-visible:ring-2",
            "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.3)]",
            "focus-visible:ring-offset-1",
            "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
            // Transition
            "transition-all",
            // Disabled state
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={{ transition: "all var(--portal-transition-base)" }}
          aria-label={isRefreshing ? "Refreshing data" : "Refresh data"}
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
        <p>{isRefreshing ? "Refreshing..." : "Refresh data"}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ============================================================================
// Status Badge Row Builder
// ============================================================================

interface StatusBadgeRowProps {
  isLive?: boolean;
  lastUpdated?: Date;
  badges?: React.ReactNode[];
}

/**
 * Builds a flex-wrapped row containing status chip + any additional badges.
 * Used as the statusBadge prop for TitleBlock.
 */
const StatusBadgeRow: React.FC<StatusBadgeRowProps> = ({ isLive, lastUpdated, badges }) => {
  const hasStatus = isLive || lastUpdated;
  const hasBadges = badges && badges.length > 0;

  if (!hasStatus && !hasBadges) return null;

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
// Main Component
// ============================================================================

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  icon,
  isLive = false,
  lastUpdated,
  badges,
  dateControls,
  showRefresh = false,
  onRefresh,
  isRefreshing = false,
  className,
}) => {
  // Build status badge row for TitleBlock
  const statusBadge = React.useMemo(() => {
    const hasStatus = isLive || lastUpdated;
    const hasBadges = badges && badges.length > 0;
    if (!hasStatus && !hasBadges) return undefined;
    return <StatusBadgeRow isLive={isLive} lastUpdated={lastUpdated} badges={badges} />;
  }, [isLive, lastUpdated, badges]);

  const hasControls = dateControls || (showRefresh && onRefresh);

  return (
    <HeaderCard
      elevation="elevated"
      border="gradient"
      padding="md"
      className={cn("overflow-hidden", className)}
    >
      {/* Header Layout:
          - Mobile (<640px): Stack vertically, controls full width
          - Tablet (640-1024px): Row layout, may wrap
          - Desktop (>1024px): Full row layout, aligned center */}
      <div
        className={cn(
          // Base: Stack vertically on mobile
          "flex flex-col gap-[var(--portal-space-md)]",
          // Tablet+: Row layout with wrap support
          "sm:flex-row sm:items-start sm:justify-between sm:flex-wrap",
          // Desktop: Align items center, no wrap
          "lg:items-center lg:flex-nowrap"
        )}
      >
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
        </div>

        {/* Right: Controls (date controls + refresh) */}
        {hasControls && (
          <DateInputGroup
            className={cn(
              // Mobile: full width, ensure proper touch targets
              "w-full sm:w-auto",
              // Wrap on smaller tablets if needed
              "flex-wrap lg:flex-nowrap"
            )}
          >
            {/* Date controls: preset(s) -> calendar (already in dateControls order) */}
            {dateControls}
            {/* Refresh button last in DOM order for tab sequence */}
            {showRefresh && onRefresh && (
              <RefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
            )}
          </DateInputGroup>
        )}
      </div>
    </HeaderCard>
  );
};

DashboardHeader.displayName = "DashboardHeader";

export default DashboardHeader;
