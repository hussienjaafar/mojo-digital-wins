import { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { ResponsiveChartTooltip } from '@/components/charts/ResponsiveChartTooltip';
import { getYAxisFormatter, ValueType, reduceDataPoints } from '@/lib/chart-formatters';
import { useIsMobile } from '@/hooks/use-mobile';

type Props = {
  title: string;
  description?: string;
  data: any[];
  lines: {
    dataKey: string;
    name: string;
    color: string;
    type?: 'monotone' | 'linear' | 'step';
    valueType?: ValueType;
  }[];
  xAxisKey?: string;
  valueType?: ValueType;
  showForecast?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
};

export const TrendChart = memo(({
  title,
  description,
  data,
  lines,
  xAxisKey = 'date',
  valueType = 'number',
  showForecast = false,
  trend,
  isLoading = false,
  error,
  onRetry,
}: Props) => {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : 280;

  // Reduce data points on mobile
  const chartData = useMemo(() => {
    if (isMobile && data.length > 10) {
      return reduceDataPoints(data, 10);
    }
    return data;
  }, [data, isMobile]);

  // Build value types map for tooltip
  const valueTypes = useMemo(() => {
    const types: Record<string, ValueType> = {};
    lines.forEach((line) => {
      types[line.dataKey] = line.valueType || valueType;
    });
    return types;
  }, [lines, valueType]);

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
      icon={TrendingUp}
      trend={trend ? { value: trend.value, isPositive: trend.isPositive } : undefined}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyMessage="No trend data available for this period"
      minHeight={chartHeight}
    >
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {showForecast ? (
            <AreaChart data={chartData} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 4, left: isMobile ? -16 : 0 }}>
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

              <Area
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--portal-accent-blue))"
                fill="hsl(var(--portal-accent-blue))"
                fillOpacity={0.3}
                name="Actual"
              />
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="hsl(var(--portal-text-muted))"
                strokeDasharray="5 5"
                fill="hsl(var(--portal-bg-elevated))"
                fillOpacity={0.2}
                name="Forecast"
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 4, left: isMobile ? -16 : 0 }}>
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
              <Tooltip content={<ResponsiveChartTooltip valueType={valueType} valueTypes={valueTypes} />} />
              <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} iconSize={isMobile ? 8 : 10} iconType="circle" />
              {lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type={line.type || 'monotone'}
                  dataKey={line.dataKey}
                  stroke={line.color}
                  strokeWidth={isMobile ? 2 : 2.5}
                  dot={!isMobile}
                  activeDot={{ r: isMobile ? 4 : 5, strokeWidth: 2 }}
                  name={line.name}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
});

TrendChart.displayName = 'TrendChart';
