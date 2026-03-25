/**
 * CreativePreviewCard
 * 
 * A compact card for displaying an ad creative with thumbnail,
 * performance tier badge, and key metrics.
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, ChevronDown, ChevronUp, DollarSign, Users, MousePointerClick } from 'lucide-react';
import { V3Badge, getTierBadgeVariant } from '@/components/v3';
import type { AdPerformanceData } from '@/types/adPerformance';
import { formatCurrency, formatRoas, formatPercentage, getTierLabel } from '@/utils/adPerformance';

interface CreativePreviewCardProps {
  ad: AdPerformanceData;
  onSelect?: (ad: AdPerformanceData) => void;
  compact?: boolean;
  rank?: number;
}

const tierAccentColors: Record<string, string> = {
  TOP_PERFORMER: 'border-l-[hsl(var(--portal-success))]',
  STRONG: 'border-l-[hsl(var(--portal-accent-blue))]',
  AVERAGE: 'border-l-[hsl(var(--portal-warning))]',
  NEEDS_IMPROVEMENT: 'border-l-[hsl(var(--portal-error))]',
};

export const CreativePreviewCard: React.FC<CreativePreviewCardProps> = ({
  ad,
  onSelect,
  compact = false,
  rank,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    if (onSelect) {
      onSelect(ad);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const tierAccent = ad.performance_tier 
    ? tierAccentColors[ad.performance_tier] || 'border-l-[hsl(var(--portal-border))]'
    : 'border-l-[hsl(var(--portal-border))]';

  return (
    <motion.div
      layout
      className={cn(
        'bg-[hsl(var(--portal-bg-elevated))] rounded-lg border border-[hsl(var(--portal-border))]',
        'border-l-4',
        tierAccent,
        onSelect && 'cursor-pointer hover:bg-[hsl(var(--portal-bg-hover))] transition-colors',
      )}
      onClick={handleClick}
    >
      <div className={cn('p-3', compact ? 'flex items-center gap-3' : 'flex gap-3')}>
        {/* Rank Badge */}
        {rank !== undefined && (
          <div className={cn(
            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
            rank === 1 && 'bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]',
            rank === 2 && 'bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]',
            rank === 3 && 'bg-[hsl(var(--portal-warning)/0.15)] text-[hsl(var(--portal-warning))]',
            rank > 3 && 'bg-[hsl(var(--portal-text-muted)/0.1)] text-[hsl(var(--portal-text-muted))]',
          )}>
            {rank}
          </div>
        )}

        {/* Thumbnail */}
        <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-[hsl(var(--portal-bg-base))] border border-[hsl(var(--portal-border))]">
          {ad.creative_thumbnail_url && !imageError ? (
            <img
              src={ad.creative_thumbnail_url}
              alt={`Ad ${ad.ad_id} creative`}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
                {ad.ad_copy_headline || `Ad ${ad.ad_id.slice(-8)}`}
              </p>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
                ID: {ad.ad_id.slice(-12)}
              </p>
            </div>
            {ad.performance_tier && (
              <V3Badge
                variant={getTierBadgeVariant(ad.performance_tier)}
                size="sm"
              >
                {getTierLabel(ad.performance_tier)}
              </V3Badge>
            )}
          </div>

          {/* Key Metrics Row */}
          <div className="flex items-center gap-3 text-xs mt-2">
            <div className="flex items-center gap-1 text-[hsl(var(--portal-text-secondary))]">
              <DollarSign className="w-3 h-3" />
              <span>{formatCurrency(ad.spend)}</span>
            </div>
            <div className="flex items-center gap-1 text-[hsl(var(--portal-success))]">
              <span className="font-medium">{formatRoas(ad.roas)} ROAS</span>
            </div>
            {ad.unique_donors > 0 && (
              <div className="flex items-center gap-1 text-[hsl(var(--portal-text-secondary))]">
                <Users className="w-3 h-3" />
                <span>{ad.unique_donors}</span>
              </div>
            )}
            {ad.ctr > 0 && (
              <div className="flex items-center gap-1 text-[hsl(var(--portal-text-muted))]">
                <MousePointerClick className="w-3 h-3" />
                <span>{formatPercentage(ad.ctr)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Expand Button */}
        {(ad.ad_copy_primary_text || ad.ad_copy_description) && (
          <button
            onClick={toggleExpand}
            className="flex-shrink-0 p-1 rounded hover:bg-[hsl(var(--portal-bg-hover))] text-[hsl(var(--portal-text-muted))]"
            aria-label={isExpanded ? 'Collapse ad copy' : 'Expand ad copy'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Expanded Ad Copy */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-base)/0.5)]">
              {ad.ad_copy_primary_text && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-0.5">Primary Text</p>
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))] whitespace-pre-wrap line-clamp-4">
                    {ad.ad_copy_primary_text}
                  </p>
                </div>
              )}
              {ad.ad_copy_description && (
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-0.5">Description</p>
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                    {ad.ad_copy_description}
                  </p>
                </div>
              )}
              {/* AI Analysis Tags */}
              {(ad.topic || ad.tone || ad.key_themes?.length) && (
                <div className="mt-2 pt-2 border-t border-[hsl(var(--portal-border))]">
                  <div className="flex flex-wrap gap-1">
                    {ad.topic && (
                      <V3Badge variant="outline" size="sm">
                        {ad.topic}
                      </V3Badge>
                    )}
                    {ad.tone && (
                      <V3Badge variant="outline" size="sm">
                        {ad.tone}
                      </V3Badge>
                    )}
                    {ad.key_themes?.slice(0, 3).map((theme) => (
                      <V3Badge key={theme} variant="secondary" size="sm">
                        {theme}
                      </V3Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CreativePreviewCard;
