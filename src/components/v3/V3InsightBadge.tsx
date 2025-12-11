import * as React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightType = "anomaly-high" | "anomaly-low" | "trend-up" | "trend-down" | "info" | "insight";

interface V3InsightBadgeProps {
  type: InsightType;
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

const typeConfig: Record<InsightType, { icon: React.ElementType; bgColor: string; textColor: string; borderColor: string }> = {
  "anomaly-high": {
    icon: AlertTriangle,
    bgColor: "bg-[hsl(var(--portal-warning))]/10",
    textColor: "text-[hsl(var(--portal-warning))]",
    borderColor: "border-[hsl(var(--portal-warning))]/30",
  },
  "anomaly-low": {
    icon: AlertTriangle,
    bgColor: "bg-[hsl(var(--portal-error))]/10",
    textColor: "text-[hsl(var(--portal-error))]",
    borderColor: "border-[hsl(var(--portal-error))]/30",
  },
  "trend-up": {
    icon: TrendingUp,
    bgColor: "bg-[hsl(var(--portal-success))]/10",
    textColor: "text-[hsl(var(--portal-success))]",
    borderColor: "border-[hsl(var(--portal-success))]/30",
  },
  "trend-down": {
    icon: TrendingDown,
    bgColor: "bg-[hsl(var(--portal-error))]/10",
    textColor: "text-[hsl(var(--portal-error))]",
    borderColor: "border-[hsl(var(--portal-error))]/30",
  },
  "info": {
    icon: Info,
    bgColor: "bg-[hsl(var(--portal-accent-blue))]/10",
    textColor: "text-[hsl(var(--portal-accent-blue))]",
    borderColor: "border-[hsl(var(--portal-accent-blue))]/30",
  },
  "insight": {
    icon: Sparkles,
    bgColor: "bg-[hsl(var(--portal-accent-purple))]/10",
    textColor: "text-[hsl(var(--portal-accent-purple))]",
    borderColor: "border-[hsl(var(--portal-accent-purple))]/30",
  },
};

export const V3InsightBadge: React.FC<V3InsightBadgeProps> = ({
  type,
  children,
  className,
  animate = true,
}) => {
  const config = typeConfig[type];
  const Icon = config.icon;

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {children}
    </span>
  );

  if (animate) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {content}
      </motion.span>
    );
  }

  return content;
};

V3InsightBadge.displayName = "V3InsightBadge";
