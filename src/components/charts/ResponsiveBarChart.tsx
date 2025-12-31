import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ResponsiveChartTooltip } from "./ResponsiveChartTooltip";
import { getYAxisFormatter, ValueType, reduceDataPoints } from "@/lib/chart-formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface BarConfig {
  dataKey: string;
  name: string;
  color: string;
  valueType?: ValueType;
  stackId?: string;
}

interface ResponsiveBarChartProps {
  data: Record<string, unknown>[];
  bars: BarConfig[];
  xAxisKey?: string;
  valueType?: ValueType;
  height?: number;
  className?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  layout?: "horizontal" | "vertical";
  maxMobilePoints?: number;
  barColors?: string[];
}

/**
 * Mobile-optimized bar chart with proper formatting and responsive behavior
 * 
 * @deprecated Use EChartsBarChart from @/components/charts/echarts instead.
 * This component will be removed in a future release.
 * Migration guide: See docs/V3_CHART_STANDARDS.md
 */
export function ResponsiveBarChart({
  data,
  bars,
  xAxisKey = "name",
  valueType = "number",
  height,
  className = "",
  showGrid = true,
  showLegend = true,
  layout = "horizontal",
  maxMobilePoints = 6,
  barColors,
}: ResponsiveBarChartProps) {
  // Log deprecation warning in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[DEPRECATED] ResponsiveBarChart is deprecated. ' +
        'Please migrate to EChartsBarChart from @/components/charts/echarts. ' +
        'See docs/V3_CHART_STANDARDS.md for migration guide.'
      );
    }
  }, []);
  const isMobile = useIsMobile();

  // Reduce data points on mobile for readability
  const chartData = useMemo(() => {
    if (isMobile && data.length > maxMobilePoints) {
      return reduceDataPoints(data, maxMobilePoints);
    }
    return data;
  }, [data, isMobile, maxMobilePoints]);

  // Build value types map for tooltip
  const valueTypes = useMemo(() => {
    const types: Record<string, ValueType> = {};
    bars.forEach((bar) => {
      types[bar.dataKey] = bar.valueType || valueType;
    });
    return types;
  }, [bars, valueType]);

  // Responsive height
  const chartHeight = height || (isMobile ? 200 : 280);
  
  const isVertical = layout === "vertical";
  
  // Only rotate when there are many items or long labels
  const needsRotation = isMobile && (chartData.length > 4 || 
    chartData.some(d => String(d[xAxisKey] || '').length > 10));

  return (
    <div className={`w-full ${className}`} style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout={layout}
          margin={{
            top: 8,
            right: isMobile ? 8 : 16,
            left: isMobile ? 0 : 0,
            bottom: isMobile ? 8 : 4,
          }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.4}
              horizontal={!isVertical}
              vertical={isVertical}
            />
          )}
          
          {isVertical ? (
            <>
              <XAxis
                type="number"
                tick={{ 
                  fontSize: isMobile ? 11 : 12, 
                  fill: "hsl(var(--muted-foreground))" 
                }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))", opacity: 0.5 }}
                tickFormatter={getYAxisFormatter(valueType)}
              />
              <YAxis
                type="category"
                dataKey={xAxisKey}
                tick={{ 
                  fontSize: isMobile ? 11 : 12, 
                  fill: "hsl(var(--muted-foreground))" 
                }}
                tickLine={false}
                axisLine={false}
                width={isMobile ? 75 : 90}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xAxisKey}
                tick={{ 
                  fontSize: isMobile ? 11 : 12, 
                  fill: "hsl(var(--muted-foreground))" 
                }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))", opacity: 0.5 }}
                angle={needsRotation ? -45 : 0}
                textAnchor={needsRotation ? "end" : "middle"}
                height={needsRotation ? 60 : 30}
                interval={isMobile ? 0 : "equidistantPreserveStart"}
              />
              <YAxis
                tick={{ 
                  fontSize: isMobile ? 11 : 12, 
                  fill: "hsl(var(--muted-foreground))" 
                }}
                tickLine={false}
                axisLine={false}
                tickFormatter={getYAxisFormatter(valueType)}
                width={isMobile ? 55 : 65}
              />
            </>
          )}
          
          <Tooltip
            content={
              <ResponsiveChartTooltip 
                valueType={valueType} 
                valueTypes={valueTypes}
              />
            }
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
          />
          
          {showLegend && bars.length > 1 && (
            <Legend
              verticalAlign={isMobile ? "bottom" : "top"}
              align={isMobile ? "center" : "right"}
              wrapperStyle={{
                fontSize: isMobile ? 11 : 12,
                paddingTop: isMobile ? 8 : 0,
                paddingBottom: isMobile ? 0 : 8,
              }}
              iconSize={isMobile ? 8 : 10}
              iconType="square"
            />
          )}
          
          {bars.map((bar, barIndex) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color}
              stackId={bar.stackId}
              radius={[4, 4, 0, 0]}
              maxBarSize={isMobile ? 30 : 50}
            >
              {barColors && chartData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={barColors[index % barColors.length]} 
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
