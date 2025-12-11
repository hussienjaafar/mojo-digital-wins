import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { kpiKeys } from "./queryKeys";
import {
  detectAnomaliesWithContext,
  calculateTrendline,
  calculateTrend,
  type AnomalyResult,
  type TrendlineResult,
} from "@/lib/analytics";
import { format, parseISO, subDays, differenceInDays } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export type InsightType = "anomaly" | "trend" | "milestone" | "opportunity" | "warning";
export type InsightPriority = "high" | "medium" | "low";

export interface Insight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  metric?: string;
  value?: string | number;
  change?: number;
  timestamp: string;
  actionable?: boolean;
  actionText?: string;
}

export interface InsightsData {
  insights: Insight[];
  summary: {
    totalInsights: number;
    highPriority: number;
    actionableCount: number;
  };
  generatedAt: string;
}

// ============================================================================
// Insight Generation Functions
// ============================================================================

function generateAnomalyInsight(
  anomaly: AnomalyResult,
  metricName: string,
  formatValue: (v: number) => string
): Insight {
  const isPositive = anomaly.direction === "high";
  const emoji = isPositive ? "📈" : "📉";

  return {
    id: `anomaly-${metricName}-${anomaly.date}`,
    type: "anomaly",
    priority: Math.abs(anomaly.zScore) > 3 ? "high" : "medium",
    title: `${emoji} Unusual ${metricName} on ${anomaly.date ? format(parseISO(anomaly.date), "MMM d") : ""}`,
    description: `${metricName} was ${formatValue(anomaly.value)}, which is ${Math.abs(anomaly.zScore).toFixed(1)} standard deviations ${isPositive ? "above" : "below"} average.`,
    metric: metricName,
    value: formatValue(anomaly.value),
    change: anomaly.zScore * 100,
    timestamp: anomaly.date || new Date().toISOString(),
    actionable: true,
    actionText: isPositive ? "Investigate what drove this spike" : "Review for potential issues",
  };
}

function generateTrendInsight(
  trend: TrendlineResult,
  metricName: string,
  daysAnalyzed: number
): Insight | null {
  if (trend.direction === "flat" || trend.strength === "weak") {
    return null;
  }

  const isPositive = trend.direction === "up";
  const emoji = isPositive ? "📊" : "⚠️";

  return {
    id: `trend-${metricName}`,
    type: "trend",
    priority: trend.strength === "strong" ? "high" : "medium",
    title: `${emoji} ${metricName} is trending ${trend.direction}`,
    description: `Over the last ${daysAnalyzed} days, ${metricName} shows a ${trend.strength} ${trend.direction}ward trend with ${(trend.rSquared * 100).toFixed(0)}% confidence.`,
    metric: metricName,
    timestamp: new Date().toISOString(),
    actionable: !isPositive,
    actionText: isPositive ? undefined : "Consider optimizing campaigns",
  };
}

function generateMilestoneInsight(
  metricName: string,
  currentValue: number,
  previousValue: number,
  formatValue: (v: number) => string
): Insight | null {
  const change = ((currentValue - previousValue) / previousValue) * 100;

  // Only generate for significant milestones (>20% change)
  if (Math.abs(change) < 20) return null;

  const isPositive = change > 0;
  const emoji = isPositive ? "🎉" : "⚠️";

  return {
    id: `milestone-${metricName}`,
    type: "milestone",
    priority: Math.abs(change) > 50 ? "high" : "medium",
    title: `${emoji} ${metricName} ${isPositive ? "increased" : "decreased"} by ${Math.abs(change).toFixed(0)}%`,
    description: `${metricName} went from ${formatValue(previousValue)} to ${formatValue(currentValue)} compared to the previous period.`,
    metric: metricName,
    value: formatValue(currentValue),
    change,
    timestamp: new Date().toISOString(),
    actionable: !isPositive,
    actionText: isPositive ? undefined : "Review what changed",
  };
}

function generateOpportunityInsight(
  data: {
    lowRefcodeRate?: boolean;
    highCac?: boolean;
    lowRecurringRate?: boolean;
    values?: Record<string, number>;
  }
): Insight[] {
  const insights: Insight[] = [];

  if (data.lowRefcodeRate) {
    insights.push({
      id: "opportunity-attribution",
      type: "opportunity",
      priority: "medium",
      title: "💡 Improve attribution tracking",
      description: `Only ${data.values?.refcodeRate?.toFixed(0) || 0}% of donations have refcode attribution. Adding UTM parameters could improve ROI visibility.`,
      metric: "Attribution Rate",
      timestamp: new Date().toISOString(),
      actionable: true,
      actionText: "Review UTM setup",
    });
  }

  if (data.highCac) {
    insights.push({
      id: "opportunity-cac",
      type: "opportunity",
      priority: "high",
      title: "💰 High customer acquisition cost",
      description: `Current CAC of $${data.values?.cac?.toFixed(0) || 0} is above typical benchmarks. Consider optimizing ad targeting.`,
      metric: "CAC",
      timestamp: new Date().toISOString(),
      actionable: true,
      actionText: "Review ad campaigns",
    });
  }

  if (data.lowRecurringRate) {
    insights.push({
      id: "opportunity-recurring",
      type: "opportunity",
      priority: "medium",
      title: "🔄 Boost recurring donations",
      description: `Only ${data.values?.recurringRate?.toFixed(0) || 0}% of donations are recurring. Upselling could improve donor lifetime value.`,
      metric: "Recurring Rate",
      timestamp: new Date().toISOString(),
      actionable: true,
      actionText: "Review upsell strategy",
    });
  }

  return insights;
}

// ============================================================================
// Query Function
// ============================================================================

async function fetchInsights(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<InsightsData> {
  const insights: Insight[] = [];
  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  // Calculate previous period for comparison
  const daysDiff = differenceInDays(parseISO(endDate), parseISO(startDate));
  const prevStartDate = format(subDays(parseISO(startDate), daysDiff + 1), "yyyy-MM-dd");
  const prevEndDate = format(subDays(parseISO(startDate), 1), "yyyy-MM-dd");

  // Fetch daily donation data for anomaly and trend detection (using correct column names)
  const { data: dailyData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, fee, is_recurring, refcode")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`)
    .order("transaction_date", { ascending: true });

  // Fetch previous period data
  const { data: prevData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, fee, is_recurring")
    .eq("organization_id", organizationId)
    .gte("transaction_date", prevStartDate)
    .lte("transaction_date", `${prevEndDate}T23:59:59`);

  // Aggregate by day
  const dailyMap = new Map<string, { gross: number; net: number; count: number }>();
  (dailyData || []).forEach((tx) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    const current = dailyMap.get(date) || { gross: 0, net: 0, count: 0 };
    current.gross += Number(tx.amount) || 0;
    current.net += (Number(tx.amount) || 0) - (Number(tx.fee) || 0);
    current.count += 1;
    dailyMap.set(date, current);
  });

  const dailyValues = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, value: values.net }));

  // Detect anomalies in daily net donations
  if (dailyValues.length >= 5) {
    const anomalies = detectAnomaliesWithContext(dailyValues, 2);
    const significantAnomalies = anomalies.filter(a => a.isAnomaly);

    // Only include the most significant anomalies (top 2)
    significantAnomalies
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, 2)
      .forEach(anomaly => {
        insights.push(generateAnomalyInsight(anomaly, "Net Revenue", formatCurrency));
      });
  }

  // Detect trends
  if (dailyValues.length >= 7) {
    const trendline = calculateTrendline(dailyValues.map(d => d.value));
    const trendInsight = generateTrendInsight(trendline, "Net Revenue", dailyValues.length);
    if (trendInsight) {
      insights.push(trendInsight);
    }
  }

  // Calculate period totals
  const currentTotal = (dailyData || []).reduce((sum, tx) =>
    sum + (Number(tx.amount) || 0) - (Number(tx.fee) || 0), 0
  );
  const prevTotal = (prevData || []).reduce((sum, tx) =>
    sum + (Number(tx.amount) || 0) - (Number(tx.fee) || 0), 0
  );

  // Generate milestone insight
  if (prevTotal > 0) {
    const milestoneInsight = generateMilestoneInsight("Net Revenue", currentTotal, prevTotal, formatCurrency);
    if (milestoneInsight) {
      insights.push(milestoneInsight);
    }
  }

  // Calculate opportunity metrics
  const totalCount = (dailyData || []).length;
  const withRefcode = (dailyData || []).filter(tx => tx.refcode).length;
  const recurringCount = (dailyData || []).filter(tx => tx.is_recurring === true).length;

  const refcodeRate = totalCount > 0 ? (withRefcode / totalCount) * 100 : 0;
  const recurringRate = totalCount > 0 ? (recurringCount / totalCount) * 100 : 0;

  // Generate opportunity insights
  const opportunityInsights = generateOpportunityInsight({
    lowRefcodeRate: refcodeRate < 40,
    lowRecurringRate: recurringRate < 15,
    values: {
      refcodeRate,
      recurringRate,
    },
  });
  insights.push(...opportunityInsights);

  // Sort by priority
  const priorityOrder: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    insights: insights.slice(0, 6), // Limit to top 6 insights
    summary: {
      totalInsights: insights.length,
      highPriority: insights.filter(i => i.priority === "high").length,
      actionableCount: insights.filter(i => i.actionable).length,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useInsightsQuery(organizationId: string | null) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: kpiKeys.summary(organizationId!, dateRange),
    queryFn: () => fetchInsights(organizationId!, dateRange.startDate, dateRange.endDate),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
