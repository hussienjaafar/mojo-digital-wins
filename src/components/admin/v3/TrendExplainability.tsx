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
  Radio
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
import type { UnifiedTrend } from '@/hooks/useUnifiedTrends';

interface TrendExplainabilityProps {
  trend: UnifiedTrend;
  className?: string;
  defaultExpanded?: boolean;
}

type TriggerType = 'velocity_spike' | 'cross_source' | 'watchlist_match' | 'volume_surge' | 'breaking';

interface TriggerExplanation {
  type: TriggerType;
  label: string;
  description: string;
  icon: typeof TrendingUp;
  color: string;
  bgColor: string;
}

function getTriggerExplanation(trend: UnifiedTrend): TriggerExplanation {
  // Priority order: breaking > watchlist > velocity spike > cross-source > volume
  if (trend.is_breaking) {
    return {
      type: 'breaking',
      label: 'Breaking News',
      description: 'Rapid emergence across multiple authoritative sources within a short time window',
      icon: Zap,
      color: 'text-status-error',
      bgColor: 'bg-status-error/10',
    };
  }

  if (trend.matchesWatchlist) {
    return {
      type: 'watchlist_match',
      label: 'Watchlist Match',
      description: `Matches tracked entity: "${trend.watchlistEntity}"`,
      icon: ShieldCheck,
      color: 'text-status-info',
      bgColor: 'bg-status-info/10',
    };
  }

  if (trend.spike_ratio >= 2.5 && trend.velocity >= 100) {
    return {
      type: 'velocity_spike',
      label: 'Velocity Spike',
      description: `${trend.spike_ratio.toFixed(1)}x above baseline in the last hour`,
      icon: TrendingUp,
      color: 'text-status-warning',
      bgColor: 'bg-status-warning/10',
    };
  }

  if (trend.source_count >= 3) {
    return {
      type: 'cross_source',
      label: 'Cross-Source Confirmation',
      description: `Verified across ${trend.source_count} independent source types`,
      icon: Users,
      color: 'text-status-success',
      bgColor: 'bg-status-success/10',
    };
  }

  return {
    type: 'volume_surge',
    label: 'Volume Increase',
    description: `${trend.total_mentions_24h} mentions in 24 hours`,
    icon: Radio,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10',
  };
}

interface ConfidenceBreakdown {
  factor: string;
  score: number;
  maxScore: number;
  description: string;
}

function calculateConfidence(trend: UnifiedTrend): { 
  total: number; 
  breakdown: ConfidenceBreakdown[] 
} {
  const breakdown: ConfidenceBreakdown[] = [];

  // Cross-source confirmation (0-40 points)
  const crossSourceScore = Math.min(40, trend.source_count * 10);
  breakdown.push({
    factor: 'Cross-Source',
    score: crossSourceScore,
    maxScore: 40,
    description: `${trend.source_count} source type(s) reporting`,
  });

  // Volume (0-25 points)
  const volumeScore = Math.min(25, Math.floor(trend.total_mentions_24h / 4));
  breakdown.push({
    factor: 'Volume',
    score: volumeScore,
    maxScore: 25,
    description: `${trend.total_mentions_24h} total mentions`,
  });

  // Velocity/Spike (0-20 points)
  const velocityScore = Math.min(20, Math.floor(trend.spike_ratio * 5));
  breakdown.push({
    factor: 'Velocity',
    score: velocityScore,
    maxScore: 20,
    description: `${trend.spike_ratio.toFixed(1)}x above baseline`,
  });

  // Source authority (0-15 points) - news sources weighted higher
  const newsCount = (trend.source_distribution?.google_news || 0) + (trend.source_distribution?.rss || 0);
  const authorityScore = Math.min(15, newsCount * 3);
  breakdown.push({
    factor: 'Authority',
    score: authorityScore,
    maxScore: 15,
    description: `${newsCount} news source(s)`,
  });

  const total = breakdown.reduce((sum, b) => sum + b.score, 0);

  return { total, breakdown };
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'google_news':
    case 'rss':
      return Newspaper;
    case 'bluesky':
    case 'reddit':
      return MessageCircle;
    default:
      return Radio;
  }
}

function formatSourceName(source: string): string {
  switch (source) {
    case 'google_news': return 'Google News';
    case 'rss': return 'RSS Feeds';
    case 'bluesky': return 'Bluesky';
    case 'reddit': return 'Reddit';
    default: return source;
  }
}

export function TrendExplainability({ trend, className, defaultExpanded = false }: TrendExplainabilityProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  
  const trigger = getTriggerExplanation(trend);
  const confidence = calculateConfidence(trend);
  const TriggerIcon = trigger.icon;

  // Calculate time window
  const lastUpdated = trend.last_updated ? new Date(trend.last_updated) : null;
  const hoursAgo = lastUpdated 
    ? Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60))
    : null;

  // Source distribution
  const sources = Object.entries(trend.source_distribution || {})
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  const totalSourceMentions = sources.reduce((sum, [, count]) => sum + count, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="space-y-2">
        {/* Header row - always visible */}
        <div className="flex items-center justify-between gap-2">
          {/* Trigger badge */}
          <Badge 
            variant="outline" 
            className={cn("gap-1.5 text-xs", trigger.bgColor, trigger.color)}
          >
            <TriggerIcon className="h-3 w-3" />
            {trigger.label}
          </Badge>

          {/* Confidence score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs font-mono",
                confidence.total >= 70 ? "bg-status-success/10 text-status-success border-status-success/30" :
                confidence.total >= 40 ? "bg-status-warning/10 text-status-warning border-status-warning/30" :
                "bg-muted/10 text-muted-foreground"
              )}
            >
              {confidence.total}%
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

          {/* Evidence metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-lg font-semibold">{trend.total_mentions_24h}</p>
              <p className="text-muted-foreground">Mentions (24h)</p>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-lg font-semibold">{trend.spike_ratio.toFixed(1)}x</p>
              <p className="text-muted-foreground">vs Baseline</p>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-center">
              <p className="text-lg font-semibold">{trend.source_count}</p>
              <p className="text-muted-foreground">Source Types</p>
            </div>
          </div>

          {/* Confidence breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Confidence Breakdown</p>
            {confidence.breakdown.map((item) => (
              <div key={item.factor} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{item.factor}</span>
                  <span className="text-muted-foreground">{item.score}/{item.maxScore}</span>
                </div>
                <Progress 
                  value={(item.score / item.maxScore) * 100} 
                  className="h-1.5"
                />
              </div>
            ))}
          </div>

          {/* Source distribution */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Top Sources</p>
              <div className="space-y-1">
                {sources.slice(0, 4).map(([source, count]) => {
                  const SourceIcon = getSourceIcon(source);
                  const percentage = totalSourceMentions > 0 
                    ? Math.round((count / totalSourceMentions) * 100) 
                    : 0;
                  return (
                    <div key={source} className="flex items-center gap-2 text-xs">
                      <SourceIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1">{formatSourceName(source)}</span>
                      <span className="text-muted-foreground">{count} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time window */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
            <Clock className="h-3 w-3" />
            <span>
              Based on data from last 24 hours
              {hoursAgo !== null && ` • Updated ${hoursAgo}h ago`}
            </span>
          </div>

          {/* Sample headline if available */}
          {trend.sampleHeadline && (
            <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
              "{trend.sampleHeadline}"
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
export function TrendExplainabilityCompact({ trend }: { trend: UnifiedTrend }) {
  const trigger = getTriggerExplanation(trend);
  const confidence = calculateConfidence(trend);
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
      <span className="text-xs text-muted-foreground">
        {confidence.total}% confidence
      </span>
    </div>
  );
}
