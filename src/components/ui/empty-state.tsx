import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Package, Inbox, FileQuestion } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: "default" | "minimal" | "card";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const defaultIcon = <Inbox className="h-12 w-12 text-muted-foreground/50" />;

  if (variant === "minimal") {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-sm text-muted-foreground">{title}</p>
        {action && (
          <Button
            variant="link"
            size="sm"
            onClick={action.onClick}
            className="mt-2"
          >
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-lg bg-muted/5",
          className
        )}
      >
        <div className="mb-4">{icon || defaultIcon}</div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            {description}
          </p>
        )}
        {action && (
          <Button onClick={action.onClick} variant="default">
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <div className="mb-4">{icon || defaultIcon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Preset empty states
export function NoDataEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon={<Package className="h-12 w-12 text-muted-foreground/50" />}
      title="No data available"
      description="There is no data to display at the moment. Try adjusting your filters or come back later."
      action={
        onRefresh
          ? {
              label: "Refresh",
              onClick: onRefresh,
            }
          : undefined
      }
    />
  );
}

export function NoResultsEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={<FileQuestion className="h-12 w-12 text-muted-foreground/50" />}
      title="No results found"
      description="We couldn't find any results matching your criteria. Try adjusting your search or filters."
      action={
        onClear
          ? {
              label: "Clear filters",
              onClick: onClear,
            }
          : undefined
      }
      variant="minimal"
    />
  );
}
