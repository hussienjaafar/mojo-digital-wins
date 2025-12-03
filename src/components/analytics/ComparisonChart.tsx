import { memo, useMemo } from 'react';
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
import { ResponsiveChartTooltip } from '@/components/charts/ResponsiveChartTooltip';
import { getYAxisFormatter, formatValue, ValueType, reduceDataPoints } from '@/lib/chart-formatters';
import { useIsMobile } from '@/hooks/use-mobile';

type Props = {
  title: string;
  description?: string;
  data: any[];
  currentKey: string;
  previousKey: string;
  currentLabel?: string;
  previousLabel?: string;
  xAxisKey?: string;
  valueType?: ValueType;
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
  valueType = 'number',
}: Props) => {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : 300;

  // Reduce data points on mobile
  const chartData = useMemo(() => {
    if (isMobile && data.length > 8) {
      return reduceDataPoints(data, 8);
    }
    return data;
  }, [data, isMobile]);

  // Calculate overall change
  const currentTotal = data.reduce((sum, item) => sum + (item[currentKey] || 0), 0);
  const previousTotal = data.reduce((sum, item) => sum + (item[previousKey] || 0), 0);
  const overallChange = previousTotal !== 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : 0;

  const formatXAxis = (value: string) => {
    try {
      const date = new Date(value);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return value;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            {description && <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>}
          </div>
          <Badge variant={overallChange >= 0 ? 'default' : 'destructive'} className="flex-shrink-0">
            {overallChange >= 0 ? '+' : ''}{overallChange.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 4, left: isMobile ? -12 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: isMobile ? 10 : 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))", opacity: 0.5 }}
                tickFormatter={formatXAxis}
                interval={isMobile ? "preserveStartEnd" : "equidistantPreserveStart"}
              />
              <YAxis
                tick={{ fontSize: isMobile ? 10 : 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={getYAxisFormatter(valueType)}
                width={isMobile ? 45 : 55}
              />
              <Tooltip content={<ResponsiveChartTooltip valueType={valueType} />} />
              <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} iconSize={isMobile ? 8 : 10} />
              <Bar
                dataKey={currentKey}
                fill="hsl(var(--primary))"
                name={currentLabel}
                radius={[4, 4, 0, 0]}
                maxBarSize={isMobile ? 25 : 40}
              />
              <Bar
                dataKey={previousKey}
                fill="hsl(var(--muted-foreground))"
                name={previousLabel}
                opacity={0.6}
                radius={[4, 4, 0, 0]}
                maxBarSize={isMobile ? 25 : 40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <div className="text-xs sm:text-sm text-muted-foreground">{currentLabel}</div>
            <div className="text-lg sm:text-2xl font-bold">
              {formatValue(currentTotal, valueType)}
            </div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-muted-foreground">{previousLabel}</div>
            <div className="text-lg sm:text-2xl font-bold">
              {formatValue(previousTotal, valueType)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ComparisonChart.displayName = 'ComparisonChart';
