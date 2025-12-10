import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface V3ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message/description */
  message?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Size variant */
  variant?: "compact" | "default" | "large";
  /** Additional class names */
  className?: string;
}

export const V3ErrorState: React.FC<V3ErrorStateProps> = ({
  title = "Failed to load data",
  message = "Something went wrong. Please try again.",
  onRetry,
  isRetrying = false,
  variant = "default",
  className,
}) => {
  const sizeClasses = {
    compact: "py-4 px-4",
    default: "py-8 px-6",
    large: "py-12 px-8",
  };

  const iconSizes = {
    compact: "h-6 w-6",
    default: "h-10 w-10",
    large: "h-14 w-14",
  };

  const titleSizes = {
    compact: "text-sm",
    default: "text-base",
    large: "text-lg",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-xl border border-[hsl(var(--portal-error))]/20",
        "bg-[hsl(var(--portal-error))]/5",
        sizeClasses[variant],
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div
        className={cn(
          "rounded-full p-3 mb-3",
          "bg-[hsl(var(--portal-error))]/10"
        )}
      >
        <AlertCircle
          className={cn(iconSizes[variant], "text-[hsl(var(--portal-error))]")}
          aria-hidden="true"
        />
      </div>
      <h3
        className={cn(
          "font-semibold text-[hsl(var(--portal-text-primary))]",
          titleSizes[variant]
        )}
      >
        {title}
      </h3>
      <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-1 max-w-sm">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-4 gap-2"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRetrying && "animate-spin")}
            aria-hidden="true"
          />
          {isRetrying ? "Retrying..." : "Try Again"}
        </Button>
      )}
    </div>
  );
};

V3ErrorState.displayName = "V3ErrorState";
