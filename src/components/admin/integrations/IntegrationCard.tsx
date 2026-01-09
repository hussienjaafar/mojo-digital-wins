import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Circle, 
  HelpCircle,
  Loader2,
  Play,
  Power,
  Settings,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  IntegrationDetail, 
  PLATFORM_DISPLAY_NAMES, 
  PLATFORM_ICONS 
} from '@/types/integrations';
import { formatDistanceToNow } from 'date-fns';

interface IntegrationCardProps {
  integration: IntegrationDetail;
  onTest: (id: string) => Promise<boolean>;
  onToggle: (id: string, currentState: boolean) => Promise<boolean>;
  onEdit: (id: string) => void;
}

export function IntegrationCard({ 
  integration, 
  onTest, 
  onToggle,
  onEdit 
}: IntegrationCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    await onTest(integration.id);
    setIsTesting(false);
  };

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggle(integration.id, integration.is_active);
    setIsToggling(false);
  };

  const getStatusIcon = () => {
    if (!integration.is_active) {
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
    if (integration.last_sync_status === 'success') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (integration.last_sync_status === 'error' || integration.last_sync_status === 'failed') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (!integration.last_tested_at) {
      return <HelpCircle className="h-4 w-4 text-yellow-500" />;
    }
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (!integration.is_active) return 'Disabled';
    if (integration.last_sync_status === 'success') return 'Connected';
    if (integration.last_sync_status === 'error' || integration.last_sync_status === 'failed') {
      return `Failed${integration.sync_error_count ? ` (${integration.sync_error_count} errors)` : ''}`;
    }
    if (!integration.last_tested_at) return 'Not tested';
    return 'Pending';
  };

  const getLastSyncText = () => {
    if (!integration.last_sync_at) return 'Never synced';
    return `Last sync: ${formatDistanceToNow(new Date(integration.last_sync_at), { addSuffix: true })}`;
  };

  const platformName = PLATFORM_DISPLAY_NAMES[integration.platform] || integration.platform;
  const platformIcon = PLATFORM_ICONS[integration.platform] || '🔌';

  const hasError = integration.last_sync_status === 'error' || integration.last_sync_status === 'failed';

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        hasError && "border-destructive/50 bg-destructive/5",
        !integration.is_active && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{platformIcon}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{platformName}</span>
            {getStatusIcon()}
            <Badge 
              variant={hasError ? "destructive" : integration.is_active ? "default" : "secondary"}
              className="text-xs"
            >
              {getStatusText()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{getLastSyncText()}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTest}
                disabled={isTesting || !integration.is_active}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Test connection</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                disabled={isToggling}
              >
                {isToggling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className={cn(
                    "h-4 w-4",
                    integration.is_active ? "text-green-500" : "text-muted-foreground"
                  )} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {integration.is_active ? 'Disable' : 'Enable'}
            </TooltipContent>
          </Tooltip>

          {hasError && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(integration.id)}
                  className="text-destructive border-destructive/50"
                >
                  Fix
                </Button>
              </TooltipTrigger>
              <TooltipContent>Update credentials</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(integration.id)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
