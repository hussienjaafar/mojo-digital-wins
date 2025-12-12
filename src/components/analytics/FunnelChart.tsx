import { memo } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { formatNumber } from '@/lib/chart-formatters';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const maxValue = stages[0]?.value || 1;
  const isMobile = useIsMobile();

  const isEmpty = !stages || stages.length === 0;
  const overallConversion = stages.length >= 2
    ? ((stages[stages.length - 1]?.value / stages[0]?.value) * 100) || 0
    : 0;

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
      minHeight={300}
    >
      <div className="space-y-4">
        {/* Funnel stages */}
        <div className="space-y-2">
          {stages.map((stage, index) => {
            const percentage = (stage.value / maxValue) * 100;
            const conversionRate = index > 0
              ? ((stage.value / stages[index - 1].value) * 100).toFixed(1)
              : '100.0';

            return (
              <div key={stage.name} className="space-y-1">
                <div className="relative">
                  {/* Funnel segment */}
                  <div
                    className="rounded-lg transition-all duration-300 hover:opacity-90 cursor-pointer"
                    style={{
                      width: `${Math.max(percentage, 50)}%`,
                      margin: '0 auto',
                      backgroundColor: stage.color,
                    }}
                    role="listitem"
                    aria-label={`${stage.name}: ${formatNumber(stage.value)} (${percentage.toFixed(1)}% of total)`}
                  >
                    <div className={`${isMobile ? 'p-3' : 'p-4'} flex items-center justify-between text-primary-foreground`}>
                      <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{stage.name}</span>
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold tabular-nums`}>
                        {formatNumber(stage.value)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conversion rate indicator */}
                {index < stages.length - 1 && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))] py-1">
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{conversionRate}% conversion</span>
                  </div>
                )}

                {/* Summary stats */}
                <div className="flex items-center justify-center gap-3 text-xs text-[hsl(var(--portal-text-muted))]">
                  <span>{percentage.toFixed(1)}% of total</span>
                  {index > 0 && (
                    <span>
                      {((stages[0].value - stage.value) / stages[0].value * 100).toFixed(1)}% drop-off
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

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
              {formatNumber((stages[0]?.value || 0) - (stages[stages.length - 1]?.value || 0))}
            </div>
            <div className="text-xs sm:text-sm text-[hsl(var(--portal-text-muted))]">Total Drop-off</div>
          </div>
        </div>
      </div>
    </ChartPanel>
  );
});

FunnelChart.displayName = 'FunnelChart';
