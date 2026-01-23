/**
 * TopCreativesSection
 * 
 * Displays top performing ad creatives for the selected date range,
 * with thumbnail previews, performance badges, and key metrics.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, ImageOff } from 'lucide-react';
import { V3Card, V3CardHeader, V3CardContent, V3LoadingState, V3EmptyState } from '@/components/v3';
import { CreativePreviewCard } from './CreativePreviewCard';
import { useAdPerformanceQuery } from '@/hooks/useAdPerformanceQuery';
import type { AdPerformanceData } from '@/types/adPerformance';

interface TopCreativesSectionProps {
  organizationId: string;
  startDate: string;
  endDate: string;
  maxItems?: number;
  className?: string;
  onSelectCreative?: (ad: AdPerformanceData) => void;
}

export const TopCreativesSection: React.FC<TopCreativesSectionProps> = ({
  organizationId,
  startDate,
  endDate,
  maxItems = 5,
  className,
  onSelectCreative,
}) => {
  const { data, isLoading, isError } = useAdPerformanceQuery({
    organizationId,
    startDate,
    endDate,
  });

  // Sort by ROAS and take top performers
  const topCreatives = React.useMemo(() => {
    if (!data?.ads) return [];
    
    return [...data.ads]
      .filter(ad => ad.spend > 0) // Only include ads with spend
      .sort((a, b) => {
        // Primary sort: ROAS (highest first)
        if (b.roas !== a.roas) return b.roas - a.roas;
        // Secondary sort: Spend (higher spend = more statistically significant)
        return b.spend - a.spend;
      })
      .slice(0, maxItems);
  }, [data?.ads, maxItems]);

  if (isLoading) {
    return (
      <V3Card className={className}>
      <V3CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-sm font-medium">Top Performing Creatives</span>
          </div>
        </V3CardHeader>
        <V3CardContent>
          <V3LoadingState variant="card" height={120} />
        </V3CardContent>
      </V3Card>
    );
  }

  if (isError) {
    return (
      <V3Card className={className}>
        <V3CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-sm font-medium">Top Performing Creatives</span>
          </div>
        </V3CardHeader>
        <V3CardContent>
          <V3EmptyState
            icon={ImageOff}
            title="Unable to load creatives"
            description="There was an error fetching creative performance data."
            accent="purple"
          />
        </V3CardContent>
      </V3Card>
    );
  }

  if (!topCreatives.length) {
    return (
      <V3Card className={className}>
        <V3CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-sm font-medium">Top Performing Creatives</span>
          </div>
        </V3CardHeader>
        <V3CardContent>
          <V3EmptyState
            icon={TrendingUp}
            title="No creative data"
            description="No ad creatives with spend found for this date range."
            accent="purple"
          />
        </V3CardContent>
      </V3Card>
    );
  }

  // Calculate date range label
  const isSingleDay = startDate === endDate;
  const dateLabel = isSingleDay 
    ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <V3Card className={cn('overflow-hidden', className)}>
      <V3CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Top Performing Creatives
            </span>
          </div>
          <span className="text-xs text-[hsl(var(--portal-text-muted))]">
            {dateLabel}
          </span>
        </div>
      </V3CardHeader>
      <V3CardContent className="space-y-2 pt-0">
        {topCreatives.map((ad, index) => (
          <motion.div
            key={ad.ad_id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <CreativePreviewCard
              ad={ad}
              rank={index + 1}
              compact
              onSelect={onSelectCreative}
            />
          </motion.div>
        ))}
      </V3CardContent>
    </V3Card>
  );
};

export default TopCreativesSection;
