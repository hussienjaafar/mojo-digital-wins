import * as React from "react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { ResponsiveChartTooltip } from "@/components/charts/ResponsiveChartTooltip";
import { getYAxisFormatter, getTooltipFormatter, ValueType } from "@/lib/chart-formatters";
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
  showValues?: boolean;
  ariaLabel?: string;
  emptyLabel?: string;
  descriptionId?: string;
}

export const PortalBarChart: React.FC<PortalBarChartProps> = ({
  data,
  height,
  barColor = "hsl(var(--portal-accent-blue))",
  className,
  valueType = "number",
  showValues = false,
  ariaLabel,
  emptyLabel = "No data available",
  descriptionId,
}) => {
  const isMobile = useIsMobile();
  const chartHeight = height || (isMobile ? 200 : 250);
  
  // Only rotate when there are many items or long labels
  const needsRotation = isMobile && (data.length > 4 || data.some(d => d.name.length > 10));

  if (!data || data.length === 0) {
    return (
      <div className={cn("w-full flex items-center justify-center text-sm portal-text-muted", className)} style={{ height: chartHeight }} role="img" aria-label={ariaLabel || emptyLabel}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn("w-full outline-none", className)}
      style={{ height: chartHeight }}
      role="img"
      aria-label={ariaLabel}
      aria-describedby={descriptionId}
      tabIndex={0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          margin={{ 
            top: 8, 
            right: isMobile ? 8 : 16, 
            bottom: needsRotation ? 8 : 4, 
            left: 0 
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
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 12 : 12 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
            angle={needsRotation ? -45 : 0}
            textAnchor={needsRotation ? "end" : "middle"}
            height={needsRotation ? 60 : 30}
            interval={0}
          />
          <YAxis
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 12 : 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={getYAxisFormatter(valueType)}
            width={isMobile ? 55 : 65}
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
            {showValues && (
              <LabelList 
                dataKey="value" 
                position="top" 
                formatter={getTooltipFormatter(valueType)} 
                className="text-[10px] sm:text-xs portal-text-primary"
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
