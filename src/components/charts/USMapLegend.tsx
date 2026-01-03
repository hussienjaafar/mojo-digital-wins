import { useId, useMemo } from "react";

export interface LegendBucket {
  min: number;
  max: number;
  color: string;
  label?: string;
}

export interface USMapLegendProps {
  minValue: number;
  maxValue: number;
  colorRange: string[];
  formatValue?: (value: number) => string;
  className?: string;
  noDataColor?: string;
  /** If true, render discrete bucket swatches instead of gradient */
  discrete?: boolean;
}

export function USMapLegend({
  minValue,
  maxValue,
  colorRange,
  formatValue = (v) => v.toLocaleString(),
  className = "",
  noDataColor = "hsl(var(--portal-bg))",
  discrete = true,
}: USMapLegendProps) {
  const gradientId = useId();

  // Calculate bucket boundaries for discrete legend
  const buckets = useMemo<LegendBucket[]>(() => {
    // Guard against edge cases
    if (!colorRange || colorRange.length === 0) {
      return [];
    }
    
    if (colorRange.length === 1) {
      return [{
        min: minValue,
        max: maxValue,
        color: colorRange[0],
        label: `${formatValue(minValue)} - ${formatValue(maxValue)}`,
      }];
    }

    // Handle case where min === max (degenerate scale)
    if (minValue >= maxValue) {
      return [{
        min: minValue,
        max: maxValue,
        color: colorRange[Math.floor(colorRange.length / 2)],
        label: formatValue(minValue),
      }];
    }

    const numBuckets = colorRange.length;
    const step = (maxValue - minValue) / numBuckets;
    
    return colorRange.map((color, i) => {
      const bucketMin = minValue + step * i;
      const bucketMax = i === numBuckets - 1 ? maxValue : minValue + step * (i + 1);
      
      return {
        min: bucketMin,
        max: bucketMax,
        color,
        label: i === 0 
          ? `${formatValue(Math.round(bucketMin))} - ${formatValue(Math.round(bucketMax))}`
          : i === numBuckets - 1
            ? `${formatValue(Math.round(bucketMin))}+`
            : undefined,
      };
    });
  }, [minValue, maxValue, colorRange, formatValue]);

  // Empty state
  if (buckets.length === 0) {
    return null;
  }

  // Discrete bucket swatches (recommended for quantized choropleths)
  if (discrete) {
    return (
      <div className={`flex flex-wrap items-center gap-4 ${className}`}>
        {/* Color buckets */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[hsl(var(--portal-text-muted))] mr-1">
            {formatValue(minValue)}
          </span>
          {buckets.map((bucket, i) => (
            <div
              key={i}
              className="w-6 h-3 first:rounded-l last:rounded-r"
              style={{ backgroundColor: bucket.color }}
              title={bucket.label || `${formatValue(Math.round(bucket.min))} - ${formatValue(Math.round(bucket.max))}`}
            />
          ))}
          <span className="text-xs text-[hsl(var(--portal-text-muted))] ml-1">
            {formatValue(maxValue)}
          </span>
        </div>
        
        {/* No data indicator */}
        <div className="flex items-center gap-1.5 pl-3 border-l border-[hsl(var(--portal-border))]">
          <div
            className="w-4 h-3 rounded-sm"
            style={{ 
              backgroundColor: noDataColor, 
              border: "1px dashed hsl(var(--portal-border))" 
            }}
          />
          <span className="text-xs text-[hsl(var(--portal-text-muted))]">No data</span>
        </div>
      </div>
    );
  }

  // Gradient legend (fallback)
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
                  offset={`${(i / Math.max(colorRange.length - 1, 1)) * 100}%`}
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
          style={{ 
            backgroundColor: noDataColor, 
            border: "1px dashed hsl(var(--portal-border))" 
          }}
        />
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">No data</span>
      </div>
    </div>
  );
}
