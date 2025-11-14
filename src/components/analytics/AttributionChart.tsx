import { memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
};

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const MODEL_DESCRIPTIONS = {
  firstTouch: 'All credit to first interaction',
  lastTouch: 'All credit to final interaction',
  linear: 'Equal credit across all touchpoints',
  positionBased: '40% first, 40% last, 20% middle',
  timeDecay: 'More credit to recent touchpoints',
};

export const AttributionChart = memo(({ title, description, data }: Props) => {
  const renderChart = (model: AttributionModel, modelLabel: string) => {
    const chartData = data.map(item => ({
      name: item.touchpoint,
      value: item[model],
      platform: item.platform,
    }));

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {MODEL_DESCRIPTIONS[model]}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" />
            <YAxis type="category" dataKey="name" className="text-xs" width={100} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                return (
                  <div className="bg-card border rounded-lg p-3 shadow-lg">
                    <p className="font-medium">{payload[0].payload.name}</p>
                    <p className="text-sm text-muted-foreground">{payload[0].payload.platform}</p>
                    <p className="text-sm font-medium mt-1">
                      {payload[0].value?.toLocaleString()} conversions
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Platform summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t">
          {Array.from(new Set(data.map(d => d.platform))).map(platform => {
            const platformTotal = data
              .filter(d => d.platform === platform)
              .reduce((sum, d) => sum + d[model], 0);
            
            return (
              <div key={platform} className="text-center">
                <div className="text-xl font-bold">{platformTotal.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground capitalize">{platform}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="linear" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="linear" className="text-xs">Linear</TabsTrigger>
            <TabsTrigger value="firstTouch" className="text-xs">First</TabsTrigger>
            <TabsTrigger value="lastTouch" className="text-xs">Last</TabsTrigger>
            <TabsTrigger value="positionBased" className="text-xs">Position</TabsTrigger>
            <TabsTrigger value="timeDecay" className="text-xs">Decay</TabsTrigger>
          </TabsList>
          
          <TabsContent value="linear" className="mt-4">
            {renderChart('linear', 'Linear Attribution')}
          </TabsContent>
          <TabsContent value="firstTouch" className="mt-4">
            {renderChart('firstTouch', 'First Touch Attribution')}
          </TabsContent>
          <TabsContent value="lastTouch" className="mt-4">
            {renderChart('lastTouch', 'Last Touch Attribution')}
          </TabsContent>
          <TabsContent value="positionBased" className="mt-4">
            {renderChart('positionBased', 'Position-Based Attribution')}
          </TabsContent>
          <TabsContent value="timeDecay" className="mt-4">
            {renderChart('timeDecay', 'Time Decay Attribution')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});

AttributionChart.displayName = 'AttributionChart';
