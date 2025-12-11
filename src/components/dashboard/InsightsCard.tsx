import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Target,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { Insight, InsightType, InsightPriority } from "@/queries/useInsightsQuery";

// ============================================================================
// Types
// ============================================================================

interface InsightsCardProps {
  insights: Insight[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onInsightClick?: (insight: Insight) => void;
  className?: string;
}

// ============================================================================
// Styling
// ============================================================================

const typeIcons: Record<InsightType, React.ComponentType<{ className?: string }>> = {
  anomaly: AlertTriangle,
  trend: TrendingUp,
  milestone: Sparkles,
  opportunity: Lightbulb,
  warning: AlertTriangle,
};

const typeColors: Record<InsightType, string> = {
  anomaly: "text-[hsl(var(--portal-warning))]",
  trend: "text-[hsl(var(--portal-accent-blue))]",
  milestone: "text-[hsl(var(--portal-success))]",
  opportunity: "text-[hsl(var(--portal-accent-purple))]",
  warning: "text-[hsl(var(--portal-error))]",
};

const priorityBadgeStyles: Record<InsightPriority, string> = {
  high: "bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/20",
  medium: "bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/20",
  low: "bg-[hsl(var(--portal-text-muted))]/10 text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-text-muted))]/20",
};

// ============================================================================
// Sub-components
// ============================================================================

const InsightItem: React.FC<{
  insight: Insight;
  index: number;
  onClick?: () => void;
}> = ({ insight, index, onClick }) => {
  const prefersReducedMotion = useReducedMotion();
  const Icon = typeIcons[insight.type];

  return (
    <motion.button
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg",
        "bg-[hsl(var(--portal-bg-elevated))]",
        "border border-[hsl(var(--portal-border))]",
        "hover:border-[hsl(var(--portal-border-hover))] hover:shadow-sm",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:ring-offset-2"
      )}
      aria-label={`${insight.title}. ${insight.description}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("mt-0.5", typeColors[insight.type])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
              {insight.title}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", priorityBadgeStyles[insight.priority])}
            >
              {insight.priority}
            </Badge>
          </div>
          <p className="text-xs text-[hsl(var(--portal-text-muted))] line-clamp-2">
            {insight.description}
          </p>

          {/* Action */}
          {insight.actionable && insight.actionText && (
            <div className="flex items-center gap-1 mt-2 text-xs text-[hsl(var(--portal-accent-blue))]">
              <Target className="h-3 w-3" aria-hidden="true" />
              <span>{insight.actionText}</span>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Change indicator */}
        {insight.change !== undefined && (
          <div
            className={cn(
              "shrink-0 text-sm font-medium",
              insight.change > 0 ? "text-[hsl(var(--portal-success))]" : "text-[hsl(var(--portal-error))]"
            )}
          >
            {insight.change > 0 ? (
              <TrendingUp className="h-4 w-4" aria-label="Increase" />
            ) : (
              <TrendingDown className="h-4 w-4" aria-label="Decrease" />
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
};

const InsightsLoadingSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="p-3 rounded-lg border border-[hsl(var(--portal-border))]">
        <div className="flex items-start gap-3">
          <Skeleton className="h-4 w-4 rounded mt-0.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const InsightsCard: React.FC<InsightsCardProps> = ({
  insights,
  isLoading = false,
  onRefresh,
  onInsightClick,
  className,
}) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "rounded-lg border border-[hsl(var(--portal-border))]",
        "bg-[hsl(var(--portal-bg-surface))]",
        "overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--portal-border))]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-[hsl(var(--portal-accent-purple))]/10">
            <Sparkles className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" aria-hidden="true" />
          </div>
          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
            Smart Insights
          </h3>
          {!isLoading && insights.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {insights.length}
            </Badge>
          )}
        </div>

        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh insights"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 text-[hsl(var(--portal-text-muted))]",
                isLoading && "animate-spin"
              )}
            />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <InsightsLoadingSkeleton />
        ) : insights.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="h-8 w-8 mx-auto text-[hsl(var(--portal-text-muted))] mb-2" />
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
              No insights available yet
            </p>
            <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
              Add more data to generate insights
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <InsightItem
                  key={insight.id}
                  insight={insight}
                  index={index}
                  onClick={() => onInsightClick?.(insight)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

InsightsCard.displayName = "InsightsCard";
