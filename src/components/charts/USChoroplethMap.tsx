import { useMemo, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { scaleQuantize } from "d3-scale";
import { geoIdentity } from "d3-geo";
import { FIPS_TO_STATE, ABBR_TO_FIPS, getStateByFips } from "@/lib/us-fips";
import { USMapLegend } from "./USMapLegend";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";

// US Atlas TopoJSON (states-albers-10m) is already projected into planar coordinates.
// Using a geographic projection (e.g. geoAlbersUsa) would double-project and scramble the geometry.
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json";

// Fixed bbox from the us-atlas file (stable across loads) so we can use an identity projection.
const ALBERS_BBOX = [
  -57.66491068874468,
  12.97635452036684,
  957.5235629133763,
  606.5694262668667,
] as const;
const ALBERS_WIDTH = ALBERS_BBOX[2] - ALBERS_BBOX[0];
const ALBERS_HEIGHT = ALBERS_BBOX[3] - ALBERS_BBOX[1];
const ALBERS_TRANSLATE: [number, number] = [-ALBERS_BBOX[0], -ALBERS_BBOX[1]];

export type MapMetricMode = "donations" | "donors" | "revenue";

export interface ChoroplethDataItem {
  /** State abbreviation (e.g., "CA") or FIPS code */
  name: string;
  /** Transaction/donation count */
  value: number;
  /** Unique donor count */
  donors?: number;
  /** Revenue amount */
  revenue?: number;
}

export interface USChoroplethMapProps {
  data: ChoroplethDataItem[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  /** Which metric to display on the map */
  metricMode?: MapMetricMode;
  /** Callback when metric mode changes */
  onMetricModeChange?: (mode: MapMetricMode) => void;
  /** Show metric toggle UI */
  showMetricToggle?: boolean;
  onStateClick?: (stateAbbr: string, stateName: string, data: ChoroplethDataItem | null) => void;
  /** Currently selected state (for visual highlighting) */
  selectedState?: string | null;
  minValue?: number;
  maxValue?: number;
}

const NO_DATA_COLOR = "hsl(var(--portal-bg))";

function useAlbersIdentityProjection() {
  return useMemo(() => {
    // react-simple-maps applies translate([width/2,height/2]) automatically only for string projections.
    // For pre-projected albers geometry we must supply a pre-configured identity projection.
    return geoIdentity().translate(ALBERS_TRANSLATE).scale(1);
  }, []);
}

export function USChoroplethMap({
  data,
  height = 420,
  className = "",
  isLoading = false,
  metricMode = "donations",
  onMetricModeChange,
  showMetricToggle = false,
  onStateClick,
  selectedState,
  minValue: propMinValue,
  maxValue: propMaxValue,
}: USChoroplethMapProps) {
  const projection = useAlbersIdentityProjection();

  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredFips, setHoveredFips] = useState<string | null>(null);

  // Get the value to display based on metric mode
  const getMetricValue = useCallback((item: ChoroplethDataItem): number => {
    switch (metricMode) {
      case "donors":
        return item.donors ?? item.value;
      case "revenue":
        return item.revenue ?? 0;
      case "donations":
      default:
        return item.value;
    }
  }, [metricMode]);

  // Get label for current metric mode
  const metricLabel = useMemo(() => {
    switch (metricMode) {
      case "donors": return "Unique Donors";
      case "revenue": return "Revenue";
      case "donations":
      default: return "Donations";
    }
  }, [metricMode]);

  // Format value based on metric mode
  const formatMetricValue = useCallback((value: number): string => {
    switch (metricMode) {
      case "revenue":
        return formatCurrency(value);
      case "donors":
      case "donations":
      default:
        return formatNumber(value);
    }
  }, [metricMode]);

  // Build lookup map: FIPS -> data item
  const dataLookup = useMemo(() => {
    const lookup = new Map<string, ChoroplethDataItem>();
    data.forEach((item) => {
      // Support both abbreviation and FIPS as input
      let fips = ABBR_TO_FIPS[item.name.toUpperCase()];
      if (!fips) {
        // Check if it's already a FIPS code (handle padding)
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

  // Calculate value range based on current metric
  const { minValue, maxValue } = useMemo(() => {
    const values = Array.from(dataLookup.values()).map(getMetricValue);
    if (values.length === 0) return { minValue: 0, maxValue: 1 };
    
    const min = propMinValue ?? Math.min(...values);
    const max = propMaxValue ?? Math.max(...values);
    
    // Handle degenerate case where min === max
    if (min >= max) {
      return { minValue: min, maxValue: min + 1 };
    }
    
    return { minValue: min, maxValue: max };
  }, [dataLookup, propMinValue, propMaxValue, getMetricValue]);

  // Color scale with 12 buckets - range from 0.12 to 0.85 for better light mode readability
  // Avoids very low opacity (hard to see) and very high opacity (looks black)
  const colorRange = useMemo(
    () => [
      "hsl(var(--portal-accent-blue) / 0.12)",
      "hsl(var(--portal-accent-blue) / 0.18)",
      "hsl(var(--portal-accent-blue) / 0.25)",
      "hsl(var(--portal-accent-blue) / 0.32)",
      "hsl(var(--portal-accent-blue) / 0.39)",
      "hsl(var(--portal-accent-blue) / 0.46)",
      "hsl(var(--portal-accent-blue) / 0.53)",
      "hsl(var(--portal-accent-blue) / 0.60)",
      "hsl(var(--portal-accent-blue) / 0.67)",
      "hsl(var(--portal-accent-blue) / 0.74)",
      "hsl(var(--portal-accent-blue) / 0.80)",
      "hsl(var(--portal-accent-blue) / 0.85)",
    ],
    []
  );

  const colorScale = useMemo(() => {
    return scaleQuantize<string>()
      .domain([minValue, maxValue])
      .range(colorRange);
  }, [minValue, maxValue, colorRange]);

  // Get FIPS for selected state
  const selectedFips = useMemo(() => {
    if (!selectedState) return null;
    return ABBR_TO_FIPS[selectedState.toUpperCase()] || null;
  }, [selectedState]);

  // Handle mouse events
  const handleMouseEnter = useCallback(
    (geo: any, event: React.MouseEvent) => {
      const fips = geo.id;
      const stateInfo = getStateByFips(fips);
      const stateData = dataLookup.get(fips);

      if (stateInfo) {
        const metricValue = stateData ? getMetricValue(stateData) : 0;
        setTooltipContent(
          <div className="space-y-0.5">
            <div className="font-semibold text-[hsl(var(--portal-text-primary))] text-sm">
              {stateInfo.name} ({stateInfo.abbreviation})
            </div>
            {stateData ? (
              <>
                <div className="text-[hsl(var(--portal-text-secondary))] text-xs">
                  {metricLabel}: <span className="font-medium">{formatMetricValue(metricValue)}</span>
                </div>
                {metricMode !== "revenue" && stateData.revenue !== undefined && (
                  <div className="text-[hsl(var(--portal-text-muted))] text-xs">
                    Revenue: {formatCurrency(stateData.revenue)}
                  </div>
                )}
              </>
            ) : (
              <div className="text-[hsl(var(--portal-text-muted))] text-xs">No data</div>
            )}
          </div>
        );
        setHoveredFips(fips);
      }
    },
    [dataLookup, metricLabel, formatMetricValue, getMetricValue, metricMode]
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
      {/* Metric Toggle */}
      {showMetricToggle && onMetricModeChange && (
        <div className="flex items-center justify-end gap-1 mb-2">
          <span className="text-xs text-[hsl(var(--portal-text-muted))] mr-2">Show:</span>
          {(["donations", "donors", "revenue"] as MapMetricMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onMetricModeChange(mode)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                metricMode === mode
                  ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                  : "bg-[hsl(var(--portal-card-bg))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-border))]"
              }`}
            >
              {mode === "donations" ? "Donations" : mode === "donors" ? "Donors" : "Revenue"}
            </button>
          ))}
        </div>
      )}

      <ComposableMap
        projection={projection}
        width={ALBERS_WIDTH}
        height={ALBERS_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const fips = geo.id;
              const stateInfo = getStateByFips(fips);
              const stateData = dataLookup.get(fips);
              
              const isSelected = selectedFips === fips;
              const metricValue = stateData ? getMetricValue(stateData) : 0;
              const hasData = stateData !== undefined && metricValue > 0;

              // Determine fill color
              let fillColor: string;
              if (!hasData) {
                fillColor = NO_DATA_COLOR;
              } else {
                fillColor = colorScale(metricValue);
              }

              // Selected state has accent outline
              const strokeColor = isSelected
                ? "hsl(var(--portal-accent-blue))"
                : "hsl(var(--portal-border))";
              const strokeWidth = isSelected ? 2 : 0.5;

              // Aria label for accessibility
              const ariaLabel = stateInfo
                ? `View details for ${stateInfo.name} (${stateInfo.abbreviation}). ${
                    hasData ? `${formatMetricValue(metricValue)} ${metricLabel.toLowerCase()}.` : "No data."
                  }`
                : undefined;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  tabIndex={onStateClick ? 0 : -1}
                  role="button"
                  aria-label={ariaLabel}
                  onClick={() => handleClick(geo)}
                  onMouseEnter={(e) => handleMouseEnter(geo, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onKeyDown={(e) => handleKeyDown(geo, e)}
                  style={{
                    default: {
                      fill: fillColor,
                      stroke: strokeColor,
                      strokeWidth,
                      outline: "none",
                      cursor: onStateClick ? "pointer" : "default",
                    },
                    hover: {
                      fill: hasData
                        ? "hsl(var(--portal-accent-blue))"
                        : "hsl(var(--portal-card-bg))",
                      stroke: "hsl(var(--portal-text-primary))",
                      strokeWidth: 1.5,
                      outline: "none",
                      cursor: onStateClick ? "pointer" : "default",
                    },
                    pressed: {
                      fill: "hsl(var(--portal-accent-blue))",
                      stroke: "hsl(var(--portal-text-primary))",
                      strokeWidth: 2,
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Legend */}
      <div className="mt-4 px-4">
        <USMapLegend
          minValue={minValue}
          maxValue={maxValue}
          colorRange={colorRange}
          formatValue={formatMetricValue}
          noDataColor={NO_DATA_COLOR}
          discrete
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
          {tooltipContent}
        </div>
      )}
    </div>
  );
}
