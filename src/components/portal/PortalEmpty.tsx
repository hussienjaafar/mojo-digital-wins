import { cn } from "@/lib/utils";

interface PortalEmptyProps {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const PortalEmpty = ({ message = "No data available", actionLabel, onAction, className }: PortalEmptyProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-sm portal-text-muted gap-2", className)}>
      <div>{message}</div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-xs px-3 py-1.5 rounded-md border border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-elevated))]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
