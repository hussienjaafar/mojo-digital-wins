import * as React from "react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ResponsiveChartTooltip } from "@/components/charts/ResponsiveChartTooltip";
import { getYAxisFormatter, ValueType, reduceDataPoints } from "@/lib/chart-formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface BarConfig {
  dataKey: string;
  name: string;
  fill: string;
  valueType?: ValueType;
  stackId?: string;
  hideByDefault?: boolean;
}

interface PortalMultiBarChartProps {
  data: Record<string, unknown>[];
  bars: BarConfig[];
  xAxisKey?: string;
  height?: number;
  className?: string;
  valueType?: ValueType;
  ariaLabel?: string;
  emptyLabel?: string;
  descriptionId?: string;
  maxMobilePoints?: number;
  layout?: "horizontal" | "vertical";
}

/**
 * Portal-styled multi-bar chart component
 * 
 * @deprecated Use EChartsBarChart from @/components/charts/echarts instead.
 * This component will be removed in a future release.
 * Migration guide: See docs/V3_CHART_STANDARDS.md
 */
export const PortalMultiBarChart: React.FC<PortalMultiBarChartProps> = ({
  data,
  bars,
  xAxisKey = "name",
  height,
  className,
  valueType = "number",
  ariaLabel,
  emptyLabel = "No data available",
  descriptionId,
  maxMobilePoints = 6,
  layout = "horizontal",
}) => {
  const isMobile = useIsMobile();
  const chartHeight = height || (isMobile ? 220 : 280);
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(new Set());

  // Initialize hidden keys from hideByDefault
  React.useEffect(() => {
    const defaults = bars.filter((b) => b.hideByDefault).map((b) => b.dataKey);
    setHiddenKeys(new Set(defaults));
  }, [bars]);

  // Build value types map for tooltip
  const valueTypes = React.useMemo(() => {
    const types: Record<string, ValueType> = {};
    bars.forEach((bar) => {
      types[bar.dataKey] = bar.valueType || valueType;
    });
    return types;
  }, [bars, valueType]);

  // Reduce data points on mobile for readability
  const chartData = React.useMemo(() => {
    if (isMobile && data.length > maxMobilePoints) {
      return reduceDataPoints(data, maxMobilePoints);
    }
    return data;
  }, [data, isMobile, maxMobilePoints]);

  const handleLegendClick = (dataKey: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  const legendPayload = bars.map((bar) => ({
    value: bar.name,
    dataKey: bar.dataKey,
    color: bar.fill,
    type: "square" as const,
    payload: { ...bar, strokeDasharray: "0" },
    inactive: hiddenKeys.has(bar.dataKey),
  }));

  // Only rotate when there are many items or long labels
  const needsRotation =
    isMobile &&
    layout === "horizontal" &&
    (chartData.length > 4 || chartData.some((d) => String(d[xAxisKey] || "").length > 10));

  const isVertical = layout === "vertical";

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
        <BarChart
          data={chartData}
          layout={layout}
          margin={{
            top: 10,
            right: isMobile ? 10 : 18,
            bottom: needsRotation ? 8 : 6,
            left: isMobile ? 6 : 10,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--portal-border))"
            opacity={0.4}
            horizontal={!isVertical}
            vertical={isVertical}
          />

          {isVertical ? (
            <>
              <XAxis
                type="number"
                tick={{
                  fill: "hsl(var(--portal-text-muted))",
                  fontSize: isMobile ? 11 : 12,
                }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
                tickFormatter={getYAxisFormatter(valueType)}
              />
              <YAxis
                type="category"
                dataKey={xAxisKey}
                tick={{
                  fill: "hsl(var(--portal-text-muted))",
                  fontSize: isMobile ? 11 : 12,
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
                  fill: "hsl(var(--portal-text-muted))",
                  fontSize: isMobile ? 11 : 12,
                }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
                angle={needsRotation ? -45 : 0}
                textAnchor={needsRotation ? "end" : "middle"}
                height={needsRotation ? 60 : 30}
                interval={isMobile ? "preserveStartEnd" : "equidistantPreserveStart"}
              />
              <YAxis
                tick={{
                  fill: "hsl(var(--portal-text-muted))",
                  fontSize: isMobile ? 11 : 12,
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
              <ResponsiveChartTooltip valueType={valueType} valueTypes={valueTypes} />
            }
            cursor={{ fill: "hsl(var(--portal-bg-elevated))", opacity: 0.3 }}
          />

          <Legend
            verticalAlign={isMobile ? "bottom" : "top"}
            align={isMobile ? "center" : "left"}
            payload={legendPayload}
            content={({ payload }) => (
              <div className="flex flex-wrap gap-2 px-2 pb-2 pt-1 text-[11px] sm:text-xs">
                {payload?.map((entry: any) => (
                  <button
                    key={entry.dataKey}
                    onClick={() => handleLegendClick(entry.dataKey)}
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-1 transition-colors",
                      hiddenKeys.has(entry.dataKey)
                        ? "opacity-60 border border-dashed border-[hsl(var(--portal-border))]"
                        : "bg-[hsl(var(--portal-bg-elevated))]"
                    )}
                  >
                    <span
                      className="inline-flex h-3 w-3 rounded-sm"
                      style={{ background: entry.color }}
                    />
                    <span className={hiddenKeys.has(entry.dataKey) ? "line-through" : ""}>
                      {entry.value}
                    </span>
                  </button>
                ))}
              </div>
            )}
          />

          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.fill}
              stackId={bar.stackId}
              radius={[4, 4, 0, 0]}
              maxBarSize={isMobile ? 30 : 50}
              hide={hiddenKeys.has(bar.dataKey)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
