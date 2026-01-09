import React from 'react';
import { AlertTriangle, CheckCircle, Circle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IntegrationStatusCounts, IntegrationHealthStatus } from '@/types/integrations';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface IntegrationStatusBarProps {
  counts: IntegrationStatusCounts;
  activeFilter: IntegrationHealthStatus | 'all';
  onFilterChange: (filter: IntegrationHealthStatus | 'all') => void;
}

interface StatusItemProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  colorClass: string;
  isActive: boolean;
  onClick: () => void;
  tooltip: string;
  pulse?: boolean;
}

function StatusItem({ icon, count, label, colorClass, isActive, onClick, tooltip, pulse }: StatusItemProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-all relative",
              "hover:bg-accent/50",
              isActive && "bg-accent ring-2 ring-primary/20"
            )}
          >
            {pulse && count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
              </span>
            )}
            <span className={colorClass}>{icon}</span>
            <span className="font-semibold text-lg">{count}</span>
            <span className="text-muted-foreground text-sm">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function IntegrationStatusBar({ 
  counts, 
  activeFilter, 
  onFilterChange 
}: IntegrationStatusBarProps) {
  const total = counts.needsAttention + counts.healthy + counts.noSetup + counts.untested;

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-card rounded-lg border">
      <button
        onClick={() => onFilterChange('all')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
          "hover:bg-accent/50",
          activeFilter === 'all' && "bg-accent ring-2 ring-primary/20"
        )}
      >
        <span className="font-semibold text-lg">{total}</span>
        <span className="text-muted-foreground text-sm">Total</span>
      </button>

      <div className="w-px h-8 bg-border mx-2" />

      <StatusItem
        icon={<AlertTriangle className="h-4 w-4" />}
        count={counts.needsAttention}
        label="needs attention"
        colorClass="text-destructive"
        isActive={activeFilter === 'needs_attention'}
        onClick={() => onFilterChange('needs_attention')}
        tooltip="Integrations with errors that need immediate attention"
        pulse={counts.needsAttention > 0}
      />

      <StatusItem
        icon={<CheckCircle className="h-4 w-4" />}
        count={counts.healthy}
        label="healthy"
        colorClass="text-green-500"
        isActive={activeFilter === 'healthy'}
        onClick={() => onFilterChange('healthy')}
        tooltip="Integrations that are working correctly"
      />

      <StatusItem
        icon={<HelpCircle className="h-4 w-4" />}
        count={counts.untested}
        label="untested"
        colorClass="text-yellow-500"
        isActive={activeFilter === 'untested'}
        onClick={() => onFilterChange('untested')}
        tooltip="Integrations that haven't been tested yet"
      />

      <StatusItem
        icon={<Circle className="h-4 w-4" />}
        count={counts.noSetup}
        label="no setup"
        colorClass="text-muted-foreground"
        isActive={activeFilter === 'no_setup'}
        onClick={() => onFilterChange('no_setup')}
        tooltip="Clients without any integrations configured"
      />
    </div>
  );
}
