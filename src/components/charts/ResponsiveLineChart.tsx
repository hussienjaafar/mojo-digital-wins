import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ResponsiveChartTooltip } from "./ResponsiveChartTooltip";
import { getYAxisFormatter, ValueType, reduceDataPoints } from "@/lib/chart-formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface LineConfig {
  dataKey: string;
  name: string;
  color: string;
  strokeWidth?: number;
  dot?: boolean;
  valueType?: ValueType;
}

interface ResponsiveLineChartProps {
  data: Record<string, unknown>[];
  lines: LineConfig[];
  xAxisKey?: string;
  valueType?: ValueType;
  height?: number;
  className?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  maxMobilePoints?: number;
}

/**
 * Mobile-optimized line chart with proper formatting and responsive behavior
 */
export function ResponsiveLineChart({
  data,
  lines,
  xAxisKey = "name",
  valueType = "number",
  height,
  className = "",
  showGrid = true,
  showLegend = true,
  maxMobilePoints = 8,
}: ResponsiveLineChartProps) {
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
    lines.forEach((line) => {
      types[line.dataKey] = line.valueType || valueType;
    });
    return types;
  }, [lines, valueType]);

  // Responsive height
  const chartHeight = height || (isMobile ? 200 : 280);

  return (
    <div className={`w-full ${className}`} style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 8,
            right: isMobile ? 8 : 16,
            left: isMobile ? -16 : 0,
            bottom: isMobile ? 8 : 4,
          }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.4}
              vertical={false}
            />
          )}
          
          <XAxis
            dataKey={xAxisKey}
            tick={{ 
              fontSize: isMobile ? 10 : 11, 
              fill: "hsl(var(--muted-foreground))" 
            }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))", opacity: 0.5 }}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 50 : 30}
            interval={isMobile ? "preserveStartEnd" : "equidistantPreserveStart"}
          />
          
          <YAxis
            tick={{ 
              fontSize: isMobile ? 10 : 11, 
              fill: "hsl(var(--muted-foreground))" 
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={getYAxisFormatter(valueType)}
            width={isMobile ? 45 : 55}
          />
          
          <Tooltip
            content={
              <ResponsiveChartTooltip 
                valueType={valueType} 
                valueTypes={valueTypes}
              />
            }
            cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
          />
          
          {showLegend && (
            <Legend
              verticalAlign={isMobile ? "bottom" : "top"}
              align={isMobile ? "center" : "right"}
              wrapperStyle={{
                fontSize: isMobile ? 10 : 12,
                paddingTop: isMobile ? 8 : 0,
                paddingBottom: isMobile ? 0 : 8,
              }}
              iconSize={isMobile ? 8 : 10}
              iconType="circle"
            />
          )}
          
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={line.strokeWidth || (isMobile ? 2 : 2.5)}
              dot={line.dot !== undefined ? line.dot : !isMobile}
              activeDot={{ 
                r: isMobile ? 4 : 5, 
                strokeWidth: 2,
                fill: line.color 
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
