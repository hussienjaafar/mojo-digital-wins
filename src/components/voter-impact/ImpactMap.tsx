/**
 * ImpactMap Component
 *
 * MapLibre-based choropleth map for visualizing Muslim voter impact data.
 * Shows states and congressional districts with color-coded impact scores.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import MapGL, {
  Source,
  Layer,
  NavigationControl,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import type { FillLayerSpecification, LineLayerSpecification, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Feature, Geometry } from "geojson";

import type {
  VoterImpactState,
  VoterImpactDistrict,
} from "@/queries/useVoterImpactQueries";
import type { MapFilters, MetricType } from "@/types/voter-impact";
import {
  calculateImpactScore,
  calculateStateImpactScore,
  getImpactColor,
  applyFilters,
  IMPACT_THRESHOLDS,
  IMPACT_COLORS,
} from "@/types/voter-impact";

// ============================================================================
// Types
// ============================================================================

export interface ImpactMapProps {
  states: VoterImpactState[];
  districts: VoterImpactDistrict[];
  filters: MapFilters;
  metric: MetricType;
  selectedRegion: string | null;
  onRegionSelect: (regionId: string | null, type: "state" | "district") => void;
  onRegionHover: (regionId: string | null, type: "state" | "district") => void;
  filteredDistrictCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
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

// Using Carto Dark Matter basemap (free, no API key required)
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const GEOJSON_STATES_URL = "/geojson/us-states.json";
const GEOJSON_DISTRICTS_URL = "/geojson/congressional-districts-118.json";

const DISTRICT_VISIBILITY_ZOOM = 5.5;

// Type for GeoJSON properties
interface StateProperties {
  name: string;
  density?: number;
  impactScore?: number;
  stateCode?: string;
}

interface DistrictProperties {
  GEO_ID: string;
  STATE: string;
  CD: string;
  NAME: string;
  LSAD: string;
  CENSUSAREA: number;
  impactScore?: number;
  cdCode?: string;
}

const COLORS = {
  border: "#0f172a",
  hoverBorder: "#60a5fa",
  selectedBorder: "#3b82f6",
};

// State FIPS code to abbreviation mapping
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

/**
 * Build district code from GeoJSON properties
 * Format: "XX-YYY" where XX is state abbreviation and YYY is 3-digit padded district number
 * Must match database cd_code format (e.g., "CA-019" not "CA-19")
 */
function buildDistrictCode(stateCode: string, districtNum: string): string {
  const stateAbbr = FIPS_TO_ABBR[stateCode];
  if (!stateAbbr) return "";
  const districtNumber = parseInt(districtNum, 10);
  return `${stateAbbr}-${String(districtNumber).padStart(3, "0")}`;
}

/**
 * Get state abbreviation from FIPS code
 */
function getStateFromFips(fips: string): string | null {
  return FIPS_TO_ABBR[fips] || null;
}

// ============================================================================
// Component
// ============================================================================

export function ImpactMap({
  states,
  districts,
  filters,
  metric: _metric,
  selectedRegion,
  onRegionSelect,
  onRegionHover,
  filteredDistrictCount,
  hasActiveFilters,
  onClearFilters,
}: ImpactMapProps) {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<"state" | "district">("state");
  const [statesGeoJSON, setStatesGeoJSON] = useState<FeatureCollection<Geometry, StateProperties> | null>(null);
  const [districtsGeoJSON, setDistrictsGeoJSON] = useState<FeatureCollection<Geometry, DistrictProperties> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Screen reader announcement state
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>("");

  // Hover tooltip state
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    name: string;
    score: number;
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

        if (!statesResponse.ok) {
          throw new Error(`Failed to load states GeoJSON: ${statesResponse.status}`);
        }
        if (!districtsResponse.ok) {
          throw new Error(`Failed to load districts GeoJSON: ${districtsResponse.status}`);
        }

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

  // Determine if districts should be visible based on zoom level
  const showDistricts = viewState.zoom >= DISTRICT_VISIBILITY_ZOOM;

  // Filter districts based on current filters
  const filteredDistrictIds = useMemo(() => {
    const filtered = applyFilters(districts, filters);
    return new Set(filtered.map((d) => d.cd_code));
  }, [districts, filters]);

  // Build state impact scores map (FIPS -> score)
  const stateImpactScores = useMemo(() => {
    const scores = new Map<string, number>();
    states.forEach((state) => {
      const stateDistricts = districts.filter(
        (d) => d.state_code === state.state_code
      );
      const score = calculateStateImpactScore(state, stateDistricts);
      // Store by FIPS code for easy matching
      const fips = Object.entries(FIPS_TO_ABBR).find(
        ([, abbr]) => abbr === state.state_code
      )?.[0];
      if (fips) {
        scores.set(fips, score);
      }
      scores.set(state.state_code, score);
    });
    return scores;
  }, [states, districts]);

  // Build district impact scores map
  const districtImpactScores = useMemo(() => {
    const scores = new Map<string, number>();
    districts.forEach((district) => {
      const score = calculateImpactScore(district);
      scores.set(district.cd_code, score);
    });
    return scores;
  }, [districts]);

  // Create enriched GeoJSON with impact scores merged into properties (states)
  const enrichedStatesGeoJSON = useMemo(() => {
    if (!statesGeoJSON || states.length === 0) return statesGeoJSON;

    return {
      ...statesGeoJSON,
      features: statesGeoJSON.features.map((feature) => {
        const fips = String(feature.id).padStart(2, '0');
        const score = stateImpactScores.get(fips) ?? 0;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            impactScore: score,
          },
        };
      }),
    };
  }, [statesGeoJSON, states, stateImpactScores]);

  // Create enriched GeoJSON with impact scores merged into properties (districts)
  const enrichedDistrictsGeoJSON = useMemo(() => {
    if (!districtsGeoJSON || districts.length === 0) return districtsGeoJSON;

    return {
      ...districtsGeoJSON,
      features: districtsGeoJSON.features.map((feature) => {
        const stateCode = feature.properties?.STATE;
        const districtNum = feature.properties?.CD;
        const cdCode = stateCode && districtNum ? buildDistrictCode(stateCode, districtNum) : null;
        const score = cdCode ? (districtImpactScores.get(cdCode) ?? 0) : 0;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            impactScore: score,
            cdCode: cdCode,
          },
        };
      }),
    };
  }, [districtsGeoJSON, districts, districtImpactScores]);

  // Color expression for states using unified IMPACT_THRESHOLDS and IMPACT_COLORS constants
  // Uses colorblind-safe palette: Blue (high), Orange (medium), Purple (low), Gray (none)
  const stateColorExpression = useMemo((): ExpressionSpecification => {
    return [
      "case",
      [">=", ["coalesce", ["get", "impactScore"], 0], IMPACT_THRESHOLDS.HIGH], IMPACT_COLORS.HIGH,
      [">=", ["coalesce", ["get", "impactScore"], 0], IMPACT_THRESHOLDS.MEDIUM], IMPACT_COLORS.MEDIUM,
      [">=", ["coalesce", ["get", "impactScore"], 0], IMPACT_THRESHOLDS.LOW], IMPACT_COLORS.LOW,
      IMPACT_COLORS.NONE
    ];
  }, []);

  // Color expression for districts using unified IMPACT_THRESHOLDS and IMPACT_COLORS constants
  // Uses colorblind-safe palette: Blue (high), Orange (medium), Purple (low), Gray (none)
  const districtColorExpression = useMemo((): ExpressionSpecification => {
    return [
      "case",
      [">=", ["coalesce", ["get", "impactScore"], 0], IMPACT_THRESHOLDS.HIGH], IMPACT_COLORS.HIGH,
      [">=", ["coalesce", ["get", "impactScore"], 0], IMPACT_THRESHOLDS.MEDIUM], IMPACT_COLORS.MEDIUM,
      [">=", ["coalesce", ["get", "impactScore"], 0], IMPACT_THRESHOLDS.LOW], IMPACT_COLORS.LOW,
      IMPACT_COLORS.NONE
    ];
  }, []);

  // Build opacity expression for districts using enriched properties
  const districtOpacityExpression = useMemo((): ExpressionSpecification => {
    // Create a list of filtered district cdCodes for the expression
    // Since we now have cdCode in properties, we can use a simpler approach
    const filteredCodes = Array.from(filteredDistrictIds);
    
    if (filteredCodes.length === 0) {
      // All visible if no filter - use literal expression
      return ["literal", 0.7] as unknown as ExpressionSpecification;
    }
    
    // Use "in" expression to check if cdCode is in the filtered set
    return [
      "case",
      ["in", ["get", "cdCode"], ["literal", filteredCodes]], 0.7,
      0.2
    ] as ExpressionSpecification;
  }, [filteredDistrictIds]);

  // Handle view state change
  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
  }, []);

  // Handle state click - with robust feature detection for MultiPolygon states
  const handleStateClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (showDistricts) return; // Districts handle clicks when zoomed in

      // Query all features at click point for the states layer
      const features = event.features?.filter(f => f.layer?.id === 'states-fill');
      const feature = features?.[0];
      
      if (!feature) {
        onRegionSelect(null, "state");
        return;
      }

      // Handle both numeric and string IDs, pad to 2 digits
      const fips = String(feature.id).padStart(2, '0');
      const stateAbbr = getStateFromFips(fips);
      const stateName = feature.properties?.name || stateAbbr || 'Unknown';

      if (stateAbbr) {
        onRegionSelect(stateAbbr, "state");
        // Announce selection to screen readers
        setScreenReaderAnnouncement(`Selected ${stateName}. Zooming to view congressional districts.`);
        // Zoom to state level
        setViewState((prev) => ({
          ...prev,
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          zoom: 6,
        }));
      }
    },
    [showDistricts, onRegionSelect]
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
          // Announce selection to screen readers
          setScreenReaderAnnouncement(`Selected ${stateAbbr} Congressional District ${parseInt(districtNum, 10) || 'At-Large'}.`);
        }
      }
    },
    [onRegionSelect]
  );

  // Handle state hover - with tooltip info
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
      const impactScore = feature.properties?.impactScore || 0;

      const stateData = states.find(s => s.state_code === stateAbbr);

      if (stateAbbr) {
        setHoveredRegion(stateAbbr);
        setHoveredType("state");
        setHoverInfo({
          x: event.point.x,
          y: event.point.y,
          name: stateName,
          score: impactScore,
          voters: stateData?.muslim_voters || 0,
          type: 'state',
        });
        onRegionHover(stateAbbr, "state");
      }
    },
    [onRegionHover, states]
  );

  // Handle district hover - with tooltip info
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
        const impactScore = feature.properties?.impactScore || 0;
        const districtData = districts.find(d => d.cd_code === cdCode);
        const stateAbbr = FIPS_TO_ABBR[stateCode] || stateCode;
        
        if (cdCode) {
          setHoveredRegion(cdCode);
          setHoveredType("district");
          setHoverInfo({
            x: event.point.x,
            y: event.point.y,
            name: `${stateAbbr} District ${parseInt(districtNum, 10) || 'At-Large'}`,
            score: impactScore,
            voters: districtData?.muslim_voters || 0,
            type: 'district',
          });
          onRegionHover(cdCode, "district");
        }
      }
    },
    [onRegionHover, districts]
  );

  // Handle mouse leave
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
        "fill-opacity": showDistricts ? 0.1 : 0.7,
      },
    }),
    [stateColorExpression, showDistricts]
  );

  // States border layer
  const statesBorderLayer: LineLayerSpecification = useMemo(
    () => ({
      id: "states-border",
      type: "line",
      source: "states",
      paint: {
        "line-color": [
          "case",
          ["==", ["id"], selectedRegion ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === selectedRegion)?.[0] || "" : ""],
          COLORS.selectedBorder,
          hoveredRegion && hoveredType === "state"
            ? [
                "case",
                ["==", ["id"], Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === hoveredRegion)?.[0] || ""],
                COLORS.hoverBorder,
                COLORS.border,
              ]
            : COLORS.border,
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          ["==", ["id"], selectedRegion ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === selectedRegion)?.[0] || "" : ""],
          3,
          hoveredRegion && hoveredType === "state"
            ? [
                "case",
                ["==", ["id"], Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === hoveredRegion)?.[0] || ""],
                2,
                1,
              ]
            : 1,
        ] as ExpressionSpecification,
      },
    }),
    [selectedRegion, hoveredRegion, hoveredType]
  );

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
        "fill-opacity": districtOpacityExpression,
      },
    }),
    [districtColorExpression, districtOpacityExpression, showDistricts]
  );

  // Districts border layer
  const districtsBorderLayer: LineLayerSpecification = useMemo(() => {
    // Parse selected district for matching
    const selectedParts = selectedRegion?.includes("-")
      ? selectedRegion.split("-")
      : null;
    const selectedStateFips = selectedParts
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === selectedParts[0])?.[0]
      : null;
    const selectedDistrictNum = selectedParts?.[1];

    // Parse hovered district for matching
    const hoveredParts =
      hoveredRegion?.includes("-") && hoveredType === "district"
        ? hoveredRegion.split("-")
        : null;
    const hoveredStateFips = hoveredParts
      ? Object.entries(FIPS_TO_ABBR).find(([, abbr]) => abbr === hoveredParts[0])?.[0]
      : null;
    const hoveredDistrictNum = hoveredParts?.[1];

    return {
      id: "districts-border",
      type: "line",
      source: "districts",
      layout: {
        visibility: showDistricts ? "visible" : "none",
      },
      paint: {
        "line-color": [
          "case",
          // Selected district
          selectedStateFips && selectedDistrictNum
            ? [
                "all",
                ["==", ["get", "STATE"], selectedStateFips],
                ["==", ["get", "CD"], selectedDistrictNum],
              ]
            : false,
          COLORS.selectedBorder,
          // Hovered district
          hoveredStateFips && hoveredDistrictNum
            ? [
                "all",
                ["==", ["get", "STATE"], hoveredStateFips],
                ["==", ["get", "CD"], hoveredDistrictNum],
              ]
            : false,
          COLORS.hoverBorder,
          // Default
          COLORS.border,
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          // Selected district
          selectedStateFips && selectedDistrictNum
            ? [
                "all",
                ["==", ["get", "STATE"], selectedStateFips],
                ["==", ["get", "CD"], selectedDistrictNum],
              ]
            : false,
          3,
          // Hovered district
          hoveredStateFips && hoveredDistrictNum
            ? [
                "all",
                ["==", ["get", "STATE"], hoveredStateFips],
                ["==", ["get", "CD"], hoveredDistrictNum],
              ]
            : false,
          2.5,
          // Default
          1,
        ] as ExpressionSpecification,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType, showDistricts]);

  // Show loading state
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

  // Show error state
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
      aria-label="Muslim Voter Impact Map of United States"
      aria-description="Interactive choropleth map showing Muslim voter impact data across states and congressional districts. Click on a state to zoom in and view district-level data. Colors indicate flippability score from high impact (blue) to no impact (gray)."
    >
      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {screenReaderAnnouncement}
      </div>

      <MapGL
        {...viewState}
        onMove={handleMove}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
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

        {/* States layer - using enriched GeoJSON with impact scores in properties */}
        {/* Note: Do NOT use generateId - it overwrites original FIPS codes with array indices */}
        <Source id="states" type="geojson" data={enrichedStatesGeoJSON}>
          <Layer {...statesFillLayer} />
          <Layer {...statesBorderLayer} />
        </Source>

        {/* Districts layer - using enriched GeoJSON with impact scores in properties */}
        <Source id="districts" type="geojson" data={enrichedDistrictsGeoJSON}>
          <Layer {...districtsFillLayer} />
          <Layer {...districtsBorderLayer} />
        </Source>
      </MapGL>

      {/* Hover Tooltip */}
      {hoverInfo && (
        <div
          className="absolute z-10 bg-[#1a1f2e] border border-[#2d3748] rounded-lg px-3 py-2 pointer-events-none shadow-lg"
          style={{
            left: Math.min(hoverInfo.x + 10, window.innerWidth - 200),
            top: hoverInfo.y + 10
          }}
        >
          <div className="font-semibold text-white text-sm">{hoverInfo.name}</div>
          <div className="text-xs text-gray-300 mt-1">
            Muslim Voters: {hoverInfo.voters.toLocaleString()}
          </div>
          <div className="text-xs text-gray-300">
            Impact Score: {(hoverInfo.score * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {/* Empty State Overlay */}
      {filteredDistrictCount === 0 && hasActiveFilters && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-[#1a1f2e] border border-[#2d3748] rounded-lg px-6 py-5 shadow-xl text-center pointer-events-auto">
            <p className="text-[#e2e8f0] text-lg font-medium mb-3">
              No districts match your filters
            </p>
            {onClearFilters && (
              <button
                onClick={onClearFilters}
                className="text-blue-400 hover:text-blue-300 underline text-sm font-medium transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImpactMap;
