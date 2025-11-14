import { memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

type Props = {
  title: string;
  description?: string;
  data: any[];
  lines: {
    dataKey: string;
    name: string;
    color: string;
    type?: 'monotone' | 'linear' | 'step';
  }[];
  xAxisKey?: string;
  yAxisFormatter?: (value: number) => string;
  showForecast?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
};

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload) return null;

  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
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
    </div>
  );
};

export const TrendChart = memo(({
  title,
  description,
  data,
  lines,
  xAxisKey = 'date',
  yAxisFormatter,
  showForecast = false,
  trend,
}: Props) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {trend && (
            <div className="flex items-center gap-2">
              {trend.isPositive ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              <span className={trend.isPositive ? 'text-green-500' : 'text-red-500'}>
                {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {showForecast ? (
            <AreaChart data={data}>
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
              
              {/* Actual data */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                name="Actual"
              />
              
              {/* Forecast */}
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                fill="hsl(var(--muted))"
                fillOpacity={0.2}
                name="Forecast"
              />
              
              {/* Confidence interval */}
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="none"
                fill="hsl(var(--muted))"
                fillOpacity={0.1}
                name="Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stroke="none"
                fill="hsl(var(--muted))"
                fillOpacity={0.1}
                name="Lower Bound"
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
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
              {lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type={line.type || 'monotone'}
                  dataKey={line.dataKey}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name={line.name}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

TrendChart.displayName = 'TrendChart';
