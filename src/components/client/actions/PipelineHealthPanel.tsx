import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
  Bot,
  FileText,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { usePipelineHealth, useForceGenerate, type PipelineHealth } from "@/hooks/usePipelineHealth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";

interface PipelineHealthPanelProps {
  organizationId: string | undefined;
  onRefresh?: () => void;
}

const StatusIndicator = ({ 
  status, 
  label,
  lastRun,
  error,
}: { 
  status: 'ok' | 'stale' | 'error' | 'unknown';
  label: string;
  lastRun: string | null;
  error: string | null;
}) => {
  const statusConfig = {
    ok: {
      icon: CheckCircle2,
      color: 'text-[hsl(var(--portal-success))]',
      bg: 'bg-[hsl(var(--portal-success)/0.1)]',
      label: 'OK',
    },
    stale: {
      icon: Clock,
      color: 'text-[hsl(var(--portal-warning))]',
      bg: 'bg-[hsl(var(--portal-warning)/0.1)]',
      label: 'Stale',
    },
    error: {
      icon: AlertTriangle,
      color: 'text-[hsl(var(--portal-error))]',
      bg: 'bg-[hsl(var(--portal-error)/0.1)]',
      label: 'Error',
    },
    unknown: {
      icon: Clock,
      color: 'text-[hsl(var(--portal-text-tertiary))]',
      bg: 'bg-[hsl(var(--portal-bg-subtle))]',
      label: 'Unknown',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-full", config.bg)}>
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[hsl(var(--portal-text-primary))]">
                {label}
              </span>
              <span className="text-[10px] text-[hsl(var(--portal-text-tertiary))]">
                {lastRun 
                  ? formatDistanceToNow(new Date(lastRun), { addSuffix: true })
                  : 'Never run'}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{label}: {config.label}</p>
            {lastRun && (
              <p className="text-xs text-muted-foreground">
                Last run: {format(new Date(lastRun), "MMM d, h:mm a")}
              </p>
            )}
            {error && (
              <p className="text-xs text-destructive">Error: {error}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export function PipelineHealthPanel({ 
  organizationId,
  onRefresh,
}: PipelineHealthPanelProps) {
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();
  const [isExpanded, setIsExpanded] = useState(false);
  const [forceOptions, setForceOptions] = useState({
    lookbackDays: 7,
    minActionableScore: 30,
  });

  const { data: health, isLoading, refetch } = usePipelineHealth(organizationId);
  const forceGenerate = useForceGenerate(organizationId);

  const handleForceGenerate = async () => {
    try {
      const result = await forceGenerate.mutateAsync(forceOptions);
      toast({
        title: "Generation Complete",
        description: `Generated ${result.actionsGenerated || 0} actions from ${result.alertsProcessed || 0} alerts`,
      });
      onRefresh?.();
      refetch();
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate actions",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !health) {
    return (
      <div className="rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[hsl(var(--portal-text-tertiary))] animate-pulse" />
          <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
            Loading pipeline status...
          </span>
        </div>
      </div>
    );
  }

  const overallStatus = 
    health.matchWatchlist.status === 'error' || health.generateActions.status === 'error'
      ? 'error'
      : health.matchWatchlist.status === 'stale' || health.generateActions.status === 'stale'
        ? 'stale'
        : health.matchWatchlist.status === 'ok' && health.generateActions.status === 'ok'
          ? 'ok'
          : 'unknown';

  const overallStyles = {
    ok: 'border-[hsl(var(--portal-success)/0.3)] bg-[hsl(var(--portal-success)/0.05)]',
    stale: 'border-[hsl(var(--portal-warning)/0.3)] bg-[hsl(var(--portal-warning)/0.05)]',
    error: 'border-[hsl(var(--portal-error)/0.3)] bg-[hsl(var(--portal-error)/0.05)]',
    unknown: 'border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-lg border p-3 transition-colors",
          overallStyles[overallStatus]
        )}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[hsl(var(--portal-text-secondary))]" />
              <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                Pipeline Health
              </span>
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center gap-4">
              <StatusIndicator
                status={health.matchWatchlist.status}
                label="Entity Matching"
                lastRun={health.matchWatchlist.lastRun}
                error={health.matchWatchlist.lastError}
              />
              <StatusIndicator
                status={health.generateActions.status}
                label="Action Generation"
                lastRun={health.generateActions.lastRun}
                error={health.generateActions.lastError}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick metrics */}
            <div className="hidden sm:flex items-center gap-3 mr-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Zap className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
                      <span className="text-[hsl(var(--portal-text-secondary))]">
                        {health.metrics.actionsGenerated24h} / 24h
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Actions generated in last 24 hours</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Bot className="h-3.5 w-3.5 text-[hsl(var(--portal-success))]" />
                      <span className="text-[hsl(var(--portal-text-secondary))]">
                        {health.metrics.aiRatio}% AI
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    AI-generated vs template ratio
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 pt-4 border-t border-[hsl(var(--portal-border)/0.5)] space-y-4"
          >
            {/* Detailed metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Alerts (24h)</p>
                <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                  {health.metrics.actionableAlerts24h}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Actions (24h)</p>
                <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                  {health.metrics.actionsGenerated24h}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">AI Generated</p>
                <p className="text-lg font-semibold text-[hsl(var(--portal-success))]">
                  {health.metrics.aiGeneratedCount}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-tertiary))]">Templates</p>
                <p className="text-lg font-semibold text-[hsl(var(--portal-text-secondary))]">
                  {health.metrics.templateGeneratedCount}
                </p>
              </div>
            </div>

            {/* AI ratio progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[hsl(var(--portal-text-tertiary))]">AI vs Template ratio</span>
                <span className="text-[hsl(var(--portal-text-secondary))]">
                  {health.metrics.aiRatio}% AI
                </span>
              </div>
              <Progress 
                value={health.metrics.aiRatio} 
                className="h-1.5"
              />
            </div>

            {/* Admin controls */}
            {isAdmin && (
              <div className="pt-2 border-t border-[hsl(var(--portal-border)/0.5)]">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[hsl(var(--portal-text-tertiary))]">
                        Lookback:
                      </label>
                      <select
                        value={forceOptions.lookbackDays}
                        onChange={(e) => setForceOptions(o => ({ ...o, lookbackDays: Number(e.target.value) }))}
                        className="h-7 text-xs rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] px-2"
                      >
                        <option value={1}>24 hours</option>
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[hsl(var(--portal-text-tertiary))]">
                        Min score:
                      </label>
                      <select
                        value={forceOptions.minActionableScore}
                        onChange={(e) => setForceOptions(o => ({ ...o, minActionableScore: Number(e.target.value) }))}
                        className="h-7 text-xs rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] px-2"
                      >
                        <option value={20}>20 (low)</option>
                        <option value={30}>30</option>
                        <option value={50}>50 (default)</option>
                        <option value={70}>70 (high)</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    onClick={handleForceGenerate}
                    disabled={forceGenerate.isPending}
                    size="sm"
                    className="gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
                  >
                    {forceGenerate.isPending ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Force Generate
                  </Button>
                </div>
                
                {overallStatus === 'stale' && (
                  <p className="mt-2 text-xs text-[hsl(var(--portal-warning))]">
                    ⚠️ Pipeline appears stale. Consider running Force Generate to refresh actions.
                  </p>
                )}
              </div>
            )}

            {/* Last snapshot timestamp */}
            {health.lastSnapshot && (
              <p className="text-[10px] text-[hsl(var(--portal-text-tertiary))]">
                Last snapshot: {format(new Date(health.lastSnapshot), "MMM d, h:mm:ss a")}
              </p>
            )}
          </motion.div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
}
