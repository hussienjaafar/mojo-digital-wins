/**
 * useImpactMapLayers Hook
 *
 * Shared layer definitions and GeoJSON enrichment logic for the Impact Map.
 * Used by both the main map and Alaska/Hawaii inset maps.
 */

import { useMemo } from "react";
import type { FillLayerSpecification, LineLayerSpecification, ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import type {
  VoterImpactState,
  VoterImpactDistrict,
} from "@/queries/useVoterImpactQueries";
import type { MetricType, ColorStop } from "@/types/voter-impact";
import { METRIC_CONFIGS } from "@/types/voter-impact";

// ============================================================================
// Types
// ============================================================================

interface StateProperties {
  name: string;
  density?: number;
  muslimVoters?: number;
  stateCode?: string;
  metricValue?: number;
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
  metricValue?: number;
}

export interface UseImpactMapLayersParams {
  states: VoterImpactState[];
  districts: VoterImpactDistrict[];
  activeMetric: MetricType;
  localDistrictColorStops?: ColorStop[] | null;
  hoveredRegion: string | null;
  hoveredType: "state" | "district";
  selectedRegion: string | null;
  showDistricts: boolean;
  statesGeoJSON: FeatureCollection<Geometry, StateProperties> | null;
  districtsGeoJSON: FeatureCollection<Geometry, DistrictProperties> | null;
}

// ============================================================================
// Constants
// ============================================================================

export const FIPS_TO_ABBR: Record<string, string> = {
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

const COLORS = {
  border: "#94a3b8",
  hoverBorder: "#93c5fd",
  selectedBorder: "#3b82f6",
  glowHover: "#60a5fa",
  glowSelected: "#3b82f6",
};

// ============================================================================
// Helper Functions
// ============================================================================

export function buildDistrictCode(stateCode: string, districtNum: string): string {
  const stateAbbr = FIPS_TO_ABBR[stateCode];
  if (!stateAbbr) return "";
  const districtNumber = parseInt(districtNum, 10);
  return `${stateAbbr}-${String(districtNumber).padStart(3, "0")}`;
}

export function getStateFromFips(fips: string): string | null {
  return FIPS_TO_ABBR[fips] || null;
}

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
// Hook
// ============================================================================

export function useImpactMapLayers({
  states,
  districts,
  activeMetric,
  localDistrictColorStops,
  hoveredRegion,
  hoveredType,
  selectedRegion,
  showDistricts,
  statesGeoJSON,
  districtsGeoJSON,
}: UseImpactMapLayersParams) {
  const metricConfig = METRIC_CONFIGS[activeMetric];

  // Enriched states GeoJSON
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

  // Enriched districts GeoJSON
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

  // Color expressions
  const colorStops = metricConfig.colorStops;
  const stateColorExpression = useMemo(() => buildColorExpression("metricValue", colorStops), [colorStops]);
  const districtColorExpression = useMemo(
    () => buildColorExpression("metricValue", localDistrictColorStops ?? colorStops),
    [localDistrictColorStops, colorStops]
  );

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

  return {
    enrichedStatesGeoJSON,
    enrichedDistrictsGeoJSON,
    statesFillLayer,
    statesBorderGlowLayer,
    statesBorderLayer,
    districtsFillLayer,
    districtsBorderGlowLayer,
    districtsBorderLayer,
    metricConfig,
  };
}
