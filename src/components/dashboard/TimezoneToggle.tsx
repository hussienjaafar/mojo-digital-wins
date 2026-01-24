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
 * TimezoneToggle - Toggle between ActBlue (ET) and UTC timezone modes
 * 
 * ActBlue's Fundraising Performance dashboard uses Eastern Time day boundaries.
 * This toggle allows users to switch between matching ActBlue exactly (ET)
 * or viewing data in UTC boundaries.
 */
export const TimezoneToggle: React.FC<{ className?: string }> = ({ className }) => {
  const useActBlueTimezone = useDashboardStore((s) => s.useActBlueTimezone);
  const setUseActBlueTimezone = useDashboardStore((s) => s.setUseActBlueTimezone);

  const handleChange = (value: string) => {
    if (value === "actblue" || value === "utc") {
      setUseActBlueTimezone(value === "actblue");
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex", className)}>
            <ToggleGroup
              type="single"
              value={useActBlueTimezone ? "actblue" : "utc"}
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
                value="actblue"
                aria-label="ActBlue time (Eastern)"
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
              <ToggleGroupItem
                value="utc"
                aria-label="UTC time"
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
              {useActBlueTimezone ? "ActBlue Time (Eastern)" : "UTC Time"}
            </p>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              {useActBlueTimezone
                ? "Matches ActBlue's Fundraising Performance dashboard. Days are bucketed using Eastern Time midnight boundaries."
                : "Uses UTC midnight boundaries. Totals may differ from ActBlue's dashboard."}
            </p>
            {!useActBlueTimezone && (
              <p className="text-xs text-[hsl(var(--portal-warning))]">
                Note: Totals may differ from ActBlue's dashboard due to different day boundaries.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TimezoneToggle;
