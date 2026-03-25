import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyClickData, HourlyClickData } from "@/hooks/useEnhancedRedirectClicksQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { EChartsLineChart } from "@/components/charts/echarts";
import { EChartsBarChart } from "@/components/charts/echarts";
import { Skeleton } from "@/components/ui/skeleton";
import { getChartColors } from "@/lib/design-tokens";

// ============================================================================
// Types
// ============================================================================

interface LinkTrackingChartsProps {
  dailyTrend: DailyClickData[];
  hourlyTrend: HourlyClickData[];
  isSingleDay: boolean;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHourShort(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  const ampm = hour >= 12 ? "p" : "a";
  const h = hour % 12 || 12;
  return `${h}${ampm}`;
}

// ============================================================================
// Loading State
// ============================================================================

const ChartSkeleton: React.FC<{ height?: string }> = ({ height = "h-[200px] sm:h-[250px]" }) => (
  <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className={cn("w-full", height)} />
    </CardContent>
  </Card>
);

// ============================================================================
// Daily Trend Chart
// ============================================================================

const DailyTrendChart: React.FC<{ data: DailyClickData[] }> = ({ data }) => {
  const colors = getChartColors();

  const chartData = data.map((d) => ({
    date: d.date,
    clicks: d.clicks,
    metaClicks: d.metaClicks,
    sessions: d.sessions,
  }));

  const series = [
    {
      dataKey: "clicks",
      name: "Total Clicks",
      color: colors[0],
      type: "line" as const,
      smooth: true,
      areaStyle: { opacity: 0.1 },
    },
    {
      dataKey: "metaClicks",
      name: "Meta Ad Clicks",
      color: colors[1],
      type: "line" as const,
      smooth: true,
      areaStyle: { opacity: 0.1 },
    },
    {
      dataKey: "sessions",
      name: "Unique Sessions",
      color: colors[2],
      type: "line" as const,
      smooth: true,
    },
  ];

  return (
    <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] min-w-0 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-medium text-[hsl(var(--portal-text-primary))]">
          <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-accent-blue))] shrink-0" />
          Daily Click Trend
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
        <V3ChartWrapper
          title="Daily Click Trend"
          ariaLabel="Line chart showing daily click trend"
          isLoading={false}
        >
          <EChartsLineChart
            data={chartData}
            xAxisKey="date"
            series={series}
            height={200}
            showLegend
          />
        </V3ChartWrapper>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Hourly Pattern Chart
// ============================================================================

const HourlyPatternChart: React.FC<{ data: HourlyClickData[]; fullWidth?: boolean }> = ({ data, fullWidth }) => {
  const colors = getChartColors();

  // Fill in missing hours - only show label every 3 hours for cleaner display
  const fullHourData = Array.from({ length: 24 }, (_, hour) => {
    const existing = data.find((d) => d.hour === hour);
    return {
      hour: hour % 3 === 0 ? formatHourShort(hour) : "",
      clicks: existing?.clicks || 0,
      metaClicks: existing?.metaClicks || 0,
    };
  });

  const series = [
    {
      dataKey: "clicks",
      name: "Clicks",
      color: colors[0],
    },
    {
      dataKey: "metaClicks",
      name: "Meta",
      color: colors[1],
    },
  ];
  return (
    <Card className={cn(
      "bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] min-w-0 overflow-hidden",
      fullWidth && "lg:col-span-2"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-medium text-[hsl(var(--portal-text-primary))]">
          <Clock className="h-4 w-4 text-[hsl(var(--portal-accent-purple))] shrink-0" />
          Clicks by Hour
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
        <V3ChartWrapper
          title="Hourly Click Pattern"
          ariaLabel="Bar chart showing hourly click distribution"
          isLoading={false}
        >
          <EChartsBarChart
            data={fullHourData}
            xAxisKey="hour"
            series={series}
            height={fullWidth ? 280 : 200}
            showLegend
          />
        </V3ChartWrapper>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const LinkTrackingCharts: React.FC<LinkTrackingChartsProps> = ({
  dailyTrend,
  hourlyTrend,
  isSingleDay,
  isLoading,
  className,
}) => {
  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  // Single day view: show hourly chart full width
  if (isSingleDay) {
    return (
      <motion.div
        className={cn("grid grid-cols-1 gap-4", className)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <HourlyPatternChart data={hourlyTrend} fullWidth />
      </motion.div>
    );
  }

  // Multi-day view: show both charts
  return (
    <motion.div
      className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <DailyTrendChart data={dailyTrend} />
      <HourlyPatternChart data={hourlyTrend} />
    </motion.div>
  );
};

LinkTrackingCharts.displayName = "LinkTrackingCharts";
