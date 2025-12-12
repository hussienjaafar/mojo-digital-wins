import { memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { GitBranch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { getYAxisFormatter, formatNumber } from '@/lib/chart-formatters';
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

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const MODEL_DESCRIPTIONS: Record<AttributionModel, string> = {
  firstTouch: 'All credit to first interaction',
  lastTouch: 'All credit to final interaction',
  linear: 'Equal credit across all touchpoints',
  positionBased: '40% first, 40% last, 20% middle',
  timeDecay: 'More credit to recent touchpoints',
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
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="horizontal"
              margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 4, left: isMobile ? -12 : 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--portal-border))" opacity={0.4} vertical={false} />
              <XAxis
                type="number"
                tick={{ fontSize: isMobile ? 10 : 11, fill: "hsl(var(--portal-text-muted))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--portal-border))", opacity: 0.5 }}
                tickFormatter={getYAxisFormatter('number')}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: isMobile ? 10 : 11, fill: "hsl(var(--portal-text-muted))" }}
                tickLine={false}
                axisLine={false}
                width={isMobile ? 70 : 100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const entry = payload[0].payload;
                  return (
                    <div className="rounded-lg px-3 py-2 text-xs bg-[hsl(var(--portal-bg-tertiary))] border border-[hsl(var(--portal-border))] shadow-lg">
                      <p className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">{entry.name}</p>
                      <p className="text-[hsl(var(--portal-text-muted))]">{entry.platform}</p>
                      <p className="text-sm font-semibold mt-1 tabular-nums text-[hsl(var(--portal-text-primary))]">
                        {formatNumber(entry.value)} conversions
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={isMobile ? 20 : 30}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

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
