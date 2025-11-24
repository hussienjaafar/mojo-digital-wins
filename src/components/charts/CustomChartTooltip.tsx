import { TooltipProps } from "recharts";
import { ReactNode } from "react";

interface CustomTooltipProps extends TooltipProps<any, any> {
  formatter?: (value: any) => string;
  labelFormatter?: (label: any, payload?: any[]) => ReactNode;
}

/**
 * Enhanced chart tooltip with Claude Console design
 * Features: Glassmorphism, smooth animations, better typography
 */
export function CustomChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="animate-fade-in">
      <div className="backdrop-blur-xl bg-card/95 border border-border/50 rounded-lg shadow-xl p-3 min-w-[160px]">
        {/* Label */}
        {label && (
          <p className="text-xs font-medium text-muted-foreground mb-2 border-b border-border/30 pb-2">
            {labelFormatter ? labelFormatter(label) : label}
          </p>
        )}

        {/* Values */}
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div
              key={`item-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {formatter ? formatter(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Currency-formatted tooltip for financial charts
 */
export function CurrencyChartTooltip(props: TooltipProps<any, any>) {
  return (
    <CustomChartTooltip
      {...props}
      formatter={(value) => `$${Number(value).toLocaleString()}`}
    />
  );
}

/**
 * Percentage-formatted tooltip for ROI/growth charts
 */
export function PercentageChartTooltip(props: TooltipProps<any, any>) {
  return (
    <CustomChartTooltip
      {...props}
      formatter={(value) => `${Number(value).toFixed(1)}%`}
    />
  );
}

/**
 * Number-formatted tooltip with thousands separator
 */
export function NumberChartTooltip(props: TooltipProps<any, any>) {
  return (
    <CustomChartTooltip
      {...props}
      formatter={(value) => Number(value).toLocaleString()}
    />
  );
}
