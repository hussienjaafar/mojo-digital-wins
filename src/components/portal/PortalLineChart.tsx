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
    strokeDasharray?: string;
    hideByDefault?: boolean;
  }>;
  height?: number;
  className?: string;
  valueType?: ValueType;
  ariaLabel?: string;
  emptyLabel?: string;
  descriptionId?: string;
}

/**
 * Portal-styled line chart component
 * 
 * @deprecated Use EChartsLineChart from @/components/charts/echarts instead.
 * This component will be removed in a future release.
 * Migration guide: See docs/V3_CHART_STANDARDS.md
 */
export const PortalLineChart: React.FC<PortalLineChartProps> = ({
  data,
  lines,
  height,
  className,
  valueType = "number",
  ariaLabel,
  emptyLabel = "No data available",
  descriptionId,
}) => {
  // Log deprecation warning in development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[DEPRECATED] PortalLineChart is deprecated. ' +
        'Please migrate to EChartsLineChart from @/components/charts/echarts. ' +
        'See docs/V3_CHART_STANDARDS.md for migration guide.'
      );
    }
  }, []);
  const isMobile = useIsMobile();
  const chartHeight = height || (isMobile ? 200 : 280);
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(new Set());

  // Build value types map for tooltip
  const valueTypes = React.useMemo(() => {
    const types: Record<string, ValueType> = {};
    lines.forEach((line) => {
      types[line.dataKey] = line.valueType || valueType;
    });
    return types;
  }, [lines, valueType]);

  React.useEffect(() => {
    const defaults = lines.filter((l) => l.hideByDefault).map((l) => l.dataKey);
    setHiddenKeys(new Set(defaults));
  }, [lines]);

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

  const legendPayload = lines.map((line) => ({
    value: line.name,
    dataKey: line.dataKey,
    color: line.stroke,
    type: "line" as const,
    payload: { ...line, strokeDasharray: line.strokeDasharray || "0" },
    inactive: hiddenKeys.has(line.dataKey),
  }));

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
        <LineChart 
          data={data} 
          margin={{ 
            top: 10, 
            right: isMobile ? 10 : 18, 
            bottom: isMobile ? 6 : 6, 
            left: isMobile ? 6 : 10 
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
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 12 : 12 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 55 : 30}
            interval={isMobile ? "preserveStartEnd" : "equidistantPreserveStart"}
          />
          <YAxis
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: isMobile ? 12 : 12 }}
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
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeDasharray={line.strokeDasharray}
              strokeWidth={isMobile ? 2 : 2.5}
              name={line.name}
              hide={hiddenKeys.has(line.dataKey)}
              dot={!isMobile}
              activeDot={{ r: isMobile ? 4 : 5, strokeWidth: 2, fill: line.stroke }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
