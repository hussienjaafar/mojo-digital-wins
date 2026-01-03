import { memo, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { V3StageChart } from '@/components/charts/V3StageChart';
import { analyzeFunnel, formatConversionRate } from '@/lib/funnel-chart-utils';

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
  
  // Analyze funnel to get conversion rate for status badge
  const analysis = useMemo(() => {
    return analyzeFunnel(stages);
  }, [stages]);

  // Only show conversion status for truly sequential funnels
  const statusBadge = useMemo(() => {
    if (isEmpty || analysis.stages.length < 2) return undefined;
    if (!analysis.isSequential) return undefined; // Don't show conversion % for non-sequential
    
    return {
      text: `${formatConversionRate(analysis.overallConversionRate)} conversion`,
      variant: analysis.overallConversionRate >= 10 ? 'success' as const : analysis.overallConversionRate >= 5 ? 'warning' as const : 'error' as const,
    };
  }, [isEmpty, analysis]);

  return (
    <ChartPanel
      title={title}
      description={description}
      icon={Filter}
      status={statusBadge}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyMessage="No funnel data available"
      minHeight={380}
    >
      <V3StageChart
        stages={stages}
        height={280}
        valueType="number"
        showConversionRates
        showDropOffAnnotation
      />
    </ChartPanel>
  );
});

FunnelChart.displayName = 'FunnelChart';
