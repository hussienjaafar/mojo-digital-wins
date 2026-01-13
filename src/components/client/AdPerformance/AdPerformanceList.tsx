/**
 * AdPerformanceList Component
 *
 * Renders a list of AdPerformanceCard components with loading,
 * empty, and error states.
 */

import { AdPerformanceCard } from './AdPerformanceCard';
import { AdPerformanceCardSkeleton } from './AdPerformanceCardSkeleton';
import { PortalEmptyState } from '@/components/portal/PortalEmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BarChart3, AlertCircle, RefreshCw } from 'lucide-react';
import type { AdPerformanceData } from '@/types/adPerformance';

interface AdPerformanceListProps {
  ads: AdPerformanceData[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  onSelectAd?: (ad: AdPerformanceData) => void;
}

export function AdPerformanceList({
  ads,
  isLoading,
  error,
  onRetry,
  onSelectAd,
}: AdPerformanceListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading ad performance data">
        {Array.from({ length: 3 }).map((_, i) => (
          <AdPerformanceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <Alert variant="destructive">
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

  // Render ads list
  return (
    <div className="space-y-4">
      {ads.map((ad) => (
        <AdPerformanceCard key={ad.id} ad={ad} onSelect={onSelectAd} />
      ))}
    </div>
  );
}
