import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Newspaper,
  MessageCircle,
  PlusCircle,
  Bell,
  Zap,
  Eye,
  ExternalLink,
  BarChart3,
  Users,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { TrendExplainability } from './TrendExplainability';
import { cn } from '@/lib/utils';
import type { UnifiedTrend } from '@/hooks/useUnifiedTrends';
import { formatDistanceToNow } from 'date-fns';
import { ProvenancePanel, RelevanceExplanation, SuggestedActionsPanel } from '@/components/admin/v3';

interface ClusterDrilldownViewProps {
  clusterId: string; // This is the normalized_name (cluster_title lowercased)
  onBack: () => void;
}

interface ClusterData {
  id: string;
  cluster_title: string;
  cluster_summary: string | null;
  sentiment_score: number | null;
  dominant_sentiment: string | null;
  total_mentions: number;
  mentions_last_hour: number;
  mentions_last_6h: number;
  mentions_last_24h: number;
  velocity_score: number;
  momentum: string | null;
  trend_stage: string | null;
  acceleration: number | null;
  entity_type: string | null;
  related_topics: string[] | null;
  key_entities: string[] | null;
  google_news_count: number;
  reddit_count: number;
  bluesky_count: number;
  rss_count: number;
  cross_source_score: number | null;
  article_ids: string[] | null;
  first_seen_at: string | null;
  peak_at: string | null;
  trending_since: string | null;
  is_trending: boolean;
  is_breaking: boolean;
  created_at: string;
  updated_at: string;
}

interface ArticleData {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  published_date: string;
  ai_summary: string | null;
  sentiment_label: string | null;
  relevance_category: string | null;
}

interface SuggestedActionCard {
  id: string;
  type: 'response' | 'comms' | 'compliance' | 'fundraising';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  trendId?: string;
  trendName?: string;
}

function mapActionType(rawType: string | null): SuggestedActionCard['type'] {
  const normalized = (rawType || '').toLowerCase();
  if (normalized.includes('fund')) return 'fundraising';
  if (normalized.includes('compliance')) return 'compliance';
  if (normalized.includes('sms') || normalized.includes('email') || normalized.includes('social')) return 'comms';
  return 'response';
}

function mapPriority(score?: number | null): SuggestedActionCard['priority'] {
  if (score && score >= 70) return 'high';
  if (score && score >= 40) return 'medium';
  return 'low';
}

async function fetchClusterData(clusterId: string): Promise<{
  cluster: ClusterData | null;
  articles: ArticleData[];
  unifiedTrend: UnifiedTrend | null;
  suggestedActions: SuggestedActionCard[];
}> {
  // Fetch cluster by normalized title
  const { data: clusterData, error: clusterError } = await supabase
    .from('trend_clusters')
    .select('*')
    .ilike('cluster_title', clusterId)
    .limit(1)
    .single();

  if (clusterError && clusterError.code !== 'PGRST116') {
    console.error('Error fetching cluster:', clusterError);
  }

  // Fetch related articles by searching title/tags
  const { data: articlesData, error: articlesError } = await supabase
    .from('articles')
    .select('id, title, source_name, source_url, published_date, ai_summary, sentiment_label, relevance_category')
    .or(`title.ilike.%${clusterId}%,tags.cs.{${clusterId}}`)
    .order('published_date', { ascending: false })
    .limit(20);

  if (articlesError) {
    console.error('Error fetching articles:', articlesError);
  }

  const cluster = clusterData as ClusterData | null;
  let suggestedActions: SuggestedActionCard[] = [];

  if (cluster) {
    const { data: actionsData, error: actionsError } = await supabase
      .from('suggested_actions')
      .select('id, action_type, suggested_copy, value_prop, urgency_score, decision_score, entity_name, estimated_impact')
      .ilike('entity_name', `%${cluster.cluster_title}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (actionsError) {
      console.error('Error fetching suggested actions:', actionsError);
    } else {
      suggestedActions = (actionsData || []).map((action: any) => ({
        id: action.id,
        type: mapActionType(action.action_type),
        title: action.value_prop || action.entity_name || 'Suggested action',
        description: action.suggested_copy || action.estimated_impact || 'No description available',
        priority: mapPriority(action.decision_score ?? action.urgency_score),
        trendId: cluster.cluster_title.toLowerCase(),
        trendName: cluster.cluster_title,
      }));
    }
  }

  // Build unified trend object for TrendExplainability
  let unifiedTrend: UnifiedTrend | null = null;
  
  if (cluster) {
    const baselineHourly = cluster.mentions_last_6h > 0 
      ? cluster.mentions_last_6h / 6 
      : (cluster.mentions_last_24h > 0 ? cluster.mentions_last_24h / 24 : 0);
    const spikeRatio = baselineHourly > 0 
      ? Math.min(5, Math.max(1, cluster.mentions_last_hour / baselineHourly)) 
      : 1;

    unifiedTrend = {
      name: cluster.cluster_title,
      normalized_name: cluster.cluster_title.toLowerCase(),
      total_mentions_1h: cluster.mentions_last_hour,
      total_mentions_6h: cluster.mentions_last_6h,
      total_mentions_24h: cluster.mentions_last_24h,
      velocity: cluster.velocity_score,
      avg_sentiment: cluster.sentiment_score,
      spike_ratio: spikeRatio,
      baseline_hourly: baselineHourly,
      is_breakthrough: cluster.is_trending && spikeRatio >= 2,
      source_types: [],
      source_count: [
        cluster.google_news_count > 0,
        cluster.reddit_count > 0,
        cluster.bluesky_count > 0,
        cluster.rss_count > 0,
      ].filter(Boolean).length,
      last_updated: cluster.updated_at,
      unified_score: 0,
      matchesWatchlist: false,
      related_topics: cluster.related_topics || [],
      entity_type: cluster.entity_type || 'category',
      is_breaking: cluster.is_breaking,
      trend_stage: (cluster.trend_stage as UnifiedTrend['trend_stage']) || 'stable',
      acceleration: cluster.acceleration || 0,
      source_distribution: {
        google_news: cluster.google_news_count,
        reddit: cluster.reddit_count,
        bluesky: cluster.bluesky_count,
        rss: cluster.rss_count,
      },
      cluster_summary: cluster.cluster_summary || '',
    };
  }

  return {
    cluster,
    articles: (articlesData || []) as ArticleData[],
    unifiedTrend,
    suggestedActions,
  };
}

const STAGE_CONFIG = {
  emerging: { label: 'Emerging', color: 'text-green-400', bgColor: 'bg-green-500/10', icon: TrendingUp },
  surging: { label: 'Surging', color: 'text-orange-400', bgColor: 'bg-orange-500/10', icon: TrendingUp },
  peaking: { label: 'Peaking', color: 'text-red-400', bgColor: 'bg-red-500/10', icon: TrendingUp },
  declining: { label: 'Declining', color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: TrendingDown },
  stable: { label: 'Stable', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Minus },
};

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

function getSourceIcon(source: string) {
  switch (source.toLowerCase()) {
    case 'google_news':
    case 'rss':
      return Newspaper;
    case 'bluesky':
    case 'reddit':
      return MessageCircle;
    default:
      return Newspaper;
  }
}

export function ClusterDrilldownView({ clusterId, onBack }: ClusterDrilldownViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cluster-drilldown', clusterId],
    queryFn: () => fetchClusterData(clusterId),
    staleTime: 60_000,
  });

  const cluster = data?.cluster;
  const articles = data?.articles || [];
  const unifiedTrend = data?.unifiedTrend;
  const suggestedActions = data?.suggestedActions || [];

  const stageConfig = STAGE_CONFIG[(cluster?.trend_stage as keyof typeof STAGE_CONFIG) || 'stable'];
  const StageIcon = stageConfig.icon;

  // Calculate source distribution percentages
  const totalSources = (cluster?.google_news_count || 0) + 
    (cluster?.reddit_count || 0) + 
    (cluster?.bluesky_count || 0) + 
    (cluster?.rss_count || 0);

  const sourceBreakdown = [
    { name: 'Google News', count: cluster?.google_news_count || 0, color: 'bg-blue-500' },
    { name: 'RSS Feeds', count: cluster?.rss_count || 0, color: 'bg-purple-500' },
    { name: 'Reddit', count: cluster?.reddit_count || 0, color: 'bg-orange-500' },
    { name: 'Bluesky', count: cluster?.bluesky_count || 0, color: 'bg-sky-500' },
  ].filter(s => s.count > 0);

  const issueAreas = useMemo(() => {
    const areas = articles
      .map((article) => article.relevance_category)
      .filter((category): category is string => !!category);
    return Array.from(new Set(areas));
  }, [articles]);

  const citations = useMemo(() => {
    return articles.slice(0, 5).map((article) => ({
      title: article.title,
      source: article.source_name,
      url: article.source_url,
      sourceType: 'news' as const,
      publishedAt: article.published_date,
    }));
  }, [articles]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Trends
        </Button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Trends
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-medium text-muted-foreground">Cluster not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              The trend "{clusterId}" could not be found or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Trends
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Add to Watchlist
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bell className="h-4 w-4" />
            Create Alert
          </Button>
          <Button variant="default" size="sm" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Generate Action
          </Button>
        </div>
      </div>

      {/* Title & Status */}
      <div className="flex items-start gap-4">
        <div className={cn("p-3 rounded-lg", stageConfig.bgColor)}>
          {cluster.is_breaking ? (
            <Zap className="h-6 w-6 text-status-error animate-pulse" />
          ) : (
            <StageIcon className={cn("h-6 w-6", stageConfig.color)} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{cluster.cluster_title}</h1>
            {cluster.is_breaking && (
              <Badge variant="destructive">BREAKING</Badge>
            )}
            {cluster.is_trending && !cluster.is_breaking && (
              <Badge variant="outline" className={cn(stageConfig.bgColor, stageConfig.color)}>
                {stageConfig.label}
              </Badge>
            )}
            {cluster.entity_type && (
              <Badge variant="secondary" className="text-xs capitalize">
                {cluster.entity_type}
              </Badge>
            )}
          </div>
          {cluster.cluster_summary && (
            <p className="text-muted-foreground mt-1">{cluster.cluster_summary}</p>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{cluster.mentions_last_24h.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Mentions (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{cluster.mentions_last_hour}</div>
            <p className="text-xs text-muted-foreground">Mentions (1h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className={cn(
              "text-2xl font-bold",
              cluster.velocity_score > 0 ? "text-status-success" : 
              cluster.velocity_score < 0 ? "text-status-error" : ""
            )}>
              {cluster.velocity_score > 0 ? '+' : ''}{cluster.velocity_score}
            </div>
            <p className="text-xs text-muted-foreground">Velocity Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{sourceBreakdown.length}</div>
            <p className="text-xs text-muted-foreground">Source Types</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="explainability" className="w-full">
        <TabsList>
          <TabsTrigger value="explainability">Why Trending</TabsTrigger>
          <TabsTrigger value="articles">Articles ({articles.length})</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="explainability" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision Context</CardTitle>
              <CardDescription>
                Understanding why this trend appeared and its confidence level
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unifiedTrend && (
                <TrendExplainability trend={unifiedTrend} defaultExpanded />
              )}

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RelevanceExplanation
                  data={{
                    issueAreas,
                    citations,
                  }}
                />
                <ProvenancePanel
                  distribution={{
                    rss: cluster.rss_count || 0,
                    google_news: cluster.google_news_count || 0,
                    bluesky: cluster.bluesky_count || 0,
                  }}
                  topSources={citations}
                  timeWindow="last 24 hours"
                  totalMentions={cluster.mentions_last_24h}
                />
              </div>

              <div className="mt-6">
                <SuggestedActionsPanel actions={suggestedActions} />
              </div>

              {/* Related Topics */}
              {cluster.related_topics && cluster.related_topics.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Related Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {cluster.related_topics.map((topic, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contributing Articles</CardTitle>
              <CardDescription>
                Articles that contributed to this trend
              </CardDescription>
            </CardHeader>
            <CardContent>
              {articles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No articles found for this trend</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {articles.map((article) => (
                      <div 
                        key={article.id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-2">{article.title}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{article.source_name}</span>
                              <span>•</span>
                              <span>{formatTimeAgo(article.published_date)}</span>
                              {article.sentiment_label && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {article.sentiment_label}
                                  </Badge>
                                </>
                              )}
                            </div>
                            {article.ai_summary && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {article.ai_summary}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => window.open(article.source_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Distribution</CardTitle>
              <CardDescription>
                Where the mentions are coming from
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Visual bar */}
                <div className="h-4 rounded-full overflow-hidden flex bg-muted">
                  {sourceBreakdown.map((source, i) => (
                    <div
                      key={i}
                      className={cn("h-full", source.color)}
                      style={{ width: `${(source.count / totalSources) * 100}%` }}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="space-y-3">
                  {sourceBreakdown.map((source, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", source.color)} />
                        <span className="text-sm">{source.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {source.count.toLocaleString()} ({Math.round((source.count / totalSources) * 100)}%)
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cross-source score */}
                {cluster.cross_source_score !== null && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Cross-Source Score</span>
                      <Badge variant="outline">
                        {cluster.cross_source_score}/4
                      </Badge>
                    </div>
                    <Progress 
                      value={(cluster.cross_source_score / 4) * 100} 
                      className="h-2 mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Higher scores indicate confirmation across multiple independent sources
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trend Timeline</CardTitle>
              <CardDescription>
                Key moments in this trend's lifecycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {/* First seen */}
                {cluster.first_seen_at && (
                  <div className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-status-success/20 flex items-center justify-center z-10">
                      <Eye className="h-4 w-4 text-status-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">First Detected</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(cluster.first_seen_at)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Trending since */}
                {cluster.trending_since && (
                  <div className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-status-warning/20 flex items-center justify-center z-10">
                      <TrendingUp className="h-4 w-4 text-status-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Started Trending</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(cluster.trending_since)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Peak */}
                {cluster.peak_at && (
                  <div className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-status-error/20 flex items-center justify-center z-10">
                      <BarChart3 className="h-4 w-4 text-status-error" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Peak Activity</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(cluster.peak_at)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Last updated */}
                <div className="flex items-start gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Last Updated</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(cluster.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
