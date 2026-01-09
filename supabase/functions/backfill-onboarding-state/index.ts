import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BackfillResult {
  total_organizations: number;
  already_tracked: number;
  newly_created: number;
  inferred_completed: number;
  inferred_in_progress: number;
  inferred_not_started: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: BackfillResult = {
      total_organizations: 0,
      already_tracked: 0,
      newly_created: 0,
      inferred_completed: 0,
      inferred_in_progress: 0,
      inferred_not_started: 0,
      errors: [],
    };

    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from("client_organizations")
      .select("id, name, is_active, created_at");

    if (orgError) {
      throw new Error(`Failed to fetch organizations: ${orgError.message}`);
    }

    result.total_organizations = organizations?.length || 0;

    // Get existing onboarding states
    const { data: existingStates, error: stateError } = await supabase
      .from("org_onboarding_state")
      .select("organization_id");

    if (stateError) {
      throw new Error(`Failed to fetch existing states: ${stateError.message}`);
    }

    const existingOrgIds = new Set(existingStates?.map(s => s.organization_id) || []);

    for (const org of organizations || []) {
      // Skip if already has onboarding state
      if (existingOrgIds.has(org.id)) {
        result.already_tracked++;
        continue;
      }

      try {
        // Get user count for this org
        const { count: userCount } = await supabase
          .from("client_users")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id);

        // Get integration count for this org
        const { count: integrationCount } = await supabase
          .from("client_api_credentials")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("is_active", true);

        // Get watchlist count for this org
        const { count: watchlistCount } = await supabase
          .from("entity_watchlist")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id);

        // Infer completion state based on existing data
        const hasUsers = (userCount || 0) > 0;
        const hasIntegrations = (integrationCount || 0) > 0;
        const hasWatchlists = (watchlistCount || 0) > 0;

        let currentStep = 1;
        let completedSteps: number[] = [];
        let status = "not_started";

        // Step 1 (Create Org) - always complete if org exists
        completedSteps.push(1);
        currentStep = 2;

        // Step 2 (Profile) - assume complete if org has name
        if (org.name && org.name.length > 0) {
          completedSteps.push(2);
          currentStep = 3;
        }

        // Step 3 (Users) - complete if has users
        if (hasUsers) {
          completedSteps.push(3);
          currentStep = 4;
        }

        // Step 4 (Integrations) - complete if has integrations
        if (hasIntegrations) {
          completedSteps.push(4);
          currentStep = 5;
        }

        // Step 5 (Watchlists) - complete if has watchlists
        if (hasWatchlists) {
          completedSteps.push(5);
          currentStep = 6;
        }

        // Step 6 (Activate) - complete if org is active AND has meaningful data
        if (org.is_active && (hasUsers || hasIntegrations)) {
          completedSteps.push(6);
          status = "completed";
          result.inferred_completed++;
        } else if (completedSteps.length > 1) {
          status = "in_progress";
          result.inferred_in_progress++;
        } else {
          status = "not_started";
          result.inferred_not_started++;
        }

        // Create the onboarding state record
        const { error: insertError } = await supabase
          .from("org_onboarding_state")
          .insert({
            organization_id: org.id,
            current_step: currentStep,
            completed_steps: completedSteps,
            status: status,
            step_data: {
              backfilled: true,
              backfill_date: new Date().toISOString(),
              inferred_from: {
                users: userCount || 0,
                integrations: integrationCount || 0,
                watchlists: watchlistCount || 0,
              },
            },
          });

        if (insertError) {
          result.errors.push(`Org ${org.name}: ${insertError.message}`);
        } else {
          result.newly_created++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Org ${org.name}: ${message}`);
      }
    }

    console.log("Backfill complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
