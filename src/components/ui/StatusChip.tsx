import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export type StatusChipVariant = "live" | "updated" | "syncing";

export interface StatusChipProps {
  /** The variant determines styling and behavior */
  variant: StatusChipVariant;
  /** Optional timestamp for "updated" variant to show relative time */
  timestamp?: Date;
  /** Custom label override (default derived from variant) */
  label?: string;
  /** Additional class names */
  className?: string;
  /** Accessibility: custom aria-label */
  "aria-label"?: string;
}

// ============================================================================
// Variant Configuration
// ============================================================================

const variantConfig: Record<
  StatusChipVariant,
  {
    defaultLabel: string;
    showDot: boolean;
    hasPulse: boolean;
    bgToken: string;
    textToken: string;
    dotToken: string | null;
  }
> = {
  live: {
    defaultLabel: "Live",
    showDot: true,
    hasPulse: true,
    bgToken: "portal-success",
    textToken: "portal-success",
    dotToken: "portal-success",
  },
  updated: {
    defaultLabel: "Updated",
    showDot: false,
    hasPulse: false,
    bgToken: "portal-bg-elevated",
    textToken: "portal-text-muted",
    dotToken: null,
  },
  syncing: {
    defaultLabel: "Syncing",
    showDot: true,
    hasPulse: true,
    bgToken: "portal-accent-blue",
    textToken: "portal-accent-blue",
    dotToken: "portal-accent-blue",
  },
};

// ============================================================================
// Pulse Animation Dot Component
// ============================================================================

interface PulseDotProps {
  colorToken: string;
  hasPulse: boolean;
}

const PulseDot: React.FC<PulseDotProps> = ({ colorToken, hasPulse }) => (
  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
    {hasPulse && (
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full opacity-75",
          "animate-ping"
        )}
        style={{ backgroundColor: `hsl(var(--${colorToken}))` }}
      />
    )}
    <span
      className="relative inline-flex h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: `hsl(var(--${colorToken}))` }}
    />
  </span>
);

// ============================================================================
// Main Component
// ============================================================================

export const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(
  (
    {
      variant,
      timestamp,
      label,
      className,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const config = variantConfig[variant];

    // Build display label
    const displayLabel = React.useMemo(() => {
      if (label) return label;
      if (variant === "updated" && timestamp) {
        return `Updated ${formatDistanceToNow(timestamp, { addSuffix: false })} ago`;
      }
      return config.defaultLabel;
    }, [label, variant, timestamp, config.defaultLabel]);

    // Build accessible label
    const accessibleLabel = ariaLabel || displayLabel;

    // Determine background opacity based on variant
    const bgOpacity = variant === "live" ? "0.12" : "0.1";

    return (
      <span
        ref={ref}
        role="status"
        aria-label={accessibleLabel}
        aria-live={variant === "live" ? "polite" : undefined}
        className={cn(
          // Base layout
          "inline-flex items-center gap-[var(--portal-space-2xs)]",
          "px-[var(--portal-space-sm)] py-[var(--portal-space-2xs)]",
          "min-h-[24px]",
          // Shape
          "rounded-full",
          // Typography
          "text-xs font-medium leading-none",
          // Transition
          "transition-colors duration-[var(--portal-transition-fast)]",
          className
        )}
        style={{
          backgroundColor: `hsl(var(--${config.bgToken}) / ${bgOpacity})`,
          color: `hsl(var(--${config.textToken}))`,
        }}
        {...props}
      >
        {config.showDot && config.dotToken && (
          <PulseDot colorToken={config.dotToken} hasPulse={config.hasPulse} />
        )}
        <span>{displayLabel}</span>
      </span>
    );
  }
);

StatusChip.displayName = "StatusChip";

export default StatusChip;
