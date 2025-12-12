import * as React from "react";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ResponsiveChartTooltip } from "@/components/charts/ResponsiveChartTooltip";
import { formatValue, ValueType } from "@/lib/chart-formatters";
import { useIsMobile } from "@/hooks/use-mobile";
import { getChartColors } from "@/lib/design-tokens";

interface PieDataItem {
  name: string;
  value: number;
  color?: string;
}

interface PortalPieChartProps {
  data: PieDataItem[];
  height?: number;
  className?: string;
  valueType?: ValueType;
  showLegend?: boolean;
  showLabels?: boolean;
  innerRadius?: number;
  ariaLabel?: string;
  emptyLabel?: string;
  descriptionId?: string;
  colors?: string[];
  labelThreshold?: number;
}

// Use design system chart colors
const PORTAL_COLORS = getChartColors();

export const PortalPieChart: React.FC<PortalPieChartProps> = ({
  data,
  height,
  className,
  valueType = "number",
  showLegend = true,
  showLabels = true,
  innerRadius = 0,
  ariaLabel,
  emptyLabel = "No data available",
  descriptionId,
  colors = PORTAL_COLORS,
  labelThreshold = 5,
}) => {
  const isMobile = useIsMobile();
  const chartHeight = height || (isMobile ? 220 : 280);
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(new Set());

  // Calculate total for percentage calculations
  const total = React.useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  // Prepare chart data with colors and percentages
  const chartData = React.useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || colors[index % colors.length],
      percentage: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [data, colors, total]);

  // Filter visible data based on hidden keys
  const visibleData = React.useMemo(() => {
    return chartData.filter((item) => !hiddenKeys.has(item.name));
  }, [chartData, hiddenKeys]);

  const handleLegendClick = (name: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        // Don't hide if it's the last visible item
        if (chartData.length - next.size > 1) {
          next.add(name);
        }
      }
      return next;
    });
  };

  // Responsive dimensions
  const outerRadius = isMobile ? 70 : 90;
  const actualInnerRadius = innerRadius > 0 ? (isMobile ? innerRadius * 0.8 : innerRadius) : 0;

  // Custom label renderer
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius: ir,
    outerRadius: or,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent * 100 < labelThreshold) return null;

    const RADIAN = Math.PI / 180;
    const radius = ir + (or - ir) * 0.5;
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
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "w-full flex items-center justify-center text-sm portal-text-muted",
          className
        )}
        style={{ height: chartHeight }}
        role="img"
        aria-label={ariaLabel || emptyLabel}
      >
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
        <PieChart>
          <Pie
            data={visibleData}
            cx="50%"
            cy={isMobile && showLegend ? "42%" : "50%"}
            innerRadius={actualInnerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={showLabels && !isMobile ? renderCustomLabel : false}
            labelLine={false}
            animationBegin={0}
            animationDuration={600}
            animationEasing="ease-out"
          >
            {visibleData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="hsl(var(--portal-bg-primary))"
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
              content={() => (
                <div
                  className={cn(
                    "flex gap-2 px-2 text-[11px] sm:text-xs",
                    isMobile ? "flex-wrap justify-center pt-2" : "flex-col pl-4"
                  )}
                >
                  {chartData.map((entry) => (
                    <button
                      key={entry.name}
                      onClick={() => handleLegendClick(entry.name)}
                      className={cn(
                        "flex items-center gap-1.5 rounded px-2 py-1 transition-colors text-left",
                        hiddenKeys.has(entry.name)
                          ? "opacity-60 border border-dashed border-[hsl(var(--portal-border))]"
                          : "bg-[hsl(var(--portal-bg-elevated))]"
                      )}
                    >
                      <span
                        className="inline-flex h-3 w-3 rounded-full flex-shrink-0"
                        style={{ background: entry.color }}
                      />
                      <span
                        className={cn(
                          "portal-text-secondary truncate",
                          hiddenKeys.has(entry.name) && "line-through"
                        )}
                      >
                        {entry.name}
                      </span>
                      <span
                        className={cn(
                          "portal-text-primary font-medium",
                          hiddenKeys.has(entry.name) && "line-through"
                        )}
                      >
                        ({formatValue(entry.value, valueType)})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
