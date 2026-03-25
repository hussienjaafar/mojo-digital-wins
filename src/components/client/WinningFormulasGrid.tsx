/**
 * WinningFormulasGrid
 * 
 * Displays discovered "winning formulas" - what works best
 * for topics, tones, video lengths, CTAs, etc.
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Video,
  Target,
  Smile,
  Clock,
  TrendingUp,
  BarChart3,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3Badge } from "@/components/v3";
import { useCreativeInsightsQuery, type CreativeLearning } from "@/queries/useCreativeInsightsQuery";

interface WinningFormulasGridProps {
  organizationId: string;
  className?: string;
}

// Group learnings by category
function groupLearnings(learnings: CreativeLearning[]) {
  const topics: CreativeLearning[] = [];
  const tones: CreativeLearning[] = [];
  const ctas: CreativeLearning[] = [];
  const emotional: CreativeLearning[] = [];

  learnings.forEach((l) => {
    if (l.topic) topics.push(l);
    if (l.tone) tones.push(l);
    if (l.call_to_action) ctas.push(l);
    if (l.emotional_appeal) emotional.push(l);
  });

  return { topics, tones, ctas, emotional };
}

// Format ROAS for display
function formatRoas(roas: number | null): string {
  if (!roas) return "-";
  return `${roas.toFixed(2)}x`;
}

// Get performance color
function getPerformanceColor(roas: number | null): string {
  if (!roas) return "text-[hsl(var(--portal-text-muted))]";
  if (roas >= 2) return "text-[hsl(var(--portal-success))]";
  if (roas >= 1) return "text-[hsl(var(--portal-warning))]";
  return "text-[hsl(var(--portal-error))]";
}

interface FormulaCardProps {
  title: string;
  icon: React.ElementType;
  items: Array<{
    label: string;
    roas: number | null;
    sample: number | null;
    confidence: number | null;
  }>;
  accentColor: string;
}

const FormulaCard: React.FC<FormulaCardProps> = ({
  title,
  icon: Icon,
  items,
  accentColor,
}) => {
  if (items.length === 0) return null;

  // Sort by ROAS descending
  const sortedItems = [...items].sort((a, b) => (b.roas || 0) - (a.roas || 0));
  const topItems = sortedItems.slice(0, 5);

  return (
    <V3Card className="overflow-hidden h-full">
      <V3CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className={cn("p-2 rounded-lg", accentColor)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h4 className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">
            {title}
          </h4>
        </div>

        <div className="space-y-2">
          {topItems.map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border)/0.5)] last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                {idx === 0 && (
                  <span className="text-sm">🏆</span>
                )}
                <span className="text-sm text-[hsl(var(--portal-text-primary))] truncate capitalize">
                  {item.label}
                </span>
                {item.sample && item.sample >= 10 && (
                  <V3Badge variant="outline" size="sm" className="shrink-0">
                    n={item.sample}
                  </V3Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-sm font-semibold", getPerformanceColor(item.roas))}>
                  {formatRoas(item.roas)}
                </span>
                {item.confidence && item.confidence >= 80 && (
                  <TrendingUp className="w-3 h-3 text-[hsl(var(--portal-success))]" />
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {sortedItems.length > 5 && (
          <div className="mt-2 text-xs text-[hsl(var(--portal-text-muted))] text-center">
            +{sortedItems.length - 5} more
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
};

export const WinningFormulasGrid: React.FC<WinningFormulasGridProps> = ({
  organizationId,
  className,
}) => {
  const { data: learnings, isLoading } = useCreativeInsightsQuery(organizationId);

  const grouped = useMemo(() => {
    if (!learnings) return { topics: [], tones: [], ctas: [], emotional: [] };
    return groupLearnings(learnings);
  }, [learnings]);

  // Transform to display format
  const topicItems = grouped.topics.map((l) => ({
    label: l.topic || "Unknown",
    roas: l.avg_roas,
    sample: l.sample_size,
    confidence: l.confidence_level,
  }));

  const toneItems = grouped.tones.map((l) => ({
    label: l.tone || "Unknown",
    roas: l.avg_roas,
    sample: l.sample_size,
    confidence: l.confidence_level,
  }));

  const ctaItems = grouped.ctas.map((l) => ({
    label: l.call_to_action || "Unknown",
    roas: l.avg_roas,
    sample: l.sample_size,
    confidence: l.confidence_level,
  }));

  const emotionalItems = grouped.emotional.map((l) => ({
    label: l.emotional_appeal || "Unknown",
    roas: l.avg_roas,
    sample: l.sample_size,
    confidence: l.confidence_level,
  }));

  const hasData = topicItems.length > 0 || toneItems.length > 0 || ctaItems.length > 0 || emotionalItems.length > 0;

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {[1, 2, 3, 4].map((i) => (
          <V3Card key={i} className="h-48 animate-pulse">
            <V3CardContent className="p-4">
              <div className="h-4 w-24 bg-[hsl(var(--portal-bg-secondary))] rounded mb-4" />
              <div className="space-y-3">
                <div className="h-3 w-full bg-[hsl(var(--portal-bg-secondary))] rounded" />
                <div className="h-3 w-3/4 bg-[hsl(var(--portal-bg-secondary))] rounded" />
                <div className="h-3 w-1/2 bg-[hsl(var(--portal-bg-secondary))] rounded" />
              </div>
            </V3CardContent>
          </V3Card>
        ))}
      </div>
    );
  }

  if (!hasData) {
    return (
      <V3Card className={className}>
        <V3CardContent className="p-8 text-center">
          <Zap className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--portal-text-muted))]" />
          <h4 className="text-lg font-medium text-[hsl(var(--portal-text-primary))] mb-2">
            No Patterns Detected Yet
          </h4>
          <p className="text-sm text-[hsl(var(--portal-text-muted))] max-w-md mx-auto">
            As your campaigns run and creatives are analyzed, we'll identify winning patterns 
            for topics, tones, and messaging strategies.
          </p>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}
    >
      <FormulaCard
        title="Top Topics"
        icon={MessageSquare}
        items={topicItems}
        accentColor="bg-[hsl(var(--portal-accent-purple))]"
      />
      <FormulaCard
        title="Best Tones"
        icon={Smile}
        items={toneItems}
        accentColor="bg-[hsl(var(--portal-accent-blue))]"
      />
      <FormulaCard
        title="Effective CTAs"
        icon={Target}
        items={ctaItems}
        accentColor="bg-[hsl(var(--portal-success))]"
      />
      <FormulaCard
        title="Emotional Appeals"
        icon={BarChart3}
        items={emotionalItems}
        accentColor="bg-[hsl(var(--portal-warning))]"
      />
    </motion.div>
  );
};

export default WinningFormulasGrid;
