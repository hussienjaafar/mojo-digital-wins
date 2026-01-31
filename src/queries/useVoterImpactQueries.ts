import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { voterImpactKeys } from "./queryKeys";

// ============================================================================
// Types
// ============================================================================

export interface VoterImpactState {
  id: string;
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

export interface VoterImpactDistrict {
  id: string;
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
// Constants
// ============================================================================

// Data doesn't change often - 10 minute stale time
const STALE_TIME = 10 * 60 * 1000; // 10 minutes
const GC_TIME = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchVoterImpactStates(): Promise<VoterImpactState[]> {
  console.log("[DEBUG] Fetching voter impact states...");
  // Using .from() with explicit type annotation since tables may not be in generated types yet
  const { data, error } = await supabase
    .from("voter_impact_states" as any)
    .select("*")
    .order("state_name", { ascending: true });

  if (error) {
    console.error("[useVoterImpactQueries] Error fetching states:", error);
    throw error;
  }

  console.log("[DEBUG] Fetched states:", data?.length || 0, "rows", data?.slice(0, 3));
  return (data || []) as unknown as VoterImpactState[];
}

async function fetchVoterImpactDistricts(): Promise<VoterImpactDistrict[]> {
  console.log("[DEBUG] Fetching voter impact districts...");
  // Using .from() with explicit type annotation since tables may not be in generated types yet
  const { data, error } = await supabase
    .from("voter_impact_districts" as any)
    .select("*")
    .order("cd_code", { ascending: true });

  if (error) {
    console.error("[useVoterImpactQueries] Error fetching districts:", error);
    throw error;
  }

  console.log("[DEBUG] Fetched districts:", data?.length || 0, "rows", data?.slice(0, 3));
  return (data || []) as unknown as VoterImpactDistrict[];
}

async function fetchDistrictsByState(stateCode: string): Promise<VoterImpactDistrict[]> {
  // Using .from() with explicit type annotation since tables may not be in generated types yet
  const { data, error } = await supabase
    .from("voter_impact_districts" as any)
    .select("*")
    .eq("state_code", stateCode)
    .order("cd_code", { ascending: true });

  if (error) {
    console.error("[useVoterImpactQueries] Error fetching districts by state:", error);
    throw error;
  }

  return (data || []) as unknown as VoterImpactDistrict[];
}

async function fetchVoterImpactDistrict(cdCode: string): Promise<VoterImpactDistrict | null> {
  // Using .from() with explicit type annotation since tables may not be in generated types yet
  const { data, error } = await supabase
    .from("voter_impact_districts" as any)
    .select("*")
    .eq("cd_code", cdCode)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("[useVoterImpactQueries] Error fetching district:", error);
    throw error;
  }

  return data as unknown as VoterImpactDistrict;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all states ordered by state_name
 */
export function useVoterImpactStates() {
  return useQuery({
    queryKey: voterImpactKeys.states(),
    queryFn: fetchVoterImpactStates,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Fetch all districts ordered by cd_code
 */
export function useVoterImpactDistricts() {
  return useQuery({
    queryKey: voterImpactKeys.districts(),
    queryFn: fetchVoterImpactDistricts,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Fetch districts for a specific state
 * Only enabled when stateCode is provided
 */
export function useDistrictsByState(stateCode: string | null) {
  return useQuery({
    queryKey: voterImpactKeys.districtsByState(stateCode || ""),
    queryFn: () => fetchDistrictsByState(stateCode!),
    enabled: !!stateCode,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Fetch a single district by cd_code
 * Only enabled when cdCode is provided
 */
export function useVoterImpactDistrict(cdCode: string | null) {
  return useQuery({
    queryKey: voterImpactKeys.district(cdCode || ""),
    queryFn: () => fetchVoterImpactDistrict(cdCode!),
    enabled: !!cdCode,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
