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
import { STATE_ABBREVIATIONS, getStateAbbreviation } from "@/lib/us-states";
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

    const stateRows: StateRow[] = [];
    
    for (const row of rows) {
      const stateName = String(row["State"] || "").trim();
      
      // Skip "NATIONAL" summary row
      if (!stateName || stateName.toUpperCase() === "NATIONAL") continue;

      // Get state code from name
      const stateCode = getStateAbbreviation(stateName);
      if (!stateCode || stateCode === stateName) {
        console.warn(`Unknown state: ${stateName}`);
        continue;
      }

      stateRows.push({
        state_code: stateCode,
        state_name: stateName,
        muslim_voters: parseNumber(row["Muslim Voters"]),
        households: parseNumber(row["Households"]),
        cell_phones: parseNumber(row["Cell Phones"]),
        registered: parseNumber(row["Registered"]),
        registered_pct: parsePercent(row["Registered %"]),
        vote_2024: parseNumber(row["Vote 2024"]),
        vote_2024_pct: parsePercent(row["Vote 2024 %"]),
        vote_2022: parseNumber(row["Vote 2022"]),
        vote_2022_pct: parsePercent(row["Vote 2022 %"]),
        political_donors: parseNumber(row["Political Donors"]),
        political_activists: parseNumber(row["Political Activists"]),
      });
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

    const districtRows: DistrictRow[] = [];
    
    for (const row of rows) {
      // Get state code - try multiple column names
      let stateCode = String(row["State Code"] || row["State_Code"] || "").trim();
      
      // If state code is empty but we have state name, convert it
      if (!stateCode && row["State"]) {
        const stateName = String(row["State"]).trim();
        const abbr = getStateAbbreviation(stateName);
        if (abbr && abbr !== stateName) {
          stateCode = abbr;
        }
      }

      // Get CD code
      const cdCode = String(row["CD_CODE"] || row["CD CODE"] || "").trim();
      
      if (!stateCode || !cdCode) continue;

      // Validate state code exists in our mapping
      if (!(stateCode in STATE_ABBREVIATIONS)) {
        console.warn(`Unknown state code: ${stateCode}`);
        continue;
      }

      districtRows.push({
        cd_code: cdCode,
        state_code: stateCode,
        district_num: parseNumber(row["District"]),
        winner: parseString(row["WINNER"]),
        winner_party: parseString(row["Party"]),
        winner_votes: parseNumber(row["Votes"]) || null,
        runner_up: parseString(row["Runner-Up"]),
        runner_up_party: parseString(row["Runner-Up Party"]),
        runner_up_votes: parseNumber(row["Runner-Up Votes"]) || null,
        margin_votes: parseNumber(row["Margin (Votes)"]) || null,
        margin_pct: parsePercent(row["Margin (%)"]) || null,
        total_votes: parseNumber(row["Total Votes"]) || null,
        muslim_voters: parseNumber(row["MUSLIM"]),
        muslim_registered: parseNumber(row["MUS-REG"]),
        muslim_unregistered: parseNumber(row["MUS-UNREG"]),
        voted_2024: parseNumber(row["MUS_VOTED24"]),
        didnt_vote_2024: parseNumber(row["MUS_DIDN'TVOTE24"]),
        turnout_pct: parsePercent(row["NEWREG_TURNOUT"]),
        can_impact: parseBoolean(row["CAN IMPACT"]),
        votes_needed: parseNumber(row["ADD MUSLIM VOTES NEEDED"]) || null,
        cost_estimate: parseNumber(row["COST (~ $70 PER VOTE)"]) || null,
      });
    }

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
        progress: 10,
        message: `Importing ${rows.length} districts...`,
        rowsTotal: rows.length,
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
