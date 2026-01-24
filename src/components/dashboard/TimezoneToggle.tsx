import * as React from "react";
import { Globe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardStore } from "@/stores/dashboardStore";

/**
 * TimezoneToggle - Toggle between ActBlue (UTC) and Local (ET) timezone modes
 * 
 * ActBlue's Fundraising Performance dashboard uses UTC day boundaries.
 * This toggle allows users to switch between matching ActBlue exactly
 * or viewing data in their organization's local timezone.
 */
export const TimezoneToggle: React.FC<{ className?: string }> = ({ className }) => {
  const useActBlueTimezone = useDashboardStore((s) => s.useActBlueTimezone);
  const setUseActBlueTimezone = useDashboardStore((s) => s.setUseActBlueTimezone);

  const handleChange = (value: string) => {
    if (value === "utc" || value === "local") {
      setUseActBlueTimezone(value === "utc");
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex", className)}>
            <ToggleGroup
              type="single"
              value={useActBlueTimezone ? "utc" : "local"}
              onValueChange={handleChange}
              className={cn(
                "inline-flex items-stretch",
                "rounded-[var(--portal-radius-sm)]",
                "border border-[hsl(var(--portal-border))]",
                "bg-[hsl(var(--portal-bg-secondary))]",
                "p-0.5",
                "gap-0.5"
              )}
              aria-label="Select timezone for data display"
            >
              <ToggleGroupItem
                value="utc"
                aria-label="ActBlue time (UTC)"
                className={cn(
                  "px-2 py-1.5",
                  "text-xs font-medium",
                  "rounded-[calc(var(--portal-radius-sm)-2px)]",
                  "border-0",
                  "transition-all",
                  "flex items-center gap-1.5",
                  // Default state
                  "bg-transparent",
                  "text-[hsl(var(--portal-text-secondary))]",
                  "hover:text-[hsl(var(--portal-text-primary))]",
                  "hover:bg-[hsl(var(--portal-bg-hover))]",
                  // Selected state
                  "data-[state=on]:bg-[hsl(var(--portal-accent-blue)/0.12)]",
                  "data-[state=on]:text-[hsl(var(--portal-accent-blue))]",
                  "data-[state=on]:shadow-sm",
                  // Focus
                  "focus:outline-none focus-visible:ring-2",
                  "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]"
                )}
              >
                <Globe className="h-3 w-3" />
                <span className="hidden sm:inline">UTC</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="local"
                aria-label="Local time (Eastern)"
                className={cn(
                  "px-2 py-1.5",
                  "text-xs font-medium",
                  "rounded-[calc(var(--portal-radius-sm)-2px)]",
                  "border-0",
                  "transition-all",
                  "flex items-center gap-1.5",
                  // Default state
                  "bg-transparent",
                  "text-[hsl(var(--portal-text-secondary))]",
                  "hover:text-[hsl(var(--portal-text-primary))]",
                  "hover:bg-[hsl(var(--portal-bg-hover))]",
                  // Selected state
                  "data-[state=on]:bg-[hsl(var(--portal-accent-blue)/0.12)]",
                  "data-[state=on]:text-[hsl(var(--portal-accent-blue))]",
                  "data-[state=on]:shadow-sm",
                  // Focus
                  "focus:outline-none focus-visible:ring-2",
                  "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]"
                )}
              >
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">ET</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className={cn(
            "max-w-[280px] p-3",
            "bg-[hsl(var(--portal-bg-elevated))]",
            "border-[hsl(var(--portal-border))]",
            "text-[hsl(var(--portal-text-primary))]"
          )}
        >
          <div className="space-y-2">
            <p className="font-medium text-sm">
              {useActBlueTimezone ? "ActBlue Time (UTC)" : "Local Time (Eastern)"}
            </p>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              {useActBlueTimezone
                ? "Matches ActBlue's Fundraising Performance dashboard. Days are bucketed using UTC midnight boundaries."
                : "Uses your organization's timezone (Eastern). Days are bucketed using local midnight boundaries."}
            </p>
            {!useActBlueTimezone && (
              <p className="text-xs text-[hsl(var(--portal-warning))]">
                Note: Totals may differ slightly from ActBlue's dashboard due to different day boundaries.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TimezoneToggle;
