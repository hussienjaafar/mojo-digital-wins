import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";
import { format, subDays } from "date-fns";
import { CalendarIcon, Download, TrendingUp, TrendingDown, AlertTriangle, Newspaper, Scale, Building2, RefreshCw, Activity, ExternalLink, Search, WifiOff, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line } from "recharts";
import { cn } from "@/lib/utils";
import { useNewsFilters } from "@/contexts/NewsFilterContext";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface TopicSentiment {
  topic: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  avgSentiment: number;
  trend: 'rising' | 'stable' | 'falling';
  velocity?: number; // Percentage growth rate from database
  momentum?: number; // Acceleration
  sampleTitles?: string[];
  keywords?: string[];
}

export default function Analytics() {
  const { setSearchTerm, navigateToTab } = useNewsFilters();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // R key: Refresh data
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        fetchAnalytics();
        toast.info('Refreshing data...', { description: 'Keyboard shortcut: R' });
      }

      // E key: Export to CSV
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        exportToCSV();
        toast.info('Exporting to CSV...', { description: 'Keyboard shortcut: E' });
      }

      // T key: Extract trending topics
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        extractTrendingTopics();
        toast.info('Extracting topics...', { description: 'Keyboard shortcut: T' });
      }

      // ? key: Show keyboard shortcuts
      if (e.key === '?') {
        e.preventDefault();
        toast.info('Keyboard Shortcuts', {
          description: 'R: Refresh • E: Export • T: Extract Topics • ?: Help',
          duration: 5000
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

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
  const [loadingPhase, setLoadingPhase] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [analyzing, setAnalyzing] = useState(false);
  const isLive = true; // Always in live mode
  const [newArticleCount, setNewArticleCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isStale, setIsStale] = useState(false); // Data older than 3 minutes
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [error, setError] = useState<{ message: string; type: string; retryable: boolean } | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(120); // Seconds until next refresh
  const [timeAgo, setTimeAgo] = useState<string>("just now");
  const [blueskyTrends, setBlueskyTrends] = useState<any[]>([]);
  const [socialMetrics, setSocialMetrics] = useState({
    totalPosts: 0,
    trendingTopics: 0,
    predictiveSignals: 0,
  });

  // Sheet drawer state for viewing articles
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTopic, setSheetTopic] = useState<string>("");
  const [sheetArticles, setSheetArticles] = useState<any[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  // Error handling utility: Parse error and return user-friendly message
  const parseError = (error: any): { message: string; type: string; retryable: boolean } => {
    // Check if offline
    if (!navigator.onLine) {
      return {
        message: "You're offline. Please check your internet connection.",
        type: 'offline',
        retryable: true
      };
    }

    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        message: "Network error. Please check your connection and try again.",
        type: 'network',
        retryable: true
      };
    }

    // Timeout errors
    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      return {
        message: "Request timed out. The server took too long to respond.",
        type: 'timeout',
        retryable: true
      };
    }

    // Authentication errors
    if (error.status === 401 || error.message?.includes('auth')) {
      return {
        message: "Authentication error. Please refresh the page and try again.",
        type: 'auth',
        retryable: false
      };
    }

    // Server errors (500+)
    if (error.status >= 500) {
      return {
        message: "Server error. Our team has been notified. Please try again later.",
        type: 'server',
        retryable: true
      };
    }

    // Rate limiting
    if (error.status === 429) {
      return {
        message: "Too many requests. Please wait a moment and try again.",
        type: 'rate_limit',
        retryable: true
      };
    }

    // Generic fallback
    return {
      message: error.message || "An unexpected error occurred. Please try again.",
      type: 'unknown',
      retryable: true
    };
  };

  // Retry utility with exponential backoff
  const retryWithBackoff = async <T,>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Show retry toast
          toast.info(`Retrying... (Attempt ${attempt + 1}/${maxRetries + 1})`, {
            description: 'Please wait...'
          });
          setRetryCount(attempt);
        }

        return await operation();
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error);

        // Don't retry if error is not retryable
        const parsedError = parseError(error);
        if (!parsedError.retryable || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };

  // Detect online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Connection restored');
      setIsOffline(false);
      toast.success('Connection restored', {
        description: 'Refreshing data...'
      });
      // Auto-retry fetch when connection restored
      fetchAnalytics();
    };

    const handleOffline = () => {
      console.log('🔴 Connection lost');
      setIsOffline(true);
      toast.error('You\'re offline', {
        description: 'Some features may not work until connection is restored'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update "time ago" and countdown timer every second
  useEffect(() => {
    const updateTimers = () => {
      // Calculate time ago
      const now = new Date();
      const secondsAgo = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

      if (secondsAgo < 60) {
        setTimeAgo("just now");
      } else if (secondsAgo < 3600) {
        const minutes = Math.floor(secondsAgo / 60);
        setTimeAgo(`${minutes}m ago`);
      } else {
        const hours = Math.floor(secondsAgo / 3600);
        setTimeAgo(`${hours}h ago`);
      }

      // Calculate next refresh countdown (2 minute cycle)
      const secondsSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
      const nextRefresh = Math.max(0, 120 - secondsSinceUpdate);
      setNextRefreshIn(nextRefresh);
    };

    // Update immediately
    updateTimers();

    // Update every second
    const timer = setInterval(updateTimers, 1000);

    return () => clearInterval(timer);
  }, [lastUpdated]);

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

          // Note: Analytics auto-refreshes every 30 seconds (see effect below)
          // No need to trigger fetchAnalytics() here - prevents excessive DB queries
        }
      )
      .subscribe();

    return () => {
      clearTimeout(extractionTimer);
      supabase.removeChannel(channel);
    };
  }, [isLive]);

  // Auto-refresh every 2 minutes when live mode is enabled
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      console.log('Auto-refreshing analytics (live mode)');
      setIsStale(true); // Mark as stale before refresh
      fetchAnalytics();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [isLive, dateRange]);

  // Check for stale data (> 3 minutes old)
  useEffect(() => {
    const staleCheckInterval = setInterval(() => {
      const now = new Date();
      const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / 60000;
      setIsStale(minutesSinceUpdate > 3);
    }, 30000); // Check every 30 seconds

    return () => clearInterval(staleCheckInterval);
  }, [lastUpdated]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setLoadingPhase("Fetching data...");
    setLoadingProgress(10);
    setLastUpdated(new Date());
    setIsStale(false); // Fresh data incoming

    try {
      // Fetch all data in parallel for better performance
      setLoadingPhase("Loading news & trends...");
      setLoadingProgress(30);

      const [
        { data: trendingTopicsData, error: topicsError },
        { data: articles },
        { data: bills },
        { data: blueskyData, error: blueskyError },
        { count: postsCount },
        { count: predictiveCount }
      ] = await Promise.all([
        // AI-extracted trending topics with velocity scores
        supabase
          .from('trending_topics')
          .select('*')
          .gte('hour_timestamp', dateRange.from.toISOString())
          .lte('hour_timestamp', dateRange.to.toISOString())
          .order('velocity_score', { ascending: false })
          .limit(50),

        // Articles in date range (for metrics)
        supabase
          .from('articles')
          .select('*')
          .gte('published_date', dateRange.from.toISOString())
          .lte('published_date', dateRange.to.toISOString())
          .order('published_date', { ascending: true }),

        // Bills in date range
        supabase
          .from('bills')
          .select('*')
          .gte('introduced_date', dateRange.from.toISOString())
          .lte('introduced_date', dateRange.to.toISOString()),

        // Bluesky social intelligence
        supabase
          .from('bluesky_trends' as any)
          .select('*')
          .gte('last_seen_at', subDays(new Date(), 7).toISOString())
          .order('velocity', { ascending: false })
          .limit(100),

        // Bluesky posts count
        supabase
          .from('bluesky_posts' as any)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateRange.from.toISOString()),

        // Predictive signals count
        supabase
          .from('bluesky_article_correlations' as any)
          .select('*', { count: 'exact', head: true })
          .eq('is_predictive', true)
      ]);

      if (topicsError) {
        console.error('Error fetching trending topics:', topicsError);
      }

      if (blueskyError) {
        console.error('Error fetching Bluesky trends:', blueskyError);
      }

      if (!articles) {
        setLoading(false);
        setLoadingPhase("");
        setLoadingProgress(0);
        return;
      }

      // Calculate core metrics
      setLoadingPhase("Analyzing sentiment...");
      setLoadingProgress(50);

      const articlesWithSentiment = articles.filter(a => a.sentiment_score !== null && a.sentiment_score !== undefined);
      const avgSentiment = articlesWithSentiment.length > 0
        ? articlesWithSentiment.reduce((sum, a) => sum + a.sentiment_score, 0) / articlesWithSentiment.length
        : 0; // 0 means "no data" - will show as N/A in UI
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
        sentimentCount: number; // Track mentions with valid sentiment for weighted average
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
            sentimentCount: 0,
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

        // Only include sentiment if valid (not null/undefined)
        if (topicRecord.avg_sentiment_score !== null && topicRecord.avg_sentiment_score !== undefined) {
          const mentions = topicRecord.mention_count || 1;
          agg.avgSentiment += topicRecord.avg_sentiment_score * mentions;
          agg.sentimentCount += mentions;
        }

        agg.velocity = Math.max(agg.velocity, topicRecord.velocity_score || 0);
        agg.momentum = Math.max(agg.momentum, topicRecord.momentum || 0);

        (topicRecord.sample_titles || []).forEach((title: string) => agg.sampleTitles.add(title));
        (topicRecord.related_keywords || []).forEach((kw: string) => agg.keywords.add(kw));
      });

      // Convert to array with calculated averages
      const topicSentimentArray: TopicSentiment[] = Array.from(topicAggregateMap.entries())
        .map(([topic, data]) => {
          const avgSentiment = data.sentimentCount > 0 ? data.avgSentiment / data.sentimentCount : 0; // 0 = no sentiment data

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
        // Sort by velocity score from database (already accounts for growth rate)
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
        // Skip articles without sentiment labels
        if (!article.sentiment_label) return;

        const date = new Date(article.published_date).toISOString().split('T')[0];
        const sentiment = article.sentiment_label;

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
          avgSentiment: data.total > 0 ? (data.positive * 1 + data.neutral * 0.5 + data.negative * 0) / data.total : 0,
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

      // === SET BLUESKY SOCIAL INTELLIGENCE (already fetched in parallel) ===
      setLoadingPhase("Loading social intelligence...");
      setLoadingProgress(85);

      setBlueskyTrends(blueskyData || []);

      setSocialMetrics({
        totalPosts: postsCount || 0,
        trendingTopics: (blueskyData || []).filter((t: any) => t.is_trending).length,
        predictiveSignals: predictiveCount || 0,
      });

      setLoadingPhase("Finalizing...");
      setLoadingProgress(100);

    } catch (error) {
      console.error('Error fetching analytics:', error);

      // Parse error and set error state
      const parsedError = parseError(error);
      setError(parsedError);

      // Show user-friendly error toast
      toast.error(parsedError.message, {
        description: parsedError.retryable
          ? 'Click the retry button below to try again'
          : 'Please refresh the page',
        duration: 5000
      });

      setLoadingPhase("");
      setLoadingProgress(0);
    } finally {
      setLoading(false);
      setLoadingPhase("");
      setLoadingProgress(0);
      setRetryCount(0); // Reset retry count
    }
  };

  const handleRetry = async () => {
    setError(null); // Clear error state
    try {
      await retryWithBackoff(fetchAnalytics);
    } catch (error) {
      // Error already handled in fetchAnalytics
      console.error('Retry failed:', error);
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

      toast.success('CSV exported successfully', {
        description: 'Your data has been downloaded',
        duration: 3000
      });
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      const parsedError = parseError(error);
      toast.error('Export Failed', {
        description: parsedError.message,
        duration: 5000
      });
    }
  };

  const extractTrendingTopics = async () => {
    try {
      setAnalyzing(true);
      toast.info('Extracting trending topics from articles using AI...');

      const { data, error } = await supabase.functions.invoke('extract-trending-topics', {
        body: { hoursBack: 24 } // Analyze last 24 hours
      });

      if (error) {
        console.error('Edge function error:', error);
        const parsedError = parseError(error);
        toast.error('Topic Extraction Failed', {
          description: parsedError.message,
          duration: 5000
        });
        return;
      }

      if (!data) {
        toast.error('Topic Extraction Failed', {
          description: 'No data returned from extraction function',
          duration: 5000
        });
        return;
      }

      toast.success(
        `✨ Found ${data.topicsExtracted} trending topics from ${data.articlesAnalyzed} articles!`,
        {
          description: 'Refreshing dashboard...',
          duration: 3000
        }
      );

      // Refresh analytics to show new topics
      await fetchAnalytics();
    } catch (error: any) {
      console.error('Error extracting topics:', error);
      const parsedError = parseError(error);
      toast.error('Topic Extraction Failed', {
        description: parsedError.message,
        duration: 5000
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchTopicArticles = async (topicData: TopicSentiment) => {
    try {
      // Open sheet and show loading
      setSheetTopic(topicData.topic);
      setSheetOpen(true);
      setSheetLoading(true);
      setSheetArticles([]);

      console.log('Fetching articles for topic:', topicData.topic);

      // Get article IDs from trending_topics table
      const { data: trendingData, error: trendingError } = await supabase
        .from('trending_topics')
        .select('article_ids, sample_titles')
        .eq('topic', topicData.topic)
        .gte('hour_timestamp', dateRange.from.toISOString())
        .lte('hour_timestamp', dateRange.to.toISOString())
        .order('hour_timestamp', { ascending: false })
        .limit(1);

      console.log('Trending data:', trendingData, 'Error:', trendingError);

      if (trendingError) {
        console.error('Trending data error:', trendingError);
        throw trendingError;
      }

      if (trendingData && trendingData.length > 0 && trendingData[0].article_ids) {
        const articleIds = trendingData[0].article_ids;
        console.log('Article IDs:', articleIds);

        if (!articleIds || articleIds.length === 0) {
          console.warn('No article IDs found for topic');
          setSheetArticles([]);
          setSheetLoading(false);
          return;
        }

        // Fetch full article details
        const { data: articles, error: articlesError } = await supabase
          .from('articles')
          .select('id, title, description, source_url, source_name, published_date, sentiment_label')
          .in('id', articleIds)
          .order('published_date', { ascending: false })
          .limit(20);

        console.log('Articles fetched:', articles, 'Error:', articlesError);

        if (articlesError) {
          console.error('Articles fetch error:', articlesError);
          throw articlesError;
        }

        setSheetArticles(articles || []);
      } else {
        console.warn('No trending data found or no article_ids');
        setSheetArticles([]);
      }
    } catch (error: any) {
      console.error('Error fetching topic articles:', error);
      const parsedError = parseError(error);
      toast.error('Failed to Load Articles', {
        description: parsedError.message,
        duration: 5000
      });
      setSheetArticles([]); // Clear articles on error
    } finally {
      setSheetLoading(false);
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
    <div className="space-y-6" role="main" aria-label="News Pulse Analytics Dashboard">
      {/* Screen reader announcements for dynamic updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {loading && "Loading analytics data"}
        {!loading && lastUpdated && `Analytics last updated ${timeAgo}`}
        {error && `Error: ${error.message}`}
        {newArticleCount > 0 && `${newArticleCount} new articles detected`}
      </div>
      {/* Loading Progress Bar */}
      {loading && loadingProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <Progress value={loadingProgress} className="h-1 rounded-none" />
          {loadingPhase && (
            <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
              <p className="text-sm text-muted-foreground text-center animate-pulse">
                {loadingPhase}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stale Data Warning */}
      {isStale && !loading && !error && (
        <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Data may be stale. Refreshing automatically in the background...
          </AlertDescription>
        </Alert>
      )}

      {/* Offline Warning */}
      {isOffline && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>You're offline.</strong> Some features may not work until your connection is restored.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && !loading && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold mb-1">{error.type === 'network' ? 'Network Error' : error.type === 'timeout' ? 'Request Timeout' : error.type === 'server' ? 'Server Error' : 'Error'}</p>
              <p className="text-sm">{error.message}</p>
              {retryCount > 0 && (
                <p className="text-xs mt-1 text-muted-foreground">
                  Retry attempt {retryCount}/3
                </p>
              )}
            </div>
            {error.retryable && (
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="ml-4 shrink-0"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        {/* Header - Matches DailyBriefing Style */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 mb-2 flex-1">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
              <Activity className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">News Pulse</h1>
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
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  Updated {timeAgo}
                </span>
                {!loading && nextRefreshIn > 0 && (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Next refresh in {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, '0')}
                  </span>
                )}
                {loading && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Updating...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal")}
                  aria-label="Select date range for analytics"
                  aria-describedby="date-range-description"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                  <span id="date-range-description" className="sr-only">
                    Current date range: {format(dateRange.from, "MMMM dd, yyyy")} to {format(dateRange.to, "MMMM dd, yyyy")}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" role="dialog" aria-label="Date range options">
                <div className="p-3 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setDateRange({ from: subDays(new Date(), 1), to: new Date() })}
                    aria-label="Show data from last 24 hours"
                  >
                    Last 24h
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                    aria-label="Show data from last 7 days"
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                    aria-label="Show data from last 30 days"
                  >
                    Last 30 days
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              onClick={() => fetchAnalytics()}
              disabled={loading}
              title="Refresh data (Keyboard shortcut: R)"
              aria-label={loading ? "Refreshing analytics data" : "Refresh analytics data"}
              aria-busy={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh View
              <span className="sr-only">(Press R key)</span>
            </Button>

            <Button
              variant="outline"
              onClick={exportToCSV}
              aria-label="Export trending topics to CSV file"
              title="Export to CSV (Keyboard shortcut: E)"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
              <span className="sr-only">(Press E key)</span>
            </Button>
          </div>
        </div>

        {/* Last Updated Indicator */}
        <div className="flex items-center justify-end text-sm text-muted-foreground">
          <span>Last updated: {format(lastUpdated, 'h:mm:ss a')}</span>
        </div>
      </div>

      {/* Key Metrics - Redesigned */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Coverage - Blue */}
        <Card className="hover:shadow-md transition-shadow" role="article" aria-label="Total coverage metric">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Coverage</p>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" aria-label={`${metrics.totalArticles} articles tracked`}>
                {metrics.totalArticles}
              </div>
              <p className="text-xs text-muted-foreground">Articles tracked</p>
            </div>
          </CardContent>
        </Card>

        {/* Critical Threats - Red */}
        <Card className="hover:shadow-md transition-shadow" role="article" aria-label="Critical threats metric">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Critical Threats</p>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400" aria-label={`${metrics.criticalThreats} high priority items`}>
                {metrics.criticalThreats}
              </div>
              <p className="text-xs text-muted-foreground">High priority items</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Bills - Purple */}
        <Card className="hover:shadow-md transition-shadow" role="article" aria-label="Active bills metric">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Active Bills</p>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {metrics.totalBills}
              </div>
              <p className="text-xs text-muted-foreground">Legislative activity</p>
            </div>
          </CardContent>
        </Card>

        {/* Overall Sentiment - Dynamic Color */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2 rounded-lg ${
                metrics.avgSentiment > 0.6
                  ? 'bg-green-100 dark:bg-green-950'
                  : metrics.avgSentiment < 0.4
                  ? 'bg-red-100 dark:bg-red-950'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <TrendingUp className={`h-5 w-5 ${
                  metrics.avgSentiment > 0.6
                    ? 'text-green-600 dark:text-green-400'
                    : metrics.avgSentiment < 0.4
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Overall Sentiment</p>
              <div className={`text-3xl font-bold ${
                metrics.avgSentiment > 0.6
                  ? 'text-green-600 dark:text-green-400'
                  : metrics.avgSentiment < 0.4
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {metrics.avgSentiment > 0 ? `${(metrics.avgSentiment * 100).toFixed(0)}%` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">Sentiment score</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="topics" className="space-y-4" aria-label="Analytics content views">
        <TabsList className="grid grid-cols-2" role="tablist">
          <TabsTrigger value="topics" aria-label="View news-based trending topics and sentiment analysis">
            News Topics
          </TabsTrigger>
          <TabsTrigger value="social" aria-label="View social media trending topics from Bluesky">
            Social Trends
          </TabsTrigger>
        </TabsList>

        {/* TRENDING TOPICS WITH SENTIMENT */}
        <TabsContent value="topics" className="space-y-4" role="tabpanel">
          {/* Warning when date range > 24 hours */}
          {Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60)) > 24 && (
            <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> You've selected a {Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))}-day date range,
                but trending topics are auto-extracted from the <strong>last 24 hours</strong> only.
                Other metrics (articles, bills, sentiment timeline) will show data for your full selected range.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Trending Topics</h2>
                <span className="text-xs px-2 py-1 bg-red-500 text-white rounded-full animate-pulse">
                  LIVE
                </span>
                {newArticleCount > 0 && (
                  <span className="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-semibold">
                    +{newArticleCount} new
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Auto-extracts every 30 min • {topicSentiments.length} topics tracked • Live updates when site is open
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer-slide"></div>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-muted animate-pulse"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-muted rounded w-3/4 animate-pulse"></div>
                          <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
                        </div>
                      </div>
                      <div className="w-16 h-12 bg-muted rounded"></div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="h-3 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-5/6"></div>
                    </div>
                    <div className="h-6 bg-muted rounded-full w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : topicSentiments.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No trending topics found</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                {Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60)) > 24
                  ? "Trending topics are calculated from the last 24 hours. Try selecting a shorter date range to see recent trends."
                  : "No significant trends detected in the last 24 hours. This is normal during quiet news periods. Check back later!"
                }
              </p>
              {Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60)) > 24 && (
                <Button
                  onClick={() => setDateRange({
                    from: subDays(new Date(), 1),
                    to: new Date()
                  })}
                  variant="outline"
                >
                  View Last 24 Hours
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {topicSentiments.map((topic, index) => (
                <Card
                  key={topic.topic}
                  onClick={() => fetchTopicArticles(topic)}
                  className={cn(
                    "cursor-pointer hover:shadow-lg transition-all group",
                    topic.trend === 'rising' && 'border-green-500 bg-green-50 dark:bg-green-950/20'
                  )}
                >
                  <CardContent className="p-6">
                    {/* Header with Rank and Sentiment */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                          #{index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                            {topic.topic}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-sm text-muted-foreground">{topic.total} mentions</span>
                            {topic.trend === 'rising' && (
                              <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded animate-pulse">
                                🔥 TRENDING
                              </span>
                            )}
                            {topic.velocity !== undefined && topic.velocity > 0 && (
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">
                                +{topic.velocity.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Large Sentiment Score */}
                      <div className="text-right">
                        <div className={cn(
                          "text-3xl font-bold",
                          topic.avgSentiment > 0.6
                            ? 'text-green-600 dark:text-green-400'
                            : topic.avgSentiment < 0.4
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-600 dark:text-gray-400'
                        )}>
                          {topic.avgSentiment > 0 ? `${(topic.avgSentiment * 100).toFixed(0)}%` : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">sentiment</p>
                      </div>
                    </div>

                    {/* Keywords */}
                    {topic.keywords && topic.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {topic.keywords.map(kw => (
                          <span key={kw} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Visual Sentiment Bar */}
                    <div className="space-y-2">
                      <div className="flex gap-1 h-6 rounded-full overflow-hidden">
                        {topic.positive > 0 && (
                          <div
                            className="bg-green-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                            style={{ width: `${(topic.positive / topic.total) * 100}%` }}
                          >
                            {((topic.positive / topic.total) * 100) > 15 && topic.positive}
                          </div>
                        )}
                        {topic.neutral > 0 && (
                          <div
                            className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium transition-all"
                            style={{ width: `${(topic.neutral / topic.total) * 100}%` }}
                          >
                            {((topic.neutral / topic.total) * 100) > 15 && topic.neutral}
                          </div>
                        )}
                        {topic.negative > 0 && (
                          <div
                            className="bg-red-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                            style={{ width: `${(topic.negative / topic.total) * 100}%` }}
                          >
                            {((topic.negative / topic.total) * 100) > 15 && topic.negative}
                          </div>
                        )}
                      </div>

                      {/* Sentiment Breakdown */}
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {topic.positive} positive
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          {topic.neutral} neutral
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {topic.negative} negative
                        </span>
                      </div>
                    </div>

                    {/* View Articles Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4 gap-2"
                      onClick={(e) => {
                        e.stopPropagation(); // Don't trigger card onClick twice
                        fetchTopicArticles(topic);
                      }}
                    >
                      <Search className="h-4 w-4" />
                      View Articles
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* BLUESKY SOCIAL TRENDS */}
        <TabsContent value="social" className="space-y-4">
          {/* Social Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                    <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Social Posts</p>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {socialMetrics.totalPosts}
                  </div>
                  <p className="text-xs text-muted-foreground">Bluesky posts tracked</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                    <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Trending Now</p>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {socialMetrics.trendingTopics}
                  </div>
                  <p className="text-xs text-muted-foreground">Hot topics on social</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                    <AlertTriangle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Predictive Signals</p>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {socialMetrics.predictiveSignals}
                  </div>
                  <p className="text-xs text-muted-foreground">Social predicted news</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bluesky Trending Topics */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-semibold">Bluesky Social Intelligence</h2>
              <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded-full">
                REAL-TIME
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              AI analysis every 10 min • Correlation with news every 15 min • Velocity-ranked by spike detection
            </p>

            {blueskyTrends.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No social trends detected yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  {socialMetrics.totalPosts === 0
                    ? "The Bluesky stream processor needs to be deployed and running to collect social data."
                    : "Social data is being collected, but no trending topics have emerged yet. Check back in a few hours!"}
                </p>
                {socialMetrics.totalPosts === 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 max-w-lg mx-auto">
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>To enable social intelligence:</strong>
                    </p>
                    <code className="text-xs block bg-background p-2 rounded">
                      npx supabase functions deploy bluesky-stream
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {blueskyTrends.map((trend, index) => (
                  <Card
                    key={trend.id}
                    className={cn(
                      "hover:shadow-lg transition-all",
                      trend.is_trending && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    )}
                  >
                    <CardContent className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 font-bold">
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{trend.topic}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-sm text-muted-foreground">
                                {trend.mentions_last_24_hours} mentions (24h)
                              </span>
                              {trend.is_trending && (
                                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded animate-pulse">
                                  🔥 TRENDING
                                </span>
                              )}
                              {trend.velocity && trend.velocity > 0 && (
                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">
                                  +{trend.velocity.toFixed(0)}% velocity
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sentiment Score */}
                        {trend.sentiment_avg !== null && (
                          <div className="text-right">
                            <div className={cn(
                              "text-3xl font-bold",
                              trend.sentiment_avg > 0.3
                                ? 'text-green-600 dark:text-green-400'
                                : trend.sentiment_avg < -0.3
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-600 dark:text-gray-400'
                            )}>
                              {((trend.sentiment_avg + 1) * 50).toFixed(0)}%
                            </div>
                            <p className="text-xs text-muted-foreground">sentiment</p>
                          </div>
                        )}
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            {trend.sentiment_positive || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Positive</div>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                            {trend.sentiment_neutral || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Neutral</div>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            {trend.sentiment_negative || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Negative</div>
                        </div>
                      </div>

                      {/* Correlation Info */}
                      {trend.related_articles && trend.related_articles.length > 0 && (
                        <div className="bg-purple-50 dark:bg-purple-950/30 rounded p-3 border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center gap-2 text-sm">
                            <Newspaper className="h-4 w-4 text-purple-600" />
                            <span className="font-semibold text-purple-900 dark:text-purple-100">
                              Correlated with {trend.related_articles.length} news article{trend.related_articles.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {trend.correlation_score && (
                            <div className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                              Correlation strength: {(trend.correlation_score * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      )}

                      {/* View Articles Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-4 gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Create minimal TopicSentiment object for Bluesky trend
                          fetchTopicArticles({ topic: trend.topic } as TopicSentiment);
                        }}
                      >
                        <Search className="h-4 w-4" />
                        View Articles
                      </Button>

                      {/* Time Info */}
                      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex justify-between">
                        <span>Last seen: {new Date(trend.last_seen_at).toLocaleTimeString()}</span>
                        {trend.trending_since && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            Trending since: {new Date(trend.trending_since).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Sheet drawer for Trending Topic Articles */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold capitalize">{sheetTopic}</SheetTitle>
            <SheetDescription>
              {sheetLoading
                ? 'Loading articles...'
                : `${sheetArticles.length} article${sheetArticles.length !== 1 ? 's' : ''} mentioning this topic`
              }
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            {sheetLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" label="Loading articles..." />
              </div>
            ) : sheetArticles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No articles found</p>
            ) : (
              sheetArticles.map((article) => (
                <a
                  key={article.id}
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1 hover:underline">
                        {article.title}
                      </h3>
                      {article.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {article.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium">{article.source_name}</span>
                        <span>•</span>
                        <span>{new Date(article.published_date).toLocaleDateString()}</span>
                        {article.sentiment_label && (
                          <>
                            <span>•</span>
                            <span
                              className={`px-2 py-0.5 rounded ${
                                article.sentiment_label === 'positive'
                                  ? 'bg-green-100 text-green-800'
                                  : article.sentiment_label === 'negative'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {article.sentiment_label}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
