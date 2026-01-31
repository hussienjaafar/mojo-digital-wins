#!/usr/bin/env npx tsx
/**
 * Import voter impact data from Excel files into Supabase
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-voter-impact-data.ts <national_analysis.xlsx> <cd_analysis.xlsx>
 *
 * Arguments:
 *   national_analysis.xlsx - Path to National Analysis Excel file -> voter_impact_states table
 *   cd_analysis.xlsx - Path to CD GOTV Analysis Excel file -> voter_impact_districts table
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/import-voter-impact-data.ts <national_analysis.xlsx> <cd_analysis.xlsx>');
  process.exit(1);
}
const NATIONAL_ANALYSIS_PATH = args[0];
const CD_ANALYSIS_PATH = args[1];

// Configuration
const BATCH_SIZE = 50;

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// State name to 2-letter code mapping
const STATE_CODES: Record<string, string> = {
  'Alabama': 'AL',
  'Alaska': 'AK',
  'Arizona': 'AZ',
  'Arkansas': 'AR',
  'California': 'CA',
  'Colorado': 'CO',
  'Connecticut': 'CT',
  'Delaware': 'DE',
  'District of Columbia': 'DC',
  'Florida': 'FL',
  'Georgia': 'GA',
  'Hawaii': 'HI',
  'Idaho': 'ID',
  'Illinois': 'IL',
  'Indiana': 'IN',
  'Iowa': 'IA',
  'Kansas': 'KS',
  'Kentucky': 'KY',
  'Louisiana': 'LA',
  'Maine': 'ME',
  'Maryland': 'MD',
  'Massachusetts': 'MA',
  'Michigan': 'MI',
  'Minnesota': 'MN',
  'Mississippi': 'MS',
  'Missouri': 'MO',
  'Montana': 'MT',
  'Nebraska': 'NE',
  'Nevada': 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  'Ohio': 'OH',
  'Oklahoma': 'OK',
  'Oregon': 'OR',
  'Pennsylvania': 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  'Tennessee': 'TN',
  'Texas': 'TX',
  'Utah': 'UT',
  'Vermont': 'VT',
  'Virginia': 'VA',
  'Washington': 'WA',
  'West Virginia': 'WV',
  'Wisconsin': 'WI',
  'Wyoming': 'WY',
};

// Helper function to parse numbers (remove commas, handle strings)
function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '' || value === '-') {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Remove commas, dollar signs, and whitespace
    const cleaned = value.replace(/[$,\s]/g, '').trim();
    if (cleaned === '' || cleaned === '-') {
      return 0;
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Helper function to parse percentage (removes % and divides by 100 if needed)
function parsePercent(value: unknown): number {
  if (value === null || value === undefined || value === '' || value === '-') {
    return 0;
  }
  if (typeof value === 'number') {
    // If already a decimal (e.g., 0.65), return as-is
    // If a whole number percentage (e.g., 65), divide by 100
    return value > 1 ? value / 100 : value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[%,\s]/g, '').trim();
    if (cleaned === '' || cleaned === '-') {
      return 0;
    }
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      return 0;
    }
    // If the string had a % sign, it was a percentage
    return value.includes('%') ? parsed / 100 : (parsed > 1 ? parsed / 100 : parsed);
  }
  return 0;
}

// Helper function to parse boolean from YES/NO or similar
function parseBoolean(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'yes' || lower === 'true' || lower === '1' || lower === 'y';
  }
  return Boolean(value);
}

// Helper function to get state code from state name
function getStateCode(stateName: string): string | null {
  if (!stateName) return null;

  // Check if it's already a 2-letter code
  const upper = stateName.toUpperCase().trim();
  if (upper.length === 2 && Object.values(STATE_CODES).includes(upper)) {
    return upper;
  }

  // Look up by name
  const normalized = stateName.trim();
  return STATE_CODES[normalized] || null;
}

// Types for Excel row data
interface NationalAnalysisRow {
  'State': string;
  'Muslim Voters': number | string;
  'Households': number | string;
  'Cell Phones': number | string;
  'Registered': number | string;
  'Registered %': number | string;
  'Vote 2024': number | string;
  'Vote 2024 %': number | string;
  'Vote 2022': number | string;
  'Vote 2022 %': number | string;
  'Political Donors': number | string;
  'Political Activists': number | string;
}

interface CDAnalysisRow {
  'State': string;
  'State Code': string;
  'District': number | string;
  'CD_CODE': string;
  'WINNER': string;
  'Party': string;
  'Votes': number | string;
  'Runner-Up': string;
  'Runner-Up Party': string;
  'Runner-Up Votes': number | string;
  'Margin (Votes)': number | string;
  'Margin (%)': number | string;
  'Total Votes': number | string;
  'MUSLIM': number | string;
  'MUS-REG': number | string;
  'MUS-UNREG': number | string;
  'MUS_VOTED24': number | string;
  "MUS_DIDN'TVOTE24": number | string;
  'NEWREG_TURNOUT': number | string;
  'CAN IMPACT': string;
  'ADD MUSLIM VOTES NEEDED': number | string;
  'COST (~ $70 PER VOTE)': number | string;
}

// Database record types
interface VoterImpactState {
  state_code: string;
  state_name: string;
  muslim_voters: number;
  households: number;
  cell_phones: number;
  registered: number;
  registered_pct: number;
  vote_2024: number;
  vote_2024_pct: number;
  vote_2022: number;
  vote_2022_pct: number;
  political_donors: number;
  political_activists: number;
}

interface VoterImpactDistrict {
  cd_code: string;
  state_code: string;
  district_num: number;
  winner: string | null;
  winner_party: string | null;
  winner_votes: number | null;
  runner_up: string | null;
  runner_up_party: string | null;
  runner_up_votes: number | null;
  margin_votes: number | null;
  margin_pct: number | null;
  total_votes: number | null;
  muslim_voters: number;
  muslim_registered: number;
  muslim_unregistered: number;
  voted_2024: number;
  didnt_vote_2024: number;
  turnout_pct: number;
  can_impact: boolean;
  votes_needed: number | null;
  cost_estimate: number | null;
}

/**
 * Import state-level data from National Analysis Excel file
 */
async function importStatesData(): Promise<void> {
  console.log('\n========================================');
  console.log('Importing State-Level Data');
  console.log('========================================');
  console.log(`Source: ${NATIONAL_ANALYSIS_PATH}`);

  // Check file exists
  if (!fs.existsSync(NATIONAL_ANALYSIS_PATH)) {
    console.error(`Error: File not found: ${NATIONAL_ANALYSIS_PATH}`);
    process.exit(1);
  }

  // Read Excel file
  const workbook = XLSX.readFile(NATIONAL_ANALYSIS_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<NationalAnalysisRow>(worksheet);

  console.log(`Found ${rawData.length} rows in Excel file`);

  // Filter out NATIONAL row and transform data
  const stateRecords: VoterImpactState[] = [];

  for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
    const row = rawData[rowIndex];
    const stateName = row['State']?.toString().trim();

    // Skip NATIONAL row
    if (!stateName || stateName.toUpperCase() === 'NATIONAL') {
      console.log(`  Skipping row ${rowIndex + 2}: ${stateName || '(empty)'}`);
      continue;
    }

    const stateCode = getStateCode(stateName);
    if (!stateCode) {
      console.warn(`  Warning: Row ${rowIndex + 2}: Unknown state "${stateName}", skipping. Data: ${JSON.stringify(row)}`);
      continue;
    }

    const record: VoterImpactState = {
      state_code: stateCode,
      state_name: stateName,
      muslim_voters: parseNumber(row['Muslim Voters']),
      households: parseNumber(row['Households']),
      cell_phones: parseNumber(row['Cell Phones']),
      registered: parseNumber(row['Registered']),
      registered_pct: parsePercent(row['Registered %']),
      vote_2024: parseNumber(row['Vote 2024']),
      vote_2024_pct: parsePercent(row['Vote 2024 %']),
      vote_2022: parseNumber(row['Vote 2022']),
      vote_2022_pct: parsePercent(row['Vote 2022 %']),
      political_donors: parseNumber(row['Political Donors']),
      political_activists: parseNumber(row['Political Activists']),
    };

    stateRecords.push(record);
  }

  console.log(`Prepared ${stateRecords.length} state records for import`);

  // Upsert in batches
  let imported = 0;
  for (let i = 0; i < stateRecords.length; i += BATCH_SIZE) {
    const batch = stateRecords.slice(i, i + BATCH_SIZE);
    console.log(`  Upserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stateRecords.length / BATCH_SIZE)} (${batch.length} records)...`);

    const { error } = await supabase
      .from('voter_impact_states')
      .upsert(batch, { onConflict: 'state_code' });

    if (error) {
      console.error(`  Error upserting batch:`, error);
      throw error;
    }

    imported += batch.length;
  }

  console.log(`Successfully imported ${imported} state records`);
}

/**
 * Import district-level data from CD GOTV Analysis Excel file
 */
async function importDistrictsData(): Promise<void> {
  console.log('\n========================================');
  console.log('Importing District-Level Data');
  console.log('========================================');
  console.log(`Source: ${CD_ANALYSIS_PATH}`);

  // Check file exists
  if (!fs.existsSync(CD_ANALYSIS_PATH)) {
    console.error(`Error: File not found: ${CD_ANALYSIS_PATH}`);
    process.exit(1);
  }

  // Read Excel file
  const workbook = XLSX.readFile(CD_ANALYSIS_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<CDAnalysisRow>(worksheet);

  console.log(`Found ${rawData.length} rows in Excel file`);

  // Transform data
  const districtRecords: VoterImpactDistrict[] = [];

  for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
    const row = rawData[rowIndex];
    // Get state code - try State Code column first, then derive from State name
    let stateCode = row['State Code']?.toString().trim().toUpperCase();
    if (!stateCode || stateCode.length !== 2) {
      const stateName = row['State']?.toString().trim();
      stateCode = getStateCode(stateName) || '';
    }

    if (!stateCode) {
      console.warn(`  Warning: Row ${rowIndex + 2}: Could not determine state code, skipping. Data: ${JSON.stringify(row)}`);
      continue;
    }

    // Get CD code - use CD_CODE column or construct from state + district
    let cdCode = row['CD_CODE']?.toString().trim();
    if (!cdCode) {
      const districtNum = parseNumber(row['District']);
      cdCode = `${stateCode}-${districtNum.toString().padStart(2, '0')}`;
    }

    // Parse district number from CD code or District column
    let districtNum = parseNumber(row['District']);
    if (districtNum === 0 && cdCode) {
      const match = cdCode.match(/-(\d+)$/);
      if (match) {
        districtNum = parseInt(match[1], 10);
      }
    }

    const record: VoterImpactDistrict = {
      cd_code: cdCode,
      state_code: stateCode,
      district_num: districtNum,
      winner: row['WINNER']?.toString().trim() || null,
      winner_party: row['Party']?.toString().trim() || null,
      winner_votes: parseNumber(row['Votes']) || null,
      runner_up: row['Runner-Up']?.toString().trim() || null,
      runner_up_party: row['Runner-Up Party']?.toString().trim() || null,
      runner_up_votes: parseNumber(row['Runner-Up Votes']) || null,
      margin_votes: parseNumber(row['Margin (Votes)']) || null,
      margin_pct: parsePercent(row['Margin (%)']) || null,
      total_votes: parseNumber(row['Total Votes']) || null,
      muslim_voters: parseNumber(row['MUSLIM']),
      muslim_registered: parseNumber(row['MUS-REG']),
      muslim_unregistered: parseNumber(row['MUS-UNREG']),
      voted_2024: parseNumber(row['MUS_VOTED24']),
      didnt_vote_2024: parseNumber(row["MUS_DIDN'TVOTE24"]),
      turnout_pct: parsePercent(row['NEWREG_TURNOUT']),
      can_impact: parseBoolean(row['CAN IMPACT']),
      votes_needed: parseNumber(row['ADD MUSLIM VOTES NEEDED']) || null,
      cost_estimate: parseNumber(row['COST (~ $70 PER VOTE)']) || null,
    };

    districtRecords.push(record);
  }

  console.log(`Prepared ${districtRecords.length} district records for import`);

  // Upsert in batches
  let imported = 0;
  for (let i = 0; i < districtRecords.length; i += BATCH_SIZE) {
    const batch = districtRecords.slice(i, i + BATCH_SIZE);
    console.log(`  Upserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(districtRecords.length / BATCH_SIZE)} (${batch.length} records)...`);

    const { error } = await supabase
      .from('voter_impact_districts')
      .upsert(batch, { onConflict: 'cd_code' });

    if (error) {
      console.error(`  Error upserting batch:`, error);
      throw error;
    }

    imported += batch.length;
  }

  console.log(`Successfully imported ${imported} district records`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('Voter Impact Data Import');
  console.log('='.repeat(50));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  try {
    // Import states first (districts have foreign key to states)
    await importStatesData();

    // Then import districts
    await importDistrictsData();

    console.log('\n========================================');
    console.log('Import Complete!');
    console.log('========================================');
  } catch (error) {
    console.error('\nImport failed:', error);
    process.exit(1);
  }
}

// Run the import
main();
