/**
 * VoterImpactDataImport Component
 * 
 * Admin-only component for importing voter impact data from Excel files.
 * Handles both National_Analysis.xlsx (states) and CD_GOTV_ANALYSIS.xlsx (districts).
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { STATE_ABBREVIATIONS, getStateAbbreviation, getStateName, isValidStateAbbreviation } from "@/lib/us-states";
import { voterImpactKeys } from "@/queries/queryKeys";

// ============================================================================
// Types
// ============================================================================

interface ImportState {
  file: File | null;
  status: "idle" | "parsing" | "importing" | "success" | "error";
  progress: number;
  message: string;
  rowsProcessed: number;
  rowsTotal: number;
  errors: string[];
}

interface StateRow {
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

interface DistrictRow {
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a column header key for fuzzy matching.
 * Removes spaces, underscores, hyphens, parentheses, percent signs, apostrophes, etc.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-()%'"]/g, "");
}

/**
 * Build a normalized lookup map from a row's column keys.
 * Maps normalized keys -> original keys for later retrieval.
 */
function buildColumnLookup(row: Record<string, unknown>): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const key of Object.keys(row)) {
    lookup.set(normalizeKey(key), key);
  }
  return lookup;
}

/**
 * Get a column value from a row using flexible matching.
 * Tries exact match first, then normalized matching across all variations.
 */
function getColWithLookup(
  row: Record<string, unknown>,
  lookup: Map<string, string>,
  ...names: string[]
): unknown {
  // Try exact match first
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
  }
  // Try normalized match
  for (const name of names) {
    const normalized = normalizeKey(name);
    const originalKey = lookup.get(normalized);
    if (originalKey && row[originalKey] !== undefined) {
      return row[originalKey];
    }
  }
  return undefined;
}

/**
 * Log column mapping diagnostics for debugging import issues.
 */
function logColumnDiagnostics(
  context: string,
  headers: string[],
  firstRow: Record<string, unknown>,
  columnMappings: Record<string, string[]>
): void {
  console.group(`[${context}] Column Diagnostics`);
  console.log("Excel columns found:", headers);
  console.log("Normalized headers:", headers.map(h => `${h} -> ${normalizeKey(h)}`));
  
  const lookup = buildColumnLookup(firstRow);
  const matchResults: Record<string, { matched: boolean; matchedColumn?: string; value?: unknown }> = {};
  
  for (const [dbField, variations] of Object.entries(columnMappings)) {
    const value = getColWithLookup(firstRow, lookup, ...variations);
    const matchedColumn = variations.find(v => {
      if (firstRow[v] !== undefined) return true;
      const normalized = normalizeKey(v);
      return lookup.has(normalized);
    });
    
    matchResults[dbField] = {
      matched: value !== undefined,
      matchedColumn: matchedColumn,
      value: value,
    };
  }
  
  console.log("Column matching results:");
  for (const [field, result] of Object.entries(matchResults)) {
    const status = result.matched ? "✅" : "❌";
    console.log(`  ${status} ${field}: ${result.matchedColumn || "NOT FOUND"} = ${result.value}`);
  }
  console.groupEnd();
}

/**
 * Parse a number from Excel cell, rounding to integer.
 * Use this for count/integer columns.
 */
function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "-" || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const cleaned = String(value).replace(/[$,\s]/g, "");
  return Math.round(parseFloat(cleaned) || 0);
}

function parsePercent(value: unknown): number {
  if (value === null || value === undefined || value === "-" || value === "") return 0;
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const cleaned = String(value).replace(/[%,\s]/g, "");
  const num = parseFloat(cleaned) || 0;
  return num > 1 ? num / 100 : num;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().trim() === "yes";
}

function parseString(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  return String(value).trim();
}

/**
 * Extract party from a candidate name that might include party in parentheses
 * e.g., "RASHIDA TLAIB (D)" -> "D", "John Smith (R)" -> "R"
 */
function extractPartyFromName(name: string | null): string | null {
  if (!name) return null;
  // Match patterns like (D), (R), (DEM), (REP), (Democrat), (Republican)
  const match = name.match(/\(([DR]|DEM|REP|Democrat|Republican)\)/i);
  if (match) {
    const party = match[1].toUpperCase();
    if (party === "D" || party === "DEM" || party === "DEMOCRAT") return "D";
    if (party === "R" || party === "REP" || party === "REPUBLICAN") return "R";
  }
  return null;
}

/**
 * Normalize party value to "D" or "R"
 */
function normalizePartyValue(party: string | null): string | null {
  if (!party) return null;
  const normalized = party.toUpperCase().trim();
  if (normalized === "D" || normalized === "DEM" || normalized === "DEMOCRAT" || normalized === "DEMOCRATIC") {
    return "D";
  }
  if (normalized === "R" || normalized === "REP" || normalized === "REPUBLICAN" || normalized === "GOP") {
    return "R";
  }
  return null;
}

// ============================================================================
// Component
// ============================================================================

export function VoterImpactDataImport() {
  const queryClient = useQueryClient();
  const [statesImport, setStatesImport] = useState<ImportState>({
    file: null,
    status: "idle",
    progress: 0,
    message: "",
    rowsProcessed: 0,
    rowsTotal: 0,
    errors: [],
  });

  const [districtsImport, setDistrictsImport] = useState<ImportState>({
    file: null,
    status: "idle",
    progress: 0,
    message: "",
    rowsProcessed: 0,
    rowsTotal: 0,
    errors: [],
  });

  const [clearStatus, setClearStatus] = useState<"idle" | "clearing" | "success" | "error">("idle");

  // Clear all existing voter impact data (for re-import with correct format)
  const clearAllData = useCallback(async () => {
    if (!window.confirm(
      "This will DELETE all existing voter impact data (states and districts). " +
      "You will need to re-import both files. Continue?"
    )) {
      return;
    }

    setClearStatus("clearing");

    try {
      // Delete districts first (due to foreign key constraint)
      const { error: districtsError } = await supabase
        .from("voter_impact_districts" as never)
        .delete()
        .neq("cd_code", "NEVER_MATCHES");

      if (districtsError) {
        throw new Error(`Failed to clear districts: ${(districtsError as any)?.message}`);
      }

      // Then delete states
      const { error: statesError } = await supabase
        .from("voter_impact_states" as never)
        .delete()
        .neq("state_code", "NEVER_MATCHES");

      if (statesError) {
        throw new Error(`Failed to clear states: ${(statesError as any)?.message}`);
      }

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: voterImpactKeys.all });

      setClearStatus("success");
      toast.success("All voter impact data cleared. You can now re-import with correct format.");

      // Reset to idle after 3 seconds
      setTimeout(() => setClearStatus("idle"), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setClearStatus("error");
      toast.error(`Failed to clear data: ${message}`);
      setTimeout(() => setClearStatus("idle"), 3000);
    }
  }, [queryClient]);

  // Column mappings for states file - maps DB field to possible Excel column names
  const STATE_COLUMN_MAPPINGS: Record<string, string[]> = {
    state: ["State", "STATE", "state"],
    muslim_voters: ["Muslim Voters", "MUSLIM VOTERS", "Muslim_Voters", "MuslimVoters", "MUSLIM", "Muslim"],
    households: ["Households", "HOUSEHOLDS", "HH"],
    cell_phones: ["Cell Phones", "CELL PHONES", "Cell_Phones", "CellPhones"],
    registered: ["Registered", "REGISTERED", "Reg"],
    registered_pct: ["Registered %", "REGISTERED %", "Registered%", "REG%", "Reg %"],
    vote_2024: ["Vote 2024", "VOTE 2024", "Vote_2024", "VOTE2024"],
    vote_2024_pct: ["Vote 2024 %", "VOTE 2024 %", "Vote_2024%", "VOTE2024%"],
    vote_2022: ["Vote 2022", "VOTE 2022", "Vote_2022", "VOTE2022"],
    vote_2022_pct: ["Vote 2022 %", "VOTE 2022 %", "Vote_2022%", "VOTE2022%"],
    political_donors: ["Political Donors", "POLITICAL DONORS", "PoliticalDonors"],
    political_activists: ["Political Activists", "POLITICAL ACTIVISTS", "PoliticalActivists"],
  };

  // Column mappings for districts file - maps DB field to possible Excel column names
  const DISTRICT_COLUMN_MAPPINGS: Record<string, string[]> = {
    state_code: ["State Code", "State_Code", "STATE CODE", "STATE_CODE", "STATE", "State"],
    cd_code: ["CD_CODE", "CD CODE", "CD_Code", "CDCODE", "CD"],
    district: ["District", "DISTRICT", "District_Num", "DIST"],
    winner: ["WINNER", "Winner", "winner", "Winner Name", "WINNER NAME"],
    party: ["Party", "PARTY", "Winner Party", "WINNER PARTY", "Winner_Party", "WinnerParty", "WIN PARTY", "WIN_PARTY"],
    votes: ["Votes", "VOTES", "Winner Votes", "WINNER VOTES", "Winner_Votes"],
    runner_up: ["Runner-Up", "RUNNER-UP", "Runner Up", "RUNNERUP", "Runner-Up Name", "RUNNER-UP NAME", "Loser", "LOSER"],
    runner_up_party: ["Runner-Up Party", "RUNNER-UP PARTY", "RunnerUpParty", "Runner Up Party", "RUNNER UP PARTY", "Loser Party", "LOSER PARTY", "LOSE PARTY"],
    runner_up_votes: ["Runner-Up Votes", "RUNNER-UP VOTES", "RunnerUpVotes", "Runner Up Votes", "RUNNER UP VOTES", "Loser Votes"],
    margin_votes: ["Margin (Votes)", "MARGIN (VOTES)", "Margin_Votes", "MarginVotes", "MARGIN"],
    margin_pct: ["Margin (%)", "MARGIN (%)", "Margin_Pct", "MarginPct", "MARGINPCT"],
    total_votes: ["Total Votes", "TOTAL VOTES", "Total_Votes", "TotalVotes"],
    muslim_voters: ["MUSLIM", "Muslim", "muslim_voters", "Muslim Voters", "MUSLIMVOTERS"],
    muslim_registered: ["MUS-REG", "MUS_REG", "MusReg", "MUSREG", "Muslim Registered"],
    muslim_unregistered: ["MUS-UNREG", "MUS_UNREG", "MusUnreg", "MUSUNREG", "Muslim Unregistered"],
    voted_2024: ["MUS_VOTED24", "MUS-VOTED24", "MusVoted24", "MUSVOTED24", "Muslim Voted 2024"],
    didnt_vote_2024: ["MUS_DIDN'TVOTE24", "MUS_DIDNTVOTE24", "MUS_DIDNT_VOTE24", "MUSDIDNTVOTE24", "Didn't Vote 2024"],
    turnout_pct: ["NEWREG_TURNOUT", "Turnout", "TURNOUT", "Turnout_Pct", "TURNOUTPCT"],
    can_impact: ["CAN IMPACT", "CAN_IMPACT", "Can Impact", "CANIMPACT"],
    votes_needed: ["ADD MUSLIM VOTES NEEDED", "Votes Needed", "VOTES_NEEDED", "VOTESNEEDED"],
    cost_estimate: ["COST (~ $70 PER VOTE)", "Cost Estimate", "COST_ESTIMATE", "COSTESTIMATE"],
  };

  // Parse states Excel file
  const parseStatesFile = useCallback(async (file: File): Promise<StateRow[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    if (rows.length === 0) {
      console.warn("[parseStatesFile] No rows found in file");
      return [];
    }

    const headers = Object.keys(rows[0]);
    const firstRow = rows[0];
    const lookup = buildColumnLookup(firstRow);

    // Log comprehensive diagnostics
    logColumnDiagnostics("parseStatesFile", headers, firstRow, STATE_COLUMN_MAPPINGS);

    const stateRows: StateRow[] = [];
    
    for (const row of rows) {
      const rowLookup = buildColumnLookup(row);
      const rawState = String(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.state) || "").trim();
      
      // Skip "NATIONAL" summary row
      if (!rawState || rawState.toUpperCase() === "NATIONAL") continue;

      let stateCode: string;
      let stateName: string;

      // Check if the value is already a 2-letter abbreviation
      if (rawState.length === 2 && isValidStateAbbreviation(rawState)) {
        stateCode = rawState.toUpperCase();
        stateName = getStateName(stateCode);
      } else {
        // Assume it's a full state name
        const abbr = getStateAbbreviation(rawState);
        if (abbr === rawState) {
          console.warn(`[parseStatesFile] Unknown state: ${rawState}`);
          continue;
        }
        stateCode = abbr;
        stateName = rawState;
      }

      const muslimVoters = parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.muslim_voters));
      
      // DEBUG: Log problem states
      if (stateCode === "CO" || stateCode === "MN" || stateCode === "NJ") {
        console.log(`[parseStatesFile] ${stateCode} - muslim_voters: ${muslimVoters}`);
      }

      stateRows.push({
        state_code: stateCode,
        state_name: stateName,
        muslim_voters: muslimVoters,
        households: parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.households)),
        cell_phones: parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.cell_phones)),
        registered: parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.registered)),
        registered_pct: parsePercent(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.registered_pct)),
        vote_2024: parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.vote_2024)),
        vote_2024_pct: parsePercent(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.vote_2024_pct)),
        vote_2022: parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.vote_2022)),
        vote_2022_pct: parsePercent(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.vote_2022_pct)),
        political_donors: parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.political_donors)),
        political_activists: parseNumber(getColWithLookup(row, rowLookup, ...STATE_COLUMN_MAPPINGS.political_activists)),
      });
    }

    console.log(`[parseStatesFile] Parsed ${stateRows.length} state rows`);
    
    // Warn if all muslim_voters are 0
    const withVoters = stateRows.filter(r => r.muslim_voters > 0).length;
    if (withVoters === 0 && stateRows.length > 0) {
      console.error("[parseStatesFile] ⚠️ WARNING: All states have 0 muslim_voters - check column mapping!");
    } else {
      console.log(`[parseStatesFile] States with muslim_voters > 0: ${withVoters}/${stateRows.length}`);
    }
    
    return stateRows;
  }, []);

  // Parse districts Excel file
  const parseDistrictsFile = useCallback(async (file: File): Promise<DistrictRow[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    if (rows.length === 0) {
      console.warn("[parseDistrictsFile] No rows found in file");
      return [];
    }

    const headers = Object.keys(rows[0]);
    const firstRow = rows[0];

    // Log comprehensive diagnostics
    logColumnDiagnostics("parseDistrictsFile", headers, firstRow, DISTRICT_COLUMN_MAPPINGS);

    const districtRows: DistrictRow[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowLookup = buildColumnLookup(row);
      
      // Get state code - try multiple column names
      let stateCode = String(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.state_code) || "").trim();
      
      // If we got a full state name, convert to abbreviation
      if (stateCode && stateCode.length > 2) {
        const abbr = getStateAbbreviation(stateCode);
        if (abbr && abbr !== stateCode) {
          stateCode = abbr;
        }
      }

      // Get CD code and normalize to 3-digit format (e.g., "MI-14" → "MI-014")
      let cdCode = String(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.cd_code) || "").trim();

      // Normalize cd_code to 3-digit district number format
      if (cdCode && cdCode.includes("-")) {
        const [state, district] = cdCode.split("-");
        const districtNum = parseInt(district, 10);
        if (!isNaN(districtNum)) {
          cdCode = `${state}-${String(districtNum).padStart(3, "0")}`;
        }
      }

      if (!stateCode || !cdCode) {
        if (i === 0) {
          console.warn("[parseDistrictsFile] Row 0: Missing state code or CD code:", { stateCode, cdCode });
        }
        continue;
      }

      // Validate state code exists in our mapping
      if (!(stateCode in STATE_ABBREVIATIONS)) {
        console.warn(`[parseDistrictsFile] Unknown state code: ${stateCode}`);
        continue;
      }

      // Parse all columns using normalized matching
      const muslimVoters = parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.muslim_voters));
      const muslimRegistered = parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.muslim_registered));
      const muslimUnregistered = parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.muslim_unregistered));
      const voted2024 = parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.voted_2024));
      const didntVote2024 = parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.didnt_vote_2024));

      // DEBUG: Log first few rows
      if (i < 3) {
        console.log(`[parseDistrictsFile] Row ${i} (${cdCode}): muslim_voters=${muslimVoters}, registered=${muslimRegistered}`);
      }

      // Parse candidate names and party affiliations
      const winnerName = parseString(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.winner));
      const runnerUpName = parseString(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.runner_up));

      // Try explicit party columns first, then extract from candidate names
      let winnerParty = normalizePartyValue(parseString(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.party)));
      if (!winnerParty && winnerName) {
        winnerParty = extractPartyFromName(winnerName);
      }

      let runnerUpParty = normalizePartyValue(parseString(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.runner_up_party)));
      if (!runnerUpParty && runnerUpName) {
        runnerUpParty = extractPartyFromName(runnerUpName);
      }

      // Debug log party extraction for first few rows
      if (i < 3) {
        console.log(`[parseDistrictsFile] Row ${i} party debug: winner="${winnerName}" party="${winnerParty}", runner="${runnerUpName}" party="${runnerUpParty}"`);
      }

      districtRows.push({
        cd_code: cdCode,
        state_code: stateCode,
        district_num: parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.district)),
        winner: winnerName,
        winner_party: winnerParty,
        winner_votes: parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.votes)) || null,
        runner_up: runnerUpName,
        runner_up_party: runnerUpParty,
        runner_up_votes: parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.runner_up_votes)) || null,
        margin_votes: parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.margin_votes)) || null,
        margin_pct: parsePercent(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.margin_pct)) || null,
        total_votes: parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.total_votes)) || null,
        muslim_voters: muslimVoters,
        muslim_registered: muslimRegistered,
        muslim_unregistered: muslimUnregistered,
        voted_2024: voted2024,
        didnt_vote_2024: didntVote2024,
        turnout_pct: parsePercent(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.turnout_pct)),
        can_impact: parseBoolean(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.can_impact)),
        votes_needed: parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.votes_needed)) || null,
        cost_estimate: parseNumber(getColWithLookup(row, rowLookup, ...DISTRICT_COLUMN_MAPPINGS.cost_estimate)) || null,
      });
    }

    console.log(`[parseDistrictsFile] Parsed ${districtRows.length} district rows`);
    
    // Summary of parsed data
    const withVoters = districtRows.filter(r => r.muslim_voters > 0).length;
    const withMargin = districtRows.filter(r => r.margin_votes && r.margin_votes > 0).length;
    
    if (withVoters === 0 && districtRows.length > 0) {
      console.error("[parseDistrictsFile] ⚠️ WARNING: All districts have 0 muslim_voters - check column mapping!");
    } else {
      console.log(`[parseDistrictsFile] Districts with muslim_voters > 0: ${withVoters}/${districtRows.length}`);
    }
    console.log(`[parseDistrictsFile] Districts with margin_votes > 0: ${withMargin}/${districtRows.length}`);

    return districtRows;
  }, []);

  // Import states data
  const importStates = useCallback(async () => {
    if (!statesImport.file) return;

    setStatesImport((prev) => ({
      ...prev,
      status: "parsing",
      progress: 0,
      message: "Parsing Excel file...",
      errors: [],
    }));

    try {
      const rows = await parseStatesFile(statesImport.file);
      
      if (rows.length === 0) {
        throw new Error("No valid state data found in file");
      }

      setStatesImport((prev) => ({
        ...prev,
        status: "importing",
        progress: 10,
        message: `Importing ${rows.length} states...`,
        rowsTotal: rows.length,
      }));

      // Batch insert in groups of 50
      const batchSize = 50;
      let processed = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from("voter_impact_states" as never)
          .upsert(batch as never[], { onConflict: "state_code" });

        if (error) {
          console.error("[importStates] Upsert error:", {
            batch: Math.floor(i / batchSize) + 1,
            error,
            sampleRow: batch[0],
          });

          const details = [
            (error as any)?.code,
            (error as any)?.message,
            (error as any)?.details,
            (error as any)?.hint,
          ]
            .filter(Boolean)
            .join(" | ");

          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${details || error.message}`);
        } else {
          processed += batch.length;
        }

        const progress = 10 + Math.round((processed / rows.length) * 90);
        setStatesImport((prev) => ({
          ...prev,
          progress,
          rowsProcessed: processed,
          message: `Imported ${processed} of ${rows.length} states...`,
        }));
      }

      if (errors.length > 0) {
        setStatesImport((prev) => ({
          ...prev,
          status: "error",
          progress: 100,
          message: `Completed with ${errors.length} errors`,
          errors,
        }));
        toast.error(`Import completed with ${errors.length} errors`);
      } else {
        setStatesImport((prev) => ({
          ...prev,
          status: "success",
          progress: 100,
          message: `Successfully imported ${processed} states`,
        }));
        toast.success(`Imported ${processed} states`);
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: voterImpactKeys.all });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatesImport((prev) => ({
        ...prev,
        status: "error",
        progress: 0,
        message,
        errors: [message],
      }));
      toast.error(`Import failed: ${message}`);
    }
  }, [statesImport.file, parseStatesFile, queryClient]);

  // Import districts data
  const importDistricts = useCallback(async () => {
    if (!districtsImport.file) return;

    setDistrictsImport((prev) => ({
      ...prev,
      status: "parsing",
      progress: 0,
      message: "Parsing Excel file...",
      errors: [],
    }));

    try {
      const rows = await parseDistrictsFile(districtsImport.file);
      
      if (rows.length === 0) {
        throw new Error("No valid district data found in file");
      }

      setDistrictsImport((prev) => ({
        ...prev,
        status: "importing",
        progress: 5,
        message: "Checking for missing states...",
        rowsTotal: rows.length,
      }));

      // Step 1: Collect unique state codes from district data
      const uniqueStateCodes = [...new Set(rows.map(r => r.state_code))];

      // Step 2: Check which states are missing from voter_impact_states
      const { data: existingStates } = await supabase
        .from("voter_impact_states" as never)
        .select("state_code");

      const existingCodes = new Set((existingStates as { state_code: string }[] || []).map(s => s.state_code));
      const missingCodes = uniqueStateCodes.filter(code => !existingCodes.has(code));

      // Step 3: Insert placeholder records for missing states
      if (missingCodes.length > 0) {
        console.log(`Auto-creating placeholder states for: ${missingCodes.join(", ")}`);
        
        const placeholderStates = missingCodes.map(code => ({
          state_code: code,
          state_name: getStateName(code),
          muslim_voters: 0,
          households: 0,
          cell_phones: 0,
          registered: 0,
          registered_pct: 0,
          vote_2024: 0,
          vote_2024_pct: 0,
          vote_2022: 0,
          vote_2022_pct: 0,
          political_donors: 0,
          political_activists: 0,
        }));
        
        const { error: stateError } = await supabase
          .from("voter_impact_states" as never)
          .upsert(placeholderStates as never[], { onConflict: "state_code" });
        
        if (stateError) {
          console.error("[importDistricts] Error creating placeholder states:", {
            stateError,
            placeholderSample: placeholderStates[0],
          });
        } else {
          console.log(`Created ${missingCodes.length} placeholder state records`);
        }
      }

      setDistrictsImport((prev) => ({
        ...prev,
        progress: 10,
        message: `Importing ${rows.length} districts...`,
      }));

      // Batch insert in groups of 50
      const batchSize = 50;
      let processed = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from("voter_impact_districts" as never)
          .upsert(batch as never[], { onConflict: "cd_code" });

        if (error) {
          console.error("[importDistricts] Upsert error:", {
            batch: Math.floor(i / batchSize) + 1,
            error,
            sampleRow: batch[0],
          });

          const details = [
            (error as any)?.code,
            (error as any)?.message,
            (error as any)?.details,
            (error as any)?.hint,
          ]
            .filter(Boolean)
            .join(" | ");

          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${details || error.message}`);
        } else {
          processed += batch.length;
        }

        const progress = 10 + Math.round((processed / rows.length) * 90);
        setDistrictsImport((prev) => ({
          ...prev,
          progress,
          rowsProcessed: processed,
          message: `Imported ${processed} of ${rows.length} districts...`,
        }));
      }

      if (errors.length > 0) {
        setDistrictsImport((prev) => ({
          ...prev,
          status: "error",
          progress: 100,
          message: `Completed with ${errors.length} errors`,
          errors,
        }));
        toast.error(`Import completed with ${errors.length} errors`);
      } else {
        setDistrictsImport((prev) => ({
          ...prev,
          status: "success",
          progress: 100,
          message: `Successfully imported ${processed} districts`,
        }));
        toast.success(`Imported ${processed} districts`);
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: voterImpactKeys.all });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setDistrictsImport((prev) => ({
        ...prev,
        status: "error",
        progress: 0,
        message,
        errors: [message],
      }));
      toast.error(`Import failed: ${message}`);
    }
  }, [districtsImport.file, parseDistrictsFile, queryClient]);

  // File change handlers
  const handleStatesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStatesImport((prev) => ({
        ...prev,
        file,
        status: "idle",
        progress: 0,
        message: "",
        errors: [],
      }));
    }
  };

  const handleDistrictsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDistrictsImport((prev) => ({
        ...prev,
        file,
        status: "idle",
        progress: 0,
        message: "",
        errors: [],
      }));
    }
  };

  const clearStatesFile = () => {
    setStatesImport({
      file: null,
      status: "idle",
      progress: 0,
      message: "",
      rowsProcessed: 0,
      rowsTotal: 0,
      errors: [],
    });
  };

  const clearDistrictsFile = () => {
    setDistrictsImport({
      file: null,
      status: "idle",
      progress: 0,
      message: "",
      rowsProcessed: 0,
      rowsTotal: 0,
      errors: [],
    });
  };

  const getStatusBadge = (status: ImportState["status"]) => {
    switch (status) {
      case "parsing":
      case "importing":
        return <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing</Badge>;
      case "success":
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />Success</Badge>;
      case "error":
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Voter Impact Data Import</h2>
          <p className="text-muted-foreground">
            Import voter impact data from Excel files into the database
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Import Order</AlertTitle>
        <AlertDescription>
          Import states data <strong>first</strong>, then districts. Districts have a foreign key dependency on states.
        </AlertDescription>
      </Alert>

      {/* Clear Data Card - for re-importing with correct format */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Re-Import Data (Format Fix)
          </CardTitle>
          <CardDescription>
            If districts show 0 voters, the data format may be incorrect. Clear existing data and re-import to fix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={clearAllData}
            disabled={clearStatus === "clearing"}
            className="border-amber-500/50 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            {clearStatus === "clearing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : clearStatus === "success" ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                Cleared! Now re-import.
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Data & Re-Import
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* States Import Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  States Data
                </CardTitle>
                <CardDescription>
                  Import National_Analysis.xlsx → voter_impact_states
                </CardDescription>
              </div>
              {getStatusBadge(statesImport.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {statesImport.file ? (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {statesImport.file.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearStatesFile}
                  disabled={statesImport.status === "parsing" || statesImport.status === "importing"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Click to select National_Analysis.xlsx
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleStatesFileChange}
                  className="hidden"
                />
              </label>
            )}

            {(statesImport.status === "parsing" || statesImport.status === "importing") && (
              <div className="space-y-2">
                <Progress value={statesImport.progress} className="h-2" />
                <p className="text-sm text-muted-foreground">{statesImport.message}</p>
              </div>
            )}

            {statesImport.status === "success" && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {statesImport.message}
                </AlertDescription>
              </Alert>
            )}

            {statesImport.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm">
                    {statesImport.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {statesImport.errors.length > 5 && (
                      <li>...and {statesImport.errors.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={importStates}
              disabled={
                !statesImport.file ||
                statesImport.status === "parsing" ||
                statesImport.status === "importing"
              }
              className="w-full"
            >
              {statesImport.status === "parsing" || statesImport.status === "importing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import States
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Districts Import Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Districts Data
                </CardTitle>
                <CardDescription>
                  Import CD_GOTV_ANALYSIS.xlsx → voter_impact_districts
                </CardDescription>
              </div>
              {getStatusBadge(districtsImport.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {districtsImport.file ? (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {districtsImport.file.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearDistrictsFile}
                  disabled={districtsImport.status === "parsing" || districtsImport.status === "importing"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Click to select CD_GOTV_ANALYSIS.xlsx
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleDistrictsFileChange}
                  className="hidden"
                />
              </label>
            )}

            {(districtsImport.status === "parsing" || districtsImport.status === "importing") && (
              <div className="space-y-2">
                <Progress value={districtsImport.progress} className="h-2" />
                <p className="text-sm text-muted-foreground">{districtsImport.message}</p>
              </div>
            )}

            {districtsImport.status === "success" && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {districtsImport.message}
                </AlertDescription>
              </Alert>
            )}

            {districtsImport.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm">
                    {districtsImport.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {districtsImport.errors.length > 5 && (
                      <li>...and {districtsImport.errors.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={importDistricts}
              disabled={
                !districtsImport.file ||
                districtsImport.status === "parsing" ||
                districtsImport.status === "importing"
              }
              className="w-full"
            >
              {districtsImport.status === "parsing" || districtsImport.status === "importing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Districts
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
