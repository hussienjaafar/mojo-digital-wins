import { cn } from "@/lib/utils";

interface PortalSkeletonProps {
  className?: string;
  variant?: "metric" | "card" | "chart" | "text" | "avatar";
}

export const PortalSkeleton = ({ className, variant = "card" }: PortalSkeletonProps) => {
  const variants = {
    metric: "portal-metric h-32",
    card: "portal-card h-64",
    chart: "portal-card h-80",
    text: "h-4 rounded",
    avatar: "rounded-full h-12 w-12",
  };

  return (
    <div
      className={cn(
        "portal-skeleton portal-loading-pulse",
        variants[variant],
        className
      )}
      role="status"
      aria-label="Loading..."
    />
  );
};

interface PortalLoadingGridProps {
  count?: number;
  variant?: "metric" | "card" | "chart";
}

export const PortalLoadingGrid = ({ count = 4, variant = "metric" }: PortalLoadingGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PortalSkeleton key={i} variant={variant} className={`portal-delay-${i * 100}`} />
      ))}
    </div>
  );
};
