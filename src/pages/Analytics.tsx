import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { UnifiedTrendingPanel } from "@/components/analytics/UnifiedTrendingPanel";
import { TopicContentSheet } from "@/components/analytics/TopicContentSheet";
import { PriorityAlertsPanel } from "@/components/analytics/PriorityAlertsPanel";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { format, subDays } from "date-fns";
import { Download, RefreshCw, Activity, WifiOff, AlertCircle, Target, TrendingUp, TrendingDown, Newspaper, Users, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNewsFilters } from "@/contexts/NewsFilterContext";
import { useTopicContent } from "@/hooks/useTopicContent";
import { useUnifiedTrends } from "@/hooks/useUnifiedTrends";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface MetricWithComparison {
  current: number;
  previous: number;
  change: number; // percentage
}

export default function Analytics() {
  const { setSearchTerm, navigateToTab } = useNewsFilters();
  const navigate = useNavigate();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        fetchAnalytics();
        toast.info('Refreshing data...');
      }

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        exportToCSV();
      }

      if (e.key === '?') {
        e.preventDefault();
        toast.info('Keyboard Shortcuts', {
          description: 'R: Refresh • E: Export • ?: Help',
          duration: 5000
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const [dateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  
  // Metrics with comparison
  const [metrics, setMetrics] = useState<{
    watchlistMentions: MetricWithComparison;
    criticalItems: MetricWithComparison;
    newArticles: MetricWithComparison;
    socialPosts: MetricWithComparison;
  }>({
    watchlistMentions: { current: 0, previous: 0, change: 0 },
    criticalItems: { current: 0, previous: 0, change: 0 },
    newArticles: { current: 0, previous: 0, change: 0 },
    socialPosts: { current: 0, previous: 0, change: 0 },
  });
  
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<{ message: string; type: string; retryable: boolean } | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [timeAgo, setTimeAgo] = useState<string>("just now");
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(120);

  // Topic content sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTopic, setSheetTopic] = useState<string>("");
  const { isLoading: sheetLoading, content: sheetContent, fetchTopicContent, addToWatchlist } = useTopicContent();
  
  // Get unified trends stats
  const { stats: trendStats, refresh: refreshTrends } = useUnifiedTrends({ limit: 10 });

  // Error handling utility
  const parseError = (error: any): { message: string; type: string; retryable: boolean } => {
    if (!navigator.onLine) {
      return { message: "You're offline. Please check your internet connection.", type: 'offline', retryable: true };
    }
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return { message: "Network error. Please check your connection.", type: 'network', retryable: true };
    }
    if (error.status >= 500) {
      return { message: "Server error. Please try again later.", type: 'server', retryable: true };
    }
    return { message: error.message || "An unexpected error occurred.", type: 'unknown', retryable: true };
  };

  // Calculate percentage change
  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Detect online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Connection restored');
      fetchAnalytics();
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.error('You\'re offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update timers
  useEffect(() => {
    const updateTimers = () => {
      const now = new Date();
      const secondsAgo = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

      if (secondsAgo < 60) setTimeAgo("just now");
      else if (secondsAgo < 3600) setTimeAgo(`${Math.floor(secondsAgo / 60)}m ago`);
      else setTimeAgo(`${Math.floor(secondsAgo / 3600)}h ago`);

      setNextRefreshIn(Math.max(0, 120 - secondsAgo));
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setIsStale(true);
      fetchAnalytics();
    }, 120000);
    return () => clearInterval(interval);
  }, [dateRange]);

  // Check for stale data
  useEffect(() => {
    const staleCheckInterval = setInterval(() => {
      const minutesSinceUpdate = (Date.now() - lastUpdated.getTime()) / 60000;
      setIsStale(minutesSinceUpdate > 3);
    }, 30000);
    return () => clearInterval(staleCheckInterval);
  }, [lastUpdated]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setLoadingPhase("Loading data...");
    setLoadingProgress(20);
    setLastUpdated(new Date());
    setIsStale(false);

    try {
      // Define time periods
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Fetch all data in parallel
      const [
        watchlistResult,
        todayArticlesResult,
        yesterdayArticlesResult,
        todaySocialResult,
        yesterdaySocialResult
      ] = await Promise.all([
        supabase.from('entity_watchlist').select('entity_name'),
        supabase
          .from('articles')
          .select('id, title, threat_level, content')
          .gte('published_date', today.toISOString()),
        supabase
          .from('articles')
          .select('id, title, threat_level, content')
          .gte('published_date', yesterday.toISOString())
          .lt('published_date', today.toISOString()),
        supabase
          .from('bluesky_posts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString()),
        supabase
          .from('bluesky_posts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString())
      ]);

      setLoadingProgress(60);

      const watchlistEntities = (watchlistResult.data || []).map(w => w.entity_name?.toLowerCase() || '');
      const todayArticles = todayArticlesResult.data || [];
      const yesterdayArticles = yesterdayArticlesResult.data || [];
      
      // Calculate today's watchlist mentions
      const todayWatchlistMentions = todayArticles.filter(a => 
        watchlistEntities.some(entity => 
          entity && (a.title?.toLowerCase().includes(entity) || a.content?.toLowerCase().includes(entity))
        )
      ).length;

      // Calculate yesterday's watchlist mentions
      const yesterdayWatchlistMentions = yesterdayArticles.filter(a => 
        watchlistEntities.some(entity => 
          entity && (a.title?.toLowerCase().includes(entity) || a.content?.toLowerCase().includes(entity))
        )
      ).length;

      // Critical items today
      const todayCritical = todayArticles.filter(a => 
        (a.threat_level === 'critical' || a.threat_level === 'high') &&
        watchlistEntities.some(entity => 
          entity && (a.title?.toLowerCase().includes(entity) || a.content?.toLowerCase().includes(entity))
        )
      ).length;

      // Critical items yesterday
      const yesterdayCritical = yesterdayArticles.filter(a => 
        (a.threat_level === 'critical' || a.threat_level === 'high') &&
        watchlistEntities.some(entity => 
          entity && (a.title?.toLowerCase().includes(entity) || a.content?.toLowerCase().includes(entity))
        )
      ).length;

      setMetrics({
        watchlistMentions: {
          current: todayWatchlistMentions,
          previous: yesterdayWatchlistMentions,
          change: calculateChange(todayWatchlistMentions, yesterdayWatchlistMentions)
        },
        criticalItems: {
          current: todayCritical,
          previous: yesterdayCritical,
          change: calculateChange(todayCritical, yesterdayCritical)
        },
        newArticles: {
          current: todayArticles.length,
          previous: yesterdayArticles.length,
          change: calculateChange(todayArticles.length, yesterdayArticles.length)
        },
        socialPosts: {
          current: todaySocialResult.count || 0,
          previous: yesterdaySocialResult.count || 0,
          change: calculateChange(todaySocialResult.count || 0, yesterdaySocialResult.count || 0)
        }
      });

      setLoadingProgress(100);
      
      // Also refresh trends
      refreshTrends();

    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      const parsedError = parseError(error);
      setError(parsedError);
      toast.error(parsedError.message);
    } finally {
      setLoading(false);
      setLoadingPhase("");
      setLoadingProgress(0);
    }
  };

  const exportToCSV = async () => {
    toast.info('Export feature coming soon');
  };

  const handleTopicClick = (topic: string, sourceTypes: string[]) => {
    setSheetTopic(topic);
    setSheetOpen(true);
    fetchTopicContent(topic, sourceTypes);
  };

  const handleAlertClick = (alert: any) => {
    if (alert.type === 'critical_news' && alert.sourceUrl) {
      window.open(alert.sourceUrl, '_blank');
    } else if (alert.entity) {
      setSheetTopic(alert.entity);
      setSheetOpen(true);
      fetchTopicContent(alert.entity, ['news', 'social']);
    }
  };

  // Render change indicator
  const ChangeIndicator = ({ change, inverse = false }: { change: number; inverse?: boolean }) => {
    if (change === 0) return null;
    
    const isPositive = inverse ? change < 0 : change > 0;
    const Icon = change > 0 ? ArrowUp : ArrowDown;
    
    return (
      <span className={cn(
        "inline-flex items-center text-xs font-medium",
        isPositive ? "text-green-600" : change < 0 ? "text-red-600" : "text-muted-foreground"
      )}>
        <Icon className="h-3 w-3 mr-0.5" />
        {Math.abs(change)}%
      </span>
    );
  };

  return (
    <div className="space-y-6" role="main" aria-label="News Pulse Analytics Dashboard">
      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {loading && "Loading analytics data"}
        {!loading && lastUpdated && `Analytics last updated ${timeAgo}`}
        {error && `Error: ${error.message}`}
      </div>

      {/* Loading Progress Bar */}
      {loading && loadingProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <Progress value={loadingProgress} className="h-1 rounded-none" />
          {loadingPhase && (
            <div className="bg-background/95 backdrop-blur border-b px-4 py-2">
              <p className="text-sm text-muted-foreground text-center animate-pulse">{loadingPhase}</p>
            </div>
          )}
        </div>
      )}

      {/* Stale Data Warning */}
      {isStale && !loading && !error && (
        <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Data may be stale. Refreshing automatically...
          </AlertDescription>
        </Alert>
      )}

      {/* Offline Warning */}
      {isOffline && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            <strong>You're offline.</strong> Some features may not work.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error.message}</span>
            {error.retryable && (
              <Button onClick={fetchAnalytics} variant="outline" size="sm" className="ml-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
              <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">News Pulse</h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-semibold animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  LIVE
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  Updated {timeAgo}
                </span>
                {!loading && nextRefreshIn > 0 && (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Next in {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="smooth" onClick={fetchAnalytics} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="smooth" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Priority Alerts - Top of page for watchlist items */}
      <PriorityAlertsPanel onAlertClick={handleAlertClick} />

      {/* Contextual Metrics with Comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <ChangeIndicator change={metrics.watchlistMentions.change} />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-primary">{metrics.watchlistMentions.current}</p>
              <p className="text-xs text-muted-foreground">Watchlist mentions today</p>
              {metrics.watchlistMentions.previous > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  vs {metrics.watchlistMentions.previous} yesterday
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "bg-gradient-to-br border-l-4",
          metrics.criticalItems.current > 0 
            ? "from-red-500/5 to-red-500/10 border-red-500 border-red-500/20" 
            : "from-green-500/5 to-green-500/10 border-green-500 border-green-500/20"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className={cn(
                "p-2 rounded-lg",
                metrics.criticalItems.current > 0 ? "bg-red-500/10" : "bg-green-500/10"
              )}>
                <AlertCircle className={cn(
                  "h-5 w-5",
                  metrics.criticalItems.current > 0 ? "text-red-500" : "text-green-500"
                )} />
              </div>
              <ChangeIndicator change={metrics.criticalItems.change} inverse />
            </div>
            <div className="mt-3">
              <p className={cn(
                "text-2xl font-bold",
                metrics.criticalItems.current > 0 ? "text-red-500" : "text-green-500"
              )}>
                {metrics.criticalItems.current}
              </p>
              <p className="text-xs text-muted-foreground">
                {metrics.criticalItems.current > 0 ? "Critical items to review" : "All clear - no critical items"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Newspaper className="h-5 w-5 text-blue-500" />
              </div>
              <ChangeIndicator change={metrics.newArticles.change} />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-blue-500">{metrics.newArticles.current}</p>
              <p className="text-xs text-muted-foreground">New articles today</p>
              {metrics.newArticles.previous > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  vs {metrics.newArticles.previous} yesterday
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <ChangeIndicator change={metrics.socialPosts.change} />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-purple-500">{metrics.socialPosts.current.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Social posts today</p>
              {metrics.socialPosts.previous > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  vs {metrics.socialPosts.previous.toLocaleString()} yesterday
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 text-sm flex-wrap">
        <span className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <strong>{trendStats.breakthroughs}</strong> rising fast
        </span>
        <span className="text-muted-foreground hidden sm:inline">•</span>
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <strong>{trendStats.watchlistMatches}</strong> match watchlist
        </span>
        <span className="text-muted-foreground hidden sm:inline">•</span>
        <span className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-green-500" />
          <strong>{trendStats.multiSourceTrends}</strong> cross-platform
        </span>
      </div>

      {/* Unified Trending Topics - Main content */}
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
