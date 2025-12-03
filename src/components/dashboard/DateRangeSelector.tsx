import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar } from "@/components/ui/calendar";
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

const presets = [
  { label: "Today", days: 0 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export function DateRangeSelector({
  startDate,
  endDate,
  onDateChange,
  className,
}: DateRangeSelectorProps) {
  const isMobile = useIsMobile();
  const [selectedPreset, setSelectedPreset] = useState<number | "custom">(30);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handlePresetClick = (days: number) => {
    setSelectedPreset(days);
    const end = new Date();
    const start = days === 0 ? new Date() : subDays(end, days);
    onDateChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
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
            onClick={() => handlePresetClick(preset.days)}
            className={cn(
              "px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap flex-shrink-0",
              selectedPreset === preset.days
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
            className="w-auto p-0 portal-card z-50" 
            align="end"
            side={isMobile ? "bottom" : "bottom"}
            sideOffset={8}
          >
            <Calendar
              mode="range"
              defaultMonth={customRange?.from}
              selected={customRange}
              onSelect={handleCustomRangeSelect}
              numberOfMonths={isMobile ? 1 : 2}
              className="pointer-events-auto"
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}