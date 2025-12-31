import { memo, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { EChartsFunnelChart } from '@/components/charts/echarts';
import { formatNumber } from '@/lib/chart-formatters';

type FunnelStage = {
  name: string;
  value: number;
  color: string;
};

type Props = {
  title: string;
  description?: string;
  stages: FunnelStage[];
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
};

export const FunnelChart = memo(({
  title,
  description,
  stages,
  isLoading = false,
  error,
  onRetry,
}: Props) => {
  const isEmpty = !stages || stages.length === 0;
  
  const overallConversion = useMemo(() => {
    if (stages.length < 2) return 0;
    return ((stages[stages.length - 1]?.value / stages[0]?.value) * 100) || 0;
  }, [stages]);

  // Transform stages to ECharts funnel data format
  const funnelData = useMemo(() => {
    return stages.map((stage) => ({
      name: stage.name,
      value: stage.value,
      itemStyle: { color: stage.color },
    }));
  }, [stages]);

  // Calculate summary metrics
  const totalDropOff = useMemo(() => {
    if (stages.length < 2) return 0;
    return (stages[0]?.value || 0) - (stages[stages.length - 1]?.value || 0);
  }, [stages]);

  return (
    <ChartPanel
      title={title}
      description={description}
      icon={Filter}
      status={
        !isEmpty
          ? {
              text: `${overallConversion.toFixed(1)}% conversion`,
              variant: overallConversion >= 10 ? 'success' : overallConversion >= 5 ? 'warning' : 'error',
            }
          : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyMessage="No funnel data available"
      minHeight={380}
    >
      <div className="space-y-4">
        {/* ECharts Funnel */}
        <EChartsFunnelChart
          data={funnelData}
          height={280}
          valueType="number"
          showConversionRates={true}
          orientation="vertical"
          showLegend={false}
        />

        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[hsl(var(--portal-border)/0.5)]">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
              {overallConversion.toFixed(1)}%
            </div>
            <div className="text-xs sm:text-sm text-[hsl(var(--portal-text-muted))]">Overall Conversion</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
              {formatNumber(totalDropOff)}
            </div>
            <div className="text-xs sm:text-sm text-[hsl(var(--portal-text-muted))]">Total Drop-off</div>
          </div>
        </div>
      </div>
    </ChartPanel>
  );
});

FunnelChart.displayName = 'FunnelChart';
