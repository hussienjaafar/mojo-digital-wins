import { 
  TrendingUp, 
  Flame, 
  Zap, 
  Rocket,
  TrendingDown,
  BarChart3,
  ChevronRight,
  Target,
  MoreHorizontal,
  PlusCircle,
  Bell,
  EyeOff,
  Pin
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { V3Card, V3CardContent } from '@/components/v3';
import { type TrendEvent, getConfidenceColor } from '@/hooks/useTrendEvents';
import { cn } from '@/lib/utils';

interface TrendCardCompactProps {
  trend: TrendEvent;
  rank: number;
  isBreaking?: boolean;
  density?: 'comfortable' | 'compact';
  onOpen?: () => void;
  onAddToWatchlist?: () => void;
  onCreateAlert?: () => void;
  onDismiss?: () => void;
  onPin?: () => void;
  className?: string;
}

const STAGE_CONFIG = {
  emerging: { 
    label: 'Emerging', 
    accent: 'green' as const,
    icon: Rocket,
    badgeClass: 'bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/30'
  },
  surging: { 
    label: 'Surging', 
    accent: 'amber' as const,
    icon: Flame,
    badgeClass: 'bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/30'
  },
  peaking: { 
    label: 'Peaking', 
    accent: 'red' as const,
    icon: TrendingUp,
    badgeClass: 'bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/30'
  },
  declining: { 
    label: 'Declining', 
    accent: 'default' as const,
    icon: TrendingDown,
    badgeClass: 'bg-muted text-muted-foreground'
  },
  stable: { 
    label: 'Stable', 
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

export function TrendCardCompact({
  trend,
  rank,
  isBreaking = false,
  density = 'comfortable',
  onOpen,
  onAddToWatchlist,
  onCreateAlert,
  onDismiss,
  onPin,
  className,
}: TrendCardCompactProps) {
  const stageConfig = STAGE_CONFIG[trend.trend_stage || 'stable'];
  
  // Calculate spike percentage
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

  // Compact mode: single line
  if (density === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, delay: rank * 0.01 }}
      >
        <div 
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
            "hover:bg-muted/50 hover:border-border",
            isBreaking && "border-destructive/30 bg-destructive/5",
            className
          )}
          onClick={onOpen}
        >
          {/* Rank */}
          <span className={cn(
            "text-xs font-medium w-5 text-center shrink-0",
            rank <= 3 ? "text-primary" : "text-muted-foreground"
          )}>
            {rank}
          </span>

          {/* Stage badge */}
          {isBreaking ? (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              BREAKING
            </Badge>
          ) : (
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 shrink-0", stageConfig.badgeClass)}>
              {stageConfig.label}
            </Badge>
          )}

          {/* Title */}
          <span className="flex-1 text-sm font-medium truncate">
            {trend.canonical_label || trend.event_title}
          </span>

          {/* Key metrics */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <span>{trend.current_24h.toLocaleString()}</span>
            {spikeText && (
              <span className="text-primary font-medium">{spikeText}</span>
            )}
            <span>{trend.source_count} src</span>
            <Badge variant="outline" className={cn("text-[9px] py-0", getConfidenceColor(trend.confidence_score))}>
              {trend.confidence_score}%
            </Badge>
          </div>

          {/* Open button */}
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </motion.div>
    );
  }

  // Comfortable mode: full card
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.02 }}
    >
      <V3Card 
        accent={getCardAccent(trend, isBreaking)}
        interactive
        className={cn("relative", className)}
      >
        <V3CardContent className="p-4">
          {/* Rank Badge */}
          <div className={cn(
            "absolute -left-1.5 -top-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10",
            rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {rank}
          </div>

          <div className="flex items-start gap-3">
            {/* Content */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
              {/* Title + Stage */}
              <div className="flex items-center gap-2 mb-1.5">
                {isBreaking ? (
                  <Badge variant="destructive" className="text-[10px] animate-pulse">
                    <Zap className="h-3 w-3 mr-0.5" />
                    BREAKING
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn("text-[10px]", stageConfig.badgeClass)}>
                    {stageConfig.label}
                  </Badge>
                )}
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <h4 className="font-semibold text-foreground truncate pr-2">
                    {trend.canonical_label || trend.event_title}
                  </h4>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  {trend.canonical_label || trend.event_title}
                </TooltipContent>
              </Tooltip>

              {/* Metrics row: 4 key metrics only */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="font-medium">
                  {trend.current_24h.toLocaleString()} mentions
                </span>
                
                {spikeText && (
                  <span className="font-medium text-primary">
                    {spikeText} spike
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

              {/* Source distribution bar */}
              <div className="mt-3">
                <div className="h-1 rounded-full overflow-hidden flex bg-muted">
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

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* More menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 opacity-60 hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onAddToWatchlist}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add to Watchlist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onCreateAlert}>
                    <Bell className="h-4 w-4 mr-2" />
                    Create Alert
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onPin}>
                    <Pin className="h-4 w-4 mr-2" />
                    Pin to Top
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDismiss} className="text-muted-foreground">
                    <EyeOff className="h-4 w-4 mr-2" />
                    Dismiss
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Open button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={onOpen}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Details</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </V3CardContent>
      </V3Card>
    </motion.div>
  );
}
