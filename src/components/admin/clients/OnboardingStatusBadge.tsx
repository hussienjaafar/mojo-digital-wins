import React from 'react';
import { V3Badge } from '@/components/v3/V3Badge';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Circle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type OnboardingEffectiveStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'blocked' 
  | 'completed';

interface OnboardingStatusBadgeProps {
  status: OnboardingEffectiveStatus;
  currentStep?: number;
  totalSteps?: number;
  blockingReason?: string | null;
  showProgress?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

const STATUS_CONFIG: Record<OnboardingEffectiveStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'blue' | 'success' | 'destructive' | 'outline';
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}> = {
  not_started: {
    label: 'Setup Required',
    variant: 'secondary',
    icon: Circle,
    className: 'border-muted-foreground/30',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'blue',
    icon: Clock,
  },
  blocked: {
    label: 'Blocked',
    variant: 'destructive',
    icon: AlertTriangle,
  },
  completed: {
    label: 'Complete',
    variant: 'success',
    icon: CheckCircle2,
  },
};

export function OnboardingStatusBadge({
  status,
  currentStep = 1,
  totalSteps = 6,
  blockingReason,
  showProgress = true,
  size = 'default',
  className,
}: OnboardingStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const Icon = config.icon;

  // Build the label
  let displayLabel = config.label;
  if (status === 'in_progress' && showProgress) {
    displayLabel = `Step ${currentStep}/${totalSteps}`;
  } else if (status === 'blocked' && blockingReason) {
    displayLabel = 'Blocked';
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <V3Badge 
        variant={config.variant as any}
        size={size}
        className={cn(
          'gap-1.5 font-medium',
          config.className
        )}
      >
        <Icon className={cn(
          'shrink-0',
          size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5',
          status === 'in_progress' && 'animate-pulse'
        )} />
        {displayLabel}
      </V3Badge>
      
      {/* Tooltip-style blocking reason */}
      {status === 'blocked' && blockingReason && (
        <span className="text-xs text-destructive truncate max-w-[150px]" title={blockingReason}>
          {blockingReason}
        </span>
      )}
    </div>
  );
}

// Compact version for table cells
export function OnboardingStatusDot({
  status,
  className,
}: {
  status: OnboardingEffectiveStatus;
  className?: string;
}) {
  const colorMap: Record<OnboardingEffectiveStatus, string> = {
    not_started: 'bg-muted-foreground/50',
    in_progress: 'bg-blue-500',
    blocked: 'bg-destructive',
    completed: 'bg-green-500',
  };

  return (
    <span 
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        colorMap[status],
        status === 'in_progress' && 'animate-pulse',
        className
      )}
      title={STATUS_CONFIG[status]?.label}
    />
  );
}
