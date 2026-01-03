import { useMemo, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleQuantize } from "d3-scale";
import { FIPS_TO_STATE, ABBR_TO_FIPS, getStateByFips } from "@/lib/us-fips";
import { USMapLegend } from "./USMapLegend";

// US Atlas TopoJSON - Albers USA projection with AK/HI inset
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json";

export interface ChoroplethDataItem {
  /** State abbreviation (e.g., "CA") or FIPS code */
  name: string;
  value: number;
  revenue?: number;
}

export interface USChoroplethMapProps {
  data: ChoroplethDataItem[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  valueType?: "number" | "currency" | "percent";
  valueLabel?: string;
  showRevenue?: boolean;
  onStateClick?: (stateAbbr: string, stateName: string, data: ChoroplethDataItem | null) => void;
  minValue?: number;
  maxValue?: number;
}

export function USChoroplethMap({
  data,
  height = 420,
  className = "",
  isLoading = false,
  valueType = "number",
  valueLabel = "Value",
  showRevenue = false,
  onStateClick,
  minValue: propMinValue,
  maxValue: propMaxValue,
}: USChoroplethMapProps) {
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredFips, setHoveredFips] = useState<string | null>(null);

  // Build lookup map: FIPS -> data item
  const dataLookup = useMemo(() => {
    const lookup = new Map<string, ChoroplethDataItem>();
    data.forEach((item) => {
      // Support both abbreviation and FIPS as input
      let fips = ABBR_TO_FIPS[item.name.toUpperCase()];
      if (!fips) {
        // Check if it's already a FIPS code
        const paddedFips = item.name.padStart(2, "0");
        if (FIPS_TO_STATE[paddedFips]) {
          fips = paddedFips;
        }
      }
      if (fips) {
        lookup.set(fips, item);
      }
    });
    return lookup;
  }, [data]);

  // Calculate value range
  const { minValue, maxValue } = useMemo(() => {
    const values = Array.from(dataLookup.values()).map((d) => d.value);
    if (values.length === 0) return { minValue: 0, maxValue: 1 };
    return {
      minValue: propMinValue ?? Math.min(...values),
      maxValue: propMaxValue ?? Math.max(...values),
    };
  }, [dataLookup, propMinValue, propMaxValue]);

  // Color scale with 5 buckets
  const colorRange = useMemo(
    () => [
      "hsl(var(--portal-accent-blue) / 0.15)",
      "hsl(var(--portal-accent-blue) / 0.35)",
      "hsl(var(--portal-accent-blue) / 0.55)",
      "hsl(var(--portal-accent-blue) / 0.75)",
      "hsl(var(--portal-accent-blue) / 0.95)",
    ],
    []
  );

  const colorScale = useMemo(() => {
    return scaleQuantize<string>()
      .domain([minValue, maxValue])
      .range(colorRange);
  }, [minValue, maxValue, colorRange]);

  // Format value based on type
  const formatValue = useCallback(
    (value: number) => {
      switch (valueType) {
        case "currency":
          return `$${value.toLocaleString()}`;
        case "percent":
          return `${value.toFixed(1)}%`;
        default:
          return value.toLocaleString();
      }
    },
    [valueType]
  );

  // Handle mouse events
  const handleMouseEnter = useCallback(
    (geo: any, event: React.MouseEvent) => {
      const fips = geo.id;
      const stateInfo = getStateByFips(fips);
      const stateData = dataLookup.get(fips);

      if (stateInfo) {
        let content = `${stateInfo.name} (${stateInfo.abbreviation})`;
        if (stateData) {
          content += `\n${valueLabel}: ${formatValue(stateData.value)}`;
          if (showRevenue && stateData.revenue !== undefined) {
            content += `\nRevenue: $${stateData.revenue.toLocaleString()}`;
          }
        } else {
          content += "\nNo data";
        }
        setTooltipContent(content);
        setHoveredFips(fips);
      }
    },
    [dataLookup, valueLabel, formatValue, showRevenue]
  );

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    setTooltipPos({ x: event.clientX, y: event.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipContent(null);
    setHoveredFips(null);
  }, []);

  const handleClick = useCallback(
    (geo: any) => {
      if (!onStateClick) return;
      const fips = geo.id;
      const stateInfo = getStateByFips(fips);
      const stateData = dataLookup.get(fips);
      if (stateInfo) {
        onStateClick(stateInfo.abbreviation, stateInfo.name, stateData || null);
      }
    },
    [onStateClick, dataLookup]
  );

  const handleKeyDown = useCallback(
    (geo: any, event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick(geo);
      }
    },
    [handleClick]
  );

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-[hsl(var(--portal-card-bg))] rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-[hsl(var(--portal-accent-blue))] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[hsl(var(--portal-text-muted))]">Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <ComposableMap
        projection="geoAlbersUsa"
        style={{ width: "100%", height: typeof height === "number" ? height : undefined }}
        projectionConfig={{ scale: 1000 }}
      >
        <ZoomableGroup center={[0, 0]} zoom={1} minZoom={1} maxZoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const fips = geo.id;
                const stateData = dataLookup.get(fips);
                const isHovered = hoveredFips === fips;
                const hasData = stateData !== undefined && stateData.value > 0;

                // Determine fill color
                let fillColor: string;
                if (!hasData) {
                  fillColor = "hsl(var(--portal-bg))";
                } else {
                  fillColor = colorScale(stateData.value);
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    tabIndex={onStateClick ? 0 : -1}
                    onClick={() => handleClick(geo)}
                    onMouseEnter={(e) => handleMouseEnter(geo, e)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onKeyDown={(e) => handleKeyDown(geo, e)}
                    style={{
                      default: {
                        fill: fillColor,
                        stroke: "hsl(var(--portal-border))",
                        strokeWidth: 0.5,
                        outline: "none",
                        cursor: onStateClick ? "pointer" : "default",
                      },
                      hover: {
                        fill: isHovered
                          ? hasData
                            ? "hsl(var(--portal-accent-blue))"
                            : "hsl(var(--portal-card-bg))"
                          : fillColor,
                        stroke: "hsl(var(--portal-text-primary))",
                        strokeWidth: 1,
                        outline: "none",
                        cursor: onStateClick ? "pointer" : "default",
                      },
                      pressed: {
                        fill: "hsl(var(--portal-accent-blue))",
                        stroke: "hsl(var(--portal-text-primary))",
                        strokeWidth: 1.5,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="mt-4 px-4">
        <USMapLegend
          minValue={minValue}
          maxValue={maxValue}
          colorRange={colorRange}
          formatValue={formatValue}
        />
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          className="fixed z-50 pointer-events-none bg-[hsl(var(--portal-card-bg))] border border-[hsl(var(--portal-border))] rounded-lg px-3 py-2 shadow-lg"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 12,
            transform: "translateY(-100%)",
          }}
        >
          {tooltipContent.split("\n").map((line, i) => (
            <div
              key={i}
              className={
                i === 0
                  ? "font-semibold text-[hsl(var(--portal-text-primary))] text-sm"
                  : "text-[hsl(var(--portal-text-secondary))] text-xs"
              }
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
