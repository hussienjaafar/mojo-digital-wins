import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lightbulb, TrendingUp, Zap, CheckCircle2, Target, MessageSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3CardDescription,
  V3Badge,
  V3Button,
  V3EmptyState,
} from "@/components/v3";
import { iconSizes, tierColors, getTierClasses } from "@/lib/design-tokens";

type Creative = {
  id: string;
  topic: string | null;
  tone: string | null;
  urgency_level: string | null;
  emotional_appeal: string | null;
  call_to_action_type: string | null;
  roas: number | null;
  ctr: number | null;
  conversions: number;
  impressions?: number;
};

type Props = {
  organizationId: string;
  creatives: Creative[];
};

type Recommendation = {
  id: string;
  type: 'topic' | 'tone' | 'emotional' | 'cta' | 'combination';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  basedOn: string;
  suggestion: string;
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

export function CreativeRecommendations({ organizationId, creatives }: Props) {
  // Check data status for user feedback
  const dataStatus = useMemo(() => {
    const total = creatives.length;
    const analyzed = creatives.filter(c => c.topic).length;
    const withPerformance = creatives.filter(c => (c.impressions ?? 0) > 0 || c.roas !== null).length;
    
    return {
      total,
      analyzed,
      withPerformance,
      hasEnoughData: analyzed >= 5,
      hasPerformanceData: withPerformance >= 3,
      needsAnalysis: total > 0 && analyzed < 3,
      needsPerformance: analyzed >= 3 && withPerformance < 3,
    };
  }, [creatives]);

  const recommendations = useMemo(() => {
    const recs: Recommendation[] = [];
    
    // Lowered threshold: only need 3 analyzed creatives instead of 5
    if (creatives.filter(c => c.topic).length < 3) {
      return recs;
    }

    // Calculate averages by different dimensions
    const byTopic: Record<string, { count: number; totalRoas: number; totalConv: number }> = {};
    const byTone: Record<string, { count: number; totalRoas: number; totalConv: number }> = {};
    const byEmotional: Record<string, { count: number; totalRoas: number; totalConv: number }> = {};
    const byCta: Record<string, { count: number; totalRoas: number; totalCtr: number }> = {};

    creatives.forEach(c => {
      if (c.topic) {
        if (!byTopic[c.topic]) byTopic[c.topic] = { count: 0, totalRoas: 0, totalConv: 0 };
        byTopic[c.topic].count++;
        byTopic[c.topic].totalRoas += c.roas || 0;
        byTopic[c.topic].totalConv += c.conversions || 0;
      }
      if (c.tone) {
        if (!byTone[c.tone]) byTone[c.tone] = { count: 0, totalRoas: 0, totalConv: 0 };
        byTone[c.tone].count++;
        byTone[c.tone].totalRoas += c.roas || 0;
        byTone[c.tone].totalConv += c.conversions || 0;
      }
      if (c.emotional_appeal) {
        if (!byEmotional[c.emotional_appeal]) byEmotional[c.emotional_appeal] = { count: 0, totalRoas: 0, totalConv: 0 };
        byEmotional[c.emotional_appeal].count++;
        byEmotional[c.emotional_appeal].totalRoas += c.roas || 0;
        byEmotional[c.emotional_appeal].totalConv += c.conversions || 0;
      }
      if (c.call_to_action_type) {
        if (!byCta[c.call_to_action_type]) byCta[c.call_to_action_type] = { count: 0, totalRoas: 0, totalCtr: 0 };
        byCta[c.call_to_action_type].count++;
        byCta[c.call_to_action_type].totalRoas += c.roas || 0;
        byCta[c.call_to_action_type].totalCtr += c.ctr || 0;
      }
    });

    // Find top performers - lowered count threshold from 2 to 1
    const sortByAvgRoas = (data: Record<string, { count: number; totalRoas: number }>) => {
      return Object.entries(data)
        .filter(([_, v]) => v.count >= 1)
        .map(([k, v]) => ({ key: k, avgRoas: v.totalRoas / v.count, count: v.count }))
        .sort((a, b) => b.avgRoas - a.avgRoas);
    };

    // Sort by count when no performance data
    const sortByCount = (data: Record<string, { count: number; totalRoas: number }>) => {
      return Object.entries(data)
        .filter(([_, v]) => v.count >= 1)
        .map(([k, v]) => ({ key: k, avgRoas: v.totalRoas / v.count, count: v.count }))
        .sort((a, b) => b.count - a.count);
    };

    const hasPerformanceData = creatives.some(c => (c.roas ?? 0) > 0);
    const sortFn = hasPerformanceData ? sortByAvgRoas : sortByCount;

    const topTopics = sortFn(byTopic);
    const topTones = sortFn(byTone);
    const topEmotional = sortFn(byEmotional);
    const topCtas = sortFn(byCta);

    // Generate topic recommendation
    if (topTopics.length > 0) {
      const best = topTopics[0];
      const avgRoas = topTopics.reduce((a, t) => a + t.avgRoas, 0) / topTopics.length;
      const performanceText = hasPerformanceData && avgRoas > 0
        ? ` performing ${((best.avgRoas / avgRoas) * 100 - 100).toFixed(0)}% above average`
        : '';
      
      recs.push({
        id: 'topic-1',
        type: 'topic',
        title: `Double down on "${best.key}" content`,
        description: `Your "${best.key}" themed ads are your most common pattern${performanceText}.`,
        confidence: Math.min(0.95, 0.6 + (best.count * 0.05)),
        impact: hasPerformanceData && best.avgRoas > 2 ? 'high' : best.avgRoas > 1 ? 'medium' : 'low',
        basedOn: `${best.count} creatives analyzed`,
        suggestion: `Create more ads focused on ${best.key}. Consider testing variations with different tones while keeping the topic consistent.`
      });
    }

    // Generate tone recommendation
    if (topTones.length > 0) {
      const best = topTones[0];
      const performanceText = hasPerformanceData && best.avgRoas > 0
        ? ` achieving $${best.avgRoas.toFixed(2)} ROAS on average`
        : '';
      
      recs.push({
        id: 'tone-1',
        type: 'tone',
        title: `Use "${best.key}" tone more often`,
        description: `Ads with a "${best.key}" tone are your most used pattern${performanceText}.`,
        confidence: Math.min(0.9, 0.5 + (best.count * 0.05)),
        impact: hasPerformanceData && best.avgRoas > 2 ? 'high' : 'medium',
        basedOn: `${best.count} creatives analyzed`,
        suggestion: `Apply the "${best.key}" tone across more of your creative assets, especially when combined with high-performing topics.`
      });
    }

    // Generate emotional appeal recommendation
    if (topEmotional.length > 0) {
      const best = topEmotional[0];
      
      recs.push({
        id: 'emotional-1',
        type: 'emotional',
        title: `Lead with "${best.key}" emotional appeal`,
        description: `Messages emphasizing "${best.key}" appear in ${best.count} of your creatives.`,
        confidence: Math.min(0.85, 0.5 + (best.count * 0.04)),
        impact: 'medium',
        basedOn: `${best.count} creatives analyzed`,
        suggestion: `Structure your ad copy to evoke "${best.key}" as the primary emotional response. Use imagery and language that reinforces this feeling.`
      });
    }

    // Generate CTA recommendation
    if (topCtas.length > 1) {
      const best = topCtas[0];
      const worst = topCtas[topCtas.length - 1];
      if (hasPerformanceData && best.avgRoas > worst.avgRoas * 1.3) {
        recs.push({
          id: 'cta-1',
          type: 'cta',
          title: `Switch to "${best.key}" CTAs`,
          description: `"${best.key}" outperforms "${worst.key}" by ${(((best.avgRoas / worst.avgRoas) - 1) * 100).toFixed(0)}% in ROAS.`,
          confidence: 0.75,
          impact: 'medium',
          basedOn: `Comparing ${best.count} vs ${worst.count} creatives`,
          suggestion: `Replace "${worst.key}" CTAs with "${best.key}" across your campaigns. Test transitional phrases that align with your top-performing tone.`
        });
      } else if (!hasPerformanceData && best.count > worst.count) {
        recs.push({
          id: 'cta-1',
          type: 'cta',
          title: `Your most common CTA: "${best.key}"`,
          description: `"${best.key}" is used in ${best.count} creatives vs "${worst.key}" in ${worst.count}.`,
          confidence: 0.7,
          impact: 'low',
          basedOn: `Comparing ${best.count} vs ${worst.count} creatives`,
          suggestion: `Connect your Meta account to see which CTA actually drives better performance.`
        });
      }
    }

    // Generate combination recommendation
    if (topTopics.length > 0 && topTones.length > 0 && topEmotional.length > 0) {
      recs.push({
        id: 'combo-1',
        type: 'combination',
        title: 'Optimal creative formula',
        description: `Combine "${topTopics[0].key}" topic + "${topTones[0].key}" tone + "${topEmotional[0].key}" appeal for maximum impact.`,
        confidence: 0.7,
        impact: 'high',
        basedOn: 'Cross-analysis of all dimensions',
        suggestion: `Create a new campaign using this formula. Start with 3-5 variations testing different headlines while maintaining the core combination.`
      });
    }

    return recs;
  }, [creatives]);

  const getImpactBadgeVariant = (impact: string): 'success' | 'info' | 'default' => {
    switch (impact) {
      case 'high': return 'success';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'topic': return <Target className={iconSizes.sm} />;
      case 'tone': return <MessageSquare className={iconSizes.sm} />;
      case 'emotional': return <Zap className={iconSizes.sm} />;
      case 'cta': return <TrendingUp className={iconSizes.sm} />;
      case 'combination': return <Sparkles className={iconSizes.sm} />;
      default: return <Lightbulb className={iconSizes.sm} />;
    }
  };

  const getAccentColor = (impact: string): string => {
    switch (impact) {
      case 'high': return 'bg-[hsl(var(--portal-success))]';
      case 'medium': return 'bg-[hsl(var(--portal-accent-blue))]';
      default: return 'bg-[hsl(var(--portal-bg-secondary))]';
    }
  };

  // Show data status indicators when there's not enough data
  if (dataStatus.total === 0) {
    return (
      <V3EmptyState
        icon={Sparkles}
        title="No Creatives Found"
        description="Import your campaign data to unlock AI-powered creative recommendations."
        accent="purple"
      />
    );
  }

  if (dataStatus.needsAnalysis) {
    return (
      <V3Card accent="amber">
        <V3CardContent className="py-8 text-center">
          <div className="p-3 rounded-xl bg-[hsl(var(--portal-warning)/0.15)] w-fit mx-auto mb-4">
            <AlertCircle className={cn(iconSizes.xl, "text-[hsl(var(--portal-warning))]")} />
          </div>
          <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
            Analysis Needed
          </h3>
          <p className="text-[hsl(var(--portal-text-muted))] max-w-md mx-auto mb-4">
            You have {dataStatus.total} creatives, but only {dataStatus.analyzed} have been analyzed. 
            Run the AI analysis to extract topics, tones, and emotional patterns.
          </p>
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">
            Click the <strong>"Analyze"</strong> button above to start.
          </p>
        </V3CardContent>
      </V3Card>
    );
  }

  if (recommendations.length === 0 && creatives.length < 3) {
    return (
      <V3Card className="border-dashed border-[hsl(var(--portal-border))]">
        <V3CardContent className="py-12 text-center">
          <div className="p-3 rounded-xl bg-[hsl(var(--portal-accent-purple)/0.15)] w-fit mx-auto mb-4">
            <Sparkles className={cn(iconSizes.xl, "text-[hsl(var(--portal-accent-purple))]")} />
          </div>
          <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
            Not Enough Data
          </h3>
          <p className="text-[hsl(var(--portal-text-muted))] max-w-md mx-auto">
            We need at least 3 analyzed creatives to generate meaningful recommendations. 
            Import more campaign data to unlock AI-powered creative insights.
          </p>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <V3Card>
          <V3CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[hsl(var(--portal-accent-purple)/0.15)]">
                <Sparkles className={cn(iconSizes.md, "text-[hsl(var(--portal-accent-purple))]")} />
              </div>
              <div>
                <V3CardTitle>AI-Powered Recommendations</V3CardTitle>
                <V3CardDescription>
                  Based on analysis of {creatives.filter(c => c.topic).length} creatives
                  {!dataStatus.hasPerformanceData && (
                    <span className="ml-2 text-[hsl(var(--portal-warning))]">
                      • Connect Meta for performance insights
                    </span>
                  )}
                </V3CardDescription>
              </div>
            </div>
          </V3CardHeader>
        </V3Card>
      </motion.div>

      {/* Performance data warning */}
      {!dataStatus.hasPerformanceData && dataStatus.analyzed >= 3 && (
        <motion.div variants={itemVariants}>
          <V3Card accent="amber">
            <V3CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(iconSizes.md, "text-[hsl(var(--portal-warning))] mt-0.5 shrink-0")} />
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                    Limited Performance Data
                  </p>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                    Recommendations are based on patterns only. Connect your Meta Ads account to import impressions, clicks, and ROAS for data-driven insights.
                  </p>
                </div>
              </div>
            </V3CardContent>
          </V3Card>
        </motion.div>
      )}

      {/* Recommendations */}
      <div className="grid gap-4">
        {recommendations.map((rec, index) => (
          <motion.div key={rec.id} variants={itemVariants}>
            <V3Card className="overflow-hidden">
              <V3CardContent className="p-0">
                <div className="flex">
                  {/* Left accent */}
                  <div className={cn("w-1 shrink-0", getAccentColor(rec.impact))} />
                  
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]">
                            {getTypeIcon(rec.type)}
                          </div>
                          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">{rec.title}</h3>
                          <V3Badge variant={getImpactBadgeVariant(rec.impact)}>
                            {rec.impact} impact
                          </V3Badge>
                        </div>
                        
                        <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-3">
                          {rec.description}
                        </p>

                        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary)/0.5)] mb-3">
                          <div className="flex items-start gap-2">
                            <Lightbulb className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-blue))] mt-0.5 shrink-0")} />
                            <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{rec.suggestion}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-[hsl(var(--portal-text-muted))]">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className={iconSizes.xs} />
                            {Math.round(rec.confidence * 100)}% confidence
                          </span>
                          <span>{rec.basedOn}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </V3CardContent>
            </V3Card>
          </motion.div>
        ))}
      </div>

      {recommendations.length === 0 && (
        <motion.div variants={itemVariants}>
          <V3Card className="border-dashed border-[hsl(var(--portal-border))]">
            <V3CardContent className="py-12 text-center">
              <div className="p-3 rounded-xl bg-[hsl(var(--portal-bg-secondary))] w-fit mx-auto mb-4">
                <Lightbulb className={cn(iconSizes.xl, "text-[hsl(var(--portal-text-muted))]")} />
              </div>
              <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
                Analyzing Patterns...
              </h3>
              <p className="text-[hsl(var(--portal-text-muted))] max-w-md mx-auto">
                Run the AI analysis on your creatives to generate personalized recommendations.
              </p>
            </V3CardContent>
          </V3Card>
        </motion.div>
      )}
    </motion.div>
  );
}
