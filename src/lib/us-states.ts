// US State abbreviation to full name mapping
// Used to match data (abbreviations) with GeoJSON (full names)

export const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
  PR: "Puerto Rico",
  VI: "Virgin Islands",
  GU: "Guam",
  AS: "American Samoa",
  MP: "Northern Mariana Islands",
};

// Reverse mapping: full name to abbreviation
export const STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([abbr, name]) => [name, abbr])
);

/**
 * Get the full state name from abbreviation
 * @param abbreviation - Two-letter state code (e.g., "CA")
 * @returns Full state name (e.g., "California") or the original input if not found
 */
export function getStateName(abbreviation: string): string {
  return STATE_ABBREVIATIONS[abbreviation.toUpperCase()] || abbreviation;
}

/**
 * Get the state abbreviation from full name
 * @param name - Full state name (e.g., "California")
 * @returns Two-letter state code (e.g., "CA") or the original input if not found
 */
export function getStateAbbreviation(name: string): string {
  return STATE_NAMES[name] || name;
}

/**
 * Check if a string is a valid US state abbreviation
 */
export function isValidStateAbbreviation(abbr: string): boolean {
  return abbr.toUpperCase() in STATE_ABBREVIATIONS;
}
