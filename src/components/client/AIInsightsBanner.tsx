/**
 * AIInsightsBanner
 * 
 * Animated carousel displaying top AI-discovered insights
 * from the correlation engine. Shows actionable recommendations
 * with dismiss/action capabilities.
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Video,
  MessageSquare,
  Target,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Lightbulb,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Button, V3Badge } from "@/components/v3";

interface Insight {
  id: string;
  type: string;
  attribute: string;
  metric: string;
  lift: number;
  insight_text: string;
  recommended_action?: string;
  is_positive: boolean;
}

interface AIInsightsBannerProps {
  correlations: any[];
  onDismiss?: (id: string) => void;
  onAction?: (insight: Insight) => void;
  className?: string;
}

// Transform correlations into displayable insights
function transformToInsights(correlations: any[]): Insight[] {
  return correlations
    .filter((c) => c.is_actionable && c.lift_percentage)
    .map((c) => ({
      id: c.id,
      type: c.correlation_type,
      attribute: c.attribute_value,
      metric: c.correlated_metric,
      lift: c.lift_percentage,
      insight_text: c.insight_text || generateInsightText(c),
      recommended_action: c.recommended_action,
      is_positive: c.lift_percentage > 0,
    }))
    .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
    .slice(0, 5);
}

function generateInsightText(correlation: any): string {
  const { attribute_name, attribute_value, correlated_metric, lift_percentage } = correlation;
  const direction = lift_percentage > 0 ? "higher" : "lower";
  const liftAbs = Math.abs(lift_percentage).toFixed(0);
  
  return `Creatives with "${attribute_value}" ${attribute_name} show ${liftAbs}% ${direction} ${correlated_metric}`;
}

function getInsightIcon(type: string) {
  switch (type) {
    case "video_retention":
      return Video;
    case "topic_roas":
      return MessageSquare;
    case "ctr_decay":
      return TrendingDown;
    case "cta_effectiveness":
      return Target;
    default:
      return Lightbulb;
  }
}

export const AIInsightsBanner: React.FC<AIInsightsBannerProps> = ({
  correlations,
  onDismiss,
  onAction,
  className,
}) => {
  const insights = transformToInsights(correlations);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);

  // Filter out dismissed insights
  const visibleInsights = insights.filter((i) => !dismissed.has(i.id));

  // Auto-advance carousel
  useEffect(() => {
    if (visibleInsights.length <= 1 || isPaused) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleInsights.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [visibleInsights.length, isPaused]);

  // Reset index if it's out of bounds
  useEffect(() => {
    if (currentIndex >= visibleInsights.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, visibleInsights.length]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    onDismiss?.(id);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + visibleInsights.length) % visibleInsights.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % visibleInsights.length);
  };

  // Empty state when no insights available
  if (visibleInsights.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-xl",
          "bg-gradient-to-r from-[hsl(var(--portal-accent-purple)/0.08)] via-[hsl(var(--portal-bg-secondary))] to-[hsl(var(--portal-accent-purple)/0.08)]",
          "border border-[hsl(var(--portal-border))]",
          className
        )}
      >
        <div className="relative p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="shrink-0 p-2.5 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
              <Sparkles className="w-5 h-5 text-[hsl(var(--portal-text-muted))]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-[hsl(var(--portal-text-muted))]">
                  AI INSIGHTS
                </span>
              </div>
              <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                No patterns detected yet. Click <span className="font-medium text-[hsl(var(--portal-accent-purple))]">"Sync Data"</span> to analyze your campaigns — need at least 5 analyzed creatives with performance data.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const currentInsight = visibleInsights[currentIndex];
  const InsightIcon = getInsightIcon(currentInsight?.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "relative overflow-hidden rounded-xl",
        "bg-gradient-to-r from-[hsl(var(--portal-accent-purple)/0.15)] via-[hsl(var(--portal-accent-blue)/0.1)] to-[hsl(var(--portal-accent-purple)/0.15)]",
        "border border-[hsl(var(--portal-accent-purple)/0.3)]",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--portal-accent-purple)/0.05)] to-transparent animate-pulse" />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="shrink-0 p-2.5 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.2)]">
            <Sparkles className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-[hsl(var(--portal-accent-purple))]">
                AI INSIGHT
              </span>
              {currentInsight && (
                <V3Badge
                  variant={currentInsight.is_positive ? "success" : "error"}
                  size="sm"
                >
                  {currentInsight.is_positive ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  {currentInsight.lift > 0 ? "+" : ""}
                  {currentInsight.lift.toFixed(0)}%
                </V3Badge>
              )}
            </div>

            <AnimatePresence mode="wait">
              {currentInsight && (
                <motion.div
                  key={currentInsight.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-sm sm:text-base text-[hsl(var(--portal-text-primary))] font-medium leading-snug">
                    {currentInsight.insight_text}
                  </p>
                  {currentInsight.recommended_action && (
                    <p className="mt-1 text-xs text-[hsl(var(--portal-text-muted))]">
                      💡 {currentInsight.recommended_action}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation dots */}
            {visibleInsights.length > 1 && (
              <div className="flex items-center gap-1.5 mt-3">
                {visibleInsights.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-200",
                      idx === currentIndex
                        ? "w-4 bg-[hsl(var(--portal-accent-purple))]"
                        : "bg-[hsl(var(--portal-text-muted)/0.3)] hover:bg-[hsl(var(--portal-text-muted)/0.5)]"
                    )}
                    aria-label={`Go to insight ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-2">
            {visibleInsights.length > 1 && (
              <>
                <V3Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={goToPrev}
                  className="text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </V3Button>
                <V3Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={goToNext}
                  className="text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]"
                >
                  <ChevronRight className="w-4 h-4" />
                </V3Button>
              </>
            )}
            {currentInsight && (
              <V3Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDismiss(currentInsight.id)}
                className="text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]"
              >
                <X className="w-4 h-4" />
              </V3Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AIInsightsBanner;
