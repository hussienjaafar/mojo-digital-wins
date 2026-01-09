import React from 'react';
import { RefreshCw, Play, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface IntegrationQuickActionsProps {
  failingCount: number;
  untestedCount: number;
  onTestAllFailing: () => Promise<void>;
  onSyncAll: () => Promise<void>;
  isTestingAll?: boolean;
  isSyncingAll?: boolean;
}

export function IntegrationQuickActions({
  failingCount,
  untestedCount,
  onTestAllFailing,
  onSyncAll,
  isTestingAll = false,
  isSyncingAll = false,
}: IntegrationQuickActionsProps) {
  const hasIssues = failingCount > 0 || untestedCount > 0;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {failingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onTestAllFailing}
                disabled={isTestingAll || isSyncingAll}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {isTestingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Retest Failing
                <Badge variant="destructive" className="ml-2 text-xs">
                  {failingCount}
                </Badge>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Re-test all {failingCount} failing integrations</p>
            </TooltipContent>
          </Tooltip>
        )}

        {untestedCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onTestAllFailing}
                disabled={isTestingAll || isSyncingAll}
                className="text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/10"
              >
                {isTestingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Test Untested
                <Badge variant="secondary" className="ml-2 text-xs bg-yellow-500/20 text-yellow-600">
                  {untestedCount}
                </Badge>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Test all {untestedCount} untested integrations</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncAll}
              disabled={isTestingAll || isSyncingAll}
            >
              {isSyncingAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Sync All
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Trigger sync for all active integrations</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}