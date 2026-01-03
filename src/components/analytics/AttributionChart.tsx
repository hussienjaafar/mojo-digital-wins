import { memo } from 'react';
import { GitBranch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { EChartsBarChart } from '@/components/charts/echarts';
import { formatNumber } from '@/lib/chart-formatters';
import { useIsMobile } from '@/hooks/use-mobile';

type AttributionModel = 'firstTouch' | 'lastTouch' | 'linear' | 'positionBased' | 'timeDecay';

type Props = {
  title: string;
  description?: string;
  data: {
    touchpoint: string;
    platform: string;
    firstTouch: number;
    lastTouch: number;
    linear: number;
    positionBased: number;
    timeDecay: number;
  }[];
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
};

const MODEL_DESCRIPTIONS: Record<AttributionModel, string> = {
  firstTouch: 'All credit to first refcode interaction',
  lastTouch: 'All credit to final refcode interaction',
  linear: 'Equal credit across all refcode touchpoints',
  positionBased: '40% first refcode, 40% last refcode, 20% middle',
  timeDecay: 'More credit to recent refcode touchpoints',
};

export const AttributionChart = memo(({
  title,
  description,
  data,
  isLoading = false,
  error,
  onRetry,
}: Props) => {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : 280;

  const isEmpty = !data || data.length === 0;

  const renderChart = (model: AttributionModel) => {
    const chartData = data.map(item => ({
      name: item.touchpoint,
      value: item[model],
      platform: item.platform,
    }));

    return (
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-muted))]">
          {MODEL_DESCRIPTIONS[model]}
        </p>
        <div className="p-2 rounded bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.2)]">
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
            <strong>Note:</strong> Attribution models only apply to donors with traceable refcodes. Meta ad impressions/clicks cannot be attributed to individuals.
          </p>
        </div>
        <EChartsBarChart
          data={chartData}
          series={[{ dataKey: 'value', name: 'Conversions', color: 'hsl(var(--chart-1))' }]}
          xAxisKey="name"
          valueType="number"
          height={chartHeight}
        />

        {/* Platform summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-[hsl(var(--portal-border)/0.5)]">
          {Array.from(new Set(data.map(d => d.platform))).map(platform => {
            const platformTotal = data
              .filter(d => d.platform === platform)
              .reduce((sum, d) => sum + d[model], 0);

            return (
              <div key={platform} className="text-center">
                <div className="text-lg sm:text-xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                  {formatNumber(platformTotal)}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))] capitalize">{platform}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ChartPanel
      title={title}
      description={description}
      icon={GitBranch}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyMessage="No attribution data available"
      minHeight={chartHeight + 150}
    >
      <Tabs defaultValue="linear" className="w-full">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-3' : 'grid-cols-5'} bg-[hsl(var(--portal-bg-elevated))]`}>
          <TabsTrigger value="linear" className="text-xs">Linear</TabsTrigger>
          <TabsTrigger value="firstTouch" className="text-xs">First</TabsTrigger>
          <TabsTrigger value="lastTouch" className="text-xs">Last</TabsTrigger>
          {!isMobile && (
            <>
              <TabsTrigger value="positionBased" className="text-xs">Position</TabsTrigger>
              <TabsTrigger value="timeDecay" className="text-xs">Decay</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="linear" className="mt-4">
          {renderChart('linear')}
        </TabsContent>
        <TabsContent value="firstTouch" className="mt-4">
          {renderChart('firstTouch')}
        </TabsContent>
        <TabsContent value="lastTouch" className="mt-4">
          {renderChart('lastTouch')}
        </TabsContent>
        <TabsContent value="positionBased" className="mt-4">
          {renderChart('positionBased')}
        </TabsContent>
        <TabsContent value="timeDecay" className="mt-4">
          {renderChart('timeDecay')}
        </TabsContent>
      </Tabs>
    </ChartPanel>
  );
});

AttributionChart.displayName = 'AttributionChart';
