import * as React from "react";
import { cn } from "@/lib/utils";
import { EChartsSparkline, type SparklineValueType } from "./echarts/EChartsSparkline";
import type { LucideIcon } from "lucide-react";

export interface SmallMultiplesPanel {
  /** Panel label */
  label: string;
  /** Key in the data array to extract values from */
  dataKey: string;
  /** Sparkline color */
  color: string;
  /** How to format values */
  valueType: SparklineValueType;
  /** Optional icon */
  icon?: LucideIcon;
}

export interface SmallMultiplesChartProps {
  /** Data array - each item should have the dataKey properties */
  data: Record<string, unknown>[];
  /** Key for x-axis labels (used in sparkline tooltips) */
  xAxisKey: string;
  /** Panel configurations */
  panels: SmallMultiplesPanel[];
  /** Height per panel in pixels */
  panelHeight?: number;
  /** Additional class name */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Format value based on type for display
 */
const formatDisplayValue = (value: number, valueType: SparklineValueType): string => {
  switch (valueType) {
    case "currency":
      if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "multiplier":
      return `${value.toFixed(1)}x`;
    case "number":
    default:
      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toLocaleString();
  }
};

/**
 * Small Multiples Chart - displays multiple metrics as stacked sparkline panels.
 * Each panel auto-scales to its own data range, making trends visible regardless of absolute values.
 */
export const SmallMultiplesChart: React.FC<SmallMultiplesChartProps> = ({
  data,
  xAxisKey,
  panels,
  panelHeight = 72,
  className,
  isLoading = false,
}) => {
  // Extract sparkline data for each panel
  const panelData = React.useMemo(() => {
    return panels.map((panel) => {
      const values = data.map((item) => ({
        date: String(item[xAxisKey] || ""),
        value: Number(item[panel.dataKey]) || 0,
      }));
      
      const currentValue = values.length > 0 ? values[values.length - 1].value : 0;
      const previousValue = values.length > 1 ? values[values.length - 2].value : currentValue;
      const change = previousValue !== 0 
        ? ((currentValue - previousValue) / previousValue) * 100 
        : 0;
      
      // Calculate total/sum for the period
      const total = values.reduce((sum, v) => sum + v.value, 0);
      
      return {
        ...panel,
        values,
        currentValue,
        total,
        change,
      };
    });
  }, [data, xAxisKey, panels]);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {panels.map((panel, i) => (
          <div
            key={panel.dataKey}
            className="animate-pulse bg-[hsl(var(--portal-bg-secondary))] rounded-lg"
            style={{ height: panelHeight }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {panelData.map((panel, index) => {
        const Icon = panel.icon;
        
        return (
          <div
            key={panel.dataKey}
            className={cn(
              "flex items-center gap-4 px-4 py-3 rounded-lg",
              "bg-[hsl(var(--portal-bg-secondary)/0.5)]",
              "border border-[hsl(var(--portal-border)/0.3)]",
              index < panelData.length - 1 && "mb-1"
            )}
            style={{ minHeight: panelHeight }}
          >
            {/* Left side: Icon + Label + Value */}
            <div className="flex items-center gap-3 min-w-[180px]">
              {Icon && (
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-md"
                  style={{ backgroundColor: `${panel.color}20` }}
                >
                  <Icon 
                    className="w-4 h-4" 
                    style={{ color: panel.color }} 
                  />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[hsl(var(--portal-text-muted))]">
                  {panel.label}
                </span>
                <span 
                  className="text-lg font-semibold"
                  style={{ color: panel.color }}
                >
                  {formatDisplayValue(panel.total, panel.valueType)}
                </span>
              </div>
            </div>

            {/* Right side: Sparkline */}
            <div className="flex-1 min-w-0">
              <EChartsSparkline
                data={panel.values}
                color={panel.color}
                valueType={panel.valueType}
                showArea
                height={panelHeight - 24}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

SmallMultiplesChart.displayName = "SmallMultiplesChart";
