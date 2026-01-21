import { ReactNode } from "react";
import { LucideIcon, Lightbulb, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DemographicsInsightCardProps {
  title: string;
  insight: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
  accent?: "blue" | "green" | "amber" | "purple";
  className?: string;
}

const accentColors = {
  blue: {
    bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    border: "border-[hsl(var(--portal-accent-blue)/0.3)]",
    icon: "text-[hsl(var(--portal-accent-blue))]",
  },
  green: {
    bg: "bg-[hsl(var(--portal-accent-green)/0.1)]",
    border: "border-[hsl(var(--portal-accent-green)/0.3)]",
    icon: "text-[hsl(var(--portal-accent-green))]",
  },
  amber: {
    bg: "bg-[hsl(var(--portal-accent-amber)/0.1)]",
    border: "border-[hsl(var(--portal-accent-amber)/0.3)]",
    icon: "text-[hsl(var(--portal-accent-amber))]",
  },
  purple: {
    bg: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
    border: "border-[hsl(var(--portal-accent-purple)/0.3)]",
    icon: "text-[hsl(var(--portal-accent-purple))]",
  },
};

export function DemographicsInsightCard({
  title,
  insight,
  icon: Icon = Lightbulb,
  trend,
  actionLabel,
  onAction,
  accent = "blue",
  className,
}: DemographicsInsightCardProps) {
  const colors = accentColors[accent];
  
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        colors.bg,
        colors.border,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-md", colors.bg)}>
          <Icon className={cn("h-4 w-4", colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {title}
            </h4>
            {trend && (
              <TrendIcon 
                className={cn(
                  "h-3.5 w-3.5",
                  trend === "up" && "text-[hsl(var(--portal-accent-green))]",
                  trend === "down" && "text-[hsl(var(--portal-accent-red))]",
                  trend === "neutral" && "text-[hsl(var(--portal-text-muted))]"
                )} 
              />
            )}
          </div>
          <p className="text-sm text-[hsl(var(--portal-text-secondary))] leading-relaxed">
            {insight}
          </p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className={cn(
                "mt-2 text-sm font-medium hover:underline",
                colors.icon
              )}
            >
              {actionLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
