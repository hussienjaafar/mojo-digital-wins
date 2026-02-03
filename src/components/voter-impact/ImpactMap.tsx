/**
 * ImpactMap Component
 *
 * MapLibre-based choropleth map for visualizing Muslim voter impact data.
 * Shows states and congressional districts with color-coded impact scores.
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
  border: "#94a3b8",          // Light slate for clear district boundaries
  hoverBorder: "#93c5fd",     // Brighter blue for hover
  selectedBorder: "#3b82f6",  // Strong blue for selection
  glowHover: "#60a5fa",       // Glow color for hover
  glowSelected: "#3b82f6",    // Glow color for selection
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

  // Map ref for programmatic control (fitBounds, etc.)
  const mapRef = useRef<MapRef>(null);

  // Selected state info for context header
  const [selectedStateInfo, setSelectedStateInfo] = useState<{
    name: string;
    code: string;
    districtCount: number;
  } | null>(null);

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

  // Create enriched GeoJSON with impact scores and voter counts merged into properties (districts)
  const enrichedDistrictsGeoJSON = useMemo(() => {
    if (!districtsGeoJSON || districts.length === 0) return districtsGeoJSON;

    // Calculate max Muslim voters for normalization
    const maxMuslimVoters = Math.max(...districts.map(d => d.muslim_voters || 0), 1);

    return {
      ...districtsGeoJSON,
      features: districtsGeoJSON.features.map((feature) => {
        const stateCode = feature.properties?.STATE;
        const districtNum = feature.properties?.CD;
        const cdCode = stateCode && districtNum ? buildDistrictCode(stateCode, districtNum) : null;
        const score = cdCode ? (districtImpactScores.get(cdCode) ?? 0) : 0;
        const districtData = cdCode ? districts.find(d => d.cd_code === cdCode) : null;
        const muslimVoters = districtData?.muslim_voters || 0;
        // Normalized value 0-1 for color interpolation
        const voterRatio = muslimVoters / maxMuslimVoters;

        return {
          ...feature,
          properties: {
            ...feature.properties,
            impactScore: score,
            cdCode: cdCode,
            muslimVoters: muslimVoters,
            voterRatio: voterRatio,
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

  // Color expression for districts with gradient variation based on Muslim voter population
  // Each impact tier has a color range: districts with more voters are lighter/brighter
  // This creates visual texture to distinguish adjacent districts
  const districtColorExpression = useMemo((): ExpressionSpecification => {
    // Get voter ratio for interpolation (0-1 scale)
    const voterRatio = ["coalesce", ["get", "voterRatio"], 0];
    const impactScore = ["coalesce", ["get", "impactScore"], 0];

    return [
      "case",
      // HIGH impact: Blue gradient (#1e40af dark to #60a5fa light)
      [">=", impactScore, IMPACT_THRESHOLDS.HIGH],
      [
        "interpolate", ["linear"], voterRatio,
        0, "#1e40af",  // Dark blue for fewer voters
        0.5, "#2563eb", // Medium blue
        1, "#60a5fa"   // Light blue for more voters
      ],
      // MEDIUM impact: Orange gradient (#b45309 dark to #fbbf24 light)
      [">=", impactScore, IMPACT_THRESHOLDS.MEDIUM],
      [
        "interpolate", ["linear"], voterRatio,
        0, "#b45309",  // Dark orange
        0.5, "#f97316", // Medium orange
        1, "#fbbf24"   // Light amber
      ],
      // LOW impact: Purple gradient (#581c87 dark to #c084fc light)
      [">=", impactScore, IMPACT_THRESHOLDS.LOW],
      [
        "interpolate", ["linear"], voterRatio,
        0, "#581c87",  // Dark purple
        0.5, "#9333ea", // Medium purple
        1, "#c084fc"   // Light purple
      ],
      // NO IMPACT: Gray gradient (#1e293b dark to #64748b light)
      // This creates visual differentiation even among "no impact" districts
      [
        "interpolate", ["linear"], voterRatio,
        0, "#1e293b",  // Dark slate (fewer voters)
        0.3, "#334155", // Medium-dark slate
        0.6, "#475569", // Medium slate
        1, "#64748b"   // Light slate (more voters)
      ]
    ] as unknown as ExpressionSpecification;
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

  // Handle state click - with fit-to-bounds zoom for large states
  const handleStateClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (showDistricts) return; // Districts handle clicks when zoomed in

      // Query all features at click point for the states layer
      const features = event.features?.filter(f => f.layer?.id === 'states-fill');
      const feature = features?.[0];

      if (!feature) {
        onRegionSelect(null, "state");
        setSelectedStateInfo(null);
        return;
      }

      // Handle both numeric and string IDs, pad to 2 digits
      const fips = String(feature.id).padStart(2, '0');
      const stateAbbr = getStateFromFips(fips);
      const stateName = feature.properties?.name || stateAbbr || 'Unknown';

      if (stateAbbr) {
        onRegionSelect(stateAbbr, "state");

        // Count districts in this state
        const stateDistrictCount = districts.filter(d => d.state_code === stateAbbr).length;
        setSelectedStateInfo({
          name: stateName,
          code: stateAbbr,
          districtCount: stateDistrictCount,
        });

        // Announce selection to screen readers
        setScreenReaderAnnouncement(`Selected ${stateName}. Zooming to view ${stateDistrictCount} congressional districts.`);

        // Fit-to-bounds: Calculate bounding box from feature geometry and zoom to fit
        if (feature.geometry && mapRef.current) {
          try {
            const featureBbox = bbox(feature as Feature);
            mapRef.current.fitBounds(
              [[featureBbox[0], featureBbox[1]], [featureBbox[2], featureBbox[3]]],
              {
                padding: 50,
                maxZoom: 7.5,
                duration: 1000, // Smooth 1s animation
              }
            );
          } catch {
            // Fallback to manual zoom if bbox calculation fails
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

  // States border glow layer (rendered below main border for halo effect)
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
          "transparent",
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          ["==", ["id"], selectedFips], 12,
          ["==", ["id"], hoveredFips], 10,
          0,
        ] as ExpressionSpecification,
        "line-opacity": [
          "case",
          ["==", ["id"], selectedFips], 0.5,
          ["==", ["id"], hoveredFips], 0.4,
          0,
        ] as ExpressionSpecification,
        "line-blur": 4,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType]);

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
          COLORS.border,
        ] as ExpressionSpecification,
        "line-width": [
          "case",
          ["==", ["id"], selectedFips], 5,  // Increased from 3
          ["==", ["id"], hoveredFips], 4,   // Increased from 2
          1.5,  // Increased from 1
        ] as ExpressionSpecification,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType]);

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

  // Districts border glow layer (rendered below main border for halo effect)
  const districtsBorderGlowLayer: LineLayerSpecification = useMemo(() => {
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
      id: "districts-border-glow",
      type: "line",
      source: "districts",
      layout: {
        visibility: showDistricts ? "visible" : "none",
      },
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
          2,  // Thicker default for clear district boundaries
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
        ref={mapRef}
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
          <Layer {...statesBorderGlowLayer} />
          <Layer {...statesBorderLayer} />
        </Source>

        {/* Districts layer - using enriched GeoJSON with impact scores in properties */}
        <Source id="districts" type="geojson" data={enrichedDistrictsGeoJSON}>
          <Layer {...districtsFillLayer} />
          <Layer {...districtsBorderGlowLayer} />
          <Layer {...districtsBorderLayer} />
        </Source>
      </MapGL>

      {/* State Context Header - shows when zoomed into a state's districts */}
      {showDistricts && selectedStateInfo && (
        <div className="absolute top-4 left-4 z-10 bg-[#0a0f1a]/95 backdrop-blur-md border border-[#1e2a45] rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center">
            <button
              onClick={() => {
                // Reset to US view
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
              <div>
                <span className="text-[#e2e8f0] font-semibold text-lg">{selectedStateInfo.name}</span>
              </div>
              <span className="px-2.5 py-1 bg-[#1e2a45] rounded-full text-xs text-[#94a3b8] font-medium">
                {selectedStateInfo.districtCount} {selectedStateInfo.districtCount === 1 ? 'district' : 'districts'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoverInfo && (
        <div
          className="absolute z-10 bg-[#0a0f1a]/95 backdrop-blur-md border border-[#1e2a45] rounded-xl px-4 py-3 pointer-events-none shadow-xl min-w-[180px]"
          style={{
            left: Math.min(hoverInfo.x + 10, window.innerWidth - 220),
            top: hoverInfo.y + 10
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-[#1e2a45]">
            <span className="font-bold text-[#e2e8f0] text-sm">{hoverInfo.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              hoverInfo.score >= 0.7 ? 'bg-[#22c55e]/20 text-[#22c55e]' :
              hoverInfo.score >= 0.4 ? 'bg-[#f97316]/20 text-[#f97316]' :
              hoverInfo.score >= 0.1 ? 'bg-[#a855f7]/20 text-[#a855f7]' :
              'bg-[#64748b]/20 text-[#64748b]'
            }`}>
              {hoverInfo.score >= 0.7 ? 'High' : hoverInfo.score >= 0.4 ? 'Medium' : hoverInfo.score >= 0.1 ? 'Low' : 'None'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-lg font-bold text-[#e2e8f0]">{hoverInfo.voters.toLocaleString()}</div>
              <div className="text-xs text-[#64748b]">Muslim Voters</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-400">{(hoverInfo.score * 100).toFixed(0)}%</div>
              <div className="text-xs text-[#64748b]">Impact</div>
            </div>
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
            <p className="text-[#e2e8f0] text-lg font-semibold mb-1">
              No districts found
            </p>
            <p className="text-[#64748b] text-sm mb-4">
              Try adjusting your filters to see more results
            </p>
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
