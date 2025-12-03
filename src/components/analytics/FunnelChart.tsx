import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
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
};

export const FunnelChart = memo(({ title, description, stages }: Props) => {
  const maxValue = stages[0]?.value || 1;
  const isMobile = useIsMobile();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        {description && <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">
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
                  >
                    <div className={`${isMobile ? 'p-3' : 'p-4'} flex items-center justify-between text-white`}>
                      <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{stage.name}</span>
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold tabular-nums`}>
                        {formatNumber(stage.value)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conversion rate indicator */}
                {index < stages.length - 1 && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-1">
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>{conversionRate}% conversion</span>
                  </div>
                )}

                {/* Summary stats */}
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
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
        <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold">
              {((stages[stages.length - 1]?.value / stages[0]?.value) * 100 || 0).toFixed(1)}%
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Overall Conversion</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold">
              {formatNumber((stages[0]?.value || 0) - (stages[stages.length - 1]?.value || 0))}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Total Drop-off</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

FunnelChart.displayName = 'FunnelChart';
