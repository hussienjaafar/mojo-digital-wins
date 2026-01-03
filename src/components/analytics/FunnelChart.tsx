import { memo, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { V3FunnelChart } from '@/components/charts/V3FunnelChart';
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

  return (
    <ChartPanel
      title={title}
      description={description}
      icon={Filter}
      status={
        !isEmpty && analysis.stages.length >= 2
          ? {
              text: `${formatConversionRate(analysis.overallConversionRate)} conversion`,
              variant: analysis.overallConversionRate >= 10 ? 'success' : analysis.overallConversionRate >= 5 ? 'warning' : 'error',
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
      <V3FunnelChart
        stages={stages}
        height={280}
        valueType="number"
        showConversionRates
        showDropOffAnnotation
        showSequenceWarning
      />
    </ChartPanel>
  );
});

FunnelChart.displayName = 'FunnelChart';
