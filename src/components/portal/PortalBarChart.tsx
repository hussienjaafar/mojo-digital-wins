import * as React from "react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ResponsiveChartTooltip } from "@/components/charts/ResponsiveChartTooltip";
import { getYAxisFormatter, ValueType } from "@/lib/chart-formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface DataPoint {
  name: string;
  value: number;
  label?: string;
}

interface PortalBarChartProps {
  data: DataPoint[];
  height?: number;
  barColor?: string;
  className?: string;
  valueType?: ValueType;
}

export const PortalBarChart: React.FC<PortalBarChartProps> = ({
  data,
  height,
  barColor = "hsl(var(--portal-accent-blue))",
  className,
  valueType = "number",
}) => {
  const isMobile = useIsMobile();
  const chartHeight = height || (isMobile ? 200 : 250);

  return (
    <div className={cn("w-full", className)} style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          margin={{ 
            top: 8, 
            right: isMobile ? 8 : 16, 
            bottom: isMobile ? 8 : 4, 
            left: isMobile ? -12 : 0 
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--portal-border))" 
            opacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 10 : 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 60 : 30}
            interval={0}
          />
          <YAxis
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 10 : 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={getYAxisFormatter(valueType)}
            width={isMobile ? 45 : 55}
          />
          <Tooltip
            content={<ResponsiveChartTooltip valueType={valueType} />}
            cursor={{ fill: "hsl(var(--portal-bg-elevated))", opacity: 0.3 }}
          />
          <Bar 
            dataKey="value" 
            fill={barColor} 
            radius={[4, 4, 0, 0]}
            maxBarSize={isMobile ? 30 : 50}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={barColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
