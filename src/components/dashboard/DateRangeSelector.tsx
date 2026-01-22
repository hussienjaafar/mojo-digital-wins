import { useState, useEffect } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, parseISO, differenceInDays } from "date-fns";
import { DateRange, DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  className?: string;
}

interface PresetConfig {
  label: string;
  days: number;
  single?: boolean;
  offset?: number; // days offset from today (negative for past)
}

const presets: PresetConfig[] = [
  { label: "Today", days: 0, single: true },
  { label: "Yesterday", days: 0, single: true, offset: -1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

/**
 * Detects which preset matches the current date range
 */
function detectPreset(startDate: string, endDate: string): number | "custom" {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");
  
  // Check for single-day selections
  if (startDate === endDate) {
    if (startDate === todayStr) return 0; // Today
    if (startDate === yesterdayStr) return -1; // Yesterday (offset)
    return "custom";
  }
  
  // Multi-day ranges must end today
  if (endDate !== todayStr) return "custom";
  
  const daysDiff = differenceInDays(parseISO(endDate), parseISO(startDate));
  
  // Match known presets
  if (daysDiff >= 6 && daysDiff <= 8) return 7;
  if (daysDiff >= 29 && daysDiff <= 31) return 30;
  if (daysDiff >= 89 && daysDiff <= 91) return 90;
  
  return "custom";
}

export function DateRangeSelector({
  startDate,
  endDate,
  onDateChange,
  className,
}: DateRangeSelectorProps) {
  const isMobile = useIsMobile();
  // Detect initial preset from props
  const [selectedPreset, setSelectedPreset] = useState<number | "custom">(() => 
    detectPreset(startDate, endDate)
  );
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Sync preset state when props change (e.g., from store rehydration)
  useEffect(() => {
    const detected = detectPreset(startDate, endDate);
    if (detected !== selectedPreset) {
      setSelectedPreset(detected);
    }
  }, [startDate, endDate]);

  const handlePresetClick = (preset: PresetConfig) => {
    const today = new Date();
    
    if (preset.single) {
      // Single-day preset (Today or Yesterday)
      const targetDate = preset.offset ? subDays(today, Math.abs(preset.offset)) : today;
      const dateStr = format(targetDate, "yyyy-MM-dd");
      setSelectedPreset(preset.offset ?? 0);
      onDateChange(dateStr, dateStr);
    } else {
      // Multi-day range preset
      setSelectedPreset(preset.days);
      const end = today;
      const start = subDays(end, preset.days);
      onDateChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
    }
  };

  const handleCustomClick = () => {
    setSelectedPreset("custom");
    setIsCalendarOpen(true);
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      onDateChange(
        format(range.from, "yyyy-MM-dd"),
        format(range.to, "yyyy-MM-dd")
      );
      setIsCalendarOpen(false);
    }
  };

  const getDisplayText = () => {
    if (selectedPreset === "custom" && customRange?.from && customRange?.to) {
      return `${format(customRange.from, "MMM d")} - ${format(customRange.to, "MMM d")}`;
    }
    return "Custom";
  };

  // Check if a preset is selected
  const isPresetSelected = (preset: PresetConfig): boolean => {
    if (preset.single && preset.offset) {
      return selectedPreset === preset.offset;
    }
    if (preset.single) {
      return selectedPreset === 0;
    }
    return selectedPreset === preset.days;
  };

  return (
    <div className={cn("flex items-center gap-1.5 max-w-full", className)}>
      {/* Preset Buttons - Portal Style with mobile scroll */}
      <div 
        className="flex items-center gap-1 p-1 rounded-lg overflow-x-auto scrollbar-hide flex-shrink-0" 
        style={{ background: 'hsl(var(--portal-bg-elevated))' }}
      >
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset)}
            className={cn(
              "px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap flex-shrink-0",
              isPresetSelected(preset)
                ? "bg-[hsl(var(--portal-accent-blue))] text-white shadow-sm"
                : "text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-tertiary))]"
            )}
          >
            {preset.label}
          </button>
        ))}
        
        {/* Custom Date Picker - Icon only on mobile */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={handleCustomClick}
              className={cn(
                "px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0",
                selectedPreset === "custom"
                  ? "bg-[hsl(var(--portal-accent-blue))] text-white shadow-sm"
                  : "text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-tertiary))]"
              )}
            >
              <CalendarIcon className="h-3 w-3" />
              <span className="hidden sm:inline">
                {selectedPreset === "custom" ? getDisplayText() : "Custom"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 z-[200] !bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] rounded-lg shadow-lg opacity-100" 
            align="end"
            side="bottom"
            sideOffset={8}
          >
            <DayPicker
              mode="range"
              selected={customRange}
              onSelect={handleCustomRangeSelect}
              numberOfMonths={1}
              defaultMonth={new Date()}
              showOutsideDays
              disabled={(date) => date > new Date()}
              className={cn(
                "portal-calendar-panel pointer-events-auto",
                "p-[var(--portal-space-md)]"
              )}
              classNames={{
                months: "flex flex-col gap-[var(--portal-space-lg)]",
                month: "space-y-[var(--portal-space-md)]",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: cn(
                  "text-sm font-semibold",
                  "text-[hsl(var(--portal-text-primary))]"
                ),
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-7 w-7 p-0",
                  "inline-flex items-center justify-center",
                  "rounded-[var(--portal-radius-sm)]",
                  "border border-[hsl(var(--portal-border))]",
                  "bg-transparent",
                  "text-[hsl(var(--portal-text-muted))]",
                  "hover:bg-[hsl(var(--portal-bg-hover))]",
                  "hover:text-[hsl(var(--portal-text-primary))]",
                  "transition-colors",
                  "disabled:opacity-50"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: cn(
                  "w-9 font-medium text-[0.75rem]",
                  "text-[hsl(var(--portal-text-muted))]",
                  "rounded-[var(--portal-radius-sm)]"
                ),
                row: "flex w-full mt-1",
                cell: cn(
                  "h-9 w-9 text-center text-sm p-0 relative",
                  "[&:has([aria-selected].day-range-end)]:rounded-r-[var(--portal-radius-sm)]",
                  "[&:has([aria-selected].day-outside)]:bg-[hsl(var(--portal-accent-blue)/0.05)]",
                  "[&:has([aria-selected])]:bg-[hsl(var(--portal-accent-blue)/0.1)]",
                  "first:[&:has([aria-selected])]:rounded-l-[var(--portal-radius-sm)]",
                  "last:[&:has([aria-selected])]:rounded-r-[var(--portal-radius-sm)]",
                  "focus-within:relative focus-within:z-20"
                ),
                day: cn(
                  "h-9 w-9 p-0 font-normal",
                  "inline-flex items-center justify-center",
                  "rounded-[var(--portal-radius-sm)]",
                  "text-[hsl(var(--portal-text-primary))]",
                  "hover:bg-[hsl(var(--portal-bg-hover))]",
                  "transition-colors",
                  "aria-selected:opacity-100"
                ),
                day_range_end: "day-range-end",
                day_selected: cn(
                  "bg-[hsl(var(--portal-accent-blue))]",
                  "text-white",
                  "hover:bg-[hsl(var(--portal-accent-blue))]",
                  "hover:text-white",
                  "focus:bg-[hsl(var(--portal-accent-blue))]",
                  "focus:text-white"
                ),
                day_today: cn(
                  "bg-[hsl(var(--portal-bg-elevated))]",
                  "text-[hsl(var(--portal-text-primary))]",
                  "font-semibold"
                ),
                day_outside: cn(
                  "day-outside",
                  "text-[hsl(var(--portal-text-muted))]",
                  "opacity-50",
                  "aria-selected:bg-[hsl(var(--portal-accent-blue)/0.05)]",
                  "aria-selected:text-[hsl(var(--portal-text-muted))]",
                  "aria-selected:opacity-30"
                ),
                day_disabled: cn(
                  "text-[hsl(var(--portal-text-muted))]",
                  "opacity-50"
                ),
                day_range_middle: cn(
                  "aria-selected:bg-[hsl(var(--portal-accent-blue)/0.1)]",
                  "aria-selected:text-[hsl(var(--portal-text-primary))]"
                ),
                day_hidden: "invisible",
              }}
              components={{
                IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                IconRight: () => <ChevronRight className="h-4 w-4" />,
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}