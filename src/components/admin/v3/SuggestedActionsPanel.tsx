import { useState } from 'react';
import { 
  Lightbulb, 
  MessageSquare, 
  FileText, 
  DollarSign,
  Shield,
  ChevronRight,
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ActionType = 'response' | 'comms' | 'compliance' | 'fundraising';

interface SuggestedAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  trendId?: string;
  trendName?: string;
}

interface SuggestedActionsPanelProps {
  actions: SuggestedAction[];
  onActionTaken?: (actionId: string, type: ActionType) => void;
  className?: string;
}

const ACTION_TYPE_CONFIG: Record<ActionType, {
  icon: typeof Lightbulb;
  label: string;
  color: string;
  bgColor: string;
}> = {
  response: {
    icon: MessageSquare,
    label: 'Response',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  comms: {
    icon: FileText,
    label: 'Communications',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  compliance: {
    icon: Shield,
    label: 'Compliance',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  fundraising: {
    icon: DollarSign,
    label: 'Fundraising',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
};

const PRIORITY_CONFIG = {
  high: { color: 'text-status-error', bg: 'bg-status-error/10', border: 'border-status-error/30' },
  medium: { color: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/30' },
  low: { color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-muted' },
};

function ActionCard({ 
  action, 
  onTake 
}: { 
  action: SuggestedAction; 
  onTake: () => void;
}) {
  const [isTaken, setIsTaken] = useState(false);
  const config = ACTION_TYPE_CONFIG[action.type];
  const priorityConfig = PRIORITY_CONFIG[action.priority];
  const Icon = config.icon;

  const handleTake = () => {
    setIsTaken(true);
    onTake();
    toast.success('Action marked as taken', {
      description: action.title,
    });
  };

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border transition-all",
      isTaken 
        ? "bg-status-success/5 border-status-success/20" 
        : "bg-card hover:bg-muted/50 border-border"
    )}>
      {/* Icon */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        config.bgColor
      )}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn("text-[10px] h-4 px-1", priorityConfig.color, priorityConfig.border)}
          >
            {action.priority}
          </Badge>
          <Badge variant="secondary" className="text-[10px] h-4 px-1">
            {config.label}
          </Badge>
        </div>
        <p className="text-sm font-medium line-clamp-1">{action.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
        {action.trendName && (
          <p className="text-[10px] text-muted-foreground">
            Re: {action.trendName}
          </p>
        )}
      </div>

      {/* Action button */}
      <Button
        variant={isTaken ? "ghost" : "outline"}
        size="sm"
        className={cn(
          "h-8 shrink-0",
          isTaken && "text-status-success"
        )}
        onClick={handleTake}
        disabled={isTaken}
      >
        {isTaken ? (
          <>
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Done
          </>
        ) : (
          <>
            Use
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}

export function SuggestedActionsPanel({ 
  actions, 
  onActionTaken,
  className 
}: SuggestedActionsPanelProps) {
  if (actions.length === 0) {
    return null;
  }

  // Sort by priority
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Suggested Actions
          <Badge variant="secondary" className="text-xs">
            {actions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedActions.slice(0, 5).map(action => (
          <ActionCard 
            key={action.id} 
            action={action}
            onTake={() => onActionTaken?.(action.id, action.type)}
          />
        ))}
        {actions.length > 5 && (
          <Button variant="ghost" size="sm" className="w-full text-xs">
            View all {actions.length} suggestions
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for inline use
export function SuggestedActionsCompact({ 
  actions,
  maxShow = 2 
}: { 
  actions: SuggestedAction[];
  maxShow?: number;
}) {
  if (actions.length === 0) return null;

  const highPriority = actions.filter(a => a.priority === 'high');
  const toShow = highPriority.length > 0 ? highPriority : actions;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Lightbulb className="h-3.5 w-3.5 text-primary" />
      <span className="text-muted-foreground">Suggested:</span>
      {toShow.slice(0, maxShow).map(action => {
        const config = ACTION_TYPE_CONFIG[action.type];
        return (
          <Badge 
            key={action.id}
            variant="outline" 
            className={cn("text-[10px] h-5 gap-1", config.color)}
          >
            {config.label}
          </Badge>
        );
      })}
      {toShow.length > maxShow && (
        <span className="text-muted-foreground">+{toShow.length - maxShow}</span>
      )}
    </div>
  );
}
