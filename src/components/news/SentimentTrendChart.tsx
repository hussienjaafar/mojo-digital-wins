import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { LoadingCard } from "@/components/ui/loading-spinner";

export function SentimentTrendChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<number>(7);

  useEffect(() => {
    fetchTrendData();
  }, [category, dateRange]);

  const fetchTrendData = async () => {
    try {
      setLoading(true);
      const startDate = subDays(new Date(), dateRange).toISOString().split('T')[0];
      
      let query = supabase
        .from('sentiment_trends')
        .select('*')
        .gte('date', startDate)
        .order('date', { ascending: true });

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      const { data: trendsData, error } = await query;

      if (error) throw error;

      // Transform data for recharts
      const chartData = transformDataForChart(trendsData || []);
      setData(chartData);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const transformDataForChart = (trendsData: any[]) => {
    if (category === 'all') {
      // Group by date and aggregate across categories
      const dateMap = new Map();
      
      trendsData.forEach(trend => {
        const existing = dateMap.get(trend.date) || {
          date: trend.date,
          positive: 0,
          neutral: 0,
          negative: 0,
          total: 0
        };

        existing.positive += trend.positive_count;
        existing.neutral += trend.neutral_count;
        existing.negative += trend.negative_count;
        existing.total += trend.positive_count + trend.neutral_count + trend.negative_count;

        dateMap.set(trend.date, existing);
      });

      return Array.from(dateMap.values())
        .map(item => ({
          date: format(new Date(item.date), 'MMM dd'),
          positive: item.total > 0 ? Math.round((item.positive / item.total) * 100) : 0,
          neutral: item.total > 0 ? Math.round((item.neutral / item.total) * 100) : 0,
          negative: item.total > 0 ? Math.round((item.negative / item.total) * 100) : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      // Single category data
      return trendsData.map(trend => {
        const total = trend.positive_count + trend.neutral_count + trend.negative_count;
        return {
          date: format(new Date(trend.date), 'MMM dd'),
          positive: total > 0 ? Math.round((trend.positive_count / total) * 100) : 0,
          neutral: total > 0 ? Math.round((trend.neutral_count / total) * 100) : 0,
          negative: total > 0 ? Math.round((trend.negative_count / total) * 100) : 0,
        };
      });
    }
  };

  if (loading) {
    return <LoadingCard />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Sentiment Trends Over Time</CardTitle>
            <CardDescription>
              Historical sentiment analysis showing positive, neutral, and negative percentages
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="mainstream">Mainstream</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="specialized">Specialized</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange.toString()} onValueChange={(val) => setDateRange(Number(val))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No sentiment data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="positive" 
                stroke="hsl(142, 76%, 36%)" 
                strokeWidth={2}
                name="Positive (%)"
                dot={{ fill: 'hsl(142, 76%, 36%)' }}
              />
              <Line 
                type="monotone" 
                dataKey="neutral" 
                stroke="hsl(215, 16%, 47%)" 
                strokeWidth={2}
                name="Neutral (%)"
                dot={{ fill: 'hsl(215, 16%, 47%)' }}
              />
              <Line 
                type="monotone" 
                dataKey="negative" 
                stroke="hsl(0, 84%, 60%)" 
                strokeWidth={2}
                name="Negative (%)"
                dot={{ fill: 'hsl(0, 84%, 60%)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
