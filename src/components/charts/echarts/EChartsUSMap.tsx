import * as React from "react";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getStateName, getStateAbbreviation, STATE_ABBREVIATIONS } from "@/lib/us-states";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";
import { getPortalChartColors, getMapGradientColors } from "@/lib/resolve-css-color";
import { useTheme } from "next-themes";

export interface USMapDataItem {
  /** State abbreviation (e.g., "CA") or full name (e.g., "California") */
  name: string;
  /** Primary value for the heat map color */
  value: number;
  /** Additional data to show in tooltip */
  revenue?: number;
  /** Any additional properties */
  [key: string]: any;
}

export interface EChartsUSMapProps {
  /** Map data array */
  data: USMapDataItem[];
  /** Chart height */
  height?: number | string;
  /** Additional className */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Value type for formatting */
  valueType?: "number" | "currency" | "percent";
  /** Label for the primary value in tooltip */
  valueLabel?: string;
  /** Whether to show revenue in tooltip */
  showRevenue?: boolean;
  /** Callback when a state is clicked */
  onStateClick?: (stateAbbr: string, stateName: string, data: USMapDataItem) => void;
  /** Min value for color scale (auto-calculated if not provided) */
  minValue?: number;
  /** Max value for color scale (auto-calculated if not provided) */
  maxValue?: number;
}

// Albers-projected TopoJSON (has AK/HI inset correctly)
const USA_ALBERS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json";

// FIPS codes to state names mapping (excluding territories for cleaner map bounds)
const FIPS_TO_STATE: Record<string, string> = {
  "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas",
  "06": "California", "08": "Colorado", "09": "Connecticut", "10": "Delaware",
  "11": "District of Columbia", "12": "Florida", "13": "Georgia", "15": "Hawaii",
  "16": "Idaho", "17": "Illinois", "18": "Indiana", "19": "Iowa",
  "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine",
  "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
  "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska",
  "32": "Nevada", "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico",
  "36": "New York", "37": "North Carolina", "38": "North Dakota", "39": "Ohio",
  "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island",
  "45": "South Carolina", "46": "South Dakota", "47": "Tennessee", "48": "Texas",
  "49": "Utah", "50": "Vermont", "51": "Virginia", "53": "Washington",
  "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
};

// All 50 states + DC for complete data coverage
const ALL_STATE_NAMES = Object.values(FIPS_TO_STATE);

export const EChartsUSMap: React.FC<EChartsUSMapProps> = ({
  data,
  height = 400,
  className,
  isLoading = false,
  valueType = "number",
  valueLabel = "Donors",
  showRevenue = true,
  onStateClick,
  minValue,
  maxValue,
}) => {
  const chartRef = React.useRef<ReactECharts>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mapRegistered, setMapRegistered] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);
  const { theme } = useTheme();

  // Register the USA map on mount
  React.useEffect(() => {
    const registerMap = async () => {
      try {
        // Check if already registered
        if (echarts.getMap("USA")) {
          setMapRegistered(true);
          return;
        }

        const response = await fetch(USA_ALBERS_URL);
        if (!response.ok) throw new Error("Failed to load map data");
        
        const topoJson = await response.json();
        
        // Convert TopoJSON to GeoJSON
        const { feature } = await import("topojson-client");
        const geoJson = feature(topoJson, topoJson.objects.states) as any;
        
        // Add state names and filter out Puerto Rico/territories
        geoJson.features = geoJson.features
          .map((f: any) => {
            const fips = String(f.id).padStart(2, "0");
            const stateName = FIPS_TO_STATE[fips];
            
            // Skip territories (Puerto Rico = 72, etc.)
            if (!stateName) return null;
            
            return {
              ...f,
              properties: {
                ...f.properties,
                name: stateName,
              },
            };
          })
          .filter(Boolean);

        echarts.registerMap("USA", geoJson);
        setMapRegistered(true);
      } catch (err) {
        console.error("Failed to register USA map:", err);
        setMapError("Failed to load map");
      }
    };

    registerMap();
  }, []);

  // Resize chart after map registration
  React.useEffect(() => {
    if (!mapRegistered || !chartRef.current) return;
    
    const chart = chartRef.current.getEchartsInstance();
    if (chart && !chart.isDisposed?.()) {
      requestAnimationFrame(() => {
        try {
          chart.resize();
        } catch (e) {
          // Chart may have been disposed
        }
      });
    }
  }, [mapRegistered]);

  // ResizeObserver for container size changes
  React.useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      const chart = chartRef.current?.getEchartsInstance();
      if (chart && !chart.isDisposed?.()) {
        try {
          chart.resize();
        } catch (e) {
          // Chart may have been disposed
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [mapRegistered]);

  // Resolve theme-aware colors
  const colors = React.useMemo(() => {
    return getPortalChartColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, mapRegistered]);

  const gradientColors = React.useMemo(() => {
    return getMapGradientColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, mapRegistered]);

  // Transform data: ensure ALL states have entries, use full names for GeoJSON matching
  const transformedData = React.useMemo(() => {
    // Create a lookup from input data
    const dataLookup = new Map<string, USMapDataItem>();
    
    data.forEach((item) => {
      // Normalize to full state name
      const fullName = item.name.length === 2 
        ? getStateName(item.name.toUpperCase()) 
        : item.name;
      const abbr = item.name.length === 2 
        ? item.name.toUpperCase() 
        : getStateAbbreviation(item.name);
      
      dataLookup.set(fullName, {
        ...item,
        name: fullName,
        originalAbbr: abbr,
      });
    });

    // Build complete dataset for all states
    return ALL_STATE_NAMES.map((stateName) => {
      const existing = dataLookup.get(stateName);
      if (existing) {
        return existing;
      }
      // Default entry for states with no data
      return {
        name: stateName,
        value: 0,
        revenue: 0,
        originalAbbr: getStateAbbreviation(stateName),
      };
    });
  }, [data]);

  // Calculate min/max for visualMap
  const { calculatedMin, calculatedMax } = React.useMemo(() => {
    const values = transformedData.map((d) => d.value).filter((v) => v > 0);
    return {
      calculatedMin: minValue ?? 0,
      calculatedMax: maxValue ?? Math.max(...values, 1),
    };
  }, [transformedData, minValue, maxValue]);

  // Format value based on type
  const formatValue = React.useCallback((value: number) => {
    switch (valueType) {
      case "currency":
        return formatCurrency(value);
      case "percent":
        return `${value.toFixed(1)}%`;
      default:
        return formatNumber(value);
    }
  }, [valueType]);

  // ECharts option with resolved colors
  const option = React.useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: "item",
      backgroundColor: colors.bgElevated,
      borderColor: colors.border,
      textStyle: {
        color: colors.textPrimary,
        fontSize: 13,
      },
      extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.25); border-radius: 8px;",
      formatter: (params: any) => {
        const stateName = params.name || "Unknown";
        const stateData = params.data;
        
        if (!stateData || stateData.value === 0) {
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 4px;">${stateName}</div>
            <div style="color: ${colors.textMuted};">No data available</div>
          </div>`;
        }
        
        const { value, revenue, originalAbbr } = stateData;
        const displayName = originalAbbr ? `${stateName} (${originalAbbr})` : stateName;
        
        let content = `<div style="padding: 4px 0;">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${displayName}</div>
          <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px;">
            <span style="color: ${colors.textMuted};">${valueLabel}:</span>
            <span style="font-weight: 600; color: ${colors.accentBlue};">${formatValue(value)}</span>
          </div>`;
        
        if (showRevenue && revenue !== undefined && revenue > 0) {
          content += `<div style="display: flex; justify-content: space-between; gap: 16px;">
            <span style="color: ${colors.textMuted};">Revenue:</span>
            <span style="font-weight: 600; color: ${colors.success};">${formatCurrency(revenue)}</span>
          </div>`;
        }
        
        content += `</div>`;
        return content;
      },
    },
    visualMap: {
      type: "continuous",
      min: calculatedMin,
      max: calculatedMax,
      left: "center",
      bottom: 10,
      orient: "horizontal",
      text: ["High", "Low"],
      textStyle: {
        color: colors.textSecondary,
        fontSize: 11,
      },
      calculable: false,
      itemWidth: 200,
      itemHeight: 12,
      inRange: {
        color: gradientColors,
      },
      outOfRange: {
        color: [colors.bgTertiary],
      },
    },
    series: [
      {
        type: "map",
        map: "USA",
        roam: false,
        projection: {
          // Albers projection is already applied in the TopoJSON
          project: (point) => point,
          unproject: (point) => point,
        },
        layoutCenter: ["50%", "50%"],
        layoutSize: "100%",
        data: transformedData,
        selectedMode: onStateClick ? "single" : false,
        label: {
          show: false,
        },
        itemStyle: {
          areaColor: colors.bgTertiary,
          borderColor: colors.border,
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: {
            areaColor: colors.accentBlueLight,
            borderColor: colors.accentBlue,
            borderWidth: 1.5,
          },
          label: {
            show: false,
          },
        },
        select: {
          itemStyle: {
            areaColor: colors.accentBlueLight,
            borderColor: colors.accentBlue,
            borderWidth: 2,
          },
          label: {
            show: false,
          },
        },
      },
    ],
  }), [transformedData, calculatedMin, calculatedMax, valueLabel, showRevenue, formatValue, onStateClick, colors, gradientColors]);

  // Handle click events - works even for states with no data
  const handleEvents = React.useMemo(() => {
    if (!onStateClick) return {};
    
    return {
      click: (params: any) => {
        if (params.componentType === "series") {
          const stateName = params.name;
          const stateData = params.data || {
            name: stateName,
            value: 0,
            revenue: 0,
            originalAbbr: getStateAbbreviation(stateName),
          };
          const abbr = stateData.originalAbbr || getStateAbbreviation(stateName);
          onStateClick(abbr, stateName, stateData);
        }
      },
    };
  }, [onStateClick]);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  if (isLoading || !mapRegistered) {
    return (
      <div
        className={cn("w-full", className)}
        style={{ height: heightStyle }}
      >
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    );
  }

  if (mapError) {
    return (
      <div
        className={cn(
          "w-full flex items-center justify-center text-[hsl(var(--portal-text-muted))]",
          className
        )}
        style={{ height: heightStyle }}
      >
        {mapError}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("w-full", className)}
      style={{ height: heightStyle }}
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "canvas" }}
        onEvents={handleEvents}
        notMerge
      />
    </div>
  );
};

EChartsUSMap.displayName = "EChartsUSMap";
