/**
 * Relevance Reasons Component
 * 
 * Displays why an opportunity/action is relevant to the org.
 */

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RelevanceReasonsProps {
  score?: number | null;
  reasons?: string[] | null;
  className?: string;
  variant?: "compact" | "full";
}

export function RelevanceReasons({
  score,
  reasons,
  className,
  variant = "compact",
}: RelevanceReasonsProps) {
  if (!score && (!reasons || reasons.length === 0)) {
    return null;
  }

  const hasReasons = reasons && reasons.length > 0;
  const priorityLevel = score ? (score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low') : 'low';
  
  const priorityColors = {
    high: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]",
    medium: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue)/0.2)]",
    low: "bg-[hsl(var(--portal-text-muted)/0.1)] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]",
  };

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1.5 cursor-help", className)}>
              {score !== null && score !== undefined && (
                <Badge
                  variant="outline"
                  className={cn("text-xs tabular-nums", priorityColors[priorityLevel])}
                >
                  {score}% match
                </Badge>
              )}
              {hasReasons && (
                <Info className="h-3.5 w-3.5 text-[hsl(var(--portal-text-muted))]" />
              )}
            </div>
          </TooltipTrigger>
          {hasReasons && (
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium text-sm">Why you're seeing this:</p>
                <ul className="text-xs space-y-0.5">
                  {reasons!.slice(0, 4).map((reason, i) => (
                    <li key={i} className="text-muted-foreground">• {reason}</li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
        <span className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
          Why you're seeing this
        </span>
        {score !== null && score !== undefined && (
          <Badge
            variant="outline"
            className={cn("text-xs tabular-nums ml-auto", priorityColors[priorityLevel])}
          >
            {score}% relevance
          </Badge>
        )}
      </div>
      {hasReasons && (
        <ul className="text-sm space-y-1 pl-6">
          {reasons!.map((reason, i) => (
            <li key={i} className="text-[hsl(var(--portal-text-secondary))]">
              • {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
