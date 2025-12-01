import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { PortalCircularProgress } from "./PortalCircularProgress";

interface PortalMetricProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  progress?: number; // 0-100 for circular progress
  subtitle?: string;
  variant?: "default" | "large" | "compact";
  className?: string;
}

export const PortalMetric: React.FC<PortalMetricProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  progress,
  subtitle,
  variant = "default",
  className,
}) => {
  if (variant === "large" && progress !== undefined) {
    return (
      <div className={cn("portal-metric", className)}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold portal-text-primary mb-1">{label}</h3>
            <div className="portal-metric-value text-4xl mb-2">{value}</div>
            {subtitle && (
              <p className="text-sm portal-text-muted">{subtitle}</p>
            )}
            {trend && (
              <div className="mt-3 flex items-center gap-2">
                <div
                  className={cn(
                    "portal-badge text-xs font-semibold",
                    trend.isPositive ? "portal-badge-success" : "portal-badge-error"
                  )}
                >
                  {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                </div>
                {trend.label && (
                  <span className="text-xs portal-text-secondary">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          <PortalCircularProgress value={progress} size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("portal-metric", className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="portal-metric-label">{label}</span>
        {Icon && (
          <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--portal-accent-blue) / 0.1)' }}>
            <Icon className="h-4 w-4" style={{ color: 'hsl(var(--portal-accent-blue))' }} />
          </div>
        )}
      </div>
      
      <div className="flex items-end justify-between">
        <div className="portal-metric-value">{value}</div>
        
        {trend && (
          <div
            className={cn(
              "portal-badge text-xs",
              trend.isPositive ? "portal-badge-success" : "portal-badge-error"
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-xs portal-text-muted mt-2">{subtitle}</p>
      )}
    </div>
  );
};
