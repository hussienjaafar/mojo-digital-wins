import React from 'react';
import { AlertTriangle, CheckCircle, Circle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IntegrationStatusCounts, IntegrationHealthStatus } from '@/types/integrations';

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
}

function StatusItem({ icon, count, label, colorClass, isActive, onClick }: StatusItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
        "hover:bg-accent/50",
        isActive && "bg-accent ring-2 ring-primary/20"
      )}
    >
      <span className={colorClass}>{icon}</span>
      <span className="font-semibold text-lg">{count}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </button>
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
      />

      <StatusItem
        icon={<CheckCircle className="h-4 w-4" />}
        count={counts.healthy}
        label="healthy"
        colorClass="text-green-500"
        isActive={activeFilter === 'healthy'}
        onClick={() => onFilterChange('healthy')}
      />

      <StatusItem
        icon={<HelpCircle className="h-4 w-4" />}
        count={counts.untested}
        label="untested"
        colorClass="text-yellow-500"
        isActive={activeFilter === 'untested'}
        onClick={() => onFilterChange('untested')}
      />

      <StatusItem
        icon={<Circle className="h-4 w-4" />}
        count={counts.noSetup}
        label="no setup"
        colorClass="text-muted-foreground"
        isActive={activeFilter === 'no_setup'}
        onClick={() => onFilterChange('no_setup')}
      />
    </div>
  );
}
