import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMetricDefinition } from "@/lib/metricDefinitions";
import { cn } from "@/lib/utils";

interface V3MetricLabelProps {
  label: string;
  showTooltip?: boolean;
  className?: string;
}

export const V3MetricLabel: React.FC<V3MetricLabelProps> = ({
  label,
  showTooltip = true,
  className,
}) => {
  const definition = getMetricDefinition(label);

  if (!showTooltip || !definition) {
    return (
      <span className={cn("text-xs text-[hsl(var(--portal-text-secondary))] uppercase tracking-wide font-medium", className)}>
        {label}
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-xs text-[hsl(var(--portal-text-secondary))] uppercase tracking-wide font-medium inline-flex items-center gap-1 cursor-help", className)}>
            {label}
            <HelpCircle className="h-3 w-3 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-accent-blue))] transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
        >
          <div className="space-y-1.5">
            <p className="font-medium text-sm">{definition.title}</p>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              {definition.description}
            </p>
            {definition.calculation && (
              <p className="text-xs text-[hsl(var(--portal-text-muted))] italic border-t border-[hsl(var(--portal-border))] pt-1.5 mt-1.5">
                Calculation: {definition.calculation}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

V3MetricLabel.displayName = "V3MetricLabel";
