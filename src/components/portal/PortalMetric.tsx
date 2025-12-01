import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PortalMetricProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export const PortalMetric: React.FC<PortalMetricProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  className,
}) => {
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
    </div>
  );
};
