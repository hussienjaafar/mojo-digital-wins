import { memo, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { ResponsiveChartTooltip } from '@/components/charts/ResponsiveChartTooltip';
import { getYAxisFormatter, formatValue, ValueType, reduceDataPoints } from '@/lib/chart-formatters';
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

  const formatXAxis = (value: string) => {
    try {
      const date = new Date(value);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return value;
    }
  };

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
      minHeight={chartHeight + 80} // Extra for summary
    >
      <div className="space-y-4">
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 4, left: isMobile ? -12 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--portal-border))" opacity={0.4} vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: isMobile ? 10 : 11, fill: "hsl(var(--portal-text-muted))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
                tickFormatter={formatXAxis}
                interval={isMobile ? "preserveStartEnd" : "equidistantPreserveStart"}
              />
              <YAxis
                tick={{ fontSize: isMobile ? 10 : 11, fill: "hsl(var(--portal-text-muted))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={getYAxisFormatter(valueType)}
                width={isMobile ? 45 : 55}
              />
              <Tooltip content={<ResponsiveChartTooltip valueType={valueType} />} />
              <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} iconSize={isMobile ? 8 : 10} />
              <Bar
                dataKey={currentKey}
                fill="hsl(var(--portal-accent-blue))"
                name={currentLabel}
                radius={[4, 4, 0, 0]}
                maxBarSize={isMobile ? 25 : 40}
              />
              <Bar
                dataKey={previousKey}
                fill="hsl(var(--portal-text-muted))"
                name={previousLabel}
                opacity={0.6}
                radius={[4, 4, 0, 0]}
                maxBarSize={isMobile ? 25 : 40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

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
