import * as React from "react";
import { type LucideIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/StatusChip";
import { HeaderCard } from "@/components/layout/HeaderCard";
import { TitleBlock } from "@/components/dashboard/TitleBlock";
import { DateInputGroup } from "@/components/ui/DateInputGroup";
import type { DateRangeControlProps } from "@/components/ui/DateRangeControl";
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
  /** Sources currently being synced (for smart refresh feedback) */
  syncingSources?: string[];
  /** Additional className */
  className?: string;
}

// ============================================================================
// Refresh Button Component (Internal)
// ============================================================================

interface RefreshButtonProps {
  onClick: () => void;
  isRefreshing?: boolean;
  syncingSources?: string[];
}

const RefreshButton: React.FC<RefreshButtonProps> = ({ onClick, isRefreshing, syncingSources = [] }) => {
  // Build tooltip text based on current state
  const getTooltipText = () => {
    if (syncingSources.length > 0) {
      const sourceLabels: Record<string, string> = {
        meta: 'Meta Ads',
        actblue: 'ActBlue',
        switchboard: 'SMS',
      };
      const labels = syncingSources.map(s => sourceLabels[s] || s).join(', ');
      return `Syncing: ${labels}...`;
    }
    if (isRefreshing) {
      return 'Checking freshness...';
    }
    return 'Smart refresh – syncs stale data only';
  };

  return (
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
              // Dark mode overrides (override outline variant's dark:* classes)
              "dark:border-[hsl(var(--portal-border))]",
              "dark:text-[hsl(var(--portal-text-muted))]",
              // Hover state
              "hover:bg-[hsl(var(--portal-bg-hover))]",
              "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
              "hover:text-[hsl(var(--portal-text-primary))]",
              "hover:shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.08)]",
              // Dark mode hover overrides
              "dark:hover:bg-[hsl(var(--portal-bg-hover))]",
              "dark:hover:text-[hsl(var(--portal-text-primary))]",
              // Focus state - portal-branded ring
              "focus-visible:ring-2",
              "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.3)]",
              "focus-visible:ring-offset-1",
              "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
              // Transition
              "transition-all",
              // Disabled state
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // Active syncing state - subtle glow
              syncingSources.length > 0 && "border-[hsl(var(--portal-accent-blue)/0.5)] shadow-[0_0_8px_hsl(var(--portal-accent-blue)/0.15)]"
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
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

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
  syncingSources = [],
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
      className={cn(className)}
    >
      {/* Header Layout:
          - Mobile: Stack vertically, controls full width
          - Mid desktops: keep controls on a second row to avoid collisions
          - Wide desktops (>=1280px): two-column grid with a constrained, shrinkable controls column */}
      <div
        className={cn(
          // Base: stack vertically
          "relative w-full",
          "grid grid-cols-1",
          "gap-[var(--portal-space-md)]",
          // Wide screens: allow side-by-side without risking overlap
          "xl:grid-cols-[minmax(0,1fr)_minmax(0,720px)]",
          "xl:items-start",
          "xl:gap-6"
        )}
      >
        {/* Left Column: Title Block with Icon and Status */}
        <div className="flex flex-col gap-[var(--portal-space-sm)] min-w-0">
          <TitleBlock
            title={title}
            subtitle={subtitle}
            icon={icon}
            iconVariant="gradient"
            size="lg"
            statusBadge={statusBadge}
            className="[&_p]:max-w-[52ch]"
          />
        </div>

        {/* Right Column: Controls (date controls + refresh) */}
        {hasControls && (
          <div
            className={cn(
              // Critical: allow this grid child to shrink and wrap instead of overflowing
              "min-w-0",
              // Mobile + mid desktops: full width below title
              "w-full",
              // Wide desktop: fill the right grid column (max 720px)
              "xl:w-full",
              // Alignment (only when side-by-side)
              "xl:justify-self-end",
              "xl:self-start"
            )}
          >
            {(() => {
              // If there is no refresh control to append, render dateControls as-is.
              // (Avoid wrapping a full toolbar component in an extra flex container,
              // which can cause shrink-to-fit sizing quirks in the grid auto column.)
              if (!showRefresh || !onRefresh) return dateControls;

              const isDateRangeControl =
                React.isValidElement(dateControls) &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (dateControls.type as any)?.displayName === "DateRangeControl";

              if (isDateRangeControl) {
                return React.cloneElement(
                  dateControls as React.ReactElement<DateRangeControlProps>,
                  {
                    variant: "segmented",
                    trailingControl: (
                      <RefreshButton onClick={onRefresh} isRefreshing={isRefreshing} syncingSources={syncingSources} />
                    ),
                  }
                );
              }

              return (
                <div className={cn("min-w-0 w-full", "flex flex-wrap items-center gap-2")}>
                  {dateControls}
                  <RefreshButton onClick={onRefresh} isRefreshing={isRefreshing} syncingSources={syncingSources} />
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </HeaderCard>
  );
};

DashboardHeader.displayName = "DashboardHeader";

export default DashboardHeader;
