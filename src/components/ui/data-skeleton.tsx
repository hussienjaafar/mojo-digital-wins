import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Loading skeleton for metric cards
 */
export const MetricCardSkeleton = () => (
  <Card>
    <CardHeader className="space-y-0 pb-2">
      <Skeleton className="h-4 w-24" variant="shimmer" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-32 mb-2" variant="shimmer" />
      <Skeleton className="h-3 w-20" variant="shimmer" />
    </CardContent>
  </Card>
);

/**
 * Loading skeleton for chart components
 */
export const ChartSkeleton = ({ height = "h-80" }: { height?: string }) => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-48 mb-2" variant="shimmer" />
      <Skeleton className="h-4 w-64" variant="shimmer" />
    </CardHeader>
    <CardContent>
      <Skeleton className={`${height} w-full`} variant="shimmer" />
    </CardContent>
  </Card>
);

/**
 * Loading skeleton for data table
 */
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-48" variant="shimmer" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" variant="shimmer" shape="circle" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" variant="shimmer" />
              <Skeleton className="h-3 w-3/4" variant="shimmer" />
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

/**
 * Loading skeleton for list items
 */
export const ListItemSkeleton = () => (
  <div className="flex items-start gap-4 p-4 border rounded-lg">
    <Skeleton className="h-12 w-12 rounded" variant="shimmer" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" variant="shimmer" />
      <Skeleton className="h-3 w-full" variant="shimmer" />
      <Skeleton className="h-3 w-1/2" variant="shimmer" />
    </div>
  </div>
);

/**
 * Loading skeleton for dashboard grid
 */
export const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
    <ChartSkeleton />
    <div className="grid gap-4 md:grid-cols-2">
      <ChartSkeleton height="h-64" />
      <ChartSkeleton height="h-64" />
    </div>
  </div>
);

/**
 * Loading skeleton for news feed
 */
export const NewsFeedSkeleton = ({ items = 10 }: { items?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: items }).map((_, i) => (
      <ListItemSkeleton key={i} />
    ))}
  </div>
);
