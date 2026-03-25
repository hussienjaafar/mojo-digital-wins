/**
 * AdPerformanceRow Component
 *
 * Compact row layout for ad performance data.
 * V3 design system aligned with premium, scannable format.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronDown,
  Video,
  Image as ImageIcon,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import type { AdPerformanceData, AdVideoTranscription } from '@/types/adPerformance';
import {
  formatCurrency,
  formatPercentage,
  formatRoas,
  getRoasColor,
  isLowSpend,
} from '@/utils/adPerformance';
import { TranscriptionStatusBadge } from './TranscriptionStatusBadge';

interface AdPerformanceRowProps {
  ad: AdPerformanceData;
  onSelect?: (ad: AdPerformanceData) => void;
  /** If true, spend/impressions are estimated (campaign distributed) */
  isEstimatedDistribution?: boolean;
  /** Transcription data for this ad's video (if available) */
  transcription?: AdVideoTranscription | null;
  /** Callback to trigger transcription for this ad */
  onTranscribe?: (adId: string, videoId: string) => void;
  /** Whether transcription is in progress for this ad */
  isTranscribing?: boolean;
}

/**
 * Get tier badge styles - contextual based on data quality
 */
function getTierBadge(
  tier: string | null,
  spend: number,
  hasAttribution: boolean,
  isEstimatedDistribution: boolean
): { label: string; className: string } | null {
  // If in estimated mode and no attribution, don't show ROAS-based tier
  if (isEstimatedDistribution && !hasAttribution) {
    return { label: 'Estimated', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
  }

  // If no attribution at all, show "No Attribution" instead of misleading ROAS tier
  if (!hasAttribution && spend > 0) {
    return { label: 'No Attribution', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
  }

  // Don't show "Needs Improvement" for low spend - show "Learning" instead
  if (spend < 50) {
    return { label: 'Learning', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
  }

  switch (tier) {
    case 'TOP_PERFORMER':
      return { label: 'Top', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'STRONG':
      return { label: 'Strong', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'AVERAGE':
      return { label: 'Average', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'NEEDS_IMPROVEMENT':
      return { label: 'Low ROAS', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    default:
      return null;
  }
}

export function AdPerformanceRow({
  ad,
  onSelect,
  isEstimatedDistribution = false,
  transcription,
  onTranscribe,
  isTranscribing = false,
}: AdPerformanceRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lowSpend = isLowSpend(ad);
  const isVideo = ad.creative_type === 'video';
  const hasAttribution = ad.raised > 0 || ad.unique_donors > 0;
  const tierBadge = getTierBadge(ad.performance_tier, ad.spend, hasAttribution, isEstimatedDistribution);
  const hasNoAttribution = ad.raised === 0 && ad.spend > 0;

  // Use ad.transcription if provided, otherwise use the prop
  const adTranscription = ad.transcription || transcription;

  const handleTranscribe = () => {
    if (onTranscribe && adTranscription?.video_id) {
      onTranscribe(ad.ad_id, adTranscription.video_id);
    }
  };

  return (
    <div
      className={cn(
        'group',
        'rounded-lg border border-[hsl(var(--portal-border))]',
        'bg-[hsl(var(--portal-bg-secondary))]',
        'hover:border-[hsl(var(--portal-accent-blue)/0.3)]',
        'hover:shadow-sm',
        'transition-all duration-200'
      )}
    >
      {/* Main Row */}
      <div
        className={cn(
          'flex items-center gap-3 p-3',
          onSelect && 'cursor-pointer'
        )}
        onClick={() => onSelect?.(ad)}
      >
        {/* Thumbnail - Fixed 48px */}
        <div className="relative w-12 h-12 rounded-md overflow-hidden bg-[hsl(var(--portal-bg-tertiary))] flex-shrink-0">
          {ad.creative_thumbnail_url ? (
            <img
              src={ad.creative_thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? (
                <Video className="h-5 w-5 text-[hsl(var(--portal-text-muted))]" />
              ) : (
                <ImageIcon className="h-5 w-5 text-[hsl(var(--portal-text-muted))]" />
              )}
            </div>
          )}
        </div>

        {/* Ad Info - Flexible width */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] truncate">
              {ad.ad_name || ad.refcode || `Ad ${ad.ad_id.slice(0, 8)}`}
            </h3>
            {tierBadge && (
              <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4 font-medium', tierBadge.className)}>
                {tierBadge.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {ad.creative_type && (
              <span className="text-[10px] text-[hsl(var(--portal-text-muted))] capitalize">
                {ad.creative_type}
              </span>
            )}
            {lowSpend && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-[10px] text-[hsl(var(--portal-text-muted))]">
                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                      Low data
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                    Results may not be statistically significant due to low spend (&lt;$50)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Transcription Status Badge - only for video ads */}
            {isVideo && (
              <TranscriptionStatusBadge
                transcription={adTranscription}
                creativeType={ad.creative_type}
                onTranscribe={onTranscribe ? handleTranscribe : undefined}
                isTranscribing={isTranscribing}
                compact
              />
            )}
          </div>
        </div>

        {/* Metrics Row - Right aligned */}
        <div className="flex items-center gap-4 text-right flex-shrink-0">
          {/* Spend */}
          <div className="w-16 hidden sm:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Spend</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {formatCurrency(ad.spend)}
            </div>
          </div>

          {/* Raised - Primary visual weight */}
          <div className="w-16">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Raised</div>
            <div className={cn(
              'text-sm font-semibold',
              ad.raised > 0
                ? 'text-green-600 dark:text-green-400'
                : hasNoAttribution
                  ? 'text-[hsl(var(--portal-text-muted))]'
                  : 'text-[hsl(var(--portal-text-primary))]'
            )}>
              {hasNoAttribution ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 text-[hsl(var(--portal-text-muted))]">
                        <TrendingUp className="h-3 w-3" />
                        --
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                      Attribution data pending. Donations may not be linked to this ad yet.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                formatCurrency(ad.raised)
              )}
            </div>
          </div>

          {/* ROAS - Most prominent */}
          <div className="w-14">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">ROAS</div>
            <div className={cn('text-sm font-bold', getRoasColor(ad.roas))}>
              {formatRoas(ad.roas)}
            </div>
          </div>

          {/* CPA */}
          <div className="w-14 hidden md:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">CPA</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {ad.unique_donors > 0 ? formatCurrency(ad.cpa) : '--'}
            </div>
          </div>

          {/* Donors */}
          <div className="w-12 hidden lg:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Donors</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {ad.unique_donors}
            </div>
          </div>

          {/* Link CTR */}
          <div className="w-12 hidden lg:block">
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Link CTR</div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {formatPercentage(ad.ctr)}
            </div>
          </div>

          {/* Expand Button */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 w-7 p-0',
                  'text-[hsl(var(--portal-text-muted))]',
                  'hover:text-[hsl(var(--portal-text-primary))]',
                  'hover:bg-[hsl(var(--portal-bg-hover))]'
                )}
                onClick={(e) => e.stopPropagation()}
                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {/* Expandable Details */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t border-[hsl(var(--portal-border))]">
            <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto">
              {/* Message Content */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">
                  Message Content
                </h4>
                {ad.ad_copy_headline && (
                  <div>
                    <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">Headline</span>
                    <p className="text-sm text-[hsl(var(--portal-text-primary))]">{ad.ad_copy_headline}</p>
                  </div>
                )}
                {ad.ad_copy_primary_text && (
                  <div>
                    <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">Primary Text</span>
                    <p className="text-sm text-[hsl(var(--portal-text-secondary))] line-clamp-3">
                      {ad.ad_copy_primary_text}
                    </p>
                  </div>
                )}
                {ad.ad_copy_description && (
                  <div>
                    <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">Description</span>
                    <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                      {ad.ad_copy_description}
                    </p>
                  </div>
                )}
                {!ad.ad_copy_headline && !ad.ad_copy_primary_text && !ad.ad_copy_description && (
                  <div className="space-y-1">
                    {/* Show ad name as fallback title when no content available */}
                    {ad.refcode && (
                      <div>
                        <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">Ad Name / Refcode</span>
                        <p className="text-sm text-[hsl(var(--portal-text-primary))] font-medium">{ad.refcode}</p>
                      </div>
                    )}
                    <p className="text-sm text-[hsl(var(--portal-text-muted))] italic">
                      Creative content not available in Meta API. This ad may use a Page Post format or dynamic creative.
                    </p>
                  </div>
                )}
              </div>

              {/* Analysis & Metadata */}
              <div className="space-y-3">
                {/* AI Tags */}
                {(ad.topic || ad.tone || ad.urgency_level || (ad.key_themes && ad.key_themes.length > 0)) && (
                  <div>
                    <h4 className="text-xs font-semibold text-[hsl(var(--portal-text-muted))] uppercase tracking-wide mb-2">
                      Analysis
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {ad.topic && (
                        <Badge variant="outline" className="text-[10px]">
                          {ad.topic}
                        </Badge>
                      )}
                      {ad.tone && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {ad.tone}
                        </Badge>
                      )}
                      {ad.urgency_level && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {ad.urgency_level} urgency
                        </Badge>
                      )}
                      {ad.key_themes?.map((theme, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px]">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Metrics */}
                <div>
                  <h4 className="text-xs font-semibold text-[hsl(var(--portal-text-muted))] uppercase tracking-wide mb-2">
                    Additional Metrics
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[hsl(var(--portal-text-muted))]">Impressions</span>
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {ad.impressions.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--portal-text-muted))]">Clicks</span>
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {ad.clicks.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--portal-text-muted))]">Donations</span>
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {ad.donation_count}
                      </p>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--portal-text-muted))]">CPM</span>
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {formatCurrency(ad.cpm)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--portal-text-muted))]">CPC</span>
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {formatCurrency(ad.cpc)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--portal-text-muted))]">Avg Donation</span>
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {ad.avg_donation > 0 ? formatCurrency(ad.avg_donation) : '--'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
