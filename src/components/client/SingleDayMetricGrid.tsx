/**
 * SingleDayMetricGrid
 * 
 * A reusable component for displaying metrics in a clean grid format,
 * optimized for single-day views where line charts would be meaningless.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { V3TrendIndicator } from '@/components/v3';
import { motion } from 'framer-motion';

export type MetricFormat = 'currency' | 'number' | 'percent' | 'ratio' | 'text';
export type MetricAccent = 'blue' | 'green' | 'purple' | 'amber' | 'default';

export interface SingleDayMetric {
  label: string;
  value: number | string;
  previousValue?: number | string;
  format: MetricFormat;
  accent?: MetricAccent;
  icon?: React.ReactNode;
}

interface SingleDayMetricGridProps {
  metrics: SingleDayMetric[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const accentColors: Record<MetricAccent, string> = {
  blue: 'border-l-[hsl(var(--portal-accent-blue))]',
  green: 'border-l-[hsl(var(--portal-success))]',
  purple: 'border-l-[hsl(var(--portal-accent-purple))]',
  amber: 'border-l-[hsl(var(--portal-warning))]',
  default: 'border-l-[hsl(var(--portal-border))]',
};

function formatValue(value: number | string, format: MetricFormat): string {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
      return `$${value.toFixed(2)}`;
    case 'number':
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toLocaleString();
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'ratio':
      return `${value.toFixed(2)}x`;
    case 'text':
    default:
      return String(value);
  }
}

function calculateChange(current: number | string, previous: number | string): number | null {
  if (typeof current !== 'number' || typeof previous !== 'number') return null;
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export const SingleDayMetricGrid: React.FC<SingleDayMetricGridProps> = ({
  metrics,
  columns = 4,
  className,
}) => {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-3', gridCols[columns], className)}>
      {metrics.map((metric, index) => {
        const change = metric.previousValue !== undefined
          ? calculateChange(metric.value, metric.previousValue)
          : null;

        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'bg-[hsl(var(--portal-bg-elevated))] rounded-lg p-3 border-l-2',
              accentColors[metric.accent || 'default'],
              'border border-[hsl(var(--portal-border))]'
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {metric.icon && (
                <span className="text-[hsl(var(--portal-text-muted))]">
                  {metric.icon}
                </span>
              )}
              <span className="text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">
                {metric.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-[hsl(var(--portal-text-primary))]">
                {formatValue(metric.value, metric.format)}
              </span>
              {change !== null && (
                <V3TrendIndicator
                  value={change}
                  size="sm"
                  suffix="%"
                />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default SingleDayMetricGrid;
