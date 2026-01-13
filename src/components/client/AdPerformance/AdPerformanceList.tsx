import React from 'react';
import { AdPerformanceData } from '../../../queries/useAdPerformanceQuery';
import { AdPerformanceCard } from './AdPerformanceCard'; 
import { AdPerformanceCardSkeleton } from './AdPerformanceCardSkeleton'; // Import the skeleton
import { V3EmptyState } from '../../../design-system/V3EmptyState'; // Assuming path to V3EmptyState
import { V3ErrorState } from '../../../design-system/V3ErrorState'; // Assuming path to V3ErrorState

interface AdPerformanceListProps {
  ads?: AdPerformanceData[]; // Make optional to handle loading state
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  // Placeholder for filter/sort controls if they were passed down
  // sortBy: string;
  // sortOrder: 'asc' | 'desc';
}

export const AdPerformanceList: React.FC<AdPerformanceListProps> = ({ ads, isLoading, isError, error }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => ( // Show 6 skeletons while loading
          <AdPerformanceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <V3ErrorState
        title="Failed to Load Ad Performance"
        message={error?.message || "An unexpected error occurred. Please try again."}
        onRetry={() => window.location.reload()} // Simple reload for retry, can be more sophisticated
      />
    );
  }

  if (!ads || ads.length === 0) {
    return (
      <V3EmptyState
        title="No Ad Performance Data Available"
        message="No ad performance data was found for the selected period. Try adjusting your filters or date range, or launching new campaigns."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {ads.map((ad) => (
        <AdPerformanceCard key={ad.ad_id} ad={ad} />
      ))}
    </div>
  );
};

