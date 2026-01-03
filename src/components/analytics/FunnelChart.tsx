/**
 * FunnelChart - Stage Analysis Chart Component
 * 
 * IMPORTANT USAGE CONSTRAINTS:
 * 
 * This component uses V3StageChart which automatically detects whether data
 * is truly sequential (monotonically decreasing). If data is NOT sequential:
 * - It renders a horizontal bar chart instead of a funnel
 * - Conversion percentages are hidden
 * - Drop-off annotations are disabled
 * 
 * Before using this for "funnel" visualization, verify your data meets these criteria:
 * 1. Each stage count represents UNIQUE entities (donors, users, etc.)
 * 2. Stages are logically progressive (awareness → engagement → conversion)
 * 3. Each entity can only be counted in ONE stage (their max stage reached)
 * 4. Stage counts are monotonically decreasing: Stage[n] >= Stage[n+1]
 * 
 * If your data doesn't meet these criteria, use forceBarMode or rename the chart
 * to avoid implying causality that doesn't exist.
 */

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
