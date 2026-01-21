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

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}${ampm}`;
}

// ============================================================================
// Loading State
// ============================================================================

const ChartSkeleton: React.FC = () => (
  <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[250px] w-full" />
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
    <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-[hsl(var(--portal-text-primary))]">
          <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
          Daily Click Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <V3ChartWrapper
          title="Daily Click Trend"
          ariaLabel="Line chart showing daily click trend"
          isLoading={false}
        >
          <EChartsLineChart
            data={chartData}
            xAxisKey="date"
            series={series}
            height={250}
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

const HourlyPatternChart: React.FC<{ data: HourlyClickData[] }> = ({ data }) => {
  const colors = getChartColors();

  // Fill in missing hours
  const fullHourData = Array.from({ length: 24 }, (_, hour) => {
    const existing = data.find((d) => d.hour === hour);
    return {
      hour: formatHour(hour),
      clicks: existing?.clicks || 0,
      metaClicks: existing?.metaClicks || 0,
    };
  });

  const series = [
    {
      dataKey: "clicks",
      name: "Total Clicks",
      color: colors[0],
    },
    {
      dataKey: "metaClicks",
      name: "Meta Ad Clicks",
      color: colors[1],
    },
  ];

  return (
    <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-[hsl(var(--portal-text-primary))]">
          <Clock className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
          Hourly Click Pattern
        </CardTitle>
      </CardHeader>
      <CardContent>
        <V3ChartWrapper
          title="Hourly Click Pattern"
          ariaLabel="Bar chart showing hourly click distribution"
          isLoading={false}
        >
          <EChartsBarChart
            data={fullHourData}
            xAxisKey="hour"
            series={series}
            height={250}
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
      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", className)}>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  // Show both charts, prioritize hourly for single day
  return (
    <motion.div
      className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      {isSingleDay ? (
        <>
          <HourlyPatternChart data={hourlyTrend} />
          {dailyTrend.length > 0 && <DailyTrendChart data={dailyTrend} />}
        </>
      ) : (
        <>
          <DailyTrendChart data={dailyTrend} />
          <HourlyPatternChart data={hourlyTrend} />
        </>
      )}
    </motion.div>
  );
};

LinkTrackingCharts.displayName = "LinkTrackingCharts";
