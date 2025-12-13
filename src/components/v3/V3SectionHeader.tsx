import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface V3SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional icon */
  icon?: LucideIcon;
  /** Optional actions (buttons, toggles, etc.) */
  actions?: React.ReactNode;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Style variant - premium includes gradient accent and larger title */
  variant?: "default" | "premium";
  /** Show live indicator (pulsing dot) */
  isLive?: boolean;
  /** Last updated timestamp - displays relative time */
  lastUpdated?: Date;
  /** Additional metadata badges */
  badges?: React.ReactNode[];
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Live Indicator Component
// ============================================================================

const LiveIndicator: React.FC = () => (
  <span
    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] text-xs font-medium"
    aria-live="polite"
  >
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--portal-success))] opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--portal-success))]" />
    </span>
    Live
  </span>
);

// ============================================================================
// Last Updated Badge Component
// ============================================================================

const LastUpdatedBadge: React.FC<{ date: Date }> = ({ date }) => {
  const relativeTime = formatDistanceToNow(date, { addSuffix: true });

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))] text-xs"
      title={date.toLocaleString()}
    >
      Updated {relativeTime}
    </span>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const V3SectionHeader: React.FC<V3SectionHeaderProps> = ({
  title,
  subtitle = undefined,
  icon: Icon = undefined,
  actions = null,
  size = "md",
  variant = "default",
  isLive = false,
  lastUpdated = undefined,
  badges = undefined,
  className = undefined,
}) => {
  const isPremium = variant === "premium";

  const sizeClasses = {
    sm: {
      title: "text-sm font-semibold",
      subtitle: "text-xs",
      icon: "h-4 w-4",
      gap: "gap-2",
    },
    md: {
      title: isPremium ? "text-xl font-bold" : "text-base font-semibold",
      subtitle: "text-sm",
      icon: isPremium ? "h-6 w-6" : "h-5 w-5",
      gap: "gap-3",
    },
    lg: {
      title: isPremium ? "text-2xl font-bold" : "text-lg font-bold",
      subtitle: "text-sm",
      icon: isPremium ? "h-7 w-7" : "h-6 w-6",
      gap: "gap-3",
    },
  };

  const styles = sizeClasses[size];

  // Check if we have any metadata to show
  const hasMetadata = isLive || lastUpdated || (badges && badges.length > 0);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between",
        styles.gap,
        isPremium && [
          "pb-4",
          // Gradient border accent for premium mode - matches hero KPI card styling
          "border-b-2 border-b-transparent",
          "bg-[length:100%_2px] bg-no-repeat bg-bottom",
          "bg-gradient-to-r from-[hsl(var(--portal-accent-blue)/0.3)] via-[hsl(var(--portal-accent-purple)/0.2)] to-transparent",
        ],
        className
      )}
    >
      <div className={cn("flex items-start sm:items-center", styles.gap)}>
        {Icon && (
          <div
            className={cn(
              "rounded-xl transition-all duration-200",
              isPremium
                ? [
                    "p-2.5",
                    "bg-gradient-to-br from-[hsl(var(--portal-accent-blue)/0.15)] to-[hsl(var(--portal-accent-purple)/0.08)]",
                    "border border-[hsl(var(--portal-accent-blue)/0.2)]",
                    "shadow-[0_0_20px_hsl(var(--portal-accent-blue)/0.12)]",
                  ]
                : [
                    "p-1.5",
                    "bg-[hsl(var(--portal-bg-elevated))]",
                  ]
            )}
          >
            <Icon
              className={cn(
                styles.icon,
                isPremium
                  ? "text-[hsl(var(--portal-accent-blue))]"
                  : "text-[hsl(var(--portal-text-muted))]"
              )}
              aria-hidden="true"
            />
          </div>
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn(styles.title, "text-[hsl(var(--portal-text-primary))]")}>
              {title}
            </h2>
            {/* Inline metadata for desktop */}
            {hasMetadata && (
              <div className="hidden sm:flex items-center gap-2">
                {isLive && <LiveIndicator />}
                {lastUpdated && <LastUpdatedBadge date={lastUpdated} />}
                {badges?.map((badge, index) => (
                  <React.Fragment key={index}>{badge}</React.Fragment>
                ))}
              </div>
            )}
          </div>
          {subtitle && (
            <p className={cn(styles.subtitle, "text-[hsl(var(--portal-text-secondary))]")}>
              {subtitle}
            </p>
          )}
          {/* Stacked metadata for mobile */}
          {hasMetadata && (
            <div className="flex sm:hidden items-center gap-2 flex-wrap mt-1">
              {isLive && <LiveIndicator />}
              {lastUpdated && <LastUpdatedBadge date={lastUpdated} />}
              {badges?.map((badge, index) => (
                <React.Fragment key={index}>{badge}</React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 mt-2 sm:mt-0">{actions}</div>}
    </div>
  );
};

V3SectionHeader.displayName = "V3SectionHeader";
