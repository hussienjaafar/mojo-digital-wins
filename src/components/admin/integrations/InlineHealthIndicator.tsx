import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineHealthIndicatorProps {
  webhookFailures?: number;
  lastError?: string;
  daysStale?: number;
  failureRate?: number;
  className?: string;
}

export const InlineHealthIndicator: React.FC<InlineHealthIndicatorProps> = ({
  webhookFailures = 0,
  lastError,
  daysStale = 0,
  failureRate = 0,
  className,
}) => {
  const issues: React.ReactNode[] = [];

  // Check for webhook failures
  if (webhookFailures > 0 && failureRate > 50) {
    issues.push(
      <div key="webhook" className="flex items-center gap-1.5 text-[hsl(var(--portal-error))]">
        <XCircle className="h-3.5 w-3.5" />
        <span className="text-xs">
          Webhook failing ({webhookFailures} events)
        </span>
      </div>
    );
  } else if (webhookFailures > 0 && failureRate > 10) {
    issues.push(
      <div key="webhook" className="flex items-center gap-1.5 text-[hsl(var(--portal-warning))]">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs">
          {Math.round(failureRate)}% webhook failures
        </span>
      </div>
    );
  }

  // Check for stale data
  if (daysStale >= 3) {
    issues.push(
      <div key="stale" className="flex items-center gap-1.5 text-[hsl(var(--portal-warning))]">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs">
          Data {daysStale}d stale
        </span>
      </div>
    );
  }

  // Show last error if present
  if (lastError && issues.length === 0) {
    const shortError = lastError.length > 30 
      ? lastError.substring(0, 30) + '...' 
      : lastError;
    issues.push(
      <div key="error" className="flex items-center gap-1.5 text-[hsl(var(--portal-error))]">
        <XCircle className="h-3.5 w-3.5" />
        <span className="text-xs truncate max-w-[200px]" title={lastError}>
          {shortError}
        </span>
      </div>
    );
  }

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1 mt-1", className)}>
      {issues}
    </div>
  );
};
