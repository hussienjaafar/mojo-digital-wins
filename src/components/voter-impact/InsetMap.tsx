/**
 * InsetMap Component
 *
 * A small, locked-viewport MapGL instance used for Alaska and Hawaii insets.
 * Shares the same data sources and layer styles as the main map, but is
 * non-interactive for pan/zoom — only clickable for state/district selection.
 */

import { useCallback, useMemo } from "react";
import MapGL, {
  Source,
  Layer,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Geometry } from "geojson";
import type { FillLayerSpecification, LineLayerSpecification } from "maplibre-gl";
import { FIPS_TO_ABBR, buildDistrictCode, getStateFromFips } from "@/hooks/useImpactMapLayers";

// ============================================================================
// Types
// ============================================================================

interface InsetMapProps {
  label: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  width: number;
  height: number;
  enrichedStatesGeoJSON: FeatureCollection<Geometry> | null;
  enrichedDistrictsGeoJSON: FeatureCollection<Geometry> | null;
  statesFillLayer: FillLayerSpecification;
  statesBorderLayer: LineLayerSpecification;
  districtsFillLayer: FillLayerSpecification;
  districtsBorderLayer: LineLayerSpecification;
  showDistricts: boolean;
  onRegionSelect: (regionId: string | null, type: "state" | "district") => void;
  mapStyle: string;
}

// ============================================================================
// Component
// ============================================================================

export function InsetMap({
  label,
  center,
  zoom,
  width,
  height,
  enrichedStatesGeoJSON,
  enrichedDistrictsGeoJSON,
  statesFillLayer,
  statesBorderLayer,
  districtsFillLayer,
  districtsBorderLayer,
  showDistricts,
  onRegionSelect,
  mapStyle,
}: InsetMapProps) {
  // Create inset-specific layer IDs to avoid conflicts with main map
  const insetPrefix = label.toLowerCase().replace(/\s+/g, '-');

  const insetStatesFillLayer = useMemo(
    () => ({
      ...statesFillLayer,
      id: `${insetPrefix}-states-fill`,
      paint: {
        ...((statesFillLayer as any).paint || {}),
        'fill-opacity': 0.7,
      },
    }),
    [statesFillLayer, insetPrefix]
  );
  const insetStatesBorderLayer = useMemo(
    () => ({
      ...statesBorderLayer,
      id: `${insetPrefix}-states-border`,
      paint: {
        ...((statesBorderLayer as any).paint || {}),
        'line-color': '#64748b',
        'line-width': 1.5,
      },
    }),
    [statesBorderLayer, insetPrefix]
  );
  const insetDistrictsFillLayer = useMemo(
    () => ({ ...districtsFillLayer, id: `${insetPrefix}-districts-fill` }),
    [districtsFillLayer, insetPrefix]
  );
  const insetDistrictsBorderLayer = useMemo(
    () => ({ ...districtsBorderLayer, id: `${insetPrefix}-districts-border` }),
    [districtsBorderLayer, insetPrefix]
  );

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const layerId = feature.layer?.id;

      if (layerId?.includes("districts-fill") && showDistricts) {
        const stateCode = feature.properties?.STATE;
        const districtNum = feature.properties?.CD;
        if (stateCode && districtNum) {
          const cdCode = buildDistrictCode(stateCode, districtNum);
          if (cdCode) onRegionSelect(cdCode, "district");
        }
      } else if (layerId?.includes("states-fill")) {
        const fips = String(feature.id).padStart(2, '0');
        const stateAbbr = getStateFromFips(fips);
        if (stateAbbr) onRegionSelect(stateAbbr, "state");
      }
    },
    [onRegionSelect, showDistricts]
  );

  const interactiveLayerIds = useMemo(
    () => [insetStatesFillLayer.id, insetDistrictsFillLayer.id],
    [insetStatesFillLayer.id, insetDistrictsFillLayer.id]
  );

  if (!enrichedStatesGeoJSON) return null;

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-[#1e2a45] bg-[#0a0f1a]"
      style={{ width, height }}
    >
      <MapGL
        longitude={center[0]}
        latitude={center[1]}
        zoom={zoom}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        interactive={false}
        dragPan={false}
        dragRotate={false}
        scrollZoom={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        keyboard={false}
        interactiveLayerIds={interactiveLayerIds}
        onClick={handleClick}
        cursor="pointer"
        attributionControl={false}
      >
        <Source id={`${insetPrefix}-states`} type="geojson" data={enrichedStatesGeoJSON}>
          <Layer {...insetStatesFillLayer} source={`${insetPrefix}-states`} />
          <Layer {...insetStatesBorderLayer} source={`${insetPrefix}-states`} />
        </Source>

        {enrichedDistrictsGeoJSON && (
          <Source id={`${insetPrefix}-districts`} type="geojson" data={enrichedDistrictsGeoJSON}>
            <Layer {...insetDistrictsFillLayer} source={`${insetPrefix}-districts`} />
            <Layer {...insetDistrictsBorderLayer} source={`${insetPrefix}-districts`} />
          </Source>
        )}
      </MapGL>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-[#94a3b8] font-medium tracking-wide pointer-events-none bg-[#0a0f1a]/70 px-1.5 rounded">
        {label}
      </span>
    </div>
  );
}
