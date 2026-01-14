/**
 * AdPerformanceList Component
 *
 * Renders a compact list of ad performance rows with loading,
 * empty, and error states. V3 design system aligned.
 */

import { AdPerformanceRow } from './AdPerformanceRow';
import { PortalEmptyState } from '@/components/portal/PortalEmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdPerformanceData } from '@/types/adPerformance';

interface AdPerformanceListProps {
  ads?: AdPerformanceData[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onSelectAd?: (ad: AdPerformanceData) => void;
  /** If true, spend/impressions are estimated (campaign distributed) */
  isEstimatedDistribution?: boolean;
}

/**
 * Compact row skeleton for loading state
 */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
      {/* Thumbnail */}
      <Skeleton className="w-12 h-12 rounded-md flex-shrink-0" />
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      {/* Metrics */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:block space-y-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-14" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-14" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
    </div>
  );
}

export function AdPerformanceList({
  ads = [],
  isLoading = false,
  error,
  onRetry,
  onSelectAd,
  isEstimatedDistribution = false,
}: AdPerformanceListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading ad performance data">
        {Array.from({ length: 5 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <Alert variant="destructive" className="rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading ad performance</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error.message}</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (ads.length === 0) {
    return (
      <PortalEmptyState
        icon={BarChart3}
        title="No Ad Performance Data"
        description="No ads with spend were found in the selected date range. Try expanding your date range or check that your Meta Ads integration is syncing properly."
      />
    );
  }

  // Render ads list - use ad_id as key to prevent duplicates
  return (
    <div
      className="space-y-2"
      role="list"
      aria-label="Ad performance list"
    >
      {ads.map((ad) => (
        <AdPerformanceRow
          key={ad.ad_id || ad.id}
          ad={ad}
          onSelect={onSelectAd}
          isEstimatedDistribution={isEstimatedDistribution}
        />
      ))}
    </div>
  );
}
