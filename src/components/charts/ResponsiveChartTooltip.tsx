import { formatValue, ValueType } from "@/lib/chart-formatters";

interface TooltipPayloadEntry {
  value?: number | string;
  name?: string;
  dataKey?: string | number;
  color?: string;
}

interface ResponsiveChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  valueType?: ValueType;
  valueTypes?: Record<string, ValueType>;
  labelFormatter?: (label: string) => string;
}

/**
 * Enhanced mobile-friendly chart tooltip with proper formatting
 * Uses portal theme styling with glassmorphism effect
 */
export function ResponsiveChartTooltip({
  active,
  payload,
  label,
  valueType = 'number',
  valueTypes,
  labelFormatter,
}: ResponsiveChartTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const formattedLabel = labelFormatter ? labelFormatter(String(label)) : label;

  return (
    <div className="portal-chart-tooltip animate-in fade-in-0 zoom-in-95 duration-150">
      {/* Label */}
      {formattedLabel && (
        <p className="text-xs font-medium text-muted-foreground mb-2 pb-2 border-b border-border/30">
          {formattedLabel}
        </p>
      )}

      {/* Values */}
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const entryValueType = valueTypes?.[entry.dataKey as string] || valueType;
          const formattedValue = formatValue(Number(entry.value), entryValueType);
          
          return (
            <div
              key={`tooltip-item-${index}`}
              className="flex items-center justify-between gap-4 min-w-[140px]"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Currency-specific tooltip
 */
export function CurrencyTooltip(props: Omit<ResponsiveChartTooltipProps, 'valueType'>) {
  return <ResponsiveChartTooltip {...props} valueType="currency" />;
}

/**
 * Percentage-specific tooltip
 */
export function PercentTooltip(props: Omit<ResponsiveChartTooltipProps, 'valueType'>) {
  return <ResponsiveChartTooltip {...props} valueType="percent" />;
}

/**
 * Number-specific tooltip
 */
export function NumberTooltip(props: Omit<ResponsiveChartTooltipProps, 'valueType'>) {
  return <ResponsiveChartTooltip {...props} valueType="number" />;
}
