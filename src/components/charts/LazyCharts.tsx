/**
 * Lazy-loaded Recharts components
 *
 * @deprecated This module is deprecated. Use ECharts components from @/components/charts/echarts instead.
 * - LazyLineChart → EChartsLineChart
 * - LazyBarChart → EChartsBarChart
 * - LazyPieChart → EChartsPieChart
 * - LazyAreaChart → EChartsLineChart (with areaStyle)
 * - LazySparkline → EChartsLineChart (with minimal config)
 *
 * This module provides lazy-loaded versions of Recharts components to reduce
 * the initial bundle size. Recharts adds ~377 kB to the bundle, so lazy loading
 * ensures it's only fetched when charts are actually rendered.
 *
 * Migration guide: See docs/V3_CHART_STANDARDS.md
 */

import React, { Suspense, lazy, ComponentType, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Chart Loading Fallback
// ============================================================================

interface ChartSkeletonProps {
  height?: number | string;
  className?: string;
}

/**
 * Skeleton placeholder shown while chart components load
 */
export function ChartSkeleton({ height = 200, className = "" }: ChartSkeletonProps) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ height }}
      role="progressbar"
      aria-label="Loading chart"
    >
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

/**
 * Sparkline-specific skeleton (smaller)
 */
export function SparklineSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-8 w-full ${className}`}
      role="progressbar"
      aria-label="Loading sparkline"
    >
      <Skeleton className="w-full h-full rounded" />
    </div>
  );
}

// ============================================================================
// Suspense Wrapper
// ============================================================================

interface ChartSuspenseProps {
  children: ReactNode;
  fallback?: ReactNode;
  height?: number | string;
}

/**
 * Suspense wrapper for lazy-loaded chart components
 */
export function ChartSuspense({
  children,
  fallback,
  height = 200,
}: ChartSuspenseProps) {
  return (
    <Suspense fallback={fallback || <ChartSkeleton height={height} />}>
      {children}
    </Suspense>
  );
}

/**
 * Suspense wrapper optimized for sparklines
 */
export function SparklineSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<SparklineSkeleton />}>
      {children}
    </Suspense>
  );
}

// ============================================================================
// Lazy Chart Components
// ============================================================================

/**
 * Lazy-loaded LineChart with all common sub-components
 */
export const LazyLineChart = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.LineChart }))
);

export const LazyBarChart = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.BarChart }))
);

export const LazyPieChart = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.PieChart }))
);

export const LazyAreaChart = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.AreaChart }))
);

export const LazyResponsiveContainer = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.ResponsiveContainer }))
);

// ============================================================================
// Pre-composed Lazy Charts (with ResponsiveContainer)
// ============================================================================

interface LazySparklineProps {
  data: Array<{ value: number } | number>;
  dataKey?: string;
  stroke?: string;
  height?: number;
  className?: string;
}

/**
 * Self-contained lazy sparkline component
 * Includes ResponsiveContainer and minimal styling
 */
export function LazySparkline({
  data,
  dataKey = "value",
  stroke = "currentColor",
  height = 32,
  className = "",
}: LazySparklineProps) {
  // Normalize data to { value: number } format
  const normalizedData = data.map((d) =>
    typeof d === "number" ? { value: d } : d
  );

  return (
    <SparklineSuspense>
      <LazySparklineInner
        data={normalizedData}
        dataKey={dataKey}
        stroke={stroke}
        height={height}
        className={className}
      />
    </SparklineSuspense>
  );
}

// Inner component that actually uses Recharts (lazy loaded)
const LazySparklineInner = lazy(() =>
  import("recharts").then((mod) => ({
    default: function SparklineInner({
      data,
      dataKey,
      stroke,
      height,
      className,
    }: LazySparklineProps & { data: Array<{ value: number }> }) {
      const { ResponsiveContainer, LineChart, Line, Tooltip } = mod;

      return (
        <div className={className} style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={stroke}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                content={() => null}
                cursor={{ stroke: "hsl(var(--portal-border))", strokeWidth: 1 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    },
  }))
);

// ============================================================================
// Hook for preloading charts
// ============================================================================

/**
 * Preload Recharts module (call on route prefetch or hover)
 */
export function preloadRecharts() {
  return import("recharts");
}

// ============================================================================
// Re-export non-lazy Recharts types for convenience
// ============================================================================

export type { TooltipProps } from "recharts";
