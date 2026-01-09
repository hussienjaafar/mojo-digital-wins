import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

export interface SyncEvent {
  id: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending' | 'running';
  message?: string;
  duration_ms?: number;
}

interface SyncTimelineProps {
  events: SyncEvent[];
  maxEvents?: number;
  className?: string;
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-[hsl(var(--portal-success))]',
    bgColor: 'bg-[hsl(var(--portal-success))]',
    label: 'Success',
  },
  error: {
    icon: XCircle,
    color: 'text-[hsl(var(--portal-error))]',
    bgColor: 'bg-[hsl(var(--portal-error))]',
    label: 'Failed',
  },
  pending: {
    icon: Clock,
    color: 'text-[hsl(var(--portal-warning))]',
    bgColor: 'bg-[hsl(var(--portal-warning))]',
    label: 'Pending',
  },
  running: {
    icon: Loader2,
    color: 'text-[hsl(var(--portal-accent-blue))]',
    bgColor: 'bg-[hsl(var(--portal-accent-blue))]',
    label: 'Running',
  },
};

export function SyncTimeline({ events, maxEvents = 5, className }: SyncTimelineProps) {
  const displayEvents = events.slice(0, maxEvents);

  if (displayEvents.length === 0) {
    return (
      <div className={cn("text-center py-4", className)}>
        <p className="text-sm text-[hsl(var(--portal-text-tertiary))]">
          No sync history available
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {displayEvents.map((event, index) => {
        const config = statusConfig[event.status];
        const Icon = config.icon;
        const isLast = index === displayEvents.length - 1;

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative flex gap-3"
          >
            {/* Timeline line */}
            {!isLast && (
              <div 
                className="absolute left-[11px] top-6 w-0.5 h-[calc(100%-8px)] bg-[hsl(var(--portal-border))]" 
              />
            )}
            
            {/* Icon */}
            <div className={cn(
              "relative z-10 flex items-center justify-center w-6 h-6 rounded-full",
              "bg-[hsl(var(--portal-bg-card))]"
            )}>
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                config.bgColor
              )} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-3">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium", config.color)}>
                  {config.label}
                </span>
                {event.duration_ms && (
                  <span className="text-xs text-[hsl(var(--portal-text-tertiary))]">
                    ({(event.duration_ms / 1000).toFixed(1)}s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[hsl(var(--portal-text-tertiary))]">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </span>
                <span className="text-xs text-[hsl(var(--portal-text-tertiary))]">•</span>
                <span className="text-xs text-[hsl(var(--portal-text-tertiary))]">
                  {format(new Date(event.timestamp), 'MMM d, h:mm a')}
                </span>
              </div>
              {event.message && (
                <p className="text-xs text-[hsl(var(--portal-text-secondary))] mt-1 break-words">
                  {event.message}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
