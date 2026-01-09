import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IntegrationSummary, IntegrationHealthStatus, PLATFORM_ICONS } from '@/types/integrations';

interface IntegrationOrgRowProps {
  summary: IntegrationSummary;
  onClick: () => void;
  isSelected?: boolean;
  index?: number;
}

const healthIndicatorStyles: Record<IntegrationHealthStatus, { dot: string; label: string }> = {
  needs_attention: {
    dot: 'bg-[hsl(var(--portal-error))]',
    label: 'Needs attention',
  },
  healthy: {
    dot: 'bg-[hsl(var(--portal-success))]',
    label: 'Healthy',
  },
  untested: {
    dot: 'bg-[hsl(var(--portal-warning))]',
    label: 'Untested',
  },
  no_setup: {
    dot: 'bg-[hsl(var(--portal-text-tertiary))]',
    label: 'No integrations',
  },
  all_disabled: {
    dot: 'bg-[hsl(var(--portal-text-tertiary))]',
    label: 'All disabled',
  },
};

function HealthDot({ status }: { status: IntegrationHealthStatus }) {
  const config = healthIndicatorStyles[status];
  const isPulsing = status === 'needs_attention';

  return (
    <div className="relative flex items-center justify-center w-6 h-6">
      {isPulsing && (
        <motion.div
          className={cn("absolute w-3 h-3 rounded-full", config.dot, "opacity-40")}
          animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      <div className={cn("w-2.5 h-2.5 rounded-full", config.dot)} />
    </div>
  );
}

function PlatformIcons({ integrations }: { integrations: IntegrationSummary['integrations'] }) {
  const platforms = [...new Set(integrations.map(i => i.platform))];
  
  if (platforms.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5">
      {platforms.slice(0, 3).map((platform) => (
        <span key={platform} className="text-sm opacity-60" title={platform}>
          {PLATFORM_ICONS[platform] || '🔌'}
        </span>
      ))}
      {platforms.length > 3 && (
        <span className="text-xs text-[hsl(var(--portal-text-tertiary))]">
          +{platforms.length - 3}
        </span>
      )}
    </div>
  );
}

export function IntegrationOrgRow({
  summary,
  onClick,
  isSelected = false,
  index = 0,
}: IntegrationOrgRowProps) {
  const healthConfig = healthIndicatorStyles[summary.health_status];
  const hasIssues = summary.health_status === 'needs_attention';
  const isNoSetup = summary.total_count === 0;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl",
        "border border-[hsl(var(--portal-border))]",
        "bg-[hsl(var(--portal-bg-card))]",
        "transition-all duration-200",
        "hover:border-[hsl(var(--portal-border-hover))]",
        "hover:shadow-sm hover:bg-[hsl(var(--portal-bg-elevated))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:ring-offset-2",
        "group text-left",
        isSelected && "ring-2 ring-[hsl(var(--portal-accent-blue))] border-transparent",
        hasIssues && "border-l-4 border-l-[hsl(var(--portal-error))]"
      )}
    >
      {/* Health Indicator */}
      <HealthDot status={summary.health_status} />

      {/* Organization Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[hsl(var(--portal-text-primary))] truncate">
            {summary.organization_name}
          </span>
          {!summary.org_is_active && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Inactive
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[hsl(var(--portal-text-secondary))]">
            {summary.organization_slug}
          </span>
          {summary.error_count > 0 && (
            <span className="text-xs text-[hsl(var(--portal-error))]">
              • {summary.error_count} error{summary.error_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Platform Icons & Count */}
      <div className="flex items-center gap-3 shrink-0">
        <PlatformIcons integrations={summary.integrations} />
        <Badge 
          variant="secondary" 
          className={cn(
            "min-w-[2rem] justify-center",
            isNoSetup && "text-[hsl(var(--portal-text-tertiary))]"
          )}
        >
          {summary.total_count}
        </Badge>
      </div>

      {/* Chevron */}
      <ChevronRight 
        className={cn(
          "h-5 w-5 shrink-0",
          "text-[hsl(var(--portal-text-tertiary))]",
          "transition-transform duration-200",
          "group-hover:text-[hsl(var(--portal-text-secondary))]",
          "group-hover:translate-x-0.5"
        )}
      />
    </motion.button>
  );
}
