import { useState } from "react";
import { format, subDays, differenceInDays } from "date-fns";
import { Calendar, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V3Button } from "@/components/v3/V3Button";
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a time period to import historical data:
      </p>
      
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as Exclude<PresetKey, "custom">[]).map((key) => (
          <Button
            key={key}
            variant={selectedPreset === key ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetClick(key)}
            disabled={isStarting}
            className="text-xs"
          >
            {PRESETS[key].label}
          </Button>
        ))}
        
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

      {/* Selected range display */}
      {selectedPreset === "custom" && customRange?.from && customRange?.to && (
        <p className="text-xs text-muted-foreground">
          Selected: {format(customRange.from, "MMM d, yyyy")} – {format(customRange.to, "MMM d, yyyy")}
        </p>
      )}

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
            <Play className="h-4 w-4 mr-2" />
            Import {getDateRangeLabel()}
          </>
        )}
      </V3Button>
    </div>
  );
};

export default ActBlueBackfillDatePicker;
