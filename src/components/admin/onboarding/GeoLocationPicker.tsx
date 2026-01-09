import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Search, MapPin } from 'lucide-react';
import { STATE_ABBREVIATIONS } from '@/lib/us-states';
import type { GeoLevel, GeoLocation } from './types';

// Congressional districts (simplified - major ones)
const CONGRESSIONAL_DISTRICTS: Record<string, string[]> = {
  CA: Array.from({ length: 52 }, (_, i) => `CA-${i + 1}`),
  TX: Array.from({ length: 38 }, (_, i) => `TX-${i + 1}`),
  FL: Array.from({ length: 28 }, (_, i) => `FL-${i + 1}`),
  NY: Array.from({ length: 26 }, (_, i) => `NY-${i + 1}`),
  PA: Array.from({ length: 17 }, (_, i) => `PA-${i + 1}`),
  IL: Array.from({ length: 17 }, (_, i) => `IL-${i + 1}`),
  OH: Array.from({ length: 15 }, (_, i) => `OH-${i + 1}`),
  GA: Array.from({ length: 14 }, (_, i) => `GA-${i + 1}`),
  NC: Array.from({ length: 14 }, (_, i) => `NC-${i + 1}`),
  MI: Array.from({ length: 13 }, (_, i) => `MI-${i + 1}`),
};

// Major cities by state
const MAJOR_CITIES: Record<string, string[]> = {
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Long Beach'],
  TX: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi'],
  FL: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'St. Petersburg', 'Hialeah', 'Tallahassee', 'Fort Lauderdale'],
  NY: ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  GA: ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah', 'Athens'],
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Boulder'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'New Bedford'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City'],
};

// Major counties by state
const MAJOR_COUNTIES: Record<string, string[]> = {
  CA: ['Los Angeles County', 'San Diego County', 'Orange County', 'Riverside County', 'San Bernardino County', 'Santa Clara County', 'Alameda County'],
  TX: ['Harris County', 'Dallas County', 'Tarrant County', 'Bexar County', 'Travis County', 'Collin County'],
  FL: ['Miami-Dade County', 'Broward County', 'Palm Beach County', 'Hillsborough County', 'Orange County', 'Pinellas County'],
  NY: ['Kings County', 'Queens County', 'New York County', 'Suffolk County', 'Bronx County', 'Nassau County'],
  PA: ['Philadelphia County', 'Allegheny County', 'Montgomery County', 'Bucks County', 'Delaware County'],
  IL: ['Cook County', 'DuPage County', 'Lake County', 'Will County', 'Kane County'],
  OH: ['Franklin County', 'Cuyahoga County', 'Hamilton County', 'Summit County', 'Montgomery County'],
  GA: ['Fulton County', 'Gwinnett County', 'Cobb County', 'DeKalb County', 'Clayton County'],
  NC: ['Mecklenburg County', 'Wake County', 'Guilford County', 'Forsyth County', 'Cumberland County'],
  MI: ['Wayne County', 'Oakland County', 'Macomb County', 'Kent County', 'Genesee County'],
};

interface GeoLocationPickerProps {
  geoLevel: GeoLevel;
  selectedLocations: GeoLocation[];
  onChange: (locations: GeoLocation[]) => void;
}

export function GeoLocationPicker({ geoLevel, selectedLocations, onChange }: GeoLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Generate searchable options based on geo level
  const searchOptions = useMemo(() => {
    const options: GeoLocation[] = [];
    
    if (geoLevel === 'national') {
      options.push({ type: 'national', value: 'US', label: 'United States (National)' });
    } else if (geoLevel === 'international') {
      // Add some common international options
      const intlOrgs = ['Global', 'European Union', 'North America', 'Latin America', 'Asia Pacific', 'Middle East', 'Africa', 'United Nations'];
      intlOrgs.forEach(org => {
        options.push({ type: 'international', value: org.toLowerCase().replace(/\s/g, '_'), label: org });
      });
    } else if (geoLevel === 'multi_state' || geoLevel === 'state') {
      // Add all states
      Object.entries(STATE_ABBREVIATIONS).forEach(([abbr, name]) => {
        options.push({ type: 'state', value: abbr, label: `${name} (${abbr})` });
      });
    } else if (geoLevel === 'congressional_district') {
      // Add congressional districts
      Object.entries(CONGRESSIONAL_DISTRICTS).forEach(([state, districts]) => {
        districts.forEach(district => {
          const stateName = STATE_ABBREVIATIONS[state];
          options.push({ 
            type: 'congressional_district', 
            value: district, 
            label: `${district} - ${stateName}` 
          });
        });
      });
    } else if (geoLevel === 'county') {
      // Add counties
      Object.entries(MAJOR_COUNTIES).forEach(([state, counties]) => {
        counties.forEach(county => {
          options.push({ 
            type: 'county', 
            value: `${county}, ${state}`, 
            label: `${county}, ${STATE_ABBREVIATIONS[state]}` 
          });
        });
      });
    } else if (geoLevel === 'city') {
      // Add cities
      Object.entries(MAJOR_CITIES).forEach(([state, cities]) => {
        cities.forEach(city => {
          options.push({ 
            type: 'city', 
            value: `${city}, ${state}`, 
            label: `${city}, ${STATE_ABBREVIATIONS[state]}` 
          });
        });
      });
    }
    
    return options;
  }, [geoLevel]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return searchOptions.slice(0, 20); // Show first 20 by default
    const query = searchQuery.toLowerCase();
    return searchOptions
      .filter(opt => opt.label.toLowerCase().includes(query) || opt.value.toLowerCase().includes(query))
      .slice(0, 20);
  }, [searchOptions, searchQuery]);

  const addLocation = (location: GeoLocation) => {
    if (!selectedLocations.some(l => l.value === location.value)) {
      onChange([...selectedLocations, location]);
    }
    setSearchQuery('');
  };

  const removeLocation = (value: string) => {
    onChange(selectedLocations.filter(l => l.value !== value));
  };

  // For national level, auto-select if empty
  if (geoLevel === 'national' && selectedLocations.length === 0) {
    onChange([{ type: 'national', value: 'US', label: 'United States (National)' }]);
  }

  const showSearch = geoLevel !== 'national';

  return (
    <div className="space-y-3">
      {/* Selected locations */}
      {selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedLocations.map(location => (
            <Badge 
              key={location.value} 
              variant="default"
              className="pr-1 gap-1"
            >
              <MapPin className="w-3 h-3" />
              {location.label}
              {geoLevel !== 'national' && (
                <button
                  type="button"
                  className="ml-1 p-0.5 rounded-full hover:bg-black/20"
                  onClick={() => removeLocation(location.value)}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${geoLevel === 'city' ? 'cities' : geoLevel === 'county' ? 'counties' : geoLevel === 'congressional_district' ? 'districts' : geoLevel === 'international' ? 'regions' : 'states'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[hsl(var(--portal-bg-secondary))]"
          />
        </div>
      )}

      {/* Suggestions */}
      {showSearch && (
        <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] max-h-40 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches found. Try a different search.</p>
          ) : (
            filteredOptions.map(option => {
              const isSelected = selectedLocations.some(l => l.value === option.value);
              return (
                <Badge
                  key={option.value}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer transition-all hover:opacity-80 ${isSelected ? 'opacity-50' : ''}`}
                  onClick={() => !isSelected && addLocation(option)}
                >
                  {option.label}
                </Badge>
              );
            })
          )}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        {geoLevel === 'multi_state' && 'Select all states where the organization operates'}
        {geoLevel === 'state' && 'Select the state where the organization is focused'}
        {geoLevel === 'congressional_district' && 'Select the congressional district(s)'}
        {geoLevel === 'county' && 'Select the county or counties'}
        {geoLevel === 'city' && 'Select the city or cities'}
        {geoLevel === 'international' && 'Select the regions or global scope'}
      </p>
    </div>
  );
}