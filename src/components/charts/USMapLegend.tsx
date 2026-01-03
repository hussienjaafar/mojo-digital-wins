import { useMemo } from "react";

export interface USMapLegendProps {
  minValue: number;
  maxValue: number;
  colorRange: string[];
  formatValue?: (value: number) => string;
  className?: string;
}

export function USMapLegend({
  minValue,
  maxValue,
  colorRange,
  formatValue = (v) => v.toLocaleString(),
  className = "",
}: USMapLegendProps) {
  const gradientId = useMemo(() => `legend-gradient-${Math.random().toString(36).slice(2)}`, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-xs text-[hsl(var(--portal-text-muted))]">
        {formatValue(minValue)}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-[hsl(var(--portal-card-bg))]">
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {colorRange.map((color, i) => (
                <stop
                  key={i}
                  offset={`${(i / (colorRange.length - 1)) * 100}%`}
                  stopColor={color}
                />
              ))}
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </svg>
      </div>
      <span className="text-xs text-[hsl(var(--portal-text-muted))]">
        {formatValue(maxValue)}
      </span>
      <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-[hsl(var(--portal-border))]">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: "hsl(var(--portal-bg))", border: "1px dashed hsl(var(--portal-border))" }}
        />
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">No data</span>
      </div>
    </div>
  );
}
