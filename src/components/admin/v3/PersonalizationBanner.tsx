import { Settings, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PersonalizationBannerProps {
  clientName?: string;
  priorities?: string[];
  onEditPreferences?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PersonalizationBanner({
  clientName = 'Your Organization',
  priorities = [],
  onEditPreferences,
  onDismiss,
  className,
}: PersonalizationBannerProps) {
  if (priorities.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2.5 rounded-lg",
      "bg-primary/5 border border-primary/20",
      className
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-1.5 rounded-md bg-primary/10">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Personalized for: <span className="font-medium text-foreground">{clientName}</span>
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Prioritizing: {' '}
            <span className="text-foreground">
              {priorities.slice(0, 3).join(' • ')}
              {priorities.length > 3 && ` +${priorities.length - 3} more`}
            </span>
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 shrink-0">
        {onEditPreferences && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onEditPreferences}
          >
            <Settings className="h-3 w-3" />
            <span className="hidden sm:inline">Edit Preferences</span>
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
