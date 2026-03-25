/**
 * CreativeOptimizationScorecard
 * 
 * Hero section displaying overall creative optimization health:
 * - Overall Optimization Score (0-100)
 * - Ad Fatigue Risk indicator
 * - Optimization Potential estimate
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Target,
  Activity,
  DollarSign,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3Badge } from "@/components/v3";

interface ScorecardProps {
  creatives: any[];
  fatigueAlerts: any[];
  correlations: any[];
  className?: string;
}

// Calculate composite optimization score
function calculateOptimizationScore(creatives: any[], fatigueAlerts: any[]): number {
  if (creatives.length === 0) return 0;

  // Factor 1: Budget allocation in high-performing creatives (0-40 points)
  const totalSpend = creatives.reduce((sum, c) => sum + (c.spend || 0), 0);
  const topPerformerSpend = creatives
    .filter((c) => c.performance_tier === "top" || (c.roas && c.roas >= 2))
    .reduce((sum, c) => sum + (c.spend || 0), 0);
  const budgetScore = totalSpend > 0 ? (topPerformerSpend / totalSpend) * 40 : 0;

  // Factor 2: Average ROAS health (0-30 points)
  const roasCreatives = creatives.filter((c) => c.roas && c.roas > 0);
  const avgRoas = roasCreatives.length > 0
    ? roasCreatives.reduce((sum, c) => sum + c.roas, 0) / roasCreatives.length
    : 0;
  const roasScore = Math.min(30, avgRoas * 10); // 3x ROAS = 30 points

  // Factor 3: Low fatigue risk (0-20 points)
  const criticalAlerts = fatigueAlerts.filter((a) => a.alert_severity === "critical").length;
  const warningAlerts = fatigueAlerts.filter((a) => a.alert_severity === "warning").length;
  const fatigueDeduction = criticalAlerts * 10 + warningAlerts * 5;
  const fatigueScore = Math.max(0, 20 - fatigueDeduction);

  // Factor 4: Creative diversity & analysis coverage (0-10 points)
  const analyzedCount = creatives.filter((c) => c.analyzed_at).length;
  const analysisRate = creatives.length > 0 ? analyzedCount / creatives.length : 0;
  const diversityScore = analysisRate * 10;

  return Math.round(budgetScore + roasScore + fatigueScore + diversityScore);
}

// Determine score color and label
function getScoreConfig(score: number) {
  if (score >= 80) return { color: "hsl(var(--portal-success))", label: "Excellent", emoji: "🚀" };
  if (score >= 60) return { color: "hsl(var(--portal-accent-blue))", label: "Good", emoji: "✨" };
  if (score >= 40) return { color: "hsl(var(--portal-warning))", label: "Needs Work", emoji: "⚠️" };
  return { color: "hsl(var(--portal-error))", label: "Critical", emoji: "🔥" };
}

export const CreativeOptimizationScorecard: React.FC<ScorecardProps> = ({
  creatives,
  fatigueAlerts,
  correlations,
  className,
}) => {
  const score = useMemo(() => calculateOptimizationScore(creatives, fatigueAlerts), [creatives, fatigueAlerts]);
  const config = getScoreConfig(score);

  // Calculate additional metrics
  const metrics = useMemo(() => {
    const activeCreatives = creatives.filter((c) => c.impressions > 0);
    const topPerformers = creatives.filter((c) => c.performance_tier === "top" || (c.roas && c.roas >= 2));
    const underperformers = creatives.filter((c) => c.roas && c.roas < 1 && c.spend > 50);
    const totalSpend = creatives.reduce((sum, c) => sum + (c.spend || 0), 0);
    const wastedSpend = underperformers.reduce((sum, c) => sum + (c.spend || 0), 0);
    
    // Optimization potential: How much could be saved by pausing underperformers
    const optimizationPotential = totalSpend > 0 ? (wastedSpend / totalSpend) * 100 : 0;

    return {
      activeCount: activeCreatives.length,
      topPerformersCount: topPerformers.length,
      underperformersCount: underperformers.length,
      criticalAlerts: fatigueAlerts.filter((a) => a.alert_severity === "critical").length,
      actionableInsights: correlations.filter((c) => c.is_actionable).length,
      optimizationPotential: Math.round(optimizationPotential),
      wastedSpend,
    };
  }, [creatives, fatigueAlerts, correlations]);

  // ECharts gauge configuration
  const gaugeOption = useMemo(() => ({
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 10,
        radius: "100%",
        center: ["50%", "70%"],
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.4, "hsl(var(--portal-error))"],
              [0.6, "hsl(var(--portal-warning))"],
              [0.8, "hsl(var(--portal-accent-blue))"],
              [1, "hsl(var(--portal-success))"],
            ],
          },
        },
        pointer: {
          icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
          length: "60%",
          width: 8,
          offsetCenter: [0, "-10%"],
          itemStyle: {
            color: "auto",
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 32,
          fontWeight: 700,
          offsetCenter: [0, "10%"],
          formatter: "{value}",
          color: config.color,
        },
        data: [{ value: score }],
      },
    ],
  }), [score, config.color]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Score Card */}
        <V3Card className="lg:col-span-1 overflow-hidden">
          <V3CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-[hsl(var(--portal-text-muted))] mb-2">
                Optimization Score
              </h3>
              <div className="h-40">
                <ReactECharts
                  option={gaugeOption}
                  style={{ height: "100%", width: "100%" }}
                  opts={{ renderer: "svg" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-2xl">{config.emoji}</span>
                <span
                  className="text-lg font-semibold"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
              </div>
            </div>
          </V3CardContent>
        </V3Card>

        {/* Quick Stats */}
        <V3Card className="lg:col-span-2 overflow-hidden">
          <V3CardContent className="p-6">
            <h3 className="text-sm font-medium text-[hsl(var(--portal-text-muted))] mb-4">
              Performance Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Top Performers */}
              <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-success)/0.1)]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-[hsl(var(--portal-success))]" />
                </div>
                <div className="text-2xl font-bold text-[hsl(var(--portal-success))]">
                  {metrics.topPerformersCount}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Top Performers
                </div>
              </div>

              {/* Fatigue Alerts */}
              <div className={cn(
                "text-center p-3 rounded-lg",
                metrics.criticalAlerts > 0 
                  ? "bg-[hsl(var(--portal-error)/0.1)]"
                  : "bg-[hsl(var(--portal-bg-secondary))]"
              )}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className={cn(
                    "w-4 h-4",
                    metrics.criticalAlerts > 0 
                      ? "text-[hsl(var(--portal-error))]"
                      : "text-[hsl(var(--portal-text-muted))]"
                  )} />
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  metrics.criticalAlerts > 0 
                    ? "text-[hsl(var(--portal-error))]"
                    : "text-[hsl(var(--portal-text-primary))]"
                )}>
                  {metrics.criticalAlerts}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Fatigue Alerts
                </div>
              </div>

              {/* Underperformers */}
              <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-warning)/0.1)]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown className="w-4 h-4 text-[hsl(var(--portal-warning))]" />
                </div>
                <div className="text-2xl font-bold text-[hsl(var(--portal-warning))]">
                  {metrics.underperformersCount}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Underperformers
                </div>
              </div>

              {/* Optimization Potential */}
              <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
                </div>
                <div className="text-2xl font-bold text-[hsl(var(--portal-accent-purple))]">
                  {metrics.optimizationPotential}%
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Savings Potential
                </div>
              </div>
            </div>

            {/* Actionable Insights Count */}
            {metrics.actionableInsights > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)] flex items-center gap-3">
                <Zap className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
                <div>
                  <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                    {metrics.actionableInsights} actionable insights discovered
                  </div>
                  <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                    AI-detected patterns to optimize your campaigns
                  </div>
                </div>
              </div>
            )}
          </V3CardContent>
        </V3Card>
      </div>
    </motion.div>
  );
};

export default CreativeOptimizationScorecard;
