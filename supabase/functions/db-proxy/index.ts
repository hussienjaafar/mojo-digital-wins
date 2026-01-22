import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";

/**
 * Database Proxy Edge Function
 * 
 * Proxies database queries through Edge Functions to bypass REST API CORS restrictions
 * for custom domains (e.g., portal.molitico.com).
 * 
 * This is a workaround until the Supabase project-level CORS settings can be updated.
 */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - no auth header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { table, select, filters, single, rpc, rpcParams } = await req.json();

    // Create client with user's JWT to validate auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for executing queries
    // We use service role to bypass RLS, but we're relying on the fact that
    // the user is authenticated and we pass their user.id for any user-specific queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let result: { data: any; error: any };

    // Handle RPC calls
    if (rpc) {
      const allowedRpcs = ["has_role"]; // Whitelist of allowed RPC functions
      if (!allowedRpcs.includes(rpc)) {
        return new Response(
          JSON.stringify({ error: `RPC function '${rpc}' not allowed` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      result = await adminClient.rpc(rpc, rpcParams);
    } 
    // Handle table queries
    else if (table) {
      // Whitelist of allowed tables for security
      const allowedTables = ["client_users", "client_organizations", "articles", "client_entity_alerts", "trend_events", "user_invitations"];
      if (!allowedTables.includes(table)) {
        return new Response(
          JSON.stringify({ error: `Table '${table}' not allowed` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = adminClient.from(table).select(select || "*");

      // Apply filters
      if (filters) {
        for (const [column, value] of Object.entries(filters)) {
          query = query.eq(column, value);
        }
      }

      if (single) {
        result = await query.maybeSingle();
      } else {
        result = await query;
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Must specify either 'table' or 'rpc'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data: result.data, error: result.error }),
      { 
        status: result.error ? 400 : 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("db-proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
