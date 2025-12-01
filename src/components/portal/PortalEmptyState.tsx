import { LucideIcon, Inbox, Search, Database, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PortalEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  };
  className?: string;
}

export function PortalEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: PortalEmptyStateProps) {
  return (
    <div className={cn("portal-card p-8 sm:p-12 text-center portal-animate-fade-in", className)}>
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="p-4 rounded-full portal-bg-tertiary">
          <Icon className="h-8 w-8 portal-text-muted" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold portal-text-primary">{title}</h3>
          {description && (
            <p className="text-sm portal-text-secondary">{description}</p>
          )}
        </div>

        {action && (
          <Button
            variant={action.variant === "primary" ? "default" : "outline"}
            onClick={action.onClick}
            className="mt-2"
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// Preset empty states
export function NoDataEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <PortalEmptyState
      icon={Database}
      title="No data available"
      description="There is no data to display at the moment. Try adjusting your filters or refreshing."
      action={
        onRefresh
          ? {
              label: "Refresh",
              onClick: onRefresh,
              variant: "primary",
            }
          : undefined
      }
    />
  );
}

export function NoResultsEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <PortalEmptyState
      icon={Search}
      title="No results found"
      description="We couldn't find any results matching your criteria. Try adjusting your search or filters."
      action={
        onClear
          ? {
              label: "Clear filters",
              onClick: onClear,
              variant: "secondary",
            }
          : undefined
      }
    />
  );
}

export function ErrorEmptyState({ 
  onRetry,
  message = "Something went wrong while loading the data." 
}: { 
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <PortalEmptyState
      icon={AlertCircle}
      title="Error loading data"
      description={message}
      action={
        onRetry
          ? {
              label: "Try again",
              onClick: onRetry,
              variant: "primary",
            }
          : undefined
      }
    />
  );
}

export function ComingSoonEmptyState({ feature }: { feature: string }) {
  return (
    <PortalEmptyState
      icon={RefreshCw}
      title={`${feature} coming soon`}
      description="We're working on this feature. Check back later for updates."
    />
  );
}
