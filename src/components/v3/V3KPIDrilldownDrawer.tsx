import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { V3TrendIndicator } from "./V3TrendIndicator";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EChartsLineChart, type LineSeriesConfig } from "@/components/charts/echarts";

export interface KPIDrilldownData {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  description?: string;
  timeSeriesData?: Record<string, any>[];
  timeSeriesConfig?: {
    xAxisKey: string;
    series: LineSeriesConfig[];
  };
  breakdown?: {
    label: string;
    value: string | number;
    percentage?: number;
  }[];
}

interface V3KPIDrilldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: KPIDrilldownData | null;
}

export const V3KPIDrilldownDrawer: React.FC<V3KPIDrilldownDrawerProps> = ({
  open,
  onOpenChange,
  data,
}) => {
  if (!data) return null;

  const Icon = data.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
                <Icon className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
              </div>
            )}
            <div>
              <SheetTitle className="text-xl">{data.label}</SheetTitle>
              {data.description && (
                <SheetDescription className="mt-1">
                  {data.description}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Hero Value */}
          <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
                {data.value}
              </span>
              {data.trend && (
                <V3TrendIndicator
                  value={data.trend.value}
                  isPositive={data.trend.isPositive}
                  size="md"
                />
              )}
            </div>
          </div>

          {/* Time Series Chart */}
          {data.timeSeriesData && data.timeSeriesConfig && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
                Trend Over Time
              </h4>
              <div className="rounded-lg border border-[hsl(var(--portal-border))] p-3 bg-[hsl(var(--portal-bg-elevated))]">
                <EChartsLineChart
                  data={data.timeSeriesData}
                  xAxisKey={data.timeSeriesConfig.xAxisKey}
                  series={data.timeSeriesConfig.series}
                  height={200}
                  showLegend={false}
                  showZoom={false}
                />
              </div>
            </div>
          )}

          {/* Breakdown Table */}
          {data.breakdown && data.breakdown.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
                Breakdown
              </h4>
              <div className="rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(var(--portal-bg-elevated))]">
                      <th className="px-4 py-2 text-left font-medium text-[hsl(var(--portal-text-muted))]">
                        Category
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-[hsl(var(--portal-text-muted))]">
                        Value
                      </th>
                      {data.breakdown[0]?.percentage !== undefined && (
                        <th className="px-4 py-2 text-right font-medium text-[hsl(var(--portal-text-muted))]">
                          %
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--portal-border))]">
                    {data.breakdown.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-[hsl(var(--portal-bg-elevated))]/50 transition-colors"
                      >
                        <td className="px-4 py-2 text-[hsl(var(--portal-text-primary))]">
                          {item.label}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-[hsl(var(--portal-text-primary))]">
                          {item.value}
                        </td>
                        {item.percentage !== undefined && (
                          <td className="px-4 py-2 text-right text-[hsl(var(--portal-text-muted))]">
                            {item.percentage.toFixed(1)}%
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

V3KPIDrilldownDrawer.displayName = "V3KPIDrilldownDrawer";
