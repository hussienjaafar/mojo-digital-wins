import { useState, useEffect } from 'react';
import { Check, X, Pin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTrendFeedback, FeedbackType } from '@/hooks/useTrendFeedback';

interface TrendFeedbackProps {
  trendId: string;
  trendName: string;
  initialFeedback?: FeedbackType | null;
  onFeedback?: (trendId: string, feedback: FeedbackType) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const FEEDBACK_CONFIG: Record<FeedbackType, {
  icon: typeof Check;
  label: string;
  activeColor: string;
  hoverColor: string;
}> = {
  relevant: {
    icon: Check,
    label: 'Relevant',
    activeColor: 'bg-status-success text-white',
    hoverColor: 'hover:bg-status-success/10 hover:text-status-success',
  },
  not_relevant: {
    icon: X,
    label: 'Not relevant',
    activeColor: 'bg-status-error text-white',
    hoverColor: 'hover:bg-status-error/10 hover:text-status-error',
  },
  follow_up: {
    icon: Pin,
    label: 'Follow up',
    activeColor: 'bg-primary text-primary-foreground',
    hoverColor: 'hover:bg-primary/10 hover:text-primary',
  },
};

export function TrendFeedback({ 
  trendId, 
  trendName,
  initialFeedback,
  onFeedback,
  size = 'sm',
  className 
}: TrendFeedbackProps) {
  const { submitFeedback, getFeedbackForTrend, isSubmitting: hookSubmitting } = useTrendFeedback();
  const existingFeedback = getFeedbackForTrend(trendId);
  const [feedback, setFeedback] = useState<FeedbackType | null>(initialFeedback || existingFeedback);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with hook data when it loads
  useEffect(() => {
    if (existingFeedback && !feedback) {
      setFeedback(existingFeedback);
    }
  }, [existingFeedback]);

  const handleFeedback = async (type: FeedbackType) => {
    // Toggle off if clicking the same feedback
    const newFeedback = feedback === type ? null : type;
    
    setIsSubmitting(true);
    
    try {
      setFeedback(newFeedback);
      
      if (newFeedback) {
        // Persist to database
        submitFeedback({ trendId, feedbackType: newFeedback });
        onFeedback?.(trendId, newFeedback);
        
        // Show toast for feedback
        const config = FEEDBACK_CONFIG[newFeedback];
        toast.success(`Marked as ${config.label.toLowerCase()}`, {
          description: `"${trendName}" feedback saved`,
        });
      }
    } catch (error) {
      toast.error('Failed to save feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {(Object.entries(FEEDBACK_CONFIG) as [FeedbackType, typeof FEEDBACK_CONFIG[FeedbackType]][]).map(([type, config]) => {
        const Icon = config.icon;
        const isActive = feedback === type;
        
        return (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFeedback(type);
                }}
                className={cn(
                  buttonSize,
                  "transition-colors",
                  isActive ? config.activeColor : config.hoverColor
                )}
              >
                {isSubmitting ? (
                  <Loader2 className={cn(iconSize, "animate-spin")} />
                ) : (
                  <Icon className={iconSize} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                {isActive ? `Remove ${config.label.toLowerCase()}` : config.label}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// Compact inline version
export function TrendFeedbackInline({ 
  trendId, 
  trendName,
  className 
}: { 
  trendId: string; 
  trendName: string;
  className?: string;
}) {
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);

  const handleFeedback = (type: FeedbackType) => {
    const newFeedback = feedback === type ? null : type;
    setFeedback(newFeedback);
    
    if (newFeedback) {
      toast.success(`Marked as ${FEEDBACK_CONFIG[newFeedback].label.toLowerCase()}`);
    }
  };

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <span className="text-muted-foreground">Rate:</span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleFeedback('relevant'); }}
          className={cn(
            "px-2 py-0.5 rounded transition-colors",
            feedback === 'relevant' 
              ? "bg-status-success/20 text-status-success" 
              : "hover:bg-muted text-muted-foreground"
          )}
        >
          ✓
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleFeedback('not_relevant'); }}
          className={cn(
            "px-2 py-0.5 rounded transition-colors",
            feedback === 'not_relevant' 
              ? "bg-status-error/20 text-status-error" 
              : "hover:bg-muted text-muted-foreground"
          )}
        >
          ✗
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleFeedback('follow_up'); }}
          className={cn(
            "px-2 py-0.5 rounded transition-colors",
            feedback === 'follow_up' 
              ? "bg-primary/20 text-primary" 
              : "hover:bg-muted text-muted-foreground"
          )}
        >
          📌
        </button>
      </div>
    </div>
  );
}
