import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ResponsiveChartTooltip } from "./ResponsiveChartTooltip";
import { formatValue, ValueType } from "@/lib/chart-formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface PieDataItem {
  name: string;
  value: number;
  color?: string;
}

interface ResponsivePieChartProps {
  data: PieDataItem[];
  valueType?: ValueType;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showLabels?: boolean;
  colors?: string[];
  innerRadius?: number;
  labelThreshold?: number;
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
];

/**
 * Mobile-optimized pie chart with proper formatting and responsive behavior
 */
export function ResponsivePieChart({
  data,
  valueType = "number",
  height,
  className = "",
  showLegend = true,
  showLabels = true,
  colors = DEFAULT_COLORS,
  innerRadius = 0,
  labelThreshold = 5,
}: ResponsivePieChartProps) {
  const isMobile = useIsMobile();

  // Calculate total for percentage calculations
  const total = useMemo(() => 
    data.reduce((sum, item) => sum + item.value, 0), 
    [data]
  );

  // Filter out very small slices for cleaner display
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || colors[index % colors.length],
      percentage: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [data, colors, total]);

  // Responsive dimensions
  const chartHeight = height || (isMobile ? 220 : 280);
  const outerRadius = isMobile ? 70 : 90;
  const actualInnerRadius = innerRadius > 0 ? (isMobile ? innerRadius * 0.8 : innerRadius) : 0;

  // Custom label renderer
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
    name: string;
  }) => {
    // Don't show labels for small slices
    if (percent * 100 < labelThreshold) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isMobile ? 11 : 12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom legend formatter
  const renderLegendText = (value: string) => {
    const item = chartData.find(d => d.name === value);
    if (!item) return value;
    
    const formatted = formatValue(item.value, valueType);
    return (
      <span className="text-xs text-muted-foreground">
        {value} <span className="font-medium text-foreground">({formatted})</span>
      </span>
    );
  };

  return (
    <div className={`w-full ${className}`} style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy={isMobile && showLegend ? "45%" : "50%"}
            innerRadius={actualInnerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={showLabels && !isMobile ? renderCustomLabel : false}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          
          <Tooltip
            content={<ResponsiveChartTooltip valueType={valueType} />}
          />
          
          {showLegend && (
            <Legend
              layout={isMobile ? "horizontal" : "vertical"}
              verticalAlign={isMobile ? "bottom" : "middle"}
              align={isMobile ? "center" : "right"}
              wrapperStyle={{
                fontSize: isMobile ? 11 : 12,
                paddingLeft: isMobile ? 0 : 16,
              }}
              iconSize={isMobile ? 8 : 10}
              iconType="circle"
              formatter={renderLegendText}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
