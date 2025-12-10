import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { ClientLayout } from "@/components/client/ClientLayout";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { useRealtimeTrends } from "@/hooks/useRealtimeTrends";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreativeInsights } from "@/components/client/CreativeInsights";
import { CreativeDataImport } from "@/components/client/CreativeDataImport";
import { V3PageContainer, V3Card, V3EmptyState } from "@/components/v3";
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
  const [hasCreativeData, setHasCreativeData] = useState(false);
  const [showImport, setShowImport] = useState(false);

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
      const { count: watchCount } = await supabase
        .from('entity_watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      
      setWatchlistCount(watchCount || 0);

      // Check if org has creative data
      const { count: smsCount } = await supabase
        .from('sms_creative_insights')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      
      const { count: metaCount } = await supabase
        .from('meta_creative_insights')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      setHasCreativeData((smsCount || 0) > 0 || (metaCount || 0) > 0);
    } catch (error) {
      console.error('Error loading intelligence data:', error);
    } finally {
      setNewsLoading(false);
    }
  }, [organizationId]);

  // Initial load
  useEffect(() => {
    loadAdditionalData();
  }, [loadAdditionalData]);

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
      <V3PageContainer
        icon={Activity}
        title="Intelligence Center"
        description="Real-time alerts, trends, and strategic insights"
        actions={
          <div className="flex items-center gap-2">
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className="gap-1"
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
              {isConnected ? 'LIVE' : 'Offline'}
            </Badge>
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
        }
      >
        {/* Critical Alerts Section */}
        <V3Card className="border-l-4 border-l-destructive">
          <div className="p-6 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">Critical Alerts</h3>
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
          </div>
          <div className="px-6 pb-6">
            {alertsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <V3EmptyState
                icon={CheckCircle2}
                title="No alerts"
                description={`No ${alertFilter !== 'all' ? alertFilter : ''} alerts at this time`}
              />
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {filteredAlerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className="flex items-start justify-between p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-card-bg))] hover:bg-[hsl(var(--portal-card-bg-hover))] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getSeverityColor(alert.severity)} variant="secondary">
                            {alert.severity}
                          </Badge>
                          <span className="text-sm font-medium truncate">{alert.entity_name}</span>
                        </div>
                        <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{alert.alert_type}</p>
                        {alert.suggested_action && (
                          <p className="text-xs text-[hsl(var(--portal-accent-blue))] mt-1">💡 {alert.suggested_action}</p>
                        )}
                        <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
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
            <div className="mt-4 pt-4 border-t border-[hsl(var(--portal-border))]">
              <Link to="/client/alerts">
                <Button variant="outline" className="w-full gap-2">
                  View All Alerts <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </V3Card>

        {/* Two Column Layout: Trends + Watchlist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trending Topics - 2/3 width */}
          <V3Card className="lg:col-span-2" title="Trending Topics" subtitle="Real-time topic velocity and mentions">
            <div className="flex items-center gap-2 absolute top-6 right-6">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
              <Badge variant="outline">Top 15</Badge>
            </div>
            {trendsLoading ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : trends.length === 0 ? (
              <V3EmptyState
                icon={TrendingUp}
                title="No trending topics"
                description="No trending topics detected"
              />
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {trends.map((trend, index) => (
                    <div 
                      key={trend.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-card-bg))] hover:bg-[hsl(var(--portal-card-bg-hover))] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-lg font-bold text-[hsl(var(--portal-text-muted))] w-6">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-[hsl(var(--portal-text-primary))]">{trend.entity_name}</p>
                          <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
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
                          <span className={`text-sm font-semibold ${trend.velocity > 0 ? 'text-green-500' : trend.velocity < 0 ? 'text-red-500' : 'text-[hsl(var(--portal-text-muted))]'}`}>
                            {trend.velocity > 0 ? '+' : ''}{Math.round(trend.velocity)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </V3Card>

          {/* Watchlist Summary - 1/3 width */}
          <V3Card title="Watchlist" subtitle="Entities you're monitoring">
            <div className="absolute top-6 right-6">
              <Eye className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="text-4xl font-bold text-[hsl(var(--portal-accent-blue))]">{watchlistCount}</div>
                <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Active Entities</p>
              </div>
              <Link to="/client/watchlist">
                <Button variant="outline" className="w-full gap-2">
                  Manage Watchlist <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </V3Card>
        </div>

        {/* Creative Insights */}
        {organizationId && (
          <>
            {!hasCreativeData && !showImport ? (
              <V3Card className="border-dashed">
                <div className="py-8 text-center">
                  <div className="p-3 rounded-full bg-[hsl(var(--portal-accent-blue)/0.1)] w-fit mx-auto mb-4">
                    <Zap className="h-8 w-8 text-[hsl(var(--portal-accent-blue))]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--portal-text-primary))]">Unlock Creative Intelligence</h3>
                  <p className="text-[hsl(var(--portal-text-muted))] max-w-md mx-auto mb-4">
                    Import your SMS and Meta ad data to get AI-powered insights on what messaging works best for your audience.
                  </p>
                  <Button onClick={() => setShowImport(true)} className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Import Campaign Data
                  </Button>
                </div>
              </V3Card>
            ) : showImport ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>
                    Cancel Import
                  </Button>
                </div>
                <CreativeDataImport 
                  organizationId={organizationId} 
                  onImportComplete={() => {
                    setShowImport(false);
                    setHasCreativeData(true);
                    loadAdditionalData();
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Import More Data
                  </Button>
                </div>
                <CreativeInsights organizationId={organizationId} />
              </div>
            )}
          </>
        )}

        {/* Sentiment Analysis */}
        <V3Card title="Sentiment Analysis" subtitle="Historical sentiment trends across news sources">
          <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
            <SentimentTrendChart />
          </Suspense>
        </V3Card>

        {/* Recent News */}
        <V3Card title="Recent Headlines" subtitle="Latest news articles">
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            <Badge variant="outline">Latest 10</Badge>
          </div>
          {newsLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : recentNews.length === 0 ? (
            <V3EmptyState
              icon={Newspaper}
              title="No recent news"
              description="No recent news articles"
            />
          ) : (
            <div className="space-y-2">
              {recentNews.map((article) => (
                <div 
                  key={article.id}
                  className="flex items-start justify-between p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-card-bg))] hover:bg-[hsl(var(--portal-card-bg-hover))] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm line-clamp-2 text-[hsl(var(--portal-text-primary))]">{article.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--portal-text-muted))]">
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
          <div className="mt-4 pt-4 border-t border-[hsl(var(--portal-border))]">
            <Link to="/client/news">
              <Button variant="outline" className="w-full gap-2">
                View Full News Feed <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </V3Card>
      </V3PageContainer>
    </ClientLayout>
  );
}
