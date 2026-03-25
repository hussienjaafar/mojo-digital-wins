/**
 * AdSetRow Component
 * 
 * Displays a single ad set with aggregated metrics.
 * Clicking drills down to show ads within the ad set.
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
import { ChevronRight, Layers } from 'lucide-react';
import type { AdSetMetrics } from '@/types/adHierarchy';
import { formatCurrency, formatPercentage, formatRoas, getRoasColor } from '@/utils/adPerformance';

interface AdSetRowProps {
  adset: AdSetMetrics;
  isSelected: boolean;
  onSelect: (adsetId: string, selected: boolean) => void;
  onDrillDown: (adsetId: string) => void;
}

export function AdSetRow({
  adset,
  isSelected,
  onSelect,
  onDrillDown,
}: AdSetRowProps) {
  return (
    <div
      className={cn(
        'group',
        'rounded-lg border border-[hsl(var(--portal-border))]',
        'bg-[hsl(var(--portal-bg-secondary))]',
        'hover:border-[hsl(var(--portal-accent-purple)/0.3)]',
        'hover:shadow-sm',
        'transition-all duration-200',
        isSelected && 'border-[hsl(var(--portal-accent-purple))] bg-[hsl(var(--portal-accent-purple)/0.05)]'
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(adset.adset_id, !!checked)}
          className="h-4 w-4"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Ad Set Icon */}
        <div className="w-10 h-10 rounded-md bg-[hsl(var(--portal-bg-tertiary))] flex items-center justify-center flex-shrink-0">
          <Layers className="h-5 w-5 text-[hsl(var(--portal-accent-purple))]" />
        </div>

        {/* Ad Set Info */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onDrillDown(adset.adset_id)}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] truncate">
              {adset.adset_name}
            </h3>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-normal text-[hsl(var(--portal-text-muted))]"
            >
              {adset.campaign_name}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[hsl(var(--portal-text-muted))]">
            <span>{adset.ad_count} ad{adset.ad_count !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 text-right flex-shrink-0">
          <div className="w-16 hidden sm:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Spend</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {formatCurrency(adset.total_spend)}
            </div>
          </div>

          <div className="w-16">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Raised</div>
            <div className={cn(
              'text-sm font-semibold',
              adset.total_raised > 0 ? 'text-green-600 dark:text-green-400' : 'text-[hsl(var(--portal-text-muted))]'
            )}>
              {formatCurrency(adset.total_raised)}
            </div>
          </div>

          <div className="w-14">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">ROAS</div>
            <div className={cn('text-sm font-bold', getRoasColor(adset.total_roas))}>
              {formatRoas(adset.total_roas)}
            </div>
          </div>

          <div className="w-14 hidden md:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">CPA</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {adset.unique_donors > 0 ? formatCurrency(adset.avg_cpa) : '--'}
            </div>
          </div>

          <div className="w-12 hidden lg:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Donors</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {adset.unique_donors}
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
                  onClick={() => onDrillDown(adset.adset_id)}
                  aria-label="View ads"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">View ads</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
