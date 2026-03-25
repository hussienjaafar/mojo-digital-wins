import { useState } from "react";
import { format, subDays, differenceInDays } from "date-fns";
import { Calendar, Play, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V3Button } from "@/components/v3/V3Button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DateRangeValue {
  startDate: string;
  endDate: string;
}

interface Props {
  onStartBackfill: (dateRange: DateRangeValue) => Promise<void>;
  isStarting: boolean;
}

type PresetKey = "7d" | "30d" | "90d" | "365d" | "custom";

interface Preset {
  label: string;
  days: number;
}

const PRESETS: Record<Exclude<PresetKey, "custom">, Preset> = {
  "7d": { label: "Last 7 Days", days: 7 },
  "30d": { label: "Last 30 Days", days: 30 },
  "90d": { label: "Last 90 Days", days: 90 },
  "365d": { label: "Last Year", days: 365 },
};

/**
 * Calculate estimated time based on smart chunking and parallel processing
 */
function getEstimatedTime(days: number): { minutes: number; isInstant: boolean } {
  if (days <= 7) {
    // Instant mode - processed inline
    return { minutes: 0, isInstant: true };
  }
  
  // Calculate chunks based on smart sizing
  let chunkSizeDays: number;
  if (days <= 14) {
    chunkSizeDays = 15;
  } else if (days <= 30) {
    chunkSizeDays = 15;
  } else if (days <= 90) {
    chunkSizeDays = 7;
  } else {
    chunkSizeDays = 30;
  }
  
  const numChunks = Math.ceil(days / chunkSizeDays);
  // 3 chunks processed in parallel every 2 minutes
  const cronRuns = Math.ceil(numChunks / 3);
  const minutes = cronRuns * 2;
  
  return { minutes: Math.max(2, minutes), isInstant: false };
}

export const ActBlueBackfillDatePicker = ({ onStartBackfill, isStarting }: Props) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const today = new Date();

  // Get the current date range based on selection
  const getDateRange = (): DateRangeValue => {
    if (selectedPreset === "custom" && customRange?.from && customRange?.to) {
      return {
        startDate: format(customRange.from, "yyyy-MM-dd"),
        endDate: format(customRange.to, "yyyy-MM-dd"),
      };
    }
    
    const preset = PRESETS[selectedPreset as Exclude<PresetKey, "custom">];
    const daysBack = preset?.days || 30;
    
    return {
      startDate: format(subDays(today, daysBack - 1), "yyyy-MM-dd"),
      endDate: format(today, "yyyy-MM-dd"),
    };
  };

  // Calculate days in range
  const getDaysInRange = (): number => {
    const range = getDateRange();
    return differenceInDays(new Date(range.endDate), new Date(range.startDate)) + 1;
  };

  const handlePresetClick = (preset: Exclude<PresetKey, "custom">) => {
    setSelectedPreset(preset);
    setCustomRange(undefined);
  };

  const handleCustomClick = () => {
    setSelectedPreset("custom");
    setIsCalendarOpen(true);
    // Default custom range to last 30 days if not set
    if (!customRange?.from) {
      setCustomRange({
        from: subDays(today, 29),
        to: today,
      });
    }
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      setIsCalendarOpen(false);
    }
  };

  const handleStartBackfill = async () => {
    const dateRange = getDateRange();
    await onStartBackfill(dateRange);
  };

  // Get display label for the selected range
  const getDateRangeLabel = (): string => {
    const range = getDateRange();
    const days = differenceInDays(new Date(range.endDate), new Date(range.startDate)) + 1;
    
    if (selectedPreset !== "custom") {
      return PRESETS[selectedPreset].label;
    }
    
    return `${format(new Date(range.startDate), "MMM d")} - ${format(new Date(range.endDate), "MMM d, yyyy")} (${days} days)`;
  };

  const days = getDaysInRange();
  const { minutes: estimatedMinutes, isInstant } = getEstimatedTime(days);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a time period to import historical data:
      </p>
      
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as Exclude<PresetKey, "custom">[]).map((key) => {
          const presetDays = PRESETS[key].days;
          const { isInstant: presetIsInstant } = getEstimatedTime(presetDays);
          
          return (
            <Button
              key={key}
              variant={selectedPreset === key ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetClick(key)}
              disabled={isStarting}
              className="text-xs relative"
            >
              {PRESETS[key].label}
              {presetIsInstant && selectedPreset !== key && (
                <Zap className="h-3 w-3 ml-1 text-[hsl(var(--portal-warning))]" />
              )}
            </Button>
          );
        })}
        
        {/* Custom date picker */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedPreset === "custom" ? "default" : "outline"}
              size="sm"
              onClick={handleCustomClick}
              disabled={isStarting}
              className="text-xs"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Custom Range
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={customRange}
              onSelect={handleCustomRangeSelect}
              numberOfMonths={2}
              disabled={(date) => date > today}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected range display with time estimate */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {selectedPreset === "custom" && customRange?.from && customRange?.to && (
          <span>
            Selected: {format(customRange.from, "MMM d, yyyy")} – {format(customRange.to, "MMM d, yyyy")}
          </span>
        )}
        
        {isInstant ? (
          <Badge variant="outline" className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.3)]">
            <Zap className="h-3 w-3 mr-1" />
            Instant Import (~20s)
          </Badge>
        ) : (
          <span className="text-muted-foreground">
            Estimated time: ~{estimatedMinutes} minutes
          </span>
        )}
      </div>

      {/* Start button */}
      <V3Button
        onClick={handleStartBackfill}
        disabled={isStarting || (selectedPreset === "custom" && (!customRange?.from || !customRange?.to))}
        variant="primary"
        size="sm"
        className="w-full sm:w-auto"
      >
        {isStarting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Starting Import...
          </>
        ) : (
          <>
            {isInstant ? (
              <Zap className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isInstant ? "Instant Import" : "Import"} {getDateRangeLabel()}
          </>
        )}
      </V3Button>
    </div>
  );
};

export default ActBlueBackfillDatePicker;
