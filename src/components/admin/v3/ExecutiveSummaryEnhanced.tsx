import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Megaphone,
  DollarSign,
  Shield,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RecommendedAction {
  id: string;
  type: 'fundraising' | 'messaging' | 'lobbying' | 'opposition';
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  trendId?: string;
}

interface ExecutiveSummaryEnhancedProps {
  opportunities: number;
  risks: number;
  keyTakeaways: Array<{
    text: string;
    type: 'opportunity' | 'risk' | 'neutral';
    trendId?: string;
  }>;
  recommendedActions?: RecommendedAction[];
  lastLoginAt?: Date;
  onViewTrend?: (trendId: string) => void;
  onExecuteAction?: (action: RecommendedAction) => void;
  className?: string;
}

const ACTION_ICONS = {
  fundraising: DollarSign,
  messaging: MessageSquare,
  lobbying: Megaphone,
  opposition: Shield,
};

const ACTION_COLORS = {
  fundraising: 'text-[hsl(var(--portal-success))] bg-[hsl(var(--portal-success))]/10',
  messaging: 'text-[hsl(var(--portal-info))] bg-[hsl(var(--portal-info))]/10',
  lobbying: 'text-[hsl(var(--portal-warning))] bg-[hsl(var(--portal-warning))]/10',
  opposition: 'text-[hsl(var(--portal-error))] bg-[hsl(var(--portal-error))]/10',
};

export function ExecutiveSummaryEnhanced({
  opportunities,
  risks,
  keyTakeaways,
  recommendedActions = [],
  lastLoginAt,
  onViewTrend,
  onExecuteAction,
  className,
}: ExecutiveSummaryEnhancedProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const timeSinceLogin = lastLoginAt 
    ? formatTimeSince(lastLoginAt) 
    : 'your last login';

  const highUrgencyAlerts = keyTakeaways.filter(t => t.type === 'risk').length;

  return (
    <div className={cn(
      "rounded-xl border bg-gradient-to-br from-card via-card to-card/80 border-border/50 overflow-hidden shadow-sm",
      className
    )}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">
              Since {timeSinceLogin}
            </h3>
            <p className="text-xs text-muted-foreground">
              {keyTakeaways.length} key developments • {recommendedActions.length} suggested actions
            </p>
          </div>
        </div>
        
        {/* Quick stats */}
        <div className="flex items-center gap-3">
          {opportunities > 0 && (
            <Badge variant="outline" className="gap-1.5 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/30 bg-[hsl(var(--portal-success))]/10 py-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-semibold">{opportunities}</span>
              <span className="hidden sm:inline text-xs">opportunities</span>
            </Badge>
          )}
          {highUrgencyAlerts > 0 && (
            <Badge variant="outline" className="gap-1.5 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/30 bg-[hsl(var(--portal-warning))]/10 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-semibold">{highUrgencyAlerts}</span>
              <span className="hidden sm:inline text-xs">alerts</span>
            </Badge>
          )}
          
          <div className="h-6 w-px bg-border mx-1" />
          
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-border/50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Key Developments */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Key Developments
                  </h4>
                  {keyTakeaways.slice(0, 3).map((takeaway, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg transition-colors",
                        takeaway.type === 'opportunity' && "bg-[hsl(var(--portal-success))]/5 hover:bg-[hsl(var(--portal-success))]/10",
                        takeaway.type === 'risk' && "bg-[hsl(var(--portal-warning))]/5 hover:bg-[hsl(var(--portal-warning))]/10",
                        takeaway.type === 'neutral' && "bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      {takeaway.type === 'opportunity' && (
                        <TrendingUp className="h-4 w-4 mt-0.5 text-[hsl(var(--portal-success))] shrink-0" />
                      )}
                      {takeaway.type === 'risk' && (
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-[hsl(var(--portal-warning))] shrink-0" />
                      )}
                      {takeaway.type === 'neutral' && (
                        <TrendingDown className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      )}
                      
                      <p className="text-sm text-foreground flex-1 leading-relaxed">
                        {takeaway.text}
                      </p>
                      
                      {takeaway.trendId && onViewTrend && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs shrink-0 hover:bg-background"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewTrend(takeaway.trendId!);
                          }}
                        >
                          View
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Recommended Actions */}
                {recommendedActions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Recommended Actions
                    </h4>
                    {recommendedActions.slice(0, 2).map((action, index) => {
                      const Icon = ACTION_ICONS[action.type];
                      const colorClasses = ACTION_COLORS[action.type];
                      
                      return (
                        <motion.div 
                          key={action.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors"
                        >
                          <div className={cn("p-2 rounded-lg", colorClasses)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {action.title}
                              </span>
                              {action.urgency === 'high' && (
                                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                  Urgent
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {action.description}
                            </p>
                          </div>
                          
                          {onExecuteAction && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onExecuteAction(action);
                              }}
                            >
                              Execute
                            </Button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTimeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'your last visit';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return 'last week';
}
