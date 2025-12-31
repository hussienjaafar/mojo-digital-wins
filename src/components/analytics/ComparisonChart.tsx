import { memo, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { EChartsBarChart } from '@/components/charts/echarts';
import { formatValue, ValueType, reduceDataPoints } from '@/lib/chart-formatters';
import { useIsMobile } from '@/hooks/use-mobile';

type Props = {
  title: string;
  description?: string;
  data: any[];
  currentKey: string;
  previousKey: string;
  currentLabel?: string;
  previousLabel?: string;
  xAxisKey?: string;
  valueType?: ValueType;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
};

export const ComparisonChart = memo(({
  title,
  description,
  data,
  currentKey,
  previousKey,
  currentLabel = 'Current Period',
  previousLabel = 'Previous Period',
  xAxisKey = 'date',
  valueType = 'number',
  isLoading = false,
  error,
  onRetry,
}: Props) => {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : 280;

  // Reduce data points on mobile
  const chartData = useMemo(() => {
    if (isMobile && data.length > 8) {
      return reduceDataPoints(data, 8);
    }
    return data;
  }, [data, isMobile]);

  // Calculate overall change
  const { currentTotal, previousTotal, overallChange } = useMemo(() => {
    const current = data.reduce((sum, item) => sum + (item[currentKey] || 0), 0);
    const previous = data.reduce((sum, item) => sum + (item[previousKey] || 0), 0);
    const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
    return { currentTotal: current, previousTotal: previous, overallChange: change };
  }, [data, currentKey, previousKey]);

  const isEmpty = !data || data.length === 0;

  return (
    <ChartPanel
      title={title}
      description={description}
      icon={BarChart3}
      trend={{
        value: overallChange,
        isPositive: overallChange >= 0,
      }}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyMessage="No comparison data available for this period"
      minHeight={chartHeight + 80}
    >
      <div className="space-y-4">
        <EChartsBarChart
          data={chartData}
          series={[
            { dataKey: currentKey, name: currentLabel, color: 'hsl(var(--portal-accent-blue))' },
            { dataKey: previousKey, name: previousLabel, color: 'hsl(var(--portal-text-muted))' },
          ]}
          xAxisKey={xAxisKey}
          valueType={valueType as "number" | "currency" | "percent"}
          height={chartHeight}
          showLegend
        />

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[hsl(var(--portal-border)/0.5)]">
          <div>
            <div className="text-xs sm:text-sm text-[hsl(var(--portal-text-muted))]">{currentLabel}</div>
            <div className="text-lg sm:text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
              {formatValue(currentTotal, valueType)}
            </div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-[hsl(var(--portal-text-muted))]">{previousLabel}</div>
            <div className="text-lg sm:text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
              {formatValue(previousTotal, valueType)}
            </div>
          </div>
        </div>
      </div>
    </ChartPanel>
  );
});

ComparisonChart.displayName = 'ComparisonChart';
