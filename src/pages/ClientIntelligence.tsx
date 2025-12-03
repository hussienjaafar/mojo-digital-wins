import { useState, useCallback, lazy, Suspense } from "react";
import { ClientLayout } from "@/components/client/ClientLayout";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { useRealtimeTrends } from "@/hooks/useRealtimeTrends";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreativeInsights } from "@/components/client/CreativeInsights";
import { 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCw, 
  Newspaper,
  Eye,
  ArrowUpRight,
  Clock,
  Zap,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

// Lazy load sentiment chart for performance
const SentimentTrendChart = lazy(() => 
  import("@/components/news/SentimentTrendChart").then(m => ({ default: m.SentimentTrendChart }))
);

type Article = {
  id: string;
  title: string;
  source_name: string;
  published_date: string;
  sentiment_label: string | null;
  category: string | null;
};

export default function ClientIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const { alerts, criticalCount, isLoading: alertsLoading, connectionStatus: alertsStatus, markAsRead, refresh: refreshAlerts } = useRealtimeAlerts(organizationId || undefined);
  const { trends, isLoading: trendsLoading, connectionStatus: trendsStatus, refresh: refreshTrends } = useRealtimeTrends();
  
  const [recentNews, setRecentNews] = useState<Article[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch recent news and watchlist count
  const loadAdditionalData = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      // Fetch recent news articles
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, source_name, published_date, sentiment_label, category')
        .order('published_date', { ascending: false })
        .limit(10);
      
      if (articles) setRecentNews(articles);

      // Fetch watchlist count
      const { count } = await (supabase as any)
        .from('client_entity_watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      
      setWatchlistCount(count || 0);
    } catch (error) {
      console.error('Error loading intelligence data:', error);
    } finally {
      setNewsLoading(false);
    }
  }, [organizationId]);

  // Initial load
  useState(() => {
    loadAdditionalData();
  });

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshAlerts(), refreshTrends(), loadAdditionalData()]);
      toast.success("Intelligence data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredAlerts = alertFilter === "all" 
    ? alerts 
    : alerts.filter(a => a.severity === alertFilter);

  const isConnected = alertsStatus === 'connected' || trendsStatus === 'connected';

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-500';
      case 'negative': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  if (orgLoading) {
    return (
      <ClientLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header with Live Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Intelligence Center</h1>
                <Badge 
                  variant={isConnected ? "default" : "secondary"}
                  className="gap-1"
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
                  {isConnected ? 'LIVE' : 'Offline'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Real-time alerts, trends, and strategic insights
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>

        {/* Critical Alerts Section */}
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg">Critical Alerts</CardTitle>
                {criticalCount > 0 && (
                  <Badge variant="destructive">{criticalCount} Critical</Badge>
                )}
              </div>
            <Tabs value={alertFilter} onValueChange={setAlertFilter} className="w-auto max-w-full">
                <div className="overflow-x-auto -mx-2 px-2 scrollbar-hide">
                  <TabsList className="h-9 inline-flex w-auto min-w-max">
                    <TabsTrigger value="all" className="text-xs px-3 h-7 min-w-[44px]">All ({alerts.length})</TabsTrigger>
                    <TabsTrigger value="critical" className="text-xs px-3 h-7 min-w-[44px]">Critical</TabsTrigger>
                    <TabsTrigger value="high" className="text-xs px-3 h-7 min-w-[44px]">High</TabsTrigger>
                    <TabsTrigger value="medium" className="text-xs px-3 h-7 min-w-[44px]">Medium</TabsTrigger>
                  </TabsList>
                </div>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No {alertFilter !== 'all' ? alertFilter : ''} alerts at this time</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {filteredAlerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getSeverityColor(alert.severity)} variant="secondary">
                            {alert.severity}
                          </Badge>
                          <span className="text-sm font-medium truncate">{alert.entity_name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.alert_type}</p>
                        {alert.suggested_action && (
                          <p className="text-xs text-primary mt-1">💡 {alert.suggested_action}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {alert.triggered_at ? formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true }) : 'Recently'}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => markAsRead(alert.id)}
                        className="shrink-0"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <div className="mt-4 pt-4 border-t">
              <Link to="/client/alerts">
                <Button variant="outline" className="w-full gap-2">
                  View All Alerts <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout: Trends + Watchlist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trending Topics - 2/3 width */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Trending Topics</CardTitle>
                <Badge variant="outline" className="ml-auto">Top 15</Badge>
              </div>
              <CardDescription>Real-time topic velocity and mentions</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : trends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No trending topics detected</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {trends.map((trend, index) => (
                      <div 
                        key={trend.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{trend.entity_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{trend.mentions_24h || 0} mentions (24h)</span>
                              {trend.is_trending && (
                                <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-500">
                                  <Zap className="h-3 w-3 mr-1" />
                                  Hot
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {trend.velocity !== null && trend.velocity !== undefined && (
                            <span className={`text-sm font-semibold ${trend.velocity > 0 ? 'text-green-500' : trend.velocity < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {trend.velocity > 0 ? '+' : ''}{Math.round(trend.velocity)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Watchlist Summary - 1/3 width */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Watchlist</CardTitle>
              </div>
              <CardDescription>Entities you're monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-6">
                <div className="text-4xl font-bold text-primary">{watchlistCount}</div>
                <p className="text-sm text-muted-foreground mt-1">Active Entities</p>
              </div>
              <Link to="/client/watchlist">
                <Button variant="outline" className="w-full gap-2">
                  Manage Watchlist <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Creative Insights */}
        {organizationId && (
          <CreativeInsights organizationId={organizationId} />
        )}

        {/* Sentiment Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sentiment Analysis</CardTitle>
            <CardDescription>Historical sentiment trends across news sources</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
              <SentimentTrendChart />
            </Suspense>
          </CardContent>
        </Card>

        {/* Recent News */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Recent Headlines</CardTitle>
              </div>
              <Badge variant="outline">Latest 10</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {newsLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentNews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No recent news articles</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentNews.map((article) => (
                  <div 
                    key={article.id}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm line-clamp-2">{article.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{article.source_name}</Badge>
                        <span>{format(new Date(article.published_date), 'MMM d, h:mm a')}</span>
                        {article.sentiment_label && (
                          <span className={getSentimentColor(article.sentiment_label)}>
                            {article.sentiment_label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t">
              <Link to="/client/news">
                <Button variant="outline" className="w-full gap-2">
                  View Full News Feed <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
