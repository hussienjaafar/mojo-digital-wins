/**
 * ImpactMap Component
 *
 * MapLibre-based choropleth map for visualizing Muslim voter impact data.
 * Shows states and congressional districts with color-coded impact scores.
 */

import { useState, useCallback, useMemo } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import type { FillLayerSpecification, LineLayerSpecification, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

const MAP_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json";

const GEOJSON_STATES = "/geojson/us-states.json";
const GEOJSON_DISTRICTS = "/geojson/congressional-districts-118.json";

const DISTRICT_VISIBILITY_ZOOM = 5.5;

const COLORS = {
  border: "#1e2a45",
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
 * Format: "XX-YY" where XX is state abbreviation and YY is district number
 */
function buildDistrictCode(stateCode: string, districtNum: string): string {
  const stateAbbr = FIPS_TO_ABBR[stateCode];
  if (!stateAbbr) return "";
  const districtNumber = parseInt(districtNum, 10);
  return `${stateAbbr}-${String(districtNumber).padStart(2, "0")}`;
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
}: ImpactMapProps) {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<"state" | "district">("state");

  // Determine if districts should be visible based on zoom level
  const showDistricts = viewState.zoom >= DISTRICT_VISIBILITY_ZOOM;

  // Filter districts based on current filters
  const filteredDistrictIds = useMemo(() => {
    const filtered = applyFilters(districts, filters);
    return new Set(filtered.map((d) => d.cd_code));
  }, [districts, filters]);

  // Build state impact scores map
  const stateImpactScores = useMemo(() => {
    const scores = new Map<string, number>();
    states.forEach((state) => {
      const stateDistricts = districts.filter(
        (d) => d.state_code === state.state_code
      );
      const score = calculateStateImpactScore(state, stateDistricts);
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

  // Build color expressions for states layer
  const stateColorExpression = useMemo((): ExpressionSpecification => {
    const colorStops: (string | ExpressionSpecification)[] = ["case"];

    states.forEach((state) => {
      const score = stateImpactScores.get(state.state_code) || 0;
      const color = getImpactColor(score);
      // Match by FIPS code (feature id)
      const fips = Object.entries(FIPS_TO_ABBR).find(
        ([, abbr]) => abbr === state.state_code
      )?.[0];
      if (fips) {
        colorStops.push(["==", ["id"], fips], color);
      }
    });

    // Default color for states without data
    colorStops.push("#374151");

    return colorStops as ExpressionSpecification;
  }, [states, stateImpactScores]);

  // Build color expressions for districts layer
  const districtColorExpression = useMemo((): ExpressionSpecification => {
    const colorStops: (string | ExpressionSpecification)[] = ["case"];

    districts.forEach((district) => {
      const score = districtImpactScores.get(district.cd_code) || 0;
      const color = getImpactColor(score);
      // Match by STATE and CD properties
      const [stateAbbr, districtNum] = district.cd_code.split("-");
      const fips = Object.entries(FIPS_TO_ABBR).find(
        ([, abbr]) => abbr === stateAbbr
      )?.[0];
      if (fips) {
        colorStops.push(
          [
            "all",
            ["==", ["get", "STATE"], fips],
            ["==", ["get", "CD"], districtNum],
          ],
          color
        );
      }
    });

    // Default color for districts without data
    colorStops.push("#374151");

    return colorStops as ExpressionSpecification;
  }, [districts, districtImpactScores]);

  // Build opacity expression for districts (filtered out = 20% opacity)
  const districtOpacityExpression = useMemo((): ExpressionSpecification => {
    const opacityStops: (string | number | ExpressionSpecification)[] = ["case"];

    districts.forEach((district) => {
      const isFiltered = filteredDistrictIds.has(district.cd_code);
      const [stateAbbr, districtNum] = district.cd_code.split("-");
      const fips = Object.entries(FIPS_TO_ABBR).find(
        ([, abbr]) => abbr === stateAbbr
      )?.[0];
      if (fips) {
        opacityStops.push(
          [
            "all",
            ["==", ["get", "STATE"], fips],
            ["==", ["get", "CD"], districtNum],
          ],
          isFiltered ? 0.7 : 0.2
        );
      }
    });

    // Default opacity
    opacityStops.push(0.7);

    return opacityStops as ExpressionSpecification;
  }, [districts, filteredDistrictIds]);

  // Handle view state change
  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
  }, []);

  // Handle state click
  const handleStateClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (showDistricts) return; // Districts handle clicks when zoomed in

      const feature = event.features?.[0];
      if (!feature) {
        onRegionSelect(null, "state");
        return;
      }

      const fips = String(feature.id);
      const stateAbbr = getStateFromFips(fips);

      if (stateAbbr) {
        onRegionSelect(stateAbbr, "state");
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
        if (cdCode) {
          onRegionSelect(cdCode, "district");
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
        onRegionHover(null, "state");
        return;
      }

      const fips = String(feature.id);
      const stateAbbr = getStateFromFips(fips);

      if (stateAbbr) {
        setHoveredRegion(stateAbbr);
        setHoveredType("state");
        onRegionHover(stateAbbr, "state");
      }
    },
    [onRegionHover]
  );

  // Handle district hover
  const handleDistrictHover = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) {
        setHoveredRegion(null);
        onRegionHover(null, "district");
        return;
      }

      const stateCode = feature.properties?.STATE;
      const districtNum = feature.properties?.CD;

      if (stateCode && districtNum) {
        const cdCode = buildDistrictCode(stateCode, districtNum);
        if (cdCode) {
          setHoveredRegion(cdCode);
          setHoveredType("district");
          onRegionHover(cdCode, "district");
        }
      }
    },
    [onRegionHover]
  );

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredRegion(null);
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
          2,
          // Default
          0.5,
        ] as ExpressionSpecification,
      },
    };
  }, [selectedRegion, hoveredRegion, hoveredType, showDistricts]);

  return (
    <div className="w-full h-full relative">
      <Map
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

        {/* States layer */}
        <Source id="states" type="geojson" data={GEOJSON_STATES}>
          <Layer {...statesFillLayer} />
          <Layer {...statesBorderLayer} />
        </Source>

        {/* Districts layer */}
        <Source id="districts" type="geojson" data={GEOJSON_DISTRICTS}>
          <Layer {...districtsFillLayer} />
          <Layer {...districtsBorderLayer} />
        </Source>
      </Map>
    </div>
  );
}

export default ImpactMap;
