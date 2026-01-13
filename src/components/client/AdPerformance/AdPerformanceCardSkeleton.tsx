/**
 * AdPerformanceCardSkeleton Component
 *
 * Loading skeleton that matches the layout of AdPerformanceCard.
 * Used during data fetching to provide visual feedback.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AdPerformanceCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Thumbnail skeleton */}
          <Skeleton className="w-full md:w-40 h-32 md:h-36 rounded-none" />

          {/* Content skeleton */}
          <div className="flex-1 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-6 w-16 ml-auto" />
                <Skeleton className="h-3 w-10 ml-auto" />
              </div>
            </div>

            {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => ( // Render 3 detailed skeleton chips
          <div key={i} className="flex flex-col space-y-1">
            <div className="h-2.5 bg-gray-300 rounded w-1/2"></div> {/* Label placeholder */}
            <div className="h-4 bg-gray-400 rounded w-3/4"></div> {/* Value placeholder */}
          </div>
        ))}
      </div>

            {/* Expand button */}
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
