import { memo, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { EChartsLineChart } from '@/components/charts/echarts';
import { ValueType, reduceDataPoints } from '@/lib/chart-formatters';
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

  const isEmpty = !data || data.length === 0;

  // Build series configuration for ECharts
  const series = useMemo(() => {
    if (showForecast) {
      return [
        { 
          dataKey: 'actual', 
          name: 'Actual', 
          color: 'hsl(var(--portal-accent-blue))',
          areaStyle: { opacity: 0.3 }
        },
        { 
          dataKey: 'forecast', 
          name: 'Forecast', 
          color: 'hsl(var(--portal-text-muted))',
          areaStyle: { opacity: 0.1 }
        },
      ];
    }
    return lines.map(line => ({
      dataKey: line.dataKey,
      name: line.name,
      color: line.color,
    }));
  }, [showForecast, lines]);

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
      <EChartsLineChart
        data={chartData}
        series={series}
        xAxisKey={xAxisKey}
        valueType={valueType === 'ratio' ? 'number' : valueType}
        height={chartHeight}
        showLegend
      />
    </ChartPanel>
  );
});

TrendChart.displayName = 'TrendChart';
