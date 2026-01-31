import React from "react";
import { cn } from "@/lib/utils";

interface PortalCircularProgressProps {
  value: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const PortalCircularProgress: React.FC<PortalCircularProgressProps> = ({
  value,
  size = "md",
  showLabel = true,
  className,
}) => {
  const sizeConfig = {
    sm: { diameter: 60, strokeWidth: 6, fontSize: "text-sm" },
    md: { diameter: 100, strokeWidth: 8, fontSize: "text-xl" },
    lg: { diameter: 140, strokeWidth: 10, fontSize: "text-3xl" },
  };

  const config = sizeConfig[size];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={config.diameter}
        height={config.diameter}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--portal-bg-elevated))"
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--portal-accent-blue))"
          strokeWidth={config.strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{
            filter: "drop-shadow(0 0 8px hsl(var(--portal-accent-blue) / 0.6))",
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold portal-text-primary", config.fontSize)}>
            {Math.round(value)}%
          </span>
          <span className="text-xs portal-text-muted">This Month</span>
        </div>
      )}
    </div>
  );
};
