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
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";
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

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "-" || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  return parseFloat(cleaned) || 0;
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

  // Parse states Excel file
  const parseStatesFile = useCallback(async (file: File): Promise<StateRow[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    // DEBUG: Log the actual column names from the Excel file
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      console.log("[parseStatesFile] Found columns:", headers);
      console.log("[parseStatesFile] First row data:", JSON.stringify(rows[0], null, 2));
    }

    const stateRows: StateRow[] = [];
    
    // Helper to find column value with flexible name matching
    const getCol = (row: Record<string, unknown>, ...names: string[]): unknown => {
      for (const name of names) {
        if (row[name] !== undefined) return row[name];
        // Try case-insensitive match
        const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
        if (key) return row[key];
      }
      return undefined;
    };
    
    for (const row of rows) {
      const rawState = String(getCol(row, "State", "STATE") || "").trim();
      
      // Skip "NATIONAL" summary row
      if (!rawState || rawState.toUpperCase() === "NATIONAL") continue;

      let stateCode: string;
      let stateName: string;

      // Check if the value is already a 2-letter abbreviation
      if (rawState.length === 2 && isValidStateAbbreviation(rawState)) {
        // It's already an abbreviation, get the full name
        stateCode = rawState.toUpperCase();
        stateName = getStateName(stateCode);
      } else {
        // Assume it's a full state name
        const abbr = getStateAbbreviation(rawState);
        if (abbr === rawState) {
          console.warn(`Unknown state: ${rawState}`);
          continue;
        }
        stateCode = abbr;
        stateName = rawState;
      }

      // Use flexible column matching with multiple possible names
      const muslimVoters = parseNumber(getCol(row, "Muslim Voters", "MUSLIM VOTERS", "Muslim_Voters", "MuslimVoters"));
      
      // DEBUG: Log if we found muslim voters for this state
      if (stateCode === "CO" || stateCode === "MN" || stateCode === "NJ") {
        console.log(`[parseStatesFile] ${stateCode} - muslim_voters: ${muslimVoters}, raw value:`, getCol(row, "Muslim Voters", "MUSLIM VOTERS"));
      }

      stateRows.push({
        state_code: stateCode,
        state_name: stateName,
        muslim_voters: muslimVoters,
        households: parseNumber(getCol(row, "Households", "HOUSEHOLDS")),
        cell_phones: parseNumber(getCol(row, "Cell Phones", "CELL PHONES", "Cell_Phones")),
        registered: parseNumber(getCol(row, "Registered", "REGISTERED")),
        registered_pct: parsePercent(getCol(row, "Registered %", "REGISTERED %", "Registered%")),
        vote_2024: parseNumber(getCol(row, "Vote 2024", "VOTE 2024", "Vote_2024")),
        vote_2024_pct: parsePercent(getCol(row, "Vote 2024 %", "VOTE 2024 %", "Vote_2024%")),
        vote_2022: parseNumber(getCol(row, "Vote 2022", "VOTE 2022", "Vote_2022")),
        vote_2022_pct: parsePercent(getCol(row, "Vote 2022 %", "VOTE 2022 %", "Vote_2022%")),
        political_donors: parseNumber(getCol(row, "Political Donors", "POLITICAL DONORS")),
        political_activists: parseNumber(getCol(row, "Political Activists", "POLITICAL ACTIVISTS")),
      });
    }

    console.log(`[parseStatesFile] Parsed ${stateRows.length} state rows`);
    return stateRows;
  }, []);

  // Parse districts Excel file
  const parseDistrictsFile = useCallback(async (file: File): Promise<DistrictRow[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    // DEBUG: Log the actual column names from the Excel file
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      console.log("[parseDistrictsFile] Found columns:", headers);
      console.log("[parseDistrictsFile] First row data:", JSON.stringify(rows[0], null, 2));
    }

    // Helper to find column value with flexible name matching
    const getCol = (row: Record<string, unknown>, ...names: string[]): unknown => {
      for (const name of names) {
        if (row[name] !== undefined) return row[name];
        // Try case-insensitive match
        const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
        if (key) return row[key];
      }
      return undefined;
    };

    const districtRows: DistrictRow[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Get state code - try multiple column names
      let stateCode = String(getCol(row, "State Code", "State_Code", "STATE CODE", "STATE_CODE") || "").trim();
      
      // If state code is empty but we have state name, convert it
      if (!stateCode) {
        const stateName = String(getCol(row, "State", "STATE") || "").trim();
        if (stateName) {
          const abbr = getStateAbbreviation(stateName);
          if (abbr && abbr !== stateName) {
            stateCode = abbr;
          }
        }
      }

      // Get CD code - try multiple variations
      const cdCode = String(getCol(row, "CD_CODE", "CD CODE", "CD_Code", "CDCODE") || "").trim();
      
      if (!stateCode || !cdCode) {
        if (i === 0) {
          console.warn("[parseDistrictsFile] Row 0: Missing state code or CD code:", { stateCode, cdCode, row });
        }
        continue;
      }

      // Validate state code exists in our mapping
      if (!(stateCode in STATE_ABBREVIATIONS)) {
        console.warn(`Unknown state code: ${stateCode}`);
        continue;
      }

      // Flexible column matching for Muslim voter data
      const muslimVoters = parseNumber(getCol(row, "MUSLIM", "Muslim", "muslim_voters", "Muslim Voters", "MUSLIMVOTERS"));
      const muslimRegistered = parseNumber(getCol(row, "MUS-REG", "MUS_REG", "Muslim Registered", "MUSLIM_REGISTERED"));
      const muslimUnregistered = parseNumber(getCol(row, "MUS-UNREG", "MUS_UNREG", "Muslim Unregistered", "MUSLIM_UNREGISTERED"));
      const voted2024 = parseNumber(getCol(row, "MUS_VOTED24", "MUS-VOTED24", "Muslim Voted 2024", "VOTED_2024"));
      const didntVote2024 = parseNumber(getCol(row, "MUS_DIDN'TVOTE24", "MUS_DIDNTVOTE24", "MUS_DIDNT_VOTE24", "Didn't Vote 2024", "DIDNT_VOTE_2024"));

      // DEBUG: Log first few rows and any with unexpected 0 values
      if (i < 3 || (muslimVoters === 0 && i < 20)) {
        console.log(`[parseDistrictsFile] Row ${i} (${cdCode}): muslim_voters=${muslimVoters}, raw MUSLIM value:`, getCol(row, "MUSLIM", "Muslim"));
      }

      districtRows.push({
        cd_code: cdCode,
        state_code: stateCode,
        district_num: parseNumber(getCol(row, "District", "DISTRICT", "District_Num")),
        winner: parseString(getCol(row, "WINNER", "Winner")),
        winner_party: parseString(getCol(row, "Party", "PARTY", "Winner Party")),
        winner_votes: parseNumber(getCol(row, "Votes", "VOTES", "Winner Votes")) || null,
        runner_up: parseString(getCol(row, "Runner-Up", "RUNNER-UP", "Runner Up")),
        runner_up_party: parseString(getCol(row, "Runner-Up Party", "RUNNER-UP PARTY")),
        runner_up_votes: parseNumber(getCol(row, "Runner-Up Votes", "RUNNER-UP VOTES")) || null,
        margin_votes: parseNumber(getCol(row, "Margin (Votes)", "MARGIN (VOTES)", "Margin_Votes")) || null,
        margin_pct: parsePercent(getCol(row, "Margin (%)", "MARGIN (%)", "Margin_Pct")) || null,
        total_votes: parseNumber(getCol(row, "Total Votes", "TOTAL VOTES", "Total_Votes")) || null,
        muslim_voters: muslimVoters,
        muslim_registered: muslimRegistered,
        muslim_unregistered: muslimUnregistered,
        voted_2024: voted2024,
        didnt_vote_2024: didntVote2024,
        turnout_pct: parsePercent(getCol(row, "NEWREG_TURNOUT", "Turnout", "TURNOUT", "Turnout_Pct")),
        can_impact: parseBoolean(getCol(row, "CAN IMPACT", "CAN_IMPACT", "Can Impact")),
        votes_needed: parseNumber(getCol(row, "ADD MUSLIM VOTES NEEDED", "Votes Needed", "VOTES_NEEDED")) || null,
        cost_estimate: parseNumber(getCol(row, "COST (~ $70 PER VOTE)", "Cost Estimate", "COST_ESTIMATE")) || null,
      });
    }

    console.log(`[parseDistrictsFile] Parsed ${districtRows.length} district rows`);
    
    // Summary of parsed data
    const withVoters = districtRows.filter(r => r.muslim_voters > 0).length;
    const withMargin = districtRows.filter(r => r.margin_votes && r.margin_votes > 0).length;
    console.log(`[parseDistrictsFile] Districts with muslim_voters > 0: ${withVoters}/${districtRows.length}`);
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
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
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
          console.error("Error creating placeholder states:", stateError);
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
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
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
