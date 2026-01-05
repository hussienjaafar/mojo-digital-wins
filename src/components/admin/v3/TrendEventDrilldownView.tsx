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
  Calendar,
  Activity,
  Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { TrendExplainability } from './TrendEventExplainability';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ProvenancePanel, RelevanceExplanation, SuggestedActionsPanel } from '@/components/admin/v3';
import type { TrendEvent, TrendEvidence } from '@/hooks/useTrendEvents';

interface TrendEventDrilldownViewProps {
  trendId: string; // trend_event id (UUID)
  onBack: () => void;
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

async function fetchTrendEventData(trendId: string): Promise<{
  trend: TrendEvent | null;
  evidence: TrendEvidence[];
  suggestedActions: SuggestedActionCard[];
}> {
  // Fetch trend event by ID
  const { data: trendData, error: trendError } = await supabase
    .from('trend_events')
    .select('*')
    .eq('id', trendId)
    .limit(1)
    .single();

  if (trendError && trendError.code !== 'PGRST116') {
    console.error('Error fetching trend event:', trendError);
  }

  const trend = trendData as TrendEvent | null;

  // Fetch evidence for this trend
  const { data: evidenceData, error: evidenceError } = await supabase
    .from('trend_evidence')
    .select('*')
    .eq('event_id', trendId)
    .order('is_primary', { ascending: false })
    .order('contribution_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(30);

  if (evidenceError) {
    console.error('Error fetching evidence:', evidenceError);
  }

  const evidence = (evidenceData || []) as TrendEvidence[];

  // Fetch suggested actions related to this trend
  let suggestedActions: SuggestedActionCard[] = [];
  if (trend) {
    const { data: actionsData, error: actionsError } = await supabase
      .from('suggested_actions')
      .select('id, action_type, suggested_copy, value_prop, urgency_score, decision_score, entity_name, estimated_impact')
      .ilike('entity_name', `%${trend.event_title}%`)
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
        trendId: trend.id,
        trendName: trend.event_title,
      }));
    }
  }

  return { trend, evidence, suggestedActions };
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

function getSourceIcon(sourceType: string) {
  switch (sourceType.toLowerCase()) {
    case 'google_news':
    case 'rss':
    case 'article':
      return Newspaper;
    case 'bluesky':
      return MessageCircle;
    default:
      return Radio;
  }
}

function formatSourceType(type: string): string {
  switch (type) {
    case 'google_news': return 'Google News';
    case 'rss': 
    case 'article': return 'RSS/News';
    case 'bluesky': return 'Bluesky';
    default: return type;
  }
}

export function TrendEventDrilldownView({ trendId, onBack }: TrendEventDrilldownViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['trend-event-drilldown', trendId],
    queryFn: () => fetchTrendEventData(trendId),
    staleTime: 60_000,
  });

  const trend = data?.trend;
  const evidence = data?.evidence || [];
  const suggestedActions = data?.suggestedActions || [];

  const stageConfig = STAGE_CONFIG[(trend?.trend_stage as keyof typeof STAGE_CONFIG) || 'stable'];
  const StageIcon = stageConfig.icon;

  // Calculate baseline delta
  const baselineDelta = trend && trend.baseline_7d > 0 
    ? ((trend.current_1h - trend.baseline_7d) / trend.baseline_7d * 100)
    : 0;

  // Group evidence by source type for provenance
  const evidenceBySource = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const e of evidence) {
      const type = e.source_type || 'unknown';
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }, [evidence]);

  // Build citations for RelevanceExplanation
  const citations = useMemo(() => {
    return evidence.slice(0, 5).map((e) => ({
      title: e.source_title || 'Untitled',
      source: e.source_domain || formatSourceType(e.source_type),
      url: e.source_url || '',
      sourceType: e.source_type === 'bluesky' ? 'social' as const : 'news' as const,
      publishedAt: e.published_at || '',
    }));
  }, [evidence]);

  // Extract unique issue areas from evidence
  const issueAreas = useMemo(() => {
    // For now, derive from trend title keywords
    const keywords = trend?.event_title?.split(' ').filter(w => w.length > 4) || [];
    return keywords.slice(0, 3);
  }, [trend]);

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

  if (error || !trend) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Trends
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-medium text-muted-foreground">Trend not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              The trend could not be found or has expired.
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
          {trend.is_breaking ? (
            <Zap className="h-6 w-6 text-status-error animate-pulse" />
          ) : (
            <StageIcon className={cn("h-6 w-6", stageConfig.color)} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{trend.event_title}</h1>
            {trend.is_breaking && (
              <Badge variant="destructive">BREAKING</Badge>
            )}
            {trend.is_trending && !trend.is_breaking && (
              <Badge variant="outline" className={cn(stageConfig.bgColor, stageConfig.color)}>
                {stageConfig.label}
              </Badge>
            )}
          </div>
          {trend.top_headline && (
            <p className="text-muted-foreground mt-1 line-clamp-2">{trend.top_headline}</p>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{trend.current_24h.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Mentions (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className={cn(
              "text-2xl font-bold",
              baselineDelta > 0 ? "text-status-success" : 
              baselineDelta < 0 ? "text-status-error" : ""
            )}>
              {baselineDelta > 0 ? '+' : ''}{Math.round(baselineDelta)}%
            </div>
            <p className="text-xs text-muted-foreground">vs 7d Baseline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{trend.confidence_score}%</div>
            <p className="text-xs text-muted-foreground">Confidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{trend.source_count}</div>
            <p className="text-xs text-muted-foreground">Source Types</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="explainability" className="w-full">
        <TabsList>
          <TabsTrigger value="explainability">Why Trending</TabsTrigger>
          <TabsTrigger value="evidence">Evidence ({evidence.length})</TabsTrigger>
          <TabsTrigger value="velocity">Velocity</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="explainability" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision Context</CardTitle>
              <CardDescription>
                Evidence-based explainability for this trend event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendExplainability trend={trend} defaultExpanded />

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RelevanceExplanation
                  data={{
                    issueAreas,
                    citations,
                  }}
                />
                <ProvenancePanel
                  distribution={{
                    rss: evidenceBySource['rss'] || evidenceBySource['article'] || 0,
                    google_news: evidenceBySource['google_news'] || 0,
                    bluesky: evidenceBySource['bluesky'] || 0,
                  }}
                  topSources={citations}
                  timeWindow="last 24 hours"
                  totalMentions={trend.evidence_count}
                />
              </div>

              <div className="mt-6">
                <SuggestedActionsPanel actions={suggestedActions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence Documents</CardTitle>
              <CardDescription>
                Sources that contributed to this trend's detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evidence.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No evidence documents found</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {evidence.map((e) => {
                      const SourceIcon = getSourceIcon(e.source_type);
                      return (
                        <div 
                          key={e.id} 
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border",
                            e.is_primary && "bg-primary/5 border-primary/20"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg",
                            e.is_primary ? "bg-primary/10" : "bg-muted"
                          )}>
                            <SourceIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{e.source_title || 'Untitled'}</p>
                              {e.is_primary && (
                                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{e.source_domain || formatSourceType(e.source_type)}</span>
                              {e.published_at && (
                                <>
                                  <span>•</span>
                                  <span>{formatTimeAgo(e.published_at)}</span>
                                </>
                              )}
                              {e.contribution_score > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Score: {e.contribution_score.toFixed(1)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {e.source_url && (
                            <a 
                              href={e.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="shrink-0 p-2 hover:bg-muted rounded-lg"
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="velocity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Velocity Analysis</CardTitle>
              <CardDescription>
                Trend momentum and acceleration metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <Activity className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{trend.current_1h}</p>
                  <p className="text-xs text-muted-foreground">Last Hour</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{trend.current_6h}</p>
                  <p className="text-xs text-muted-foreground">Last 6 Hours</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{Math.round(trend.velocity)}%</p>
                  <p className="text-xs text-muted-foreground">Velocity</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className={cn(
                    "text-2xl font-bold",
                    trend.acceleration > 20 ? "text-status-success" :
                    trend.acceleration < -20 ? "text-status-error" : ""
                  )}>
                    {trend.acceleration > 0 ? '+' : ''}{Math.round(trend.acceleration)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Acceleration</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <h4 className="font-medium text-sm">Baseline Comparison</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">7-Day Average</p>
                    <p className="text-xl font-bold">{trend.baseline_7d.toFixed(1)}/hr</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">30-Day Average</p>
                    <p className="text-xl font-bold">{trend.baseline_30d.toFixed(1)}/hr</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2 text-sm text-muted-foreground border-t pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>First seen: {formatTimeAgo(trend.first_seen_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Last updated: {formatTimeAgo(trend.last_seen_at)}</span>
                </div>
                {trend.peak_at && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Peak: {formatTimeAgo(trend.peak_at)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Suggested Actions</CardTitle>
              <CardDescription>
                AI-generated action recommendations based on this trend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SuggestedActionsPanel actions={suggestedActions} />
              
              {suggestedActions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No suggested actions yet</p>
                  <p className="text-sm mt-1">Actions will be generated based on trend analysis</p>
                  <Button className="mt-4 gap-2">
                    <Zap className="h-4 w-4" />
                    Generate Actions Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
