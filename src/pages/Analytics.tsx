import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnifiedTrendingPanel } from "@/components/analytics/UnifiedTrendingPanel";
import { TopicContentSheet } from "@/components/analytics/TopicContentSheet";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";
import { format, subDays } from "date-fns";
import { Download, TrendingUp, TrendingDown, AlertTriangle, Newspaper, Scale, RefreshCw, Activity, WifiOff, AlertCircle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line } from "recharts";
import { cn } from "@/lib/utils";
import { useNewsFilters } from "@/contexts/NewsFilterContext";
import { useTopicContent } from "@/hooks/useTopicContent";
import { useNavigate } from "react-router-dom";

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
    watchlistMatches: 0,
    criticalWatchlistMatches: 0,
    sentimentChange: 0, // vs previous period
    newThreatsToday: 0,
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

  // Topic content sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTopic, setSheetTopic] = useState<string>("");
  const { isLoading: sheetLoading, content: sheetContent, fetchTopicContent, addToWatchlist } = useTopicContent();
  const navigate = useNavigate();

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
        { count: predictiveCount },
        { data: watchlistData },
        { data: todayArticles }
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
          .eq('is_predictive', true),

        // Watchlist entities for contextual metrics
        supabase
          .from('entity_watchlist')
          .select('entity_name'),

        // Today's articles for "new today" metric
        supabase
          .from('articles')
          .select('id, threat_level')
          .gte('published_date', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
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
      
      // Calculate watchlist matches
      const watchlistEntities = (watchlistData || []).map((w: any) => w.entity_name?.toLowerCase() || '');
      const watchlistMatches = articles.filter(a => 
        watchlistEntities.some((entity: string) => 
          entity && (a.title?.toLowerCase().includes(entity) || a.content?.toLowerCase().includes(entity))
        )
      ).length;
      
      const criticalWatchlistMatches = articles.filter(a => 
        (a.threat_level === 'critical' || a.threat_level === 'high') &&
        watchlistEntities.some((entity: string) => 
          entity && (a.title?.toLowerCase().includes(entity) || a.content?.toLowerCase().includes(entity))
        )
      ).length;
      
      // Today's new threats
      const newThreatsToday = (todayArticles || []).filter((a: any) => 
        a.threat_level === 'critical' || a.threat_level === 'high'
      ).length;

      setMetrics({
        totalArticles: articles.length,
        totalBills: bills?.length || 0,
        criticalThreats,
        avgSentiment,
        watchlistMatches,
        criticalWatchlistMatches,
        sentimentChange: 0, // Could calculate vs previous period
        newThreatsToday,
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

  // Handle topic click - fetch content from appropriate sources
  const handleTopicClick = (topic: string, sourceTypes: string[]) => {
    setSheetTopic(topic);
    setSheetOpen(true);
    fetchTopicContent(topic, sourceTypes);
  };

  // Navigate to filtered news view
  const handleStatCardClick = (type: 'coverage' | 'threats' | 'bills' | 'sentiment') => {
    switch (type) {
      case 'coverage':
        setSearchTerm('');
        navigateToTab?.('feed');
        toast.info('Viewing all news coverage');
        break;
      case 'threats':
        setSearchTerm('threat:high');
        navigateToTab?.('feed');
        toast.info('Filtered to critical threats');
        break;
      case 'bills':
        navigate('/admin/bills');
        toast.info('Viewing legislative activity');
        break;
      case 'sentiment':
        toast.info('Sentiment breakdown coming soon');
        break;
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
            <Button
              variant="smooth"
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
              variant="smooth"
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

      {/* Key Metrics - Clickable Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Coverage - Blue */}
        <Card 
          variant="elevated" 
          className="animate-fade-in-up cursor-pointer hover:shadow-lg transition-all group" 
          style={{ animationDelay: '0ms' }} 
          role="button" 
          aria-label="View all news coverage"
          onClick={() => handleStatCardClick('coverage')}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Coverage</p>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {metrics.totalArticles.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.watchlistMatches > 0 
                  ? `${metrics.watchlistMatches} mention your watchlist`
                  : 'Click to view all articles'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Critical Threats - Red */}
        <Card 
          variant="elevated" 
          className="animate-fade-in-up cursor-pointer hover:shadow-lg transition-all group" 
          style={{ animationDelay: '50ms' }} 
          role="button" 
          aria-label="View critical threats"
          onClick={() => handleStatCardClick('threats')}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Critical Threats</p>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {metrics.criticalThreats}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.newThreatsToday > 0 
                  ? <span className="text-red-500">{metrics.newThreatsToday} new today</span>
                  : metrics.criticalWatchlistMatches > 0 
                    ? `${metrics.criticalWatchlistMatches} affect your issues`
                    : 'Click to view high priority'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Bills - Purple */}
        <Card 
          variant="elevated" 
          className="animate-fade-in-up cursor-pointer hover:shadow-lg transition-all group" 
          style={{ animationDelay: '100ms' }} 
          role="button" 
          aria-label="View legislative activity"
          onClick={() => handleStatCardClick('bills')}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Active Bills</p>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {metrics.totalBills}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalBills > 0 
                  ? 'In current date range'
                  : 'No bills in range • View all'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Overall Sentiment - Dynamic Color */}
        <Card 
          variant="elevated" 
          className="animate-fade-in-up cursor-pointer hover:shadow-lg transition-all group" 
          style={{ animationDelay: '150ms' }}
          role="button"
          aria-label="View sentiment analysis"
          onClick={() => handleStatCardClick('sentiment')}
        >
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
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
              <p className="text-xs text-muted-foreground">
                {metrics.avgSentiment > 0.6 
                  ? 'Positive coverage trending'
                  : metrics.avgSentiment < 0.4 && metrics.avgSentiment > 0
                  ? 'Negative sentiment detected'
                  : metrics.avgSentiment > 0
                  ? 'Neutral tone overall'
                  : 'No sentiment data available'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unified Trending Topics - Twitter-style */}
      <UnifiedTrendingPanel onTopicClick={handleTopicClick} />

      {/* Topic Content Sheet */}
      <TopicContentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        topic={sheetTopic}
        isLoading={sheetLoading}
        content={sheetContent}
        onAddToWatchlist={addToWatchlist}
      />
    </div>
  );
}
