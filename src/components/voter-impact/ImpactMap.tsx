/**
 * ImpactMap Component
 *
 * MapLibre-based heatmap for visualizing Muslim voter population data.
 * Shows states colored by total Muslim voters, with drill-down to congressional districts.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import MapGL, {
  Source,
  Layer,
  NavigationControl,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { FillLayerSpecification, LineLayerSpecification, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import bbox from "@turf/bbox";
import { ArrowLeft } from "lucide-react";

import type {
  VoterImpactState,
  VoterImpactDistrict,
} from "@/queries/useVoterImpactQueries";
import type { MapFilters, MetricType, ColorStop } from "@/types/voter-impact";
import { METRIC_CONFIGS, getMetricLabel, formatMetricValue } from "@/types/voter-impact";

// ============================================================================
// Types
// ============================================================================

export interface ImpactMapProps {
  states: VoterImpactState[];
  districts: VoterImpactDistrict[];
  filters: MapFilters;
  selectedRegion: string | null;
  onRegionSelect: (regionId: string | null, type: "state" | "district") => void;
  onRegionHover: (regionId: string | null, type: "state" | "district") => void;
  filteredDistrictCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  activeMetric?: MetricType;
  localDistrictColorStops?: ColorStop[] | null;
}

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// ============================================================================
// Constants
// ============================================================================

const INITIAL_VIEW_STATE: ViewState = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 3.5,
};

/** Bounding box covering all US states including Alaska and Hawaii */
const US_BOUNDS: [[number, number], [number, number]] = [
  [-175, 17],   // Southwest corner (Hawaii longitude + Puerto Rico latitude)
  [-64, 72],    // Northeast corner (Maine longitude + Alaska latitude)
];

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const GEOJSON_STATES_URL = "/geojson/us-states.json";
const GEOJSON_DISTRICTS_URL = "/geojson/congressional-districts-118.json";
const DISTRICT_VISIBILITY_ZOOM = 5.5;

interface StateProperties {
  name: string;
  density?: number;
  muslimVoters?: number;
  stateCode?: string;
}

interface DistrictProperties {
  GEO_ID: string;
  STATE: string;
  CD: string;
  NAME: string;
  LSAD: string;
  CENSUSAREA: number;
  muslimVoters?: number;
  cdCode?: string;
}

const COLORS = {
  border: "#94a3b8",
  hoverBorder: "#93c5fd",
  selectedBorder: "#3b82f6",
  glowHover: "#60a5fa",
  glowSelected: "#3b82f6",
};

const FIPS_TO_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI",
};

// ============================================================================
// Helper Functions
// ============================================================================

function buildDistrictCode(stateCode: string, districtNum: string): string {
  const stateAbbr = FIPS_TO_ABBR[stateCode];
  if (!stateAbbr) return "";
  const districtNumber = parseInt(districtNum, 10);
  return `${stateAbbr}-${String(districtNumber).padStart(3, "0")}`;
}

function getStateFromFips(fips: string): string | null {
  return FIPS_TO_ABBR[fips] || null;
}

/**
 * Build a MapLibre interpolate expression for population-based coloring.
 * Uses the POPULATION_COLOR_STOPS for a continuous gradient.
 */
function buildColorExpression(property: string, colorStops: readonly ColorStop[]): ExpressionSpecification {
  const stops: (number | string)[] = [];
  for (const stop of colorStops) {
    stops.push(stop.threshold, stop.color);
  }
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", property], 0],
    ...stops,
  ] as unknown as ExpressionSpecification;
}

// ============================================================================
// Component
// ============================================================================

export function ImpactMap({
  states,
  districts,
  filters,
  selectedRegion,
  onRegionSelect,
  onRegionHover,
  filteredDistrictCount,
  hasActiveFilters,
  onClearFilters,
  activeMetric = "population",
  localDistrictColorStops,
}: ImpactMapProps) {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<"state" | "district">("state");
  const [statesGeoJSON, setStatesGeoJSON] = useState<FeatureCollection<Geometry, StateProperties> | null>(null);
  const [districtsGeoJSON, setDistrictsGeoJSON] = useState<FeatureCollection<Geometry, DistrictProperties> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);

  const [selectedStateInfo, setSelectedStateInfo] = useState<{
    name: string;
    code: string;
    districtCount: number;
  } | null>(null);

  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>("");

  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    name: string;
    voters: number;
    type: 'state' | 'district';
  } | null>(null);

  // Load GeoJSON files on mount
  useEffect(() => {
    async function loadGeoJSON() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const [statesResponse, districtsResponse] = await Promise.all([
          fetch(GEOJSON_STATES_URL),
          fetch(GEOJSON_DISTRICTS_URL),
        ]);
        if (!statesResponse.ok) throw new Error(`Failed to load states GeoJSON: ${statesResponse.status}`);
        if (!districtsResponse.ok) throw new Error(`Failed to load districts GeoJSON: ${districtsResponse.status}`);
        const statesData = await statesResponse.json();
        const districtsData = await districtsResponse.json();
        setStatesGeoJSON(statesData);
        setDistrictsGeoJSON(districtsData);
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
        setLoadError(error instanceof Error ? error.message : "Failed to load map data");
      } finally {
        setIsLoading(false);
      }
    }
    loadGeoJSON();
  }, []);

  const showDistricts = viewState.zoom >= DISTRICT_VISIBILITY_ZOOM;

  const metricConfig = METRIC_CONFIGS[activeMetric];

  // Create enriched GeoJSON with metric value injected into state properties
  const enrichedStatesGeoJSON = useMemo(() => {
    if (!statesGeoJSON || states.length === 0) return statesGeoJSON;

    const stateDataMap = new Map<string, number>();
    states.forEach((state) => {
      const fips = Object.entries(FIPS_TO_ABBR).find(
        ([, abbr]) => abbr === state.state_code
      )?.[0];
      if (fips) {
        const val = (state as any)[metricConfig.stateField] || 0;
        stateDataMap.set(fips, val);
      }
    });

    return {
      ...statesGeoJSON,
      features: statesGeoJSON.features.map((feature) => {
        const fips = String(feature.id).padStart(2, '0');
        const metricValue = stateDataMap.get(fips) ?? 0;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            metricValue,
          },
        };
      }),
    };
  }, [statesGeoJSON, states, metricConfig.stateField]);

  // Create enriched GeoJSON with metric value injected into district properties
  const enrichedDistrictsGeoJSON = useMemo(() => {
    if (!districtsGeoJSON || districts.length === 0) return districtsGeoJSON;

    return {
      ...districtsGeoJSON,
      features: districtsGeoJSON.features.map((feature) => {
        const stateCode = feature.properties?.STATE;
        const districtNum = feature.properties?.CD;
        const cdCode = stateCode && districtNum ? buildDistrictCode(stateCode, districtNum) : null;
        const districtData = cdCode ? districts.find(d => d.cd_code === cdCode) : null;
        const metricValue = metricConfig.districtField && districtData
          ? (districtData as any)[metricConfig.districtField] || 0
          : 0;

        return {
          ...feature,
          properties: {
            ...feature.properties,
            cdCode,
            metricValue,
          },
        };
      }),
    };
  }, [districtsGeoJSON, districts, metricConfig.districtField]);

  // Metric-based color expressions
  const colorStops = metricConfig.colorStops;
  const stateColorExpression = useMemo(() => buildColorExpression("metricValue", colorStops), [colorStops]);

  const districtColorExpression = useMemo(
    () => buildColorExpression("metricValue", localDistrictColorStops ?? colorStops),
    [localDistrictColorStops, colorStops]
  );

  // Handle view state change
  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
  }, []);

  // Handle state click
  const handleStateClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (showDistricts) return;
      const features = event.features?.filter(f => f.layer?.id === 'states-fill');
      const feature = features?.[0];
      if (!feature) {
        onRegionSelect(null, "state");
        setSelectedStateInfo(null);
        return;
      }
      const fips = String(feature.id).padStart(2, '0');
      const stateAbbr = getStateFromFips(fips);
      const stateName = feature.properties?.name || stateAbbr || 'Unknown';
      if (stateAbbr) {
        onRegionSelect(stateAbbr, "state");
        const stateDistrictCount = districts.filter(d => d.state_code === stateAbbr).length;
        setSelectedStateInfo({
          name: stateName,
          code: stateAbbr,
          districtCount: stateDistrictCount,
        });
        setScreenReaderAnnouncement(`Selected ${stateName}. Zooming to view ${stateDistrictCount} congressional districts.`);
        if (feature.geometry && mapRef.current) {
          try {
            const featureBbox = bbox(feature as Feature);
            mapRef.current.fitBounds(
              [[featureBbox[0], featureBbox[1]], [featureBbox[2], featureBbox[3]]],
              { padding: 50, maxZoom: 7.5, duration: 1000 }
            );
          } catch {
            setViewState((prev) => ({
              ...prev,
              longitude: event.lngLat.lng,
              latitude: event.lngLat.lat,
              zoom: 6,
            }));
          }
        }
      }
    },
    [showDistricts, onRegionSelect, districts]
  );

  // Handle district click
  const handleDistrictClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) {
        onRegionSelect(null, "district");
        return;
      }
      const stateCode = feature.properties?.STATE;
      const districtNum = feature.properties?.CD;
      if (stateCode && districtNum) {
        const cdCode = buildDistrictCode(stateCode, districtNum);
        const stateAbbr = FIPS_TO_ABBR[stateCode] || stateCode;
        if (cdCode) {
          onRegionSelect(cdCode, "district");
          setScreenReaderAnnouncement(`Selected ${stateAbbr} Congressional District ${parseInt(districtNum, 10) || 'At-Large'}.`);
        }
      }
    },
    [onRegionSelect]
  );

  // Handle state hover
  const handleStateHover = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) {
        setHoveredRegion(null);
        setHoverInfo(null);
        onRegionHover(null, "state");
        return;
      }
      const fips = String(feature.id).padStart(2, '0');
      const stateAbbr = getStateFromFips(fips);
      const stateName = feature.properties?.name || stateAbbr || 'Unknown';
      const stateData = states.find(s => s.state_code === stateAbbr);
      if (stateAbbr) {
        setHoveredRegion(stateAbbr);
        setHoveredType("state");
        setHoverInfo({
          x: event.point.x,
          y: event.point.y,
          name: stateName,
          voters: stateData ? (stateData as any)[metricConfig.stateField] || 0 : 0,
          type: 'state',
        });
        onRegionHover(stateAbbr, "state");
      }
    },
    [onRegionHover, states, metricConfig]
  );

  // Handle district hover
  const handleDistrictHover = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) {
        setHoveredRegion(null);
        setHoverInfo(null);
        onRegionHover(null, "district");
        return;
      }
      const stateCode = feature.properties?.STATE;
      const districtNum = feature.properties?.CD;
      if (stateCode && districtNum) {
        const cdCode = buildDistrictCode(stateCode, districtNum);
        const districtData = districts.find(d => d.cd_code === cdCode);
        const stateAbbr = FIPS_TO_ABBR[stateCode] || stateCode;
        if (cdCode) {
          setHoveredRegion(cdCode);
          setHoveredType("district");
          setHoverInfo({
            x: event.point.x,
            y: event.point.y,
            name: `${stateAbbr} District ${parseInt(districtNum, 10) || 'At-Large'}`,
            voters: metricConfig.districtField && districtData
              ? (districtData as any)[metricConfig.districtField] || 0
              : 0,
            type: 'district',
          });
          onRegionHover(cdCode, "district");
        }
      }
    },
    [onRegionHover, districts, metricConfig]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredRegion(null);
    setHoverInfo(null);
    onRegionHover(null, "state");
  }, [onRegionHover]);

  // States fill layer
  const statesFillLayer: FillLayerSpecification = useMemo(
    () => ({
      id: "states-fill",
      type: "fill",
      source: "states",
      paint: {
        "fill-color": stateColorExpression,
        "fill-opacity": showDistricts ? 0.1 : 0.75,
      },
    }),
    [stateColorExpression, showDistricts]
  );

  // States border glow layer
  const statesBorderGlowLayer: LineLayerSpecification = useMemo(() => {
    const selectedFips = selectedRegion ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === selectedRegion)?.[0] || "" : "";
    const hoveredFips = hoveredRegion && hoveredType === "state"
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === hoveredRegion)?.[0] || ""
      : "";
    return {
      id: "states-border-glow",
      type: "line",
      source: "states",
      paint: {
        "line-color": [
          "case",
          ["==", ["id"], selectedFips], COLORS.glowSelected,
          ["==", ["id"], hoveredFips], COLORS.glowHover,
          showDistricts ? "#475569" : "transparent",
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          ["==", ["id"], selectedFips], 12,
          ["==", ["id"], hoveredFips], 10,
          showDistricts ? 6 : 0,
        ] as ExpressionSpecification,
        "line-opacity": [
          "case",
          ["==", ["id"], selectedFips], 0.5,
          ["==", ["id"], hoveredFips], 0.4,
          showDistricts ? 0.3 : 0,
        ] as ExpressionSpecification,
        "line-blur": 4,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType, showDistricts]);

  // States border layer
  const statesBorderLayer: LineLayerSpecification = useMemo(() => {
    const selectedFips = selectedRegion ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === selectedRegion)?.[0] || "" : "";
    const hoveredFips = hoveredRegion && hoveredType === "state"
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === hoveredRegion)?.[0] || ""
      : "";
    return {
      id: "states-border",
      type: "line",
      source: "states",
      paint: {
        "line-color": [
          "case",
          ["==", ["id"], selectedFips], COLORS.selectedBorder,
          ["==", ["id"], hoveredFips], COLORS.hoverBorder,
          showDistricts ? "#cbd5e1" : COLORS.border,
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          ["==", ["id"], selectedFips], 5,
          ["==", ["id"], hoveredFips], 4,
          showDistricts ? 3 : 1.5,
        ] as ExpressionSpecification,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType, showDistricts]);

  // Districts fill layer
  const districtsFillLayer: FillLayerSpecification = useMemo(
    () => ({
      id: "districts-fill",
      type: "fill",
      source: "districts",
      layout: {
        visibility: showDistricts ? "visible" : "none",
      },
      paint: {
        "fill-color": districtColorExpression,
        "fill-opacity": 0.75,
      },
    }),
    [districtColorExpression, showDistricts]
  );

  // Districts border glow layer
  const districtsBorderGlowLayer: LineLayerSpecification = useMemo(() => {
    const selectedParts = selectedRegion?.includes("-") ? selectedRegion.split("-") : null;
    const selectedStateFips = selectedParts
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === selectedParts[0])?.[0]
      : null;
    const selectedDistrictNum = selectedParts?.[1];
    const hoveredParts = hoveredRegion?.includes("-") && hoveredType === "district" ? hoveredRegion.split("-") : null;
    const hoveredStateFips = hoveredParts
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === hoveredParts[0])?.[0]
      : null;
    const hoveredDistrictNum = hoveredParts?.[1];

    return {
      id: "districts-border-glow",
      type: "line",
      source: "districts",
      layout: { visibility: showDistricts ? "visible" : "none" },
      paint: {
        "line-color": [
          "case",
          selectedStateFips && selectedDistrictNum
            ? ["all", ["==", ["get", "STATE"], selectedStateFips], ["==", ["get", "CD"], selectedDistrictNum]]
            : false,
          COLORS.glowSelected,
          hoveredStateFips && hoveredDistrictNum
            ? ["all", ["==", ["get", "STATE"], hoveredStateFips], ["==", ["get", "CD"], hoveredDistrictNum]]
            : false,
          COLORS.glowHover,
          "transparent",
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          selectedStateFips && selectedDistrictNum
            ? ["all", ["==", ["get", "STATE"], selectedStateFips], ["==", ["get", "CD"], selectedDistrictNum]]
            : false,
          12,
          hoveredStateFips && hoveredDistrictNum
            ? ["all", ["==", ["get", "STATE"], hoveredStateFips], ["==", ["get", "CD"], hoveredDistrictNum]]
            : false,
          10,
          0,
        ] as ExpressionSpecification,
        "line-opacity": [
          "case",
          selectedStateFips && selectedDistrictNum
            ? ["all", ["==", ["get", "STATE"], selectedStateFips], ["==", ["get", "CD"], selectedDistrictNum]]
            : false,
          0.5,
          hoveredStateFips && hoveredDistrictNum
            ? ["all", ["==", ["get", "STATE"], hoveredStateFips], ["==", ["get", "CD"], hoveredDistrictNum]]
            : false,
          0.4,
          0,
        ] as ExpressionSpecification,
        "line-blur": 4,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType, showDistricts]);

  // Districts border layer
  const districtsBorderLayer: LineLayerSpecification = useMemo(() => {
    const selectedParts = selectedRegion?.includes("-") ? selectedRegion.split("-") : null;
    const selectedStateFips = selectedParts
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === selectedParts[0])?.[0]
      : null;
    const selectedDistrictNum = selectedParts?.[1];
    const hoveredParts = hoveredRegion?.includes("-") && hoveredType === "district" ? hoveredRegion.split("-") : null;
    const hoveredStateFips = hoveredParts
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === hoveredParts[0])?.[0]
      : null;
    const hoveredDistrictNum = hoveredParts?.[1];

    return {
      id: "districts-border",
      type: "line",
      source: "districts",
      layout: { visibility: showDistricts ? "visible" : "none" },
      paint: {
        "line-color": [
          "case",
          selectedStateFips && selectedDistrictNum
            ? ["all", ["==", ["get", "STATE"], selectedStateFips], ["==", ["get", "CD"], selectedDistrictNum]]
            : false,
          COLORS.selectedBorder,
          hoveredStateFips && hoveredDistrictNum
            ? ["all", ["==", ["get", "STATE"], hoveredStateFips], ["==", ["get", "CD"], hoveredDistrictNum]]
            : false,
          COLORS.hoverBorder,
          COLORS.border,
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          selectedStateFips && selectedDistrictNum
            ? ["all", ["==", ["get", "STATE"], selectedStateFips], ["==", ["get", "CD"], selectedDistrictNum]]
            : false,
          5,
          hoveredStateFips && hoveredDistrictNum
            ? ["all", ["==", ["get", "STATE"], hoveredStateFips], ["==", ["get", "CD"], hoveredDistrictNum]]
            : false,
          4,
          2,
        ] as ExpressionSpecification,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType, showDistricts]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (loadError || !statesGeoJSON || !districtsGeoJSON) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center text-red-400">
          <p className="text-lg mb-2">Failed to load map</p>
          <p className="text-sm text-gray-500">{loadError || "GeoJSON data not available"}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full relative"
      role="application"
      aria-label="Muslim Voter Population Heatmap"
      aria-description="Interactive heatmap showing Muslim voter population across states and congressional districts. Click on a state to zoom in and view district-level data. Colors range from dark (zero voters) to bright yellow (highest population)."
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {screenReaderAnnouncement}
      </div>

      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        maxBounds={US_BOUNDS}
        minZoom={2.5}
        interactiveLayerIds={["states-fill", "districts-fill"]}
        onClick={(e) => {
          if (showDistricts) {
            handleDistrictClick(e);
          } else {
            handleStateClick(e);
          }
        }}
        onMouseMove={(e) => {
          if (showDistricts) {
            handleDistrictHover(e);
          } else {
            handleStateHover(e);
          }
        }}
        onMouseLeave={handleMouseLeave}
        cursor={hoveredRegion ? "pointer" : "grab"}
      >
        <NavigationControl position="top-right" />

        <Source id="states" type="geojson" data={enrichedStatesGeoJSON}>
          <Layer {...statesFillLayer} />
          <Layer {...statesBorderGlowLayer} />
          <Layer {...statesBorderLayer} />
        </Source>

        <Source id="districts" type="geojson" data={enrichedDistrictsGeoJSON}>
          <Layer {...districtsFillLayer} />
          <Layer {...districtsBorderGlowLayer} />
          <Layer {...districtsBorderLayer} />
        </Source>
      </MapGL>

      {/* State Context Header */}
      {showDistricts && selectedStateInfo && (
        <div className="absolute top-4 left-4 z-10 bg-[#0a0f1a]/95 backdrop-blur-md border border-[#1e2a45] rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center">
            <button
              onClick={() => {
                setViewState(INITIAL_VIEW_STATE);
                onRegionSelect(null, "state");
                setSelectedStateInfo(null);
                setScreenReaderAnnouncement("Returned to United States overview.");
              }}
              className="flex items-center gap-2 px-4 py-3 text-[#94a3b8] hover:text-white hover:bg-[#1e2a45] transition-all"
              aria-label="Return to US map view"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="h-8 w-px bg-[#1e2a45]" />
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="text-[#e2e8f0] font-semibold text-lg">{selectedStateInfo.name}</span>
              <span className="px-2.5 py-1 bg-[#1e2a45] rounded-full text-xs text-[#94a3b8] font-medium">
                {selectedStateInfo.districtCount} {selectedStateInfo.districtCount === 1 ? 'district' : 'districts'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip - simplified to show name + voter count */}
      {hoverInfo && (
        <div
          className="absolute z-10 bg-[#0a0f1a]/95 backdrop-blur-md border border-[#1e2a45] rounded-xl px-4 py-3 pointer-events-none shadow-xl min-w-[160px]"
          style={{
            left: Math.min(hoverInfo.x + 10, window.innerWidth - 200),
            top: hoverInfo.y + 10
          }}
        >
          <div className="mb-1">
            <span className="font-bold text-[#e2e8f0] text-sm">{hoverInfo.name}</span>
          </div>
          <div>
            <div className="text-xl font-bold text-[#e2e8f0]">{formatMetricValue(hoverInfo.voters, activeMetric)}</div>
            <div className="text-xs text-[#64748b]">{getMetricLabel(activeMetric)}</div>
          </div>
        </div>
      )}

      {/* Empty State Overlay */}
      {filteredDistrictCount === 0 && hasActiveFilters && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-[#0a0f1a]/95 backdrop-blur-md border border-[#1e2a45] rounded-xl px-8 py-6 shadow-2xl text-center pointer-events-auto max-w-sm">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1e2a45] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[#e2e8f0] text-lg font-semibold mb-1">No districts found</p>
            <p className="text-[#64748b] text-sm mb-4">Try adjusting your filters to see more results</p>
            {onClearFilters && (
              <button
                onClick={onClearFilters}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImpactMap;
