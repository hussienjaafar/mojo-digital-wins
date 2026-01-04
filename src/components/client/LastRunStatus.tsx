import { formatDistanceToNow, format } from "date-fns";
import { Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LastRunStatusProps {
  lastRun: {
    started_at: string;
    finished_at: string | null;
    created_count?: number;
    actions_created?: number;
    skipped_count?: number;
    error_count?: number;
    ai_generated_count?: number;
    template_generated_count?: number;
    metadata?: Record<string, any> | null;
  } | null;
  isLoading?: boolean;
  variant?: "opportunities" | "actions";
}

export function LastRunStatus({ lastRun, isLoading, variant = "opportunities" }: LastRunStatusProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--portal-text-muted))]">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading run status...</span>
      </div>
    );
  }

  if (!lastRun) {
    return (
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--portal-text-muted))]">
        <Clock className="h-3 w-3" />
        <span>No runs recorded yet</span>
      </div>
    );
  }

  const isRunning = !lastRun.finished_at;
  const hasErrors = (lastRun.error_count ?? 0) > 0;
  const isSuccess = lastRun.finished_at && !hasErrors;

  const createdCount = variant === "opportunities" 
    ? lastRun.created_count ?? 0 
    : lastRun.actions_created ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Status indicator */}
      <Badge
        variant="outline"
        className={cn(
          "gap-1 text-xs",
          isRunning && "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning)/0.3)]",
          isSuccess && "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.3)]",
          hasErrors && "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.3)]"
        )}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Running...
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Last run: {formatDistanceToNow(new Date(lastRun.finished_at!), { addSuffix: true })}
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3" />
            Errors: {lastRun.error_count}
          </>
        )}
      </Badge>

      {/* Stats */}
      {lastRun.finished_at && (
        <>
          <span className="text-[hsl(var(--portal-text-muted))]">•</span>
          <span className="text-[hsl(var(--portal-text-secondary))]">
            Created: <span className="font-medium text-[hsl(var(--portal-text-primary))]">{createdCount}</span>
          </span>
          {lastRun.skipped_count !== undefined && lastRun.skipped_count > 0 && (
            <>
              <span className="text-[hsl(var(--portal-text-muted))]">•</span>
              <span className="text-[hsl(var(--portal-text-secondary))]">
                Skipped: {lastRun.skipped_count}
              </span>
            </>
          )}
          {variant === "actions" && (
            <>
              {lastRun.ai_generated_count !== undefined && lastRun.ai_generated_count > 0 && (
                <>
                  <span className="text-[hsl(var(--portal-text-muted))]">•</span>
                  <Badge variant="outline" className="text-xs bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border-[hsl(var(--portal-accent-purple)/0.2)]">
                    AI: {lastRun.ai_generated_count}
                  </Badge>
                </>
              )}
              {lastRun.template_generated_count !== undefined && lastRun.template_generated_count > 0 && (
                <>
                  <Badge variant="outline" className="text-xs bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]">
                    Template: {lastRun.template_generated_count}
                  </Badge>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
