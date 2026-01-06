import { 
  TrendingUp, 
  Users, 
  Clock, 
  Zap, 
  ShieldCheck, 
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Newspaper,
  MessageCircle,
  Radio,
  Activity,
  BarChart3,
  Target
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { TrendEvent, TrendEvidence } from '@/hooks/useTrendEvents';
import { useTrendEvidence, getConfidenceLabel, getConfidenceColor, getTrendStageInfo } from '@/hooks/useTrendEvents';

interface TrendExplainabilityProps {
  trend: TrendEvent;
  className?: string;
  defaultExpanded?: boolean;
}

type TriggerType = 'breaking' | 'baseline_spike' | 'cross_source' | 'velocity_surge' | 'emerging';

interface TriggerExplanation {
  type: TriggerType;
  label: string;
  description: string;
  icon: typeof TrendingUp;
  color: string;
  bgColor: string;
}

function getTriggerExplanation(trend: TrendEvent): TriggerExplanation {
  // Twitter-like ranking: velocity vs baseline is PRIMARY
  const zScore = trend.z_score_velocity || 0;
  const baselineDeltaPct = trend.confidence_factors?.baseline_delta_pct 
    ?? (trend.baseline_7d > 0 
      ? ((trend.current_1h - trend.baseline_7d) / trend.baseline_7d * 100) 
      : trend.current_1h * 100);
  
  // Breaking: highest priority (extreme velocity + corroboration)
  if (trend.is_breaking) {
    return {
      type: 'breaking',
      label: 'Breaking',
      description: `${Math.round(baselineDeltaPct)}% above baseline with ${trend.source_count} sources confirming`,
      icon: Zap,
      color: 'text-status-error',
      bgColor: 'bg-status-error/10',
    };
  }

  // Velocity spike: primary ranking signal
  if (zScore >= 3 || baselineDeltaPct > 300) {
    return {
      type: 'velocity_surge',
      label: 'Velocity Spike',
      description: `${Math.round(baselineDeltaPct)}% above 7-day baseline (${zScore.toFixed(1)}σ spike)`,
      icon: TrendingUp,
      color: 'text-status-error',
      bgColor: 'bg-status-error/10',
    };
  }

  // Baseline spike: significant but not extreme
  if (zScore >= 2 || baselineDeltaPct > 200) {
    return {
      type: 'baseline_spike',
      label: 'Baseline Spike',
      description: `${Math.round(baselineDeltaPct)}% above normal (baseline: ${trend.baseline_7d.toFixed(1)}/hr)`,
      icon: BarChart3,
      color: 'text-status-warning',
      bgColor: 'bg-status-warning/10',
    };
  }

  // Cross-source corroboration: secondary boost
  if (trend.source_count >= 2 && (trend.news_source_count >= 1 && trend.social_source_count >= 1)) {
    return {
      type: 'cross_source',
      label: 'Cross-Source',
      description: `Verified across news + social (${Math.round(baselineDeltaPct)}% vs baseline)`,
      icon: Users,
      color: 'text-status-success',
      bgColor: 'bg-status-success/10',
    };
  }

  // Moderate velocity: above baseline but not spiking
  if (zScore >= 1 || baselineDeltaPct > 100) {
    return {
      type: 'velocity_surge',
      label: 'Rising',
      description: `${Math.round(baselineDeltaPct)}% above expected rate`,
      icon: TrendingUp,
      color: 'text-status-info',
      bgColor: 'bg-status-info/10',
    };
  }

  // Emerging: new topic with momentum
  if (trend.trend_stage === 'emerging') {
    return {
      type: 'emerging',
      label: 'Emerging',
      description: `New topic with ${trend.acceleration > 0 ? 'accelerating' : 'steady'} momentum`,
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    };
  }

  // Default: trending but not spiking
  return {
    type: 'velocity_surge',
    label: 'Trending',
    description: `${trend.current_24h} mentions, ${Math.round(baselineDeltaPct)}% vs baseline`,
    icon: Radio,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10',
  };
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

function getSourceIcon(type: string) {
  switch (type) {
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

export function TrendExplainability({ trend, className, defaultExpanded = false }: TrendExplainabilityProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const { evidence, isLoading: evidenceLoading } = useTrendEvidence(isOpen ? trend.id : null);
  
  const trigger = getTriggerExplanation(trend);
  const TriggerIcon = trigger.icon;
  const stageInfo = getTrendStageInfo(trend.trend_stage);
  
  // Velocity-based metrics (primary ranking factors)
  const zScore = trend.z_score_velocity || 0;
  const trendScore = trend.trend_score || 0;
  const baselineDelta = trend.confidence_factors?.baseline_delta_pct 
    ?? (trend.baseline_7d > 0 
      ? ((trend.current_1h - trend.baseline_7d) / trend.baseline_7d * 100)
      : 0);

  // Time since first seen
  const firstSeenDate = new Date(trend.first_seen_at);
  const hoursAgo = Math.floor((Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60));

  // Confidence factors (with fallback)
  const factors = trend.confidence_factors || {
    baseline_delta: 0,
    cross_source: 0,
    volume: 0,
    velocity: 0,
    z_score: 0,
    trend_score: 0
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="space-y-2">
        {/* Header row - always visible */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Trigger badge */}
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn("gap-1.5 text-xs", trigger.bgColor, trigger.color)}
            >
              <TriggerIcon className="h-3 w-3" />
              {trigger.label}
            </Badge>
            
            <Badge 
              variant="outline" 
              className={cn("gap-1 text-xs", stageInfo.bgColor, stageInfo.color)}
            >
              {stageInfo.label}
            </Badge>
          </div>

          {/* Confidence score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs font-mono",
                getConfidenceColor(trend.confidence_score)
              )}
            >
              {trend.confidence_score}%
            </Badge>
          </div>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
              Why?
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Expanded content */}
        <CollapsibleContent className="space-y-3">
          {/* Trigger explanation */}
          <div className={cn("rounded-md p-3 text-sm", trigger.bgColor)}>
            <div className="flex items-start gap-2">
              <TriggerIcon className={cn("h-4 w-4 mt-0.5 shrink-0", trigger.color)} />
              <div>
                <p className={cn("font-medium", trigger.color)}>{trigger.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{trigger.description}</p>
              </div>
            </div>
          </div>

          {/* Key metrics - Velocity-based (Twitter-like ranking) */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className={cn(
                "text-lg font-semibold",
                zScore >= 3 ? "text-status-error" :
                zScore >= 2 ? "text-status-warning" :
                zScore >= 1 ? "text-status-info" : ""
              )}>
                {zScore >= 0 ? '+' : ''}{zScore.toFixed(1)}σ
              </p>
              <p className="text-muted-foreground">Spike</p>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className={cn(
                "text-lg font-semibold",
                baselineDelta > 300 ? "text-status-error" :
                baselineDelta > 200 ? "text-status-warning" :
                baselineDelta > 100 ? "text-status-info" : ""
              )}>
                {baselineDelta > 0 ? '+' : ''}{Math.round(baselineDelta)}%
              </p>
              <p className="text-muted-foreground">vs Baseline</p>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-lg font-semibold">{trend.source_count}</p>
              <p className="text-muted-foreground">Sources</p>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-lg font-semibold">{Math.round(trendScore)}</p>
              <p className="text-muted-foreground">Score</p>
            </div>
          </div>

          {/* Velocity breakdown */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md bg-muted/20 p-2">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">1h</span>
              </div>
              <p className="font-medium">{trend.current_1h} mentions</p>
              <p className="text-muted-foreground">baseline: {trend.baseline_7d.toFixed(1)}/hr</p>
            </div>
            <div className="rounded-md bg-muted/20 p-2">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">6h</span>
              </div>
              <p className="font-medium">{trend.current_6h} mentions</p>
              <p className="text-muted-foreground">{Math.round(trend.velocity_6h)}% velocity</p>
            </div>
            <div className="rounded-md bg-muted/20 p-2">
              <div className="flex items-center gap-1 mb-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Accel</span>
              </div>
              <p className="font-medium">
                {trend.acceleration > 0 ? '+' : ''}{Math.round(trend.acceleration)}%
              </p>
              <p className="text-muted-foreground">
                {trend.acceleration > 20 ? 'Speeding up' : trend.acceleration < -20 ? 'Slowing' : 'Steady'}
              </p>
            </div>
          </div>

          {/* Ranking Formula Breakdown (Twitter-like) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Why Trending (Velocity-Based Ranking)
            </p>
            <div className="text-xs space-y-1.5 bg-muted/20 rounded-md p-2">
              <div className="flex justify-between">
                <span>Velocity vs Baseline (z-score × 10)</span>
                <span className="font-mono">{(zScore * 10).toFixed(0)} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Cross-Source Boost</span>
                <span className="font-mono">
                  {trend.source_count >= 2 
                    ? (15 + (trend.news_source_count >= 1 && trend.social_source_count >= 1 ? 15 : 0))
                    : 0} pts
                </span>
              </div>
              <div className="flex justify-between">
                <span>Volume Bonus</span>
                <span className="font-mono">{Math.min(20, Math.round(Math.log2(trend.current_24h + 1) * 5))} pts</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1 font-medium">
                <span>Total Trend Score</span>
                <span className="font-mono">{Math.round(trendScore)} pts</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {trend.confidence_factors?.meets_volume_gate === false 
                ? "⚠️ Below minimum volume threshold" 
                : `✓ Volume gate passed (${trend.current_1h}+ in 1h or ${trend.current_24h}+ in 24h)`}
            </p>
          </div>

          {/* Evidence preview */}
          {evidenceLoading ? (
            <p className="text-xs text-muted-foreground">Loading evidence...</p>
          ) : evidence.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Top Evidence</p>
              <div className="space-y-1.5">
                {evidence.slice(0, 5).map((e) => {
                  const SourceIcon = getSourceIcon(e.source_type);
                  return (
                    <div key={e.id} className="flex items-start gap-2 text-xs">
                      <SourceIcon className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{e.source_title || 'Untitled'}</p>
                        <p className="text-muted-foreground truncate">
                          {e.source_domain || formatSourceType(e.source_type)}
                          {e.is_primary && <span className="ml-1 text-status-info">(primary)</span>}
                        </p>
                      </div>
                      {e.source_url && (
                        <a 
                          href={e.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Time window and freshness */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
            <Clock className="h-3 w-3" />
            <span>
              First seen {hoursAgo}h ago
              {trend.freshness && (
                <span className={cn(
                  "ml-2",
                  trend.freshness === 'fresh' ? 'text-status-success' :
                  trend.freshness === 'recent' ? 'text-status-info' :
                  trend.freshness === 'aging' ? 'text-status-warning' :
                  'text-status-error'
                )}>
                  • {trend.freshness}
                </span>
              )}
            </span>
          </div>

          {/* Top headline if available */}
          {trend.top_headline && (
            <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
              "{trend.top_headline}"
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Compact version for inline use in trend cards
 */
export function TrendExplainabilityCompact({ trend }: { trend: TrendEvent }) {
  const trigger = getTriggerExplanation(trend);
  const TriggerIcon = trigger.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={cn("gap-1 text-xs py-0", trigger.bgColor, trigger.color)}
      >
        <TriggerIcon className="h-3 w-3" />
        {trigger.label}
      </Badge>
      <span className={cn("text-xs", getConfidenceColor(trend.confidence_score))}>
        {trend.confidence_score}% confidence
      </span>
    </div>
  );
}
