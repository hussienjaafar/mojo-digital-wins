/**
 * CampaignRow Component
 * 
 * Displays a single campaign with aggregated metrics.
 * Clicking drills down to show ad sets within the campaign.
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronRight, Layers, LayoutGrid } from 'lucide-react';
import type { CampaignMetrics } from '@/types/adHierarchy';
import { formatCurrency, formatPercentage, formatRoas, getRoasColor } from '@/utils/adPerformance';

interface CampaignRowProps {
  campaign: CampaignMetrics;
  isSelected: boolean;
  onSelect: (campaignId: string, selected: boolean) => void;
  onDrillDown: (campaignId: string) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'PAUSED':
      return { label: 'Paused', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'ARCHIVED':
      return { label: 'Archived', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
    default:
      return { label: status, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
  }
}

export function CampaignRow({
  campaign,
  isSelected,
  onSelect,
  onDrillDown,
}: CampaignRowProps) {
  const statusBadge = getStatusBadge(campaign.status);

  return (
    <div
      className={cn(
        'group',
        'rounded-lg border border-[hsl(var(--portal-border))]',
        'bg-[hsl(var(--portal-bg-secondary))]',
        'hover:border-[hsl(var(--portal-accent-blue)/0.3)]',
        'hover:shadow-sm',
        'transition-all duration-200',
        isSelected && 'border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.05)]'
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(campaign.campaign_id, !!checked)}
          className="h-4 w-4"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Campaign Icon */}
        <div className="w-10 h-10 rounded-md bg-[hsl(var(--portal-bg-tertiary))] flex items-center justify-center flex-shrink-0">
          <LayoutGrid className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
        </div>

        {/* Campaign Info */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onDrillDown(campaign.campaign_id)}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] truncate">
              {campaign.campaign_name}
            </h3>
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0 h-4 font-medium', statusBadge.className)}
            >
              {statusBadge.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[hsl(var(--portal-text-muted))]">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {campaign.adset_count} ad set{campaign.adset_count !== 1 ? 's' : ''}
            </span>
            <span>•</span>
            <span>{campaign.ad_count} ad{campaign.ad_count !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 text-right flex-shrink-0">
          <div className="w-16 hidden sm:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Spend</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {formatCurrency(campaign.total_spend)}
            </div>
          </div>

          <div className="w-16">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Raised</div>
            <div className={cn(
              'text-sm font-semibold',
              campaign.total_raised > 0 ? 'text-green-600 dark:text-green-400' : 'text-[hsl(var(--portal-text-muted))]'
            )}>
              {formatCurrency(campaign.total_raised)}
            </div>
          </div>

          <div className="w-14">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">ROAS</div>
            <div className={cn('text-sm font-bold', getRoasColor(campaign.total_roas))}>
              {formatRoas(campaign.total_roas)}
            </div>
          </div>

          <div className="w-14 hidden md:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">CPA</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {campaign.unique_donors > 0 ? formatCurrency(campaign.avg_cpa) : '--'}
            </div>
          </div>

          <div className="w-12 hidden lg:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Donors</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {campaign.unique_donors}
            </div>
          </div>

          {/* Drill Down Button */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    'h-8 w-8 flex items-center justify-center rounded-md',
                    'text-[hsl(var(--portal-text-muted))]',
                    'hover:text-[hsl(var(--portal-text-primary))]',
                    'hover:bg-[hsl(var(--portal-bg-hover))]',
                    'transition-colors'
                  )}
                  onClick={() => onDrillDown(campaign.campaign_id)}
                  aria-label="View ad sets"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">View ad sets</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
