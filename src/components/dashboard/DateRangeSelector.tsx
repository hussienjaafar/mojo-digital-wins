import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
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
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
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
      return (
        <>
          {format(customRange.from, "LLL dd, y")} -{" "}
          {format(customRange.to, "LLL dd, y")}
        </>
      );
    }
    if (selectedPreset === "custom") {
      return "Select date range";
    }
    const preset = presets.find((p) => p.days === selectedPreset);
    return preset?.label || "Last 30 Days";
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={selectedPreset === preset.days ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetClick(preset.days)}
            className="text-sm"
          >
            {preset.label}
          </Button>
        ))}
        <Button
          variant={selectedPreset === "custom" ? "default" : "outline"}
          size="sm"
          onClick={handleCustomClick}
          className="text-sm"
        >
          Custom Range
        </Button>
      </div>

      {/* Custom Date Picker */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal w-full sm:w-auto",
              selectedPreset !== "custom" && "opacity-0 h-0 p-0 overflow-hidden"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="text-sm">{getDisplayText()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
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
  );
}
