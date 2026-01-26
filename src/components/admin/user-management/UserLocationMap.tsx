import { useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { Skeleton } from "@/components/ui/skeleton";
import { V3Badge } from "@/components/v3/V3Badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Globe, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LocationData } from "./types";

interface UserLocationMapProps {
  locations: LocationData[];
  isLoading: boolean;
}

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function UserLocationMap({ locations, isLoading }: UserLocationMapProps) {
  const [hoveredLocation, setHoveredLocation] = useState<LocationData | null>(null);

  // Detect anomalies (locations seen only once or in new countries)
  const locationsWithAnomalies = useMemo(() => {
    const countryCounts = new Map<string, number>();
    locations.forEach(loc => {
      const country = loc.country || 'Unknown';
      countryCounts.set(country, (countryCounts.get(country) || 0) + loc.count);
    });

    return locations.map(loc => ({
      ...loc,
      is_anomaly: loc.count === 1 && (countryCounts.get(loc.country || 'Unknown') || 0) < 3
    }));
  }, [locations]);

  const uniqueCountries = [...new Set(locations.map(l => l.country).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--portal-text-secondary))]">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No location data available</p>
        <p className="text-xs mt-1 text-[hsl(var(--portal-text-muted))]">
          Location data is recorded when users log in
        </p>
      </div>
    );
  }

  const anomalyCount = locationsWithAnomalies.filter(l => l.is_anomaly).length;

  return (
    <div className="space-y-4">
      {anomalyCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.3)]">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
          <span className="text-sm text-[hsl(var(--portal-warning))]">
            {anomalyCount} unusual location{anomalyCount > 1 ? 's' : ''} detected
          </span>
        </div>
      )}

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 120,
            center: [0, 30]
          }}
          style={{ width: "100%", height: "280px" }}
        >
          <ZoomableGroup>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="hsl(var(--portal-bg-tertiary))"
                    stroke="hsl(var(--portal-border))"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "hsl(var(--portal-bg-hover))", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
            {locationsWithAnomalies.map((location, i) => (
              <Marker
                key={i}
                coordinates={[location.longitude, location.latitude]}
                onMouseEnter={() => setHoveredLocation(location)}
                onMouseLeave={() => setHoveredLocation(null)}
              >
                <circle
                  r={Math.min(Math.max(location.count * 2, 4), 12)}
                  fill={location.is_anomaly 
                    ? "hsl(var(--portal-warning))" 
                    : "hsl(var(--portal-accent-blue))"}
                  fillOpacity={0.7}
                  stroke={location.is_anomaly 
                    ? "hsl(var(--portal-warning))" 
                    : "hsl(var(--portal-accent-blue))"}
                  strokeWidth={2}
                  className="cursor-pointer transition-all hover:fill-opacity-100"
                />
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {hoveredLocation && (
          <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-[hsl(var(--portal-bg-primary))] border border-[hsl(var(--portal-border))] shadow-lg z-10">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                {hoveredLocation.city || 'Unknown'}, {hoveredLocation.country || 'Unknown'}
              </span>
              {hoveredLocation.is_anomaly && (
                <V3Badge variant="warning" className="text-[10px]">Unusual</V3Badge>
              )}
            </div>
            <p className="text-xs text-[hsl(var(--portal-text-secondary))] mt-1">
              {hoveredLocation.count} login{hoveredLocation.count > 1 ? 's' : ''} • 
              Last: {formatDistanceToNow(new Date(hoveredLocation.last_seen), { addSuffix: true })}
            </p>
          </div>
        )}
      </div>

      {/* Location List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
          Locations ({uniqueCountries.length} countries)
        </h4>
        <ScrollArea className="h-[150px]">
          <div className="space-y-2 pr-4">
            {locationsWithAnomalies
              .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
              .map((location, i) => (
                <div 
                  key={i}
                  className={`p-2 rounded-lg border ${
                    location.is_anomaly 
                      ? 'bg-[hsl(var(--portal-warning)/0.05)] border-[hsl(var(--portal-warning)/0.2)]' 
                      : 'bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className={`h-4 w-4 ${
                        location.is_anomaly 
                          ? 'text-[hsl(var(--portal-warning))]' 
                          : 'text-[hsl(var(--portal-accent-blue))]'
                      }`} />
                      <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                        {location.city || 'Unknown'}, {location.country || 'Unknown'}
                      </span>
                      {location.is_anomaly && (
                        <V3Badge variant="warning" className="text-[10px]">New</V3Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
                      <span>{location.count} login{location.count > 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(location.last_seen), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
