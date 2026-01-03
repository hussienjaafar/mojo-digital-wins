import * as React from "react";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, ECharts } from "echarts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getStateName, getStateAbbreviation } from "@/lib/us-states";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";

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

// GeoJSON URL for USA map
const USA_GEOJSON_URL = "https://cdn.jsdelivr.net/npm/usa-atlas@3/states-10m.json";

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
  const [mapRegistered, setMapRegistered] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);

  // Register the USA map on mount
  React.useEffect(() => {
    const registerMap = async () => {
      try {
        // Check if already registered
        if (echarts.getMap("USA")) {
          setMapRegistered(true);
          return;
        }

        const response = await fetch(USA_GEOJSON_URL);
        if (!response.ok) throw new Error("Failed to load map data");
        
        const topoJson = await response.json();
        
        // Convert TopoJSON to GeoJSON
        const { feature } = await import("topojson-client");
        const geoJson = feature(topoJson, topoJson.objects.states) as any;
        
        // Map FIPS codes to state names
        const statesByFips: Record<string, string> = {
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
          "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming", "72": "Puerto Rico",
        };
        
        // Add state names to features
        geoJson.features = geoJson.features.map((f: any) => ({
          ...f,
          properties: {
            ...f.properties,
            name: statesByFips[f.id] || f.properties?.name || "Unknown",
          },
        }));

        echarts.registerMap("USA", geoJson, {
          // Position Alaska and Hawaii
          Alaska: {
            left: -131,
            top: 25,
            width: 15,
          },
          Hawaii: {
            left: -110,
            top: 24,
            width: 5,
          },
        });
        
        setMapRegistered(true);
      } catch (err) {
        console.error("Failed to register USA map:", err);
        setMapError("Failed to load map");
      }
    };

    registerMap();
  }, []);

  // Transform data to use full state names for GeoJSON matching
  const transformedData = React.useMemo(() => {
    return data.map((item) => ({
      ...item,
      // Convert abbreviation to full name if needed
      name: item.name.length === 2 ? getStateName(item.name) : item.name,
      originalAbbr: item.name.length === 2 ? item.name : getStateAbbreviation(item.name),
    }));
  }, [data]);

  // Calculate min/max for visualMap
  const { calculatedMin, calculatedMax } = React.useMemo(() => {
    const values = transformedData.map((d) => d.value);
    return {
      calculatedMin: minValue ?? Math.min(...values, 0),
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

  // ECharts option
  const option = React.useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: "item",
      backgroundColor: "hsl(var(--portal-bg-elevated))",
      borderColor: "hsl(var(--portal-border))",
      textStyle: {
        color: "hsl(var(--portal-text-primary))",
        fontSize: 13,
      },
      extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.25); border-radius: 8px; backdrop-filter: blur(8px);",
      formatter: (params: any) => {
        if (!params.data) {
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
            <div style="color: hsl(var(--portal-text-muted));">No data available</div>
          </div>`;
        }
        const { name, value, revenue, originalAbbr } = params.data;
        const displayName = originalAbbr ? `${name} (${originalAbbr})` : name;
        
        let content = `<div style="padding: 4px 0;">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${displayName}</div>
          <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px;">
            <span style="color: hsl(var(--portal-text-muted));">${valueLabel}:</span>
            <span style="font-weight: 600; color: hsl(var(--portal-accent-blue));">${formatValue(value)}</span>
          </div>`;
        
        if (showRevenue && revenue !== undefined) {
          content += `<div style="display: flex; justify-content: space-between; gap: 16px;">
            <span style="color: hsl(var(--portal-text-muted));">Revenue:</span>
            <span style="font-weight: 600; color: hsl(var(--portal-success));">${formatCurrency(revenue)}</span>
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
      left: "right",
      top: "center",
      orient: "vertical",
      text: ["High", "Low"],
      textStyle: {
        color: "hsl(var(--portal-text-secondary))",
        fontSize: 11,
      },
      calculable: true,
      itemWidth: 12,
      itemHeight: 120,
      inRange: {
        color: [
          "hsl(213 90% 95%)",   // Very light blue
          "hsl(213 90% 75%)",   // Light blue
          "hsl(213 90% 55%)",   // Medium blue
          "hsl(213 90% 45%)",   // Portal blue
          "hsl(213 90% 35%)",   // Dark blue
        ],
      },
      outOfRange: {
        color: ["hsl(var(--portal-bg-tertiary))"],
      },
    },
    geo: {
      map: "USA",
      roam: false,
      projection: {
        project: (point: number[]) => point,
        unproject: (point: number[]) => point,
      },
      itemStyle: {
        areaColor: "hsl(var(--portal-bg-tertiary))",
        borderColor: "hsl(var(--portal-border))",
        borderWidth: 0.5,
      },
      emphasis: {
        itemStyle: {
          areaColor: "hsl(var(--portal-accent-blue) / 0.3)",
          borderColor: "hsl(var(--portal-accent-blue))",
          borderWidth: 1.5,
        },
        label: {
          show: false,
        },
      },
      select: {
        itemStyle: {
          areaColor: "hsl(var(--portal-accent-blue) / 0.4)",
          borderColor: "hsl(var(--portal-accent-blue))",
          borderWidth: 2,
        },
      },
    },
    series: [
      {
        type: "map",
        map: "USA",
        geoIndex: 0,
        data: transformedData,
        selectedMode: onStateClick ? "single" : false,
      },
    ],
  }), [transformedData, calculatedMin, calculatedMax, valueLabel, showRevenue, formatValue, onStateClick]);

  // Handle click events
  const handleEvents = React.useMemo(() => {
    if (!onStateClick) return {};
    
    return {
      click: (params: any) => {
        if (params.componentType === "series" && params.data) {
          const { name, originalAbbr } = params.data;
          onStateClick(originalAbbr || getStateAbbreviation(name), name, params.data);
        }
      },
    };
  }, [onStateClick]);

  if (isLoading || !mapRegistered) {
    return (
      <div
        className={cn("w-full", className)}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
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
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      >
        {mapError}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
        opts={{ renderer: "svg" }}
        onEvents={handleEvents}
      />
    </div>
  );
};

EChartsUSMap.displayName = "EChartsUSMap";
