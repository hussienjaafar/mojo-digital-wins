import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface V3TrendIndicatorProps {
  value: number;
  /** Override automatic direction detection */
  isPositive?: boolean;
  /** Show as neutral (no color) */
  neutral?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Custom suffix (default: %) */
  suffix?: string;
  className?: string;
}

export const V3TrendIndicator: React.FC<V3TrendIndicatorProps> = ({
  value,
  isPositive,
  neutral = false,
  size = "sm",
  suffix = "%",
  className,
}) => {
  // Determine direction: positive means good (green), negative means bad (red)
  // Unless isPositive is explicitly set
  const positive = isPositive ?? value >= 0;
  const isZero = Math.abs(value) < 0.01;

  const sizeClasses = {
    sm: "text-xs gap-0.5",
    md: "text-sm gap-1",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
  };

  if (isZero || neutral) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-medium text-[hsl(var(--portal-text-muted))]",
          sizeClasses[size],
          className
        )}
        aria-label="No change"
      >
        <Minus className={iconSizes[size]} aria-hidden="true" />
        <span>0{suffix}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        positive
          ? "text-[hsl(var(--portal-success))]"
          : "text-[hsl(var(--portal-error))]",
        sizeClasses[size],
        className
      )}
      aria-label={`${positive ? "Increased" : "Decreased"} by ${Math.abs(value).toFixed(1)}${suffix}`}
    >
      {positive ? (
        <TrendingUp className={iconSizes[size]} aria-hidden="true" />
      ) : (
        <TrendingDown className={iconSizes[size]} aria-hidden="true" />
      )}
      <span>{Math.abs(value).toFixed(1)}{suffix}</span>
    </span>
  );
};

V3TrendIndicator.displayName = "V3TrendIndicator";
