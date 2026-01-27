import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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
  Calendar,
  Activity,
  Radio,
  Target,
  Timer,
  Search,
  MessageSquare,
  Send,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Users,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { TrendExplainability } from './TrendEventExplainability';
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle, V3CardDescription, type V3CardAccent } from '@/components/v3/V3Card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInMinutes, differenceInHours } from 'date-fns';
import { ProvenancePanel } from './ProvenancePanel';
import { RelevanceExplanation } from './RelevanceExplanation';
import { SuggestedActionsPanel } from './SuggestedActionsPanel';
import { CampaignLaunchPanel } from './CampaignLaunchPanel';
import type { TrendEvent, TrendEvidence } from '@/hooks/useTrendEvents';
import { generateWhyTrendingSummary, getTierLabel } from '@/hooks/useTrendEvents';
import { useTrendActionTracking } from '@/hooks/useTrendActionTracking';
import { useToast } from '@/hooks/use-toast';

type DrilldownMode = 'investigate' | 'act';

interface TrendEventDrilldownViewProps {
  trendId: string;
  onBack: () => void;
  initialMode?: DrilldownMode;
  organizationId?: string;
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

const STAGE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof TrendingUp; accent: V3CardAccent }> = {
  emerging: { label: 'Emerging', color: 'text-[hsl(var(--portal-success))]', bgColor: 'bg-[hsl(var(--portal-success))]/10', icon: TrendingUp, accent: 'green' },
  surging: { label: 'Surging', color: 'text-[hsl(var(--portal-warning))]', bgColor: 'bg-[hsl(var(--portal-warning))]/10', icon: TrendingUp, accent: 'amber' },
  peaking: { label: 'Peaking', color: 'text-[hsl(var(--portal-error))]', bgColor: 'bg-[hsl(var(--portal-error))]/10', icon: TrendingUp, accent: 'red' },
  declining: { label: 'Declining', color: 'text-[hsl(var(--portal-text-tertiary))]', bgColor: 'bg-[hsl(var(--portal-bg-elevated))]', icon: TrendingDown, accent: 'default' },
  stable: { label: 'Stable', color: 'text-[hsl(var(--portal-text-secondary))]', bgColor: 'bg-[hsl(var(--portal-bg-elevated))]', icon: Minus, accent: 'default' },
};

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

function formatTrendingDuration(firstSeenAt: string | null): string {
  if (!firstSeenAt) return 'Unknown duration';
  try {
    const start = new Date(firstSeenAt);
    const now = new Date();
    const mins = differenceInMinutes(now, start);
    const hrs = differenceInHours(now, start);
    
    if (mins < 60) return `${mins}m`;
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
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

export function TrendEventDrilldownView({ 
  trendId, 
  onBack, 
  initialMode = 'investigate',
  organizationId 
}: TrendEventDrilldownViewProps) {
  const [mode, setMode] = useState<DrilldownMode>(initialMode);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  const { trackAction } = useTrendActionTracking();

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
    const keywords = trend?.event_title?.split(' ').filter(w => w.length > 4) || [];
    return keywords.slice(0, 3);
  }, [trend]);

  // Action handlers with tracking
  const handleCopyMessage = async () => {
    if (generatedMessage) {
      await navigator.clipboard.writeText(generatedMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      
      if (organizationId && trend) {
        await trackAction({
          trendEventId: trend.id,
          organizationId,
          actionType: 'sms',
          metadata: { action: 'copy_message' },
        });
      }
      
      toast({ title: 'Copied to clipboard' });
    }
  };

  const handleCreateAlert = async () => {
    if (organizationId && trend) {
      await trackAction({
        trendEventId: trend.id,
        organizationId,
        actionType: 'alert',
      });
    }
    toast({ title: 'Alert created', description: `You'll be notified about ${trend?.event_title}` });
  };

  const handleAddToWatchlist = async () => {
    if (organizationId && trend) {
      await trackAction({
        trendEventId: trend.id,
        organizationId,
        actionType: 'watchlist',
      });
    }
    toast({ title: 'Added to watchlist' });
  };

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
        <V3Card>
          <V3CardContent className="py-12 text-center">
            <Eye className="h-12 w-12 mx-auto mb-3 text-[hsl(var(--portal-text-tertiary))] opacity-30" />
            <p className="font-medium text-[hsl(var(--portal-text-secondary))]">Trend not found</p>
            <p className="text-sm text-[hsl(var(--portal-text-tertiary))] mt-1">
              The trend could not be found or has expired.
            </p>
          </V3CardContent>
        </V3Card>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header with Mode Toggle */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Trends
        </Button>
        
        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border p-1 bg-muted/30">
            <Button 
              variant={mode === 'investigate' ? 'default' : 'ghost'} 
              size="sm" 
              className="gap-1.5 h-8"
              onClick={() => setMode('investigate')}
            >
              <Search className="h-3.5 w-3.5" />
              Investigate
            </Button>
            <Button 
              variant={mode === 'act' ? 'default' : 'ghost'} 
              size="sm" 
              className="gap-1.5 h-8"
              onClick={() => setMode('act')}
            >
              <Zap className="h-3.5 w-3.5" />
              Act
            </Button>
          </div>
        </div>
      </div>

      {/* Title & Status */}
      <V3Card accent={trend.is_breaking ? 'red' : stageConfig.accent}>
        <V3CardHeader className="pb-0">
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-lg", stageConfig.bgColor)}>
              {trend.is_breaking ? (
                <Zap className="h-6 w-6 text-[hsl(var(--portal-error))] animate-pulse" />
              ) : (
                <StageIcon className={cn("h-6 w-6", stageConfig.color)} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.event_title}</h1>
                {trend.is_breaking && (
                  <Badge className="bg-[hsl(var(--portal-error))] text-white">BREAKING</Badge>
                )}
                {trend.is_trending && !trend.is_breaking && (
                  <Badge variant="outline" className={cn(stageConfig.bgColor, stageConfig.color, "border-0")}>
                    {stageConfig.label}
                  </Badge>
                )}
                {/* Trending Duration Indicator */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="gap-1 text-[hsl(var(--portal-text-secondary))] border-[hsl(var(--portal-border))]">
                        <Timer className="h-3 w-3" />
                        {formatTrendingDuration(trend.first_seen_at)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Trending for {formatTrendingDuration(trend.first_seen_at)}</p>
                      <p className="text-xs text-muted-foreground">First seen: {formatTimeAgo(trend.first_seen_at)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {trend.top_headline && (
                <p className="text-[hsl(var(--portal-text-secondary))] mt-2 line-clamp-2">{trend.top_headline}</p>
              )}
            </div>
          </div>
        </V3CardHeader>
        <V3CardContent className="pt-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.current_24h.toLocaleString()}</div>
              <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Mentions (24h)</p>
            </div>
            <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "text-2xl font-bold cursor-help",
                      baselineDelta > 0 ? "text-[hsl(var(--portal-success))]" : 
                      baselineDelta < 0 ? "text-[hsl(var(--portal-error))]" : "text-[hsl(var(--portal-text-primary))]"
                    )}>
                      {baselineDelta > 0 ? '+' : ''}{Math.round(baselineDelta)}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Current: {trend.current_1h}/hr</p>
                    <p>Baseline: {trend.baseline_7d.toFixed(1)}/hr</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">vs 7d Baseline</p>
            </div>
            <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.confidence_score}%</div>
              <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Confidence</p>
            </div>
            <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.source_count}</div>
              <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Source Types</p>
            </div>
          </div>
        </V3CardContent>
      </V3Card>

      {/* Mode-based Content */}
      <AnimatePresence mode="wait">
        {mode === 'investigate' ? (
          <motion.div
            key="investigate"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <Tabs defaultValue="context" className="w-full">
              <TabsList>
                <TabsTrigger value="context">Decision Context</TabsTrigger>
                <TabsTrigger value="evidence">Evidence ({evidence.length})</TabsTrigger>
                <TabsTrigger value="velocity">Velocity</TabsTrigger>
              </TabsList>

              <TabsContent value="context" className="mt-4">
                <V3Card>
                  <V3CardHeader>
                    <V3CardTitle className="text-base">Decision Context</V3CardTitle>
                    <V3CardDescription>
                      Evidence-based explainability for this trend event
                    </V3CardDescription>
                  </V3CardHeader>
                  <V3CardContent className="pt-0">
                    <div className="mb-6 p-4 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10 border border-[hsl(var(--portal-accent-blue))]/20">
                      <div className="flex items-start gap-3">
                        <Target className="h-5 w-5 text-[hsl(var(--portal-accent-blue))] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Why This Is Trending</p>
                          <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-1">{generateWhyTrendingSummary(trend)}</p>
                        </div>
                      </div>
                    </div>
                    
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
                  </V3CardContent>
                </V3Card>
              </TabsContent>

              <TabsContent value="evidence" className="mt-4">
                <V3Card>
                  <V3CardHeader>
                    <V3CardTitle className="text-base">Evidence Documents</V3CardTitle>
                    <V3CardDescription>
                      Sources that contributed to this trend's detection
                    </V3CardDescription>
                  </V3CardHeader>
                  <V3CardContent className="pt-0">
                    {evidence.length === 0 ? (
                      <div className="text-center py-8 text-[hsl(var(--portal-text-secondary))]">
                        <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No evidence documents found</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3 pr-4">
                          {evidence.map((e) => {
                            const SourceIcon = getSourceIcon(e.source_type);
                            const tierInfo = getTierLabel(e.source_tier);
                            return (
                              <div 
                                key={e.id} 
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-lg border border-[hsl(var(--portal-border))]",
                                  e.is_primary && "bg-[hsl(var(--portal-accent-blue))]/5 border-[hsl(var(--portal-accent-blue))]/20"
                                )}
                              >
                                <div className={cn(
                                  "p-2 rounded-lg",
                                  e.is_primary ? "bg-[hsl(var(--portal-accent-blue))]/10" : "bg-[hsl(var(--portal-bg-elevated))]"
                                )}>
                                  <SourceIcon className="h-4 w-4 text-[hsl(var(--portal-text-secondary))]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm truncate text-[hsl(var(--portal-text-primary))]">{e.source_title || 'Untitled'}</p>
                                    {e.source_tier && (
                                      <Badge variant="outline" className={cn("text-[10px]", tierInfo.color)}>
                                        {tierInfo.label}
                                      </Badge>
                                    )}
                                    {e.is_primary && (
                                      <Badge variant="outline" className="text-[10px] bg-[hsl(var(--portal-accent-blue))]/10 text-[hsl(var(--portal-accent-blue))] border-0">
                                        Primary
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--portal-text-tertiary))]">
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
                                {(e.source_url || e.canonical_url) && (
                                  <a 
                                    href={e.canonical_url || e.source_url || ''} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="shrink-0 p-2 hover:bg-[hsl(var(--portal-bg-elevated))] rounded-lg transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4 text-[hsl(var(--portal-text-tertiary))] hover:text-[hsl(var(--portal-text-primary))]" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </V3CardContent>
                </V3Card>
              </TabsContent>

              <TabsContent value="velocity" className="mt-4">
                <V3Card>
                  <V3CardHeader>
                    <V3CardTitle className="text-base">Velocity Analysis</V3CardTitle>
                    <V3CardDescription>
                      Trend momentum and acceleration metrics
                    </V3CardDescription>
                  </V3CardHeader>
                  <V3CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center border border-[hsl(var(--portal-border))]">
                        <Activity className="h-5 w-5 mx-auto mb-2 text-[hsl(var(--portal-text-secondary))]" />
                        <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.current_1h}</p>
                        <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Last Hour</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center border border-[hsl(var(--portal-border))]">
                        <Clock className="h-5 w-5 mx-auto mb-2 text-[hsl(var(--portal-text-secondary))]" />
                        <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.current_6h}</p>
                        <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Last 6 Hours</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center border border-[hsl(var(--portal-border))]">
                        <TrendingUp className="h-5 w-5 mx-auto mb-2 text-[hsl(var(--portal-text-secondary))]" />
                        <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{Math.round(trend.velocity)}%</p>
                        <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Velocity</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center border border-[hsl(var(--portal-border))]">
                        <BarChart3 className="h-5 w-5 mx-auto mb-2 text-[hsl(var(--portal-text-secondary))]" />
                        <p className={cn(
                          "text-2xl font-bold",
                          trend.acceleration > 20 ? "text-[hsl(var(--portal-success))]" :
                          trend.acceleration < -20 ? "text-[hsl(var(--portal-error))]" : "text-[hsl(var(--portal-text-primary))]"
                        )}>
                          {trend.acceleration > 0 ? '+' : ''}{Math.round(trend.acceleration)}%
                        </p>
                        <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Acceleration</p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <h4 className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">Baseline Comparison</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-[hsl(var(--portal-border))]">
                          <p className="text-sm text-[hsl(var(--portal-text-secondary))]">7-Day Average</p>
                          <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.baseline_7d.toFixed(1)}/hr</p>
                        </div>
                        <div className="p-4 rounded-lg border border-[hsl(var(--portal-border))]">
                          <p className="text-sm text-[hsl(var(--portal-text-secondary))]">30-Day Average</p>
                          <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">{trend.baseline_30d.toFixed(1)}/hr</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2 text-sm text-[hsl(var(--portal-text-secondary))] border-t border-[hsl(var(--portal-border))] pt-4">
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
                  </V3CardContent>
                </V3Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : (
          /* ACT MODE */
          <motion.div
            key="act"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Quick Actions Bar */}
            <V3Card>
              <V3CardContent className="py-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={handleAddToWatchlist}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add to Watchlist
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={handleCreateAlert}
                  >
                    <Bell className="h-4 w-4" />
                    Create Alert
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Users className="h-4 w-4" />
                    Assign to Team
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </V3CardContent>
            </V3Card>

            {/* Suggested Actions */}
            <V3Card accent="green">
              <V3CardHeader>
                <V3CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                  Suggested Actions
                </V3CardTitle>
                <V3CardDescription>
                  AI-generated recommendations based on this trend
                </V3CardDescription>
              </V3CardHeader>
              <V3CardContent className="pt-0">
                <SuggestedActionsPanel actions={suggestedActions} />
                
                {suggestedActions.length === 0 && (
                  <div className="text-center py-8 text-[hsl(var(--portal-text-secondary))]">
                    <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No suggested actions yet</p>
                    <p className="text-sm mt-1">Actions will be generated based on trend analysis</p>
                    <Button className="mt-4 gap-2">
                      <Zap className="h-4 w-4" />
                      Generate Actions Now
                    </Button>
                  </div>
                )}
              </V3CardContent>
            </V3Card>

            {/* Campaign Launcher */}
            <CampaignLaunchPanel
              trendId={trend.id}
              trendTitle={trend.event_title}
              organizationId={organizationId}
              opportunityContext={trend.top_headline || `Breaking trend: ${trend.event_title}`}
            />

            {/* Risk Warning (if applicable) */}
            {trend.is_breaking && (
              <V3Card accent="amber">
                <V3CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-[hsl(var(--portal-warning))] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Breaking News Advisory</p>
                      <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-1">
                        This trend is developing rapidly. Consider waiting for additional confirmation before major messaging decisions.
                      </p>
                    </div>
                  </div>
                </V3CardContent>
              </V3Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
