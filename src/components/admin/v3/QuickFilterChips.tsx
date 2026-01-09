import { Zap, Target, Flame, MapPin, Bookmark, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type QuickFilter = 'breaking' | 'high_confidence' | 'high_relevance' | 'watchlist' | 'geography';

interface QuickFilterChipsProps {
  activeFilters: QuickFilter[];
  onToggleFilter: (filter: QuickFilter) => void;
  counts?: {
    breaking?: number;
    high_confidence?: number;
    high_relevance?: number;
    watchlist?: number;
    geography?: number;
  };
  className?: string;
}

const FILTER_CONFIG: Record<QuickFilter, {
  label: string;
  icon: typeof Zap;
  activeClasses: string;
  description: string;
}> = {
  breaking: {
    label: 'Breaking',
    icon: Zap,
    activeClasses: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    description: 'Breaking news and urgent developments',
  },
  high_confidence: {
    label: 'High Confidence',
    icon: Target,
    activeClasses: 'bg-[hsl(var(--portal-success))] text-white hover:bg-[hsl(var(--portal-success))]/90',
    description: 'Trends with 70%+ confidence score',
  },
  high_relevance: {
    label: 'High Relevance',
    icon: Flame,
    activeClasses: 'bg-[hsl(var(--portal-warning))] text-white hover:bg-[hsl(var(--portal-warning))]/90',
    description: 'Most relevant to your priorities',
  },
  watchlist: {
    label: 'My Watchlist',
    icon: Bookmark,
    activeClasses: 'bg-primary text-primary-foreground hover:bg-primary/90',
    description: 'Topics you are tracking',
  },
  geography: {
    label: 'In My Geography',
    icon: MapPin,
    activeClasses: 'bg-[hsl(var(--portal-info))] text-white hover:bg-[hsl(var(--portal-info))]/90',
    description: 'Relevant to your region',
  },
};

export function QuickFilterChips({
  activeFilters,
  onToggleFilter,
  counts = {},
  className,
}: QuickFilterChipsProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {(Object.entries(FILTER_CONFIG) as [QuickFilter, typeof FILTER_CONFIG[QuickFilter]][]).map(([key, config]) => {
        const isActive = activeFilters.includes(key);
        const Icon = config.icon;
        const count = counts[key];
        
        return (
          <Button
            key={key}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleFilter(key)}
            className={cn(
              "h-8 gap-1.5 text-xs font-medium transition-all",
              isActive ? config.activeClasses : "hover:bg-muted"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {config.label}
            {count !== undefined && count > 0 && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-[10px] px-1.5 py-0 min-w-[1.25rem] justify-center",
                  isActive ? "bg-white/20 text-inherit" : "bg-muted"
                )}
              >
                {count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
