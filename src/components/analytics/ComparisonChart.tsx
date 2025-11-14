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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Props = {
  title: string;
  description?: string;
  data: any[];
  currentKey: string;
  previousKey: string;
  currentLabel?: string;
  previousLabel?: string;
  xAxisKey?: string;
  yAxisFormatter?: (value: number) => string;
};

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload) return null;

  const current = payload.find((p: any) => p.dataKey.includes('current'))?.value || 0;
  const previous = payload.find((p: any) => p.dataKey.includes('previous'))?.value || 0;
  const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t">
        <span className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% change
        </span>
      </div>
    </div>
  );
};

export const ComparisonChart = memo(({
  title,
  description,
  data,
  currentKey,
  previousKey,
  currentLabel = 'Current Period',
  previousLabel = 'Previous Period',
  xAxisKey = 'date',
  yAxisFormatter,
}: Props) => {
  // Calculate overall change
  const currentTotal = data.reduce((sum, item) => sum + (item[currentKey] || 0), 0);
  const previousTotal = data.reduce((sum, item) => sum + (item[previousKey] || 0), 0);
  const overallChange = previousTotal !== 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <Badge variant={overallChange >= 0 ? 'default' : 'destructive'}>
            {overallChange >= 0 ? '+' : ''}{overallChange.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={xAxisKey}
              className="text-xs"
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              className="text-xs"
              tickFormatter={yAxisFormatter}
            />
            <Tooltip content={<CustomTooltip formatter={yAxisFormatter} />} />
            <Legend />
            <Bar
              dataKey={currentKey}
              fill="hsl(var(--primary))"
              name={currentLabel}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={previousKey}
              fill="hsl(var(--muted-foreground))"
              name={previousLabel}
              opacity={0.6}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <div className="text-sm text-muted-foreground">{currentLabel}</div>
            <div className="text-2xl font-bold">
              {yAxisFormatter ? yAxisFormatter(currentTotal) : currentTotal.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{previousLabel}</div>
            <div className="text-2xl font-bold">
              {yAxisFormatter ? yAxisFormatter(previousTotal) : previousTotal.toLocaleString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ComparisonChart.displayName = 'ComparisonChart';
