import { useMemo } from 'react';
import { 
  FileText, 
  X, 
  TrendingUp,
  Clock,
  Bell,
  Newspaper,
  ChevronRight,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { V3Card, V3CardContent } from '@/components/v3';
import { useTrendEvents, type TrendEvent } from '@/hooks/useTrendEvents';
import { cn } from '@/lib/utils';

interface BriefingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewTrend?: (trendId: string) => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getStageColor(stage: string): string {
  switch (stage) {
    case 'peaking': return 'text-[hsl(var(--portal-error))]';
    case 'surging': return 'text-[hsl(var(--portal-warning))]';
    case 'emerging': return 'text-[hsl(var(--portal-success))]';
    default: return 'text-muted-foreground';
  }
}

function getStageBadgeClass(stage: string): string {
  switch (stage) {
    case 'peaking': return 'bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/30';
    case 'surging': return 'bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/30';
    case 'emerging': return 'bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/30';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function BriefingDrawer({ open, onOpenChange, onViewTrend }: BriefingDrawerProps) {
  const { events, stats, isLoading } = useTrendEvents({ limit: 20, minConfidence: 50 });

  // Get top 5 developments ranked by confidence
  const topDevelopments = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        // Breaking first, then by confidence
        if (a.is_breaking && !b.is_breaking) return -1;
        if (!a.is_breaking && b.is_breaking) return 1;
        return b.confidence_score - a.confidence_score;
      })
      .slice(0, 5);
  }, [events]);

  // The #1 most important development
  const topDevelopment = topDevelopments[0];

  // Calculate delta since login metrics (placeholder - in production this would come from user session)
  const deltaMetrics = useMemo(() => ({
    newArticles: Math.floor(Math.random() * 200) + 50, // Placeholder
    newAlerts: Math.floor(Math.random() * 5),
    newTrends: stats.totalEvents,
  }), [stats.totalEvents]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        
        {/* Drawer */}
        <motion.div
          className="relative w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Executive Briefing</h2>
                <p className="text-xs text-muted-foreground">What you need to know</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-6">
              {/* #1 Most Important Development */}
              {topDevelopment && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Most Important Development
                  </h3>
                  <V3Card 
                    accent={topDevelopment.is_breaking ? 'red' : 'amber'}
                    interactive
                    className="cursor-pointer"
                    onClick={() => onViewTrend?.(topDevelopment.id)}
                  >
                    <V3CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {topDevelopment.is_breaking && (
                              <Badge variant="destructive" className="text-[10px]">BREAKING</Badge>
                            )}
                            <Badge variant="outline" className={cn("text-[10px]", getStageBadgeClass(topDevelopment.trend_stage || 'stable'))}>
                              {topDevelopment.trend_stage?.toUpperCase() || 'ACTIVE'}
                            </Badge>
                          </div>
                          <h4 className="font-semibold text-foreground">
                            {topDevelopment.canonical_label || topDevelopment.event_title}
                          </h4>
                          {topDevelopment.context_summary && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {topDevelopment.context_summary}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                            <span>{topDevelopment.current_24h.toLocaleString()} mentions</span>
                            <span>•</span>
                            <span>{topDevelopment.source_count} sources</span>
                            <span>•</span>
                            <span>{topDevelopment.confidence_score}% confidence</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </V3CardContent>
                  </V3Card>
                </div>
              )}

              <Separator />

              {/* Top 5 Developments */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Top Developments
                </h3>
                <div className="space-y-2">
                  {topDevelopments.slice(1).map((trend, index) => (
                    <div
                      key={trend.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                      onClick={() => onViewTrend?.(trend.id)}
                    >
                      <span className="text-sm font-medium text-muted-foreground w-5">
                        {index + 2}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {trend.canonical_label || trend.event_title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={cn("text-[9px] py-0", getStageBadgeClass(trend.trend_stage || 'stable'))}>
                            {trend.trend_stage?.toUpperCase() || 'ACTIVE'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {trend.current_24h.toLocaleString()} mentions
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Since Your Last Login */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Since Your Last Login
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <Newspaper className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-semibold">{deltaMetrics.newArticles}</p>
                    <p className="text-[10px] text-muted-foreground">New articles</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <Bell className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-semibold">{deltaMetrics.newAlerts}</p>
                    <p className="text-[10px] text-muted-foreground">New alerts</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-semibold">{deltaMetrics.newTrends}</p>
                    <p className="text-[10px] text-muted-foreground">Active trends</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border">
            <Button 
              className="w-full" 
              onClick={() => onOpenChange(false)}
            >
              Open Full Trends Console
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
