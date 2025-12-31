import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3TrendIndicator } from "./V3TrendIndicator";
import { V3MetricLabel } from "./V3MetricLabel";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { EChartsSparkline } from "@/components/charts/echarts";

export type V3KPIAccent = "blue" | "green" | "purple" | "amber" | "red" | "default";

interface V3KPICardWithSparklineProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    /** Override: true = green (good), false = red (bad) */
    isPositive?: boolean;
  };
  subtitle?: string;
  accent?: V3KPIAccent;
  sparklineData?: number[];
  sparklineColor?: string;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
  /** Show tooltip with metric definition */
  showDefinition?: boolean;
}

const accentIconBg: Record<V3KPIAccent, string> = {
  blue: "bg-[hsl(var(--portal-accent-blue))]/10",
  green: "bg-[hsl(var(--portal-success))]/10",
  purple: "bg-[hsl(var(--portal-accent-purple))]/10",
  amber: "bg-[hsl(var(--portal-warning))]/10",
  red: "bg-[hsl(var(--portal-error))]/10",
  default: "bg-[hsl(var(--portal-bg-elevated))]",
};

const accentIconColor: Record<V3KPIAccent, string> = {
  blue: "text-[hsl(var(--portal-accent-blue))]",
  green: "text-[hsl(var(--portal-success))]",
  purple: "text-[hsl(var(--portal-accent-purple))]",
  amber: "text-[hsl(var(--portal-warning))]",
  red: "text-[hsl(var(--portal-error))]",
  default: "text-[hsl(var(--portal-text-muted))]",
};

const accentSparklineColor: Record<V3KPIAccent, string> = {
  blue: "hsl(var(--portal-accent-blue))",
  green: "hsl(var(--portal-success))",
  purple: "hsl(var(--portal-accent-purple))",
  amber: "hsl(var(--portal-warning))",
  red: "hsl(var(--portal-error))",
  default: "hsl(var(--portal-text-muted))",
};

export const V3KPICardWithSparkline: React.FC<V3KPICardWithSparklineProps> = ({
  icon: Icon,
  label,
  value,
  trend,
  subtitle,
  accent = "default",
  sparklineData,
  sparklineColor,
  isLoading = false,
  className,
  onClick,
  showDefinition = true,
}) => {
  const isInteractive = !!onClick;
  const chartColor = sparklineColor || accentSparklineColor[accent];
  const prefersReducedMotion = useReducedMotion();
  
  // Reduced motion variants
  const motionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.01 },
        whileTap: { scale: 0.99 },
      };

  // Check if we have sparkline data
  const hasSparklineData = sparklineData && sparklineData.length > 1;

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg p-4 border border-[hsl(var(--portal-border))]",
          "bg-[hsl(var(--portal-bg-elevated))]",
          className
        )}
        aria-busy="true"
        aria-label={`Loading ${label}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-7 w-20 mb-1" />
        <Skeleton className="h-8 w-full mb-1" />
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <div className={cn("p-1 rounded", accentIconBg[accent])}>
            <Icon
              className={cn("h-4 w-4", accentIconColor[accent])}
              aria-hidden="true"
            />
          </div>
          <V3MetricLabel label={label} showTooltip={showDefinition} />
        </div>
        {trend && (
          <V3TrendIndicator
            value={trend.value}
            isPositive={trend.isPositive}
            size="sm"
          />
        )}
      </div>
      
      <div
        className={cn(
          "text-lg sm:text-xl font-bold text-[hsl(var(--portal-text-primary))] leading-tight",
          "tabular-nums min-w-0 break-words line-clamp-2 sm:line-clamp-1"
        )}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </div>

      {/* Sparkline */}
      {hasSparklineData && (
        <motion.div
          className="h-10 mt-2 -mx-1"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <EChartsSparkline
            data={sparklineData}
            color={chartColor}
            height={40}
            ariaLabel={`${label} sparkline`}
          />
        </motion.div>
      )}

      {subtitle && (
        <span className="text-xs text-[hsl(var(--portal-text-muted))] truncate block mt-1">
          {subtitle}
        </span>
      )}
    </>
  );

  const baseClasses = cn(
    "rounded-lg p-4 border border-[hsl(var(--portal-border))]",
    "bg-[hsl(var(--portal-bg-elevated))]",
    "transition-all duration-200",
    className
  );

  if (isInteractive) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className={cn(
          baseClasses,
          "text-left w-full",
          "hover:border-[hsl(var(--portal-border-hover))] hover:shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:ring-offset-2"
        )}
        aria-label={`${label}: ${value}. Click for details.`}
        {...motionProps}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <div className={baseClasses} role="status" aria-live="polite">
      {content}
    </div>
  );
};

V3KPICardWithSparkline.displayName = "V3KPICardWithSparkline";
