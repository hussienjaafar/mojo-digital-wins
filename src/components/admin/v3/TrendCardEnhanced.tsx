import { 
  TrendingUp, 
  Flame, 
  Zap, 
  Rocket,
  TrendingDown,
  BarChart3,
  Target,
  ChevronRight,
  Newspaper,
  MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TrendEvent } from '@/hooks/useTrendEvents';

interface TrendCardEnhancedProps {
  trend: TrendEvent;
  rank: number;
  whyTrending?: string;
  confidenceScore: number;
  orgRelevanceScore?: number;
  matchedPriorities?: string[];
  signalBreakdown?: {
    news: number;
    social: number;
  };
  onDrilldown: () => void;
  className?: string;
}

const STAGE_CONFIG = {
  emerging: { 
    label: 'Emerging', 
    color: 'text-[hsl(var(--portal-success))]',
    bg: 'bg-[hsl(var(--portal-success))]/10',
    border: 'border-[hsl(var(--portal-success))]/30',
    icon: Rocket,
  },
  surging: { 
    label: 'Surging', 
    color: 'text-[hsl(var(--portal-warning))]',
    bg: 'bg-[hsl(var(--portal-warning))]/10',
    border: 'border-[hsl(var(--portal-warning))]/30',
    icon: Flame,
  },
  peaking: { 
    label: 'Peaking', 
    color: 'text-[hsl(var(--portal-error))]',
    bg: 'bg-[hsl(var(--portal-error))]/10',
    border: 'border-[hsl(var(--portal-error))]/30',
    icon: TrendingUp,
  },
  declining: { 
    label: 'Declining', 
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    border: 'border-border',
    icon: TrendingDown,
  },
  stable: { 
    label: 'Stable', 
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    border: 'border-border',
    icon: BarChart3,
  },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  policy: { label: 'Policy', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  person: { label: 'Person', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  event: { label: 'Event', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  geography: { label: 'Geography', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
};

export function TrendCardEnhanced({
  trend,
  rank,
  whyTrending,
  confidenceScore,
  orgRelevanceScore,
  matchedPriorities = [],
  signalBreakdown,
  onDrilldown,
  className,
}: TrendCardEnhancedProps) {
  const stage = trend.trend_stage || 'stable';
  const stageConfig = STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG] || STAGE_CONFIG.stable;
  const StageIcon = stageConfig.icon;
  
  // Calculate signal percentages
  const totalSignals = (signalBreakdown?.news || 0) + (signalBreakdown?.social || 0);
  const newsPercent = totalSignals > 0 ? ((signalBreakdown?.news || 0) / totalSignals) * 100 : 50;

  // Detect trend type from context
  const trendType = trend.context_terms?.includes('bill') || trend.context_terms?.includes('legislation') 
    ? 'policy' 
    : trend.context_terms?.includes('senator') || trend.context_terms?.includes('representative')
    ? 'person'
    : 'event';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.03 }}
      className={className}
    >
      <div
        onClick={onDrilldown}
        className={cn(
          "relative group cursor-pointer rounded-xl border bg-card p-4 transition-all duration-200",
          "hover:shadow-md hover:border-primary/30",
          trend.is_breaking && "ring-2 ring-destructive/30 border-destructive/50"
        )}
      >
        {/* Rank indicator */}
        <div className={cn(
          "absolute -left-2 -top-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm",
          rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border"
        )}>
          {rank}
        </div>

        {/* Main content */}
        <div className="ml-4">
          {/* Header row: Type + Stage + Breaking */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge 
              variant="outline" 
              className={cn("text-[10px] py-0 px-1.5", TYPE_CONFIG[trendType]?.color)}
            >
              {TYPE_CONFIG[trendType]?.label || 'Trend'}
            </Badge>
            
            {trend.is_breaking ? (
              <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse">
                <Zap className="h-3 w-3" />
                BREAKING
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className={cn("text-[10px] gap-1", stageConfig.bg, stageConfig.color, stageConfig.border)}
              >
                <StageIcon className="h-3 w-3" />
                {stageConfig.label}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
            {trend.canonical_label || trend.event_title}
          </h3>

          {/* Why trending sentence */}
          {whyTrending && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {whyTrending}
            </p>
          )}

          {/* Metrics row */}
          <div className="flex items-center gap-4 mb-3">
            {/* Confidence score */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={cn(
                    "text-xs font-medium",
                    confidenceScore >= 70 ? "text-[hsl(var(--portal-success))]" : 
                    confidenceScore >= 50 ? "text-[hsl(var(--portal-warning))]" : "text-muted-foreground"
                  )}>
                    {confidenceScore}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Confidence score</TooltipContent>
            </Tooltip>

            {/* Org relevance */}
            {orgRelevanceScore !== undefined && orgRelevanceScore > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[10px] py-0 gap-1 bg-primary/10 text-primary border-0">
                    <span>Relevance:</span>
                    <span className="font-bold">{orgRelevanceScore}%</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Relevance to your organization's priorities</TooltipContent>
              </Tooltip>
            )}

            {/* Signal breakdown mini bar */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Newspaper className="h-3 w-3 text-[hsl(var(--portal-info))]" />
                <span>{signalBreakdown?.news || 0}</span>
              </div>
              <div className="w-16 h-1.5 rounded-full overflow-hidden flex bg-muted">
                <div 
                  className="bg-[hsl(var(--portal-info))] h-full transition-all" 
                  style={{ width: `${newsPercent}%` }}
                />
                <div 
                  className="bg-[hsl(var(--portal-accent-sky))] h-full transition-all" 
                  style={{ width: `${100 - newsPercent}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MessageCircle className="h-3 w-3 text-[hsl(var(--portal-accent-sky))]" />
                <span>{signalBreakdown?.social || 0}</span>
              </div>
            </div>
          </div>

          {/* Matched priorities */}
          {matchedPriorities.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Matched:</span>
              {matchedPriorities.slice(0, 3).map((priority, i) => (
                <Badge 
                  key={i} 
                  variant="secondary" 
                  className="text-[10px] py-0 px-1.5 bg-primary/5 text-primary/80 border-0"
                >
                  {priority}
                </Badge>
              ))}
              {matchedPriorities.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{matchedPriorities.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Drill down arrow */}
        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );
}
