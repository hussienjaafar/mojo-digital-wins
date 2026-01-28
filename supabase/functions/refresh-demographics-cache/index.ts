import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RefreshRequest {
  organization_id?: string;
  all_orgs?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    let body: RefreshRequest = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        // Empty body is fine for cron calls
      }
    }

    const { organization_id, all_orgs } = body;

    // Check for cron authorization
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    // If not cron, verify user has admin access
    if (!isCron && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is admin
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });

      if (!isAdmin && !organization_id) {
        return new Response(
          JSON.stringify({ error: "Admin access required for bulk refresh" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const results: {
      organization_id: string;
      name: string;
      success: boolean;
      transaction_count?: number;
      error?: string;
      duration_ms?: number;
    }[] = [];

    // Determine which orgs to refresh
    let orgsToRefresh: { id: string; name: string }[] = [];

    if (organization_id) {
      // Single org refresh
      const { data: org } = await supabase
        .from("client_organizations")
        .select("id, name")
        .eq("id", organization_id)
        .single();

      if (org) {
        orgsToRefresh = [org];
      }
    } else if (all_orgs || isCron) {
      // Refresh all orgs with stale cache or no cache
      const { data: orgs } = await supabase
        .from("client_organizations")
        .select("id, name")
        .eq("is_active", true);

      if (orgs) {
        // Filter to orgs that need refresh (stale or missing cache)
        const { data: cachedOrgs } = await supabase
          .from("donor_demographics_cache")
          .select("organization_id, is_stale, calculated_at")
          .in("organization_id", orgs.map((o) => o.id));

        const cachedOrgMap = new Map(
          (cachedOrgs || []).map((c) => [c.organization_id, c])
        );

        orgsToRefresh = orgs.filter((org) => {
          const cache = cachedOrgMap.get(org.id);
          if (!cache) return true; // No cache
          if (cache.is_stale) return true; // Marked stale
          // Check if older than 24 hours
          const cacheAge =
            Date.now() - new Date(cache.calculated_at).getTime();
          return cacheAge > 24 * 60 * 60 * 1000;
        });
      }
    }

    console.log(
      `[DEMOGRAPHICS-CACHE] Refreshing ${orgsToRefresh.length} organizations`
    );

    // Process each org
    for (const org of orgsToRefresh) {
      const startTime = Date.now();

      try {
        console.log(`[DEMOGRAPHICS-CACHE] Refreshing: ${org.name} (${org.id})`);

        const { data, error } = await supabase.rpc("refresh_demographics_cache", {
          _organization_id: org.id,
        });

        if (error) {
          throw error;
        }

        results.push({
          organization_id: org.id,
          name: org.name,
          success: true,
          transaction_count: data?.transaction_count,
          duration_ms: Date.now() - startTime,
        });

        console.log(
          `[DEMOGRAPHICS-CACHE] ✅ ${org.name}: ${data?.transaction_count} transactions in ${Date.now() - startTime}ms`
        );
      } catch (error: any) {
        console.error(
          `[DEMOGRAPHICS-CACHE] ❌ ${org.name}: ${error.message}`
        );

        results.push({
          organization_id: org.id,
          name: org.name,
          success: false,
          error: error.message,
          duration_ms: Date.now() - startTime,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(
      `[DEMOGRAPHICS-CACHE] Complete: ${successCount} success, ${failCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        refreshed: successCount,
        failed: failCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[DEMOGRAPHICS-CACHE] Error:", error.message);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
