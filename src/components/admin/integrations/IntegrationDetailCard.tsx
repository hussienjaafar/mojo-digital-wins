import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  Circle, 
  Clock,
  Loader2,
  Power,
  Settings,
  RefreshCw,
  Link2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { 
  IntegrationDetail, 
  PLATFORM_DISPLAY_NAMES, 
  PLATFORM_ICONS 
} from '@/types/integrations';
import { formatDistanceToNow } from 'date-fns';
import { ErrorTypeBadge, categorizeError } from './ErrorTypeBadge';

interface IntegrationDetailCardProps {
  integration: IntegrationDetail;
  onTest: (id: string) => Promise<boolean>;
  onToggle: (id: string, currentState: boolean) => Promise<boolean>;
  onEdit: (id: string) => void;
}

const platformAccentColors: Record<string, string> = {
  meta_ads: 'border-l-[#1877F2]',
  switchboard: 'border-l-[hsl(var(--portal-accent-purple))]',
  actblue: 'border-l-[#0033A0]',
  google_ads: 'border-l-[#4285F4]',
};

export function IntegrationDetailCard({ 
  integration, 
  onTest, 
  onToggle,
  onEdit 
}: IntegrationDetailCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    await onTest(integration.id);
    setIsTesting(false);
  };

  const handleToggle = async () => {
    setDisableDialogOpen(false);
    setIsToggling(true);
    await onToggle(integration.id, integration.is_active);
    setIsToggling(false);
  };

  const getStatusConfig = () => {
    if (!integration.is_active) {
      return {
        icon: <Circle className="h-4 w-4 text-[hsl(var(--portal-text-tertiary))]" />,
        label: 'Disabled',
        color: 'text-[hsl(var(--portal-text-tertiary))]',
      };
    }
    if (integration.last_sync_status === 'success') {
      return {
        icon: <CheckCircle className="h-4 w-4 text-[hsl(var(--portal-success))]" />,
        label: 'Connected',
        color: 'text-[hsl(var(--portal-success))]',
      };
    }
    if (integration.last_sync_status === 'error' || integration.last_sync_status === 'failed') {
      return {
        icon: <XCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />,
        label: 'Failed',
        color: 'text-[hsl(var(--portal-error))]',
      };
    }
    if (!integration.last_tested_at) {
      return {
        icon: <Clock className="h-4 w-4 text-[hsl(var(--portal-warning))]" />,
        label: 'Untested',
        color: 'text-[hsl(var(--portal-warning))]',
      };
    }
    return {
      icon: <Circle className="h-4 w-4 text-[hsl(var(--portal-text-tertiary))]" />,
      label: 'Pending',
      color: 'text-[hsl(var(--portal-text-tertiary))]',
    };
  };

  const getLastSyncText = () => {
    if (!integration.last_sync_at) return 'Never synced';
    return `Last sync: ${formatDistanceToNow(new Date(integration.last_sync_at), { addSuffix: true })}`;
  };

  const platformName = PLATFORM_DISPLAY_NAMES[integration.platform] || integration.platform;
  const platformIcon = PLATFORM_ICONS[integration.platform] || '🔌';
  const accentColor = platformAccentColors[integration.platform] || 'border-l-[hsl(var(--portal-border))]';
  const hasError = integration.last_sync_status === 'error' || integration.last_sync_status === 'failed';
  const statusConfig = getStatusConfig();

  return (
    <div 
      className={cn(
        "rounded-xl border border-[hsl(var(--portal-border))]",
        "bg-[hsl(var(--portal-bg-card))]",
        "border-l-4",
        accentColor,
        "transition-all duration-200",
        "hover:shadow-sm",
        !integration.is_active && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{platformIcon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                  {platformName}
                </span>
                <div className={cn("flex items-center gap-1", statusConfig.color)}>
                  {statusConfig.icon}
                  <span className="text-xs">{statusConfig.label}</span>
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--portal-text-tertiary))] mt-0.5">
                {getLastSyncText()}
              </p>
            </div>
          </div>
        </div>

        {/* Error section */}
        {hasError && integration.last_sync_error && (
          <div className="mt-3 p-3 rounded-lg bg-[hsl(var(--portal-error)/0.05)] border border-[hsl(var(--portal-error)/0.2)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-error))] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <ErrorTypeBadge errorMessage={integration.last_sync_error} className="mb-2" />
                <p className="text-xs text-[hsl(var(--portal-text-secondary))] break-words">
                  {integration.last_sync_error}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        <TooltipProvider>
          {/* Test Connection */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting || !integration.is_active}
                className="gap-1.5 border-[hsl(var(--portal-border))]"
              >
                {isTesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Test
              </Button>
            </TooltipTrigger>
            <TooltipContent>Test connection</TooltipContent>
          </Tooltip>

          {/* Reconnect (only for errors) */}
          {hasError && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(integration.id)}
              className="gap-1.5 border-[hsl(var(--portal-warning))] text-[hsl(var(--portal-warning))] hover:bg-[hsl(var(--portal-warning)/0.1)]"
            >
              <Link2 className="h-3.5 w-3.5" />
              Reconnect
            </Button>
          )}

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(integration.id)}
                className="gap-1.5"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit integration settings</TooltipContent>
          </Tooltip>

          {/* Enable/Disable with confirmation for disable */}
          <div className="ml-auto">
            {integration.is_active ? (
              <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isToggling}
                    className="gap-1.5 text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-error))]"
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                    Disable
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable {platformName} Integration?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop syncing data from {platformName}. You can re-enable it at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleToggle}
                      className="bg-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.9)]"
                    >
                      Disable
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={isToggling}
                    className="gap-1.5 border-[hsl(var(--portal-success))] text-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.1)]"
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                    Enable
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enable this integration</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
