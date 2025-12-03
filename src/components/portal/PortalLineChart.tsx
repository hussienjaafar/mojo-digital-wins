import * as React from "react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ResponsiveChartTooltip } from "@/components/charts/ResponsiveChartTooltip";
import { getYAxisFormatter, ValueType } from "@/lib/chart-formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface PortalLineChartProps {
  data: DataPoint[];
  lines: Array<{
    dataKey: string;
    stroke: string;
    name: string;
    valueType?: ValueType;
  }>;
  height?: number;
  className?: string;
  valueType?: ValueType;
}

export const PortalLineChart: React.FC<PortalLineChartProps> = ({
  data,
  lines,
  height,
  className,
  valueType = "number",
}) => {
  const isMobile = useIsMobile();
  const chartHeight = height || (isMobile ? 200 : 280);

  // Build value types map for tooltip
  const valueTypes = React.useMemo(() => {
    const types: Record<string, ValueType> = {};
    lines.forEach((line) => {
      types[line.dataKey] = line.valueType || valueType;
    });
    return types;
  }, [lines, valueType]);

  return (
    <div className={cn("w-full", className)} style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data} 
          margin={{ 
            top: 8, 
            right: isMobile ? 8 : 16, 
            bottom: isMobile ? 8 : 4, 
            left: isMobile ? 0 : 0 
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--portal-border))" 
            opacity={0.4} 
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 11 : 12 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 55 : 30}
            interval={isMobile ? "preserveStartEnd" : "equidistantPreserveStart"}
          />
          <YAxis
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 11 : 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={getYAxisFormatter(valueType)}
            width={isMobile ? 55 : 65}
          />
          <Tooltip
            content={
              <ResponsiveChartTooltip 
                valueType={valueType} 
                valueTypes={valueTypes}
              />
            }
            cursor={{ stroke: "hsl(var(--portal-text-muted))", strokeOpacity: 0.3 }}
          />
          <Legend
            verticalAlign={isMobile ? "bottom" : "top"}
            align={isMobile ? "center" : "right"}
            wrapperStyle={{
              fontSize: isMobile ? 11 : 12,
              paddingTop: isMobile ? 8 : 0,
              paddingBottom: isMobile ? 0 : 8,
            }}
            iconSize={isMobile ? 8 : 10}
            iconType="circle"
          />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={isMobile ? 2 : 2.5}
              name={line.name}
              dot={!isMobile}
              activeDot={{ r: isMobile ? 4 : 5, strokeWidth: 2, fill: line.stroke }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
