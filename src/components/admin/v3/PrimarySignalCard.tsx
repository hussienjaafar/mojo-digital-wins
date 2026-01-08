import { 
  TrendingUp, 
  Flame, 
  Zap, 
  Rocket,
  TrendingDown,
  BarChart3,
  Target,
  Search,
  MessageSquare,
  Bell,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { V3Card, V3CardContent } from '@/components/v3';
import { type TrendEvent, getConfidenceColor } from '@/hooks/useTrendEvents';
import { cn } from '@/lib/utils';

interface PrimarySignalCardProps {
  trend: TrendEvent;
  rank: number;
  whyItMatters?: string;
  matchedReasons?: string[];
  evidencePreview?: Array<{
    headline: string;
    source: string;
  }>;
  opportunityTier?: 'act_now' | 'consider' | 'watch' | null;
  decisionScore?: number | null;
  onInvestigate: () => void;
  onAct: () => void;
  onCreateAlert?: () => void;
  className?: string;
}

const STAGE_CONFIG = {
  emerging: { 
    label: 'EMERGING', 
    accent: 'green' as const,
    icon: Rocket,
    badgeClass: 'bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/30'
  },
  surging: { 
    label: 'SURGING', 
    accent: 'amber' as const,
    icon: Flame,
    badgeClass: 'bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/30'
  },
  peaking: { 
    label: 'PEAKING', 
    accent: 'red' as const,
    icon: TrendingUp,
    badgeClass: 'bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/30'
  },
  declining: { 
    label: 'DECLINING', 
    accent: 'default' as const,
    icon: TrendingDown,
    badgeClass: 'bg-muted text-muted-foreground'
  },
  stable: { 
    label: 'STABLE', 
    accent: 'default' as const,
    icon: BarChart3,
    badgeClass: 'bg-muted text-muted-foreground'
  },
};

function getCardAccent(trend: TrendEvent, isBreaking?: boolean): 'red' | 'amber' | 'green' | 'default' {
  if (isBreaking) return 'red';
  const stage = trend.trend_stage || 'stable';
  return STAGE_CONFIG[stage]?.accent || 'default';
}

export function PrimarySignalCard({
  trend,
  rank,
  whyItMatters,
  matchedReasons = [],
  evidencePreview = [],
  opportunityTier,
  decisionScore,
  onInvestigate,
  onAct,
  onCreateAlert,
  className,
}: PrimarySignalCardProps) {
  const stageConfig = STAGE_CONFIG[trend.trend_stage || 'stable'];
  const isBreaking = trend.is_breaking;
  
  // Calculate spike text
  const spikeText = trend.z_score_velocity 
    ? `${trend.z_score_velocity >= 0 ? '+' : ''}${trend.z_score_velocity.toFixed(1)}σ`
    : trend.baseline_delta_pct 
      ? `${trend.baseline_delta_pct >= 0 ? '+' : ''}${trend.baseline_delta_pct.toFixed(0)}%`
      : null;

  // Source distribution
  const newsCount = trend.news_source_count || 0;
  const socialCount = trend.social_source_count || 0;
  const totalSources = newsCount + socialCount;
  const newsPercent = totalSources > 0 ? (newsCount / totalSources) * 100 : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.05 }}
    >
      <V3Card 
        accent={getCardAccent(trend, isBreaking)}
        className={cn("relative", className)}
      >
        <V3CardContent className="p-5">
          {/* Rank Badge - Large and prominent */}
          <div className={cn(
            "absolute -left-2 -top-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 shadow-md",
            rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            #{rank}
          </div>

          {/* Header: Stage + Title */}
          <div className="flex items-start justify-between gap-4 ml-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isBreaking ? (
                  <Badge variant="destructive" className="text-[10px] animate-pulse font-semibold">
                    <Zap className="h-3 w-3 mr-0.5" />
                    BREAKING
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn("text-[10px] font-semibold", stageConfig.badgeClass)}>
                    {stageConfig.label}
                  </Badge>
                )}
                
                {/* Opportunity Tier Badge */}
                {opportunityTier === 'act_now' && (
                  <Badge className="text-[10px] font-semibold bg-[hsl(var(--portal-success))] text-white">
                    ACT NOW
                  </Badge>
                )}
                {opportunityTier === 'consider' && (
                  <Badge variant="outline" className="text-[10px] font-semibold border-[hsl(var(--portal-warning))] text-[hsl(var(--portal-warning))]">
                    CONSIDER
                  </Badge>
                )}
              </div>
              
              <h3 className="text-lg font-semibold text-foreground leading-tight">
                {trend.canonical_label || trend.event_title}
              </h3>
            </div>
          </div>

          {/* WHY THIS MATTERS - Primary content block */}
          {whyItMatters && (
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                Why This Matters
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {whyItMatters}
              </p>
              
              {/* Matched reasons as tags */}
              {matchedReasons.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <Target className="h-3 w-3 text-primary shrink-0" />
                  {matchedReasons.map((reason, i) => (
                    <Badge 
                      key={i} 
                      variant="secondary" 
                      className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-0"
                    >
                      {reason}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Evidence Preview */}
          {evidencePreview.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Evidence Preview
              </p>
              {evidencePreview.slice(0, 2).map((evidence, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="shrink-0 mt-1">•</span>
                  <span>
                    "{evidence.headline}" — <span className="text-foreground/70">{evidence.source}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Metrics Row */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-medium">
                  {trend.current_24h.toLocaleString()} mentions
                </span>
                
                {spikeText && (
                  <span className="font-semibold text-primary">
                    {spikeText}
                  </span>
                )}
                
                <span className="text-[hsl(var(--portal-success))]">
                  {trend.source_count} sources
                </span>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] py-0 gap-1 cursor-help", getConfidenceColor(trend.confidence_score))}
                    >
                      <Target className="h-2.5 w-2.5" />
                      {trend.confidence_score}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Confidence score</TooltipContent>
                </Tooltip>
              </div>

              {/* Source bar mini */}
              <div className="w-24 h-1.5 rounded-full overflow-hidden flex bg-muted">
                <div 
                  className="bg-[hsl(var(--portal-info))] h-full" 
                  style={{ width: `${newsPercent}%` }}
                />
                <div 
                  className="bg-[hsl(var(--portal-accent-sky))] h-full" 
                  style={{ width: `${100 - newsPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons - Mode-based */}
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 gap-1.5"
              onClick={onInvestigate}
            >
              <Search className="h-3.5 w-3.5" />
              Investigate
            </Button>
            
            <Button
              variant="default"
              size="sm"
              className="flex-1 h-9 gap-1.5"
              onClick={onAct}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Act
            </Button>
            
            {onCreateAlert && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={onCreateAlert}
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create Alert</TooltipContent>
              </Tooltip>
            )}
          </div>
        </V3CardContent>
      </V3Card>
    </motion.div>
  );
}
