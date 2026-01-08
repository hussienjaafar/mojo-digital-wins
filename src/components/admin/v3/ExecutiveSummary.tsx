import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ExecutiveSummaryProps {
  opportunities: number;
  risks: number;
  keyTakeaways: Array<{
    text: string;
    type: 'opportunity' | 'risk' | 'neutral';
    trendId?: string;
  }>;
  lastLoginAt?: Date;
  onViewTrend?: (trendId: string) => void;
  className?: string;
}

export function ExecutiveSummary({
  opportunities,
  risks,
  keyTakeaways,
  lastLoginAt,
  onViewTrend,
  className,
}: ExecutiveSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const timeSinceLogin = lastLoginAt 
    ? formatTimeSince(lastLoginAt) 
    : 'your last login';

  return (
    <div className={cn(
      "rounded-lg border bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden",
      className
    )}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Since {timeSinceLogin}
          </span>
          
          {/* Quick stats */}
          <div className="flex items-center gap-3 ml-2">
            {opportunities > 0 && (
              <Badge variant="outline" className="gap-1 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/30 bg-[hsl(var(--portal-success))]/10">
                <TrendingUp className="h-3 w-3" />
                +{opportunities} {opportunities === 1 ? 'opportunity' : 'opportunities'}
              </Badge>
            )}
            {risks > 0 && (
              <Badge variant="outline" className="gap-1 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/30 bg-[hsl(var(--portal-warning))]/10">
                <AlertTriangle className="h-3 w-3" />
                {risks} {risks === 1 ? 'risk' : 'risks'}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && keyTakeaways.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2">
              {keyTakeaways.slice(0, 3).map((takeaway, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md",
                    takeaway.type === 'opportunity' && "bg-[hsl(var(--portal-success))]/5",
                    takeaway.type === 'risk' && "bg-[hsl(var(--portal-warning))]/5",
                    takeaway.type === 'neutral' && "bg-muted/30"
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
                  
                  <p className="text-sm text-foreground flex-1">
                    {takeaway.text}
                  </p>
                  
                  {takeaway.trendId && onViewTrend && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs shrink-0"
                      onClick={() => onViewTrend(takeaway.trendId!)}
                    >
                      View
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              ))}
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
