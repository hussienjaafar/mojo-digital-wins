import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface V3DataTruncationWarningProps {
  /** Warning message to display */
  message: string;
  /** Whether data is truncated */
  isTruncated: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

/**
 * Displays a warning indicator when query results may be truncated due to row limits.
 * Improves transparency about data completeness for users.
 */
export const V3DataTruncationWarning: React.FC<V3DataTruncationWarningProps> = ({
  message,
  isTruncated,
  size = "sm",
  className,
}) => {
  if (!isTruncated) return null;

  const sizeClasses = {
    sm: "text-xs gap-1 py-1 px-2",
    md: "text-sm gap-1.5 py-1.5 px-3",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center font-medium rounded-md cursor-help",
              "bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))]",
              "border border-[hsl(var(--portal-warning))]/20",
              sizeClasses[size],
              className
            )}
            role="status"
            aria-label="Data may be incomplete"
          >
            <AlertTriangle className={iconSizes[size]} aria-hidden="true" />
            <span>Partial Data</span>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
        >
          <p className="text-xs">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

V3DataTruncationWarning.displayName = "V3DataTruncationWarning";
