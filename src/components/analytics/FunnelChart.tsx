import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
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
                      width: `${percentage}%`,
                      minWidth: '60%',
                      margin: '0 auto',
                      backgroundColor: stage.color,
                    }}
                  >
                    <div className="p-4 flex items-center justify-between text-white">
                      <span className="font-medium">{stage.name}</span>
                      <span className="text-sm">
                        {stage.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conversion rate indicator */}
                {index < stages.length - 1 && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
                    <ChevronDown className="h-4 w-4" />
                    <span>{conversionRate}% conversion</span>
                  </div>
                )}

                {/* Summary stats */}
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
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
            <div className="text-2xl font-bold">
              {((stages[stages.length - 1].value / stages[0].value) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Overall Conversion</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {(stages[0].value - stages[stages.length - 1].value).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Total Drop-off</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

FunnelChart.displayName = 'FunnelChart';
