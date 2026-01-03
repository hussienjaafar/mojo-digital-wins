/**
 * FIPS-based US state mapping for reliable geographic data joins.
 * Using FIPS codes as canonical IDs avoids name-matching brittleness.
 */

export interface StateInfo {
  fips: string;
  name: string;
  abbreviation: string;
}

// Complete mapping of FIPS codes to state info (50 states + DC)
export const FIPS_TO_STATE: Record<string, StateInfo> = {
  "01": { fips: "01", name: "Alabama", abbreviation: "AL" },
  "02": { fips: "02", name: "Alaska", abbreviation: "AK" },
  "04": { fips: "04", name: "Arizona", abbreviation: "AZ" },
  "05": { fips: "05", name: "Arkansas", abbreviation: "AR" },
  "06": { fips: "06", name: "California", abbreviation: "CA" },
  "08": { fips: "08", name: "Colorado", abbreviation: "CO" },
  "09": { fips: "09", name: "Connecticut", abbreviation: "CT" },
  "10": { fips: "10", name: "Delaware", abbreviation: "DE" },
  "11": { fips: "11", name: "District of Columbia", abbreviation: "DC" },
  "12": { fips: "12", name: "Florida", abbreviation: "FL" },
  "13": { fips: "13", name: "Georgia", abbreviation: "GA" },
  "15": { fips: "15", name: "Hawaii", abbreviation: "HI" },
  "16": { fips: "16", name: "Idaho", abbreviation: "ID" },
  "17": { fips: "17", name: "Illinois", abbreviation: "IL" },
  "18": { fips: "18", name: "Indiana", abbreviation: "IN" },
  "19": { fips: "19", name: "Iowa", abbreviation: "IA" },
  "20": { fips: "20", name: "Kansas", abbreviation: "KS" },
  "21": { fips: "21", name: "Kentucky", abbreviation: "KY" },
  "22": { fips: "22", name: "Louisiana", abbreviation: "LA" },
  "23": { fips: "23", name: "Maine", abbreviation: "ME" },
  "24": { fips: "24", name: "Maryland", abbreviation: "MD" },
  "25": { fips: "25", name: "Massachusetts", abbreviation: "MA" },
  "26": { fips: "26", name: "Michigan", abbreviation: "MI" },
  "27": { fips: "27", name: "Minnesota", abbreviation: "MN" },
  "28": { fips: "28", name: "Mississippi", abbreviation: "MS" },
  "29": { fips: "29", name: "Missouri", abbreviation: "MO" },
  "30": { fips: "30", name: "Montana", abbreviation: "MT" },
  "31": { fips: "31", name: "Nebraska", abbreviation: "NE" },
  "32": { fips: "32", name: "Nevada", abbreviation: "NV" },
  "33": { fips: "33", name: "New Hampshire", abbreviation: "NH" },
  "34": { fips: "34", name: "New Jersey", abbreviation: "NJ" },
  "35": { fips: "35", name: "New Mexico", abbreviation: "NM" },
  "36": { fips: "36", name: "New York", abbreviation: "NY" },
  "37": { fips: "37", name: "North Carolina", abbreviation: "NC" },
  "38": { fips: "38", name: "North Dakota", abbreviation: "ND" },
  "39": { fips: "39", name: "Ohio", abbreviation: "OH" },
  "40": { fips: "40", name: "Oklahoma", abbreviation: "OK" },
  "41": { fips: "41", name: "Oregon", abbreviation: "OR" },
  "42": { fips: "42", name: "Pennsylvania", abbreviation: "PA" },
  "44": { fips: "44", name: "Rhode Island", abbreviation: "RI" },
  "45": { fips: "45", name: "South Carolina", abbreviation: "SC" },
  "46": { fips: "46", name: "South Dakota", abbreviation: "SD" },
  "47": { fips: "47", name: "Tennessee", abbreviation: "TN" },
  "48": { fips: "48", name: "Texas", abbreviation: "TX" },
  "49": { fips: "49", name: "Utah", abbreviation: "UT" },
  "50": { fips: "50", name: "Vermont", abbreviation: "VT" },
  "51": { fips: "51", name: "Virginia", abbreviation: "VA" },
  "53": { fips: "53", name: "Washington", abbreviation: "WA" },
  "54": { fips: "54", name: "West Virginia", abbreviation: "WV" },
  "55": { fips: "55", name: "Wisconsin", abbreviation: "WI" },
  "56": { fips: "56", name: "Wyoming", abbreviation: "WY" },
};

// Reverse mappings for quick lookups
export const ABBR_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.values(FIPS_TO_STATE).map((s) => [s.abbreviation, s.fips])
);

export const NAME_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.values(FIPS_TO_STATE).map((s) => [s.name, s.fips])
);

/**
 * Get state info by FIPS code
 */
export function getStateByFips(fips: string): StateInfo | undefined {
  // Handle numeric FIPS (e.g., "6" for California should become "06")
  const paddedFips = fips.padStart(2, "0");
  return FIPS_TO_STATE[paddedFips];
}

/**
 * Get state info by abbreviation
 */
export function getStateByAbbr(abbr: string): StateInfo | undefined {
  const fips = ABBR_TO_FIPS[abbr.toUpperCase()];
  return fips ? FIPS_TO_STATE[fips] : undefined;
}

/**
 * Get FIPS code from abbreviation
 */
export function getFipsByAbbr(abbr: string): string | undefined {
  return ABBR_TO_FIPS[abbr.toUpperCase()];
}

/**
 * Get FIPS code from state name
 */
export function getFipsByName(name: string): string | undefined {
  return NAME_TO_FIPS[name];
}

/**
 * Get all FIPS codes (useful for ensuring all states are represented)
 */
export function getAllFipsCodes(): string[] {
  return Object.keys(FIPS_TO_STATE);
}
