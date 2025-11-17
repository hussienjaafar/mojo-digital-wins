import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { CalendarIcon, Download, TrendingUp, FileText, Scale, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function Analytics() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [metrics, setMetrics] = useState({
    totalArticles: 0,
    totalBills: 0,
    avgSentiment: 0,
    trendingTopics: [] as string[],
  });
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [billStatusData, setBillStatusData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch articles in date range
      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .gte('published_date', dateRange.from.toISOString())
        .lte('published_date', dateRange.to.toISOString());

      // Fetch bills in date range
      const { data: bills } = await supabase
        .from('bills')
        .select('*')
        .gte('introduced_date', dateRange.from.toISOString())
        .lte('introduced_date', dateRange.to.toISOString());

      // Calculate metrics
      const avgSentiment = articles?.reduce((sum, a) => sum + (a.sentiment_score || 0), 0) / (articles?.length || 1);
      
      // Get trending topics from tags
      const allTags = articles?.flatMap(a => a.tags || []) || [];
      const tagCounts = allTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag);

      setMetrics({
        totalArticles: articles?.length || 0,
        totalBills: bills?.length || 0,
        avgSentiment: avgSentiment || 0,
        trendingTopics: topTags,
      });

      // Sentiment distribution
      const sentimentCounts = {
        Positive: articles?.filter(a => a.sentiment_label === 'positive').length || 0,
        Neutral: articles?.filter(a => a.sentiment_label === 'neutral').length || 0,
        Negative: articles?.filter(a => a.sentiment_label === 'negative').length || 0,
      };
      setSentimentData(Object.entries(sentimentCounts).map(([name, value]) => ({ name, value })));

      // Source distribution
      const sourceCounts = articles?.reduce((acc, a) => {
        acc[a.source_name] = (acc[a.source_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      const topSources = Object.entries(sourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));
      setSourceData(topSources);

      // Bill status distribution
      const statusCounts = bills?.reduce((acc, b) => {
        const status = b.current_status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      setBillStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    toast.info('PDF export feature coming soon!');
  };

  const exportToCSV = async () => {
    try {
      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .gte('published_date', dateRange.from.toISOString())
        .lte('published_date', dateRange.to.toISOString());

      if (!articles || articles.length === 0) {
        toast.error('No data to export');
        return;
      }

      const headers = ['Title', 'Source', 'Published Date', 'Sentiment', 'Tags'];
      const rows = articles.map(a => [
        a.title,
        a.source_name,
        a.published_date,
        a.sentiment_label || 'N/A',
        (a.tags || []).join('; '),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      <main className="container mx-auto px-4 py-8 mt-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Insights and trends from news and legislation</p>
          </div>
          
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                />
              </PopoverContent>
            </Popover>
            
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={exportToPDF}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalArticles}</div>
              <p className="text-xs text-muted-foreground">In selected period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bills</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalBills}</div>
              <p className="text-xs text-muted-foreground">Introduced in period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgSentiment.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">-1 (negative) to 1 (positive)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trending Topics</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.trendingTopics.length}</div>
              <p className="text-xs text-muted-foreground">Top tags identified</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="sentiment" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sentiment">Sentiment Analysis</TabsTrigger>
            <TabsTrigger value="sources">Source Distribution</TabsTrigger>
            <TabsTrigger value="bills">Bill Status</TabsTrigger>
            <TabsTrigger value="topics">Trending Topics</TabsTrigger>
          </TabsList>

          <TabsContent value="sentiment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
                <CardDescription>Overall sentiment across all articles</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Articles by Source</CardTitle>
                <CardDescription>Top news sources by article count</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bills" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bill Status Distribution</CardTitle>
                <CardDescription>Current status of tracked bills</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={billStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="hsl(var(--secondary))"
                      dataKey="value"
                    >
                      {billStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trending Topics</CardTitle>
                <CardDescription>Most frequently mentioned topics and tags</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {metrics.trendingTopics.map((topic, index) => (
                    <div
                      key={topic}
                      className="px-4 py-2 rounded-full bg-primary/10 text-primary font-medium"
                      style={{ fontSize: `${1 + (10 - index) * 0.1}rem` }}
                    >
                      {topic}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
