import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { CalendarIcon, Download, TrendingUp, AlertTriangle, Newspaper, Scale, Building2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line } from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface TopicSentiment {
  topic: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  avgSentiment: number;
  trend: 'rising' | 'stable' | 'falling';
  velocity?: number; // Percentage growth rate
  momentum?: number; // Acceleration
  sampleTitles?: string[];
  keywords?: string[];
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [metrics, setMetrics] = useState({
    totalArticles: 0,
    totalBills: 0,
    criticalThreats: 0,
    avgSentiment: 0,
  });
  const [topicSentiments, setTopicSentiments] = useState<TopicSentiment[]>([]);
  const [threatTrends, setThreatTrends] = useState<any[]>([]);
  const [billTopicCorrelation, setBillTopicCorrelation] = useState<any[]>([]);
  const [entityMentions, setEntityMentions] = useState<any[]>([]);
  const [sentimentTimeline, setSentimentTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [newArticleCount, setNewArticleCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);

  // Real-time subscription for new articles
  useEffect(() => {
    let articleBuffer: any[] = [];
    let extractionTimer: NodeJS.Timeout;

    const channel = supabase
      .channel('analytics-articles')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'articles',
        },
        (payload) => {
          console.log('New article detected:', payload.new);
          setNewArticleCount((prev) => prev + 1);
          articleBuffer.push(payload.new);

          // Show toast notification
          toast.success(`New article: ${(payload.new as any).title?.substring(0, 50)}...`, {
            description: 'Analyzing for trending topics...',
          });

          // Debounce: Extract topics after 5 articles or 60 seconds
          clearTimeout(extractionTimer);

          if (articleBuffer.length >= 5) {
            // Enough articles accumulated, extract now
            console.log('🔍 Extracting topics from', articleBuffer.length, 'new articles');
            extractTrendingTopics();
            articleBuffer = [];
          } else {
            // Wait for more articles or timeout
            extractionTimer = setTimeout(() => {
              if (articleBuffer.length > 0) {
                console.log('🔍 Extracting topics from', articleBuffer.length, 'new articles (timeout)');
                extractTrendingTopics();
                articleBuffer = [];
              }
            }, 60000); // 60 seconds
          }

          // Trigger analytics refresh
          if (isLive) {
            fetchAnalytics();
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(extractionTimer);
      supabase.removeChannel(channel);
    };
  }, [isLive]);

  // Auto-refresh every 30 seconds when live mode is enabled
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      console.log('Auto-refreshing analytics (live mode)');
      fetchAnalytics();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isLive, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setLastUpdated(new Date());
    try {
      // Fetch AI-extracted trending topics with velocity scores
      const { data: trendingTopicsData, error: topicsError } = await supabase
        .from('trending_topics')
        .select('*')
        .gte('hour_timestamp', dateRange.from.toISOString())
        .lte('hour_timestamp', dateRange.to.toISOString())
        .order('velocity_score', { ascending: false })
        .limit(50);

      if (topicsError) {
        console.error('Error fetching trending topics:', topicsError);
      }

      // Fetch articles in date range (for metrics)
      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .gte('published_date', dateRange.from.toISOString())
        .lte('published_date', dateRange.to.toISOString())
        .order('published_date', { ascending: true});

      // Fetch bills in date range
      const { data: bills } = await supabase
        .from('bills')
        .select('*')
        .gte('introduced_date', dateRange.from.toISOString())
        .lte('introduced_date', dateRange.to.toISOString());

      if (!articles) {
        setLoading(false);
        return;
      }

      // Calculate core metrics
      const avgSentiment = articles.reduce((sum, a) => sum + (a.sentiment_score || 0.5), 0) / (articles.length || 1);
      const criticalThreats = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high').length;

      setMetrics({
        totalArticles: articles.length,
        totalBills: bills?.length || 0,
        criticalThreats,
        avgSentiment,
      });

      // === AGGREGATE AI-EXTRACTED TRENDING TOPICS ===
      const topicAggregateMap = new Map<string, {
        total: number;
        positive: number;
        neutral: number;
        negative: number;
        avgSentiment: number;
        velocity: number;
        momentum: number;
        sampleTitles: Set<string>;
        keywords: Set<string>;
      }>();

      // Aggregate topics across time periods
      (trendingTopicsData || []).forEach((topicRecord: any) => {
        const topicKey = topicRecord.topic;

        if (!topicAggregateMap.has(topicKey)) {
          topicAggregateMap.set(topicKey, {
            total: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
            avgSentiment: 0,
            velocity: 0,
            momentum: 0,
            sampleTitles: new Set(),
            keywords: new Set(),
          });
        }

        const agg = topicAggregateMap.get(topicKey)!;
        agg.total += topicRecord.mention_count || 0;
        agg.positive += topicRecord.positive_count || 0;
        agg.neutral += topicRecord.neutral_count || 0;
        agg.negative += topicRecord.negative_count || 0;
        agg.avgSentiment += (topicRecord.avg_sentiment_score || 0.5) * (topicRecord.mention_count || 1);
        agg.velocity = Math.max(agg.velocity, topicRecord.velocity_score || 0);
        agg.momentum = Math.max(agg.momentum, topicRecord.momentum || 0);

        (topicRecord.sample_titles || []).forEach((title: string) => agg.sampleTitles.add(title));
        (topicRecord.related_keywords || []).forEach((kw: string) => agg.keywords.add(kw));
      });

      // Convert to array with calculated averages
      const topicSentimentArray: TopicSentiment[] = Array.from(topicAggregateMap.entries())
        .map(([topic, data]) => {
          const avgSentiment = data.total > 0 ? data.avgSentiment / data.total : 0.5;

          // Determine trend based on velocity and momentum
          let trend: 'rising' | 'stable' | 'falling';
          if (data.velocity > 20 || data.momentum > 0.2) {
            trend = 'rising';
          } else if (data.velocity < -20 || data.momentum < -0.2) {
            trend = 'falling';
          } else {
            trend = 'stable';
          }

          return {
            topic,
            total: data.total,
            positive: data.positive,
            neutral: data.neutral,
            negative: data.negative,
            avgSentiment,
            trend,
            velocity: data.velocity,
            momentum: data.momentum,
            sampleTitles: Array.from(data.sampleTitles).slice(0, 3),
            keywords: Array.from(data.keywords).slice(0, 5),
          };
        })
        // Sort by velocity (what's trending NOW), not just total mentions
        .sort((a, b) => (b.velocity || 0) - (a.velocity || 0))
        .slice(0, 15);

      // Detect new trending topics
      if (isLive && previousTopics.length > 0) {
        const currentTopicNames = topicSentimentArray.map(t => t.topic);
        const newTopics = currentTopicNames.filter(topic => !previousTopics.includes(topic));

        if (newTopics.length > 0) {
          newTopics.slice(0, 3).forEach(topic => {
            toast.info(`🔥 New trending topic: ${topic}`, {
              description: 'This topic just entered the top 15',
            });
          });
        }
      }

      setPreviousTopics(topicSentimentArray.map(t => t.topic));
      setTopicSentiments(topicSentimentArray);

      // === SENTIMENT TIMELINE (Daily breakdown) ===
      const dailySentiment = new Map<string, { positive: number; neutral: number; negative: number; total: number }>();

      articles.forEach(article => {
        const date = new Date(article.published_date).toISOString().split('T')[0];
        const sentiment = article.sentiment_label || 'neutral';

        if (!dailySentiment.has(date)) {
          dailySentiment.set(date, { positive: 0, neutral: 0, negative: 0, total: 0 });
        }
        const data = dailySentiment.get(date)!;
        data[sentiment as 'positive' | 'neutral' | 'negative']++;
        data.total++;
      });

      const timelineData = Array.from(dailySentiment.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM dd'),
          positive: data.positive,
          neutral: data.neutral,
          negative: data.negative,
          total: data.total,
          avgSentiment: ((data.positive * 1 + data.neutral * 0.5 + data.negative * 0) / data.total) * 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setSentimentTimeline(timelineData);

      // === THREAT LEVEL TRENDS ===
      const threatByDate = new Map<string, { critical: number; high: number; medium: number; low: number }>();

      articles.forEach(article => {
        const date = new Date(article.published_date).toISOString().split('T')[0];
        const threat = article.threat_level || 'low';

        if (!threatByDate.has(date)) {
          threatByDate.set(date, { critical: 0, high: 0, medium: 0, low: 0 });
        }
        threatByDate.get(date)![threat as 'critical' | 'high' | 'medium' | 'low']++;
      });

      const threatData = Array.from(threatByDate.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM dd'),
          critical: data.critical,
          high: data.high,
          medium: data.medium,
          low: data.low,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setThreatTrends(threatData);

      // === ENTITY MENTIONS (Organizations being discussed) ===
      const entityMap = new Map<string, number>();

      articles.forEach(article => {
        const orgs = article.affected_organizations || [];
        orgs.forEach((org: string) => {
          entityMap.set(org, (entityMap.get(org) || 0) + 1);
        });
      });

      const entityData = Array.from(entityMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setEntityMentions(entityData);

      // === BILL-TO-TOPIC CORRELATION ===
      const billTopicMap = new Map<string, number>();

      bills?.forEach(bill => {
        // Extract topics from bill title and match with article tags
        const billWords = bill.title.toLowerCase().split(' ');

        topicSentimentArray.forEach(({ topic }) => {
          const topicLower = topic.toLowerCase();
          if (billWords.some(word => topicLower.includes(word) || word.includes(topicLower))) {
            billTopicMap.set(topic, (billTopicMap.get(topic) || 0) + 1);
          }
        });
      });

      const correlationData = Array.from(billTopicMap.entries())
        .map(([topic, billCount]) => {
          const topicData = topicSentimentArray.find(t => t.topic === topic);
          return {
            topic,
            bills: billCount,
            articles: topicData?.total || 0,
          };
        })
        .filter(d => d.bills > 0)
        .sort((a, b) => b.bills - a.bills)
        .slice(0, 10);

      setBillTopicCorrelation(correlationData);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      const headers = ['Topic', 'Total Mentions', 'Positive', 'Neutral', 'Negative', 'Avg Sentiment', 'Trend'];
      const rows = topicSentiments.map(t => [
        t.topic,
        t.total,
        t.positive,
        t.neutral,
        t.negative,
        t.avgSentiment.toFixed(2),
        t.trend,
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

  const runSentimentAnalysis = async () => {
    try {
      setAnalyzing(true);
      toast.info('Starting sentiment analysis... This may take a minute.');

      const { data, error } = await supabase.functions.invoke('analyze-articles');

      if (error) throw error;

      toast.success(
        `Analysis complete! Processed ${data.processed} articles, found ${data.duplicates} duplicates.`
      );

      // Refresh analytics data to show new sentiment results
      await fetchAnalytics();
    } catch (error) {
      console.error('Error running sentiment analysis:', error);
      toast.error('Failed to analyze articles. Check console for details.');
    } finally {
      setAnalyzing(false);
    }
  };

  const extractTrendingTopics = async () => {
    try {
      setAnalyzing(true);
      toast.info('Extracting trending topics from articles using AI...');

      const { data, error } = await supabase.functions.invoke('extract-trending-topics', {
        body: { hoursBack: 24 } // Analyze last 24 hours
      });

      if (error) throw error;

      toast.success(
        `✨ Found ${data.topicsExtracted} trending topics from ${data.articlesAnalyzed} articles!`
      );

      // Refresh analytics to show new topics
      await fetchAnalytics();
    } catch (error) {
      console.error('Error extracting topics:', error);
      toast.error('Failed to extract trending topics.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.6) return 'text-green-600';
    if (sentiment < 0.4) return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'rising') return '📈';
    if (trend === 'falling') return '📉';
    return '➡️';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold">Intelligence Snapshot</h1>
            {isLive && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-semibold animate-pulse">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                LIVE
              </div>
            )}
            {newArticleCount > 0 && (
              <div className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm font-semibold">
                +{newArticleCount} new
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            {isLive ? 'Real-time updates enabled • Auto-refresh every 30s' : 'Real-time overview of news, politics, and emerging threats'}
          </p>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-2">
                <Button variant="outline" size="sm" className="w-full" onClick={() => setDateRange({ from: subDays(new Date(), 1), to: new Date() })}>
                  Last 24h
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>
                  Last 7 days
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>
                  Last 30 days
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant={isLive ? "default" : "outline"}
            onClick={() => setIsLive(!isLive)}
            title={isLive ? "Disable live updates" : "Enable live updates"}
          >
            <TrendingUp className={`mr-2 h-4 w-4 ${isLive ? 'animate-pulse' : ''}`} />
            {isLive ? 'Live Mode' : 'Static Mode'}
          </Button>

          <Button
            variant="outline"
            onClick={runSentimentAnalysis}
            disabled={analyzing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing...' : 'Analyze Sentiment'}
          </Button>

          <Button
            variant="default"
            onClick={extractTrendingTopics}
            disabled={analyzing}
          >
            <TrendingUp className={`mr-2 h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Extracting...' : 'Extract Topics'}
          </Button>

          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Last Updated Indicator */}
      <div className="flex items-center justify-end text-sm text-muted-foreground">
        <span>Last updated: {format(lastUpdated, 'h:mm:ss a')}</span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coverage</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalArticles}</div>
            <p className="text-xs text-muted-foreground">Articles tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.criticalThreats}</div>
            <p className="text-xs text-muted-foreground">High priority items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bills</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalBills}</div>
            <p className="text-xs text-muted-foreground">Legislative activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Sentiment</CardTitle>
            <TrendingUp className={`h-4 w-4 ${getSentimentColor(metrics.avgSentiment)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getSentimentColor(metrics.avgSentiment)}`}>
              {(metrics.avgSentiment * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">Sentiment score</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="topics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="topics">Trending Topics</TabsTrigger>
          <TabsTrigger value="timeline">Sentiment Timeline</TabsTrigger>
          <TabsTrigger value="threats">Threat Trends</TabsTrigger>
          <TabsTrigger value="entities">Key Entities</TabsTrigger>
          <TabsTrigger value="correlation">Bill Correlation</TabsTrigger>
        </TabsList>

        {/* TRENDING TOPICS WITH SENTIMENT */}
        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Trending Topics & Sentiment
                    {isLive && (
                      <span className="text-xs px-2 py-1 bg-red-500 text-white rounded-full animate-pulse">
                        LIVE
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isLive
                      ? `Real-time analysis • ${topicSentiments.length} topics tracked • Updates every 30s`
                      : 'What\'s being discussed and how people feel about it'
                    }
                  </CardDescription>
                </div>
                {newArticleCount > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">+{newArticleCount}</div>
                    <p className="text-xs text-muted-foreground">new articles</p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topicSentiments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No trending topics found in this time period</p>
                ) : (
                  topicSentiments.map((topic, index) => (
                    <div key={topic.topic} className={`border-b pb-4 last:border-0 ${topic.trend === 'rising' && isLive ? 'bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border-green-200' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg capitalize">{topic.topic}</h3>
                              <span className="text-xl">{getTrendIcon(topic.trend)}</span>
                              {topic.trend === 'rising' && isLive && (
                                <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded animate-pulse">
                                  TRENDING
                                </span>
                              )}
                              {topic.velocity !== undefined && topic.velocity > 0 && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                                  +{topic.velocity.toFixed(0)}% velocity
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{topic.total} mentions</p>
                            {topic.keywords && topic.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {topic.keywords.map(kw => (
                                  <span key={kw} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`text-right ${getSentimentColor(topic.avgSentiment)}`}>
                          <div className="text-2xl font-bold">{(topic.avgSentiment * 100).toFixed(0)}%</div>
                          <p className="text-xs">sentiment</p>
                        </div>
                      </div>

                      {/* Sentiment breakdown bar */}
                      <div className="flex gap-1 h-8 rounded overflow-hidden">
                        {topic.positive > 0 && (
                          <div
                            className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${(topic.positive / topic.total) * 100}%` }}
                          >
                            {topic.positive}
                          </div>
                        )}
                        {topic.neutral > 0 && (
                          <div
                            className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${(topic.neutral / topic.total) * 100}%` }}
                          >
                            {topic.neutral}
                          </div>
                        )}
                        {topic.negative > 0 && (
                          <div
                            className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${(topic.negative / topic.total) * 100}%` }}
                          >
                            {topic.negative}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-green-600">✓ {topic.positive} positive</span>
                        <span className="text-gray-600">● {topic.neutral} neutral</span>
                        <span className="text-red-600">✗ {topic.negative} negative</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SENTIMENT TIMELINE */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Over Time</CardTitle>
              <CardDescription>Daily sentiment breakdown and trends</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sentimentTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="positive" stackId="1" fill="#10b981" stroke="#10b981" name="Positive" />
                  <Area type="monotone" dataKey="neutral" stackId="1" fill="#6b7280" stroke="#6b7280" name="Neutral" />
                  <Area type="monotone" dataKey="negative" stackId="1" fill="#ef4444" stroke="#ef4444" name="Negative" />
                  <Line type="monotone" dataKey="avgSentiment" stroke="#8b5cf6" strokeWidth={2} name="Avg Sentiment %" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* THREAT TRENDS */}
        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Threat Level Trends</CardTitle>
              <CardDescription>Escalation and de-escalation of threat levels over time</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="critical" stackId="a" fill="#dc2626" name="Critical" />
                  <Bar dataKey="high" stackId="a" fill="#f97316" name="High" />
                  <Bar dataKey="medium" stackId="a" fill="#eab308" name="Medium" />
                  <Bar dataKey="low" stackId="a" fill="#6b7280" name="Low" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KEY ENTITIES */}
        <TabsContent value="entities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Organizations & Entities</CardTitle>
              <CardDescription>Most mentioned organizations in current coverage</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={entityMentions} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Mentions" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILL-TOPIC CORRELATION */}
        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bill-to-News Correlation</CardTitle>
              <CardDescription>Topics with both legislative and news activity</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={billTopicCorrelation}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="topic" angle={-45} textAnchor="end" height={120} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="bills" fill="#8b5cf6" name="Bills" />
                  <Bar dataKey="articles" fill="#3b82f6" name="Articles" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
