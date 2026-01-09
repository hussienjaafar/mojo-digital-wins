import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client for session termination
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user client to verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { user_id, reason } = await req.json();
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-termination
    if (user_id === caller.id) {
      return new Response(
        JSON.stringify({ error: "Cannot terminate your own sessions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${caller.email} terminating sessions for user ${user_id}`);

    // Use Supabase Admin API to sign out user from all sessions
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(user_id, "global");
    
    if (signOutError) {
      console.error("Error signing out user:", signOutError);
      throw signOutError;
    }

    // Update profile to mark session revocation time
    await supabaseAdmin
      .from("profiles")
      .update({ session_revoked_at: new Date().toISOString() })
      .eq("id", user_id);

    // Log the revocation
    const { error: logError } = await supabaseAdmin
      .from("session_revocation_log")
      .insert({
        user_id,
        revoked_by: caller.id,
        reason: reason || "Admin initiated session termination",
        sessions_terminated: 1, // API doesn't return count
      });

    if (logError) {
      console.error("Error logging revocation:", logError);
    }

    // Also log to audit logs
    await supabaseAdmin.from("admin_audit_logs").insert({
      user_id: caller.id,
      action_type: "session_terminated",
      record_id: user_id,
      table_affected: "auth.sessions",
      new_value: { reason, terminated_at: new Date().toISOString() },
    });

    console.log(`Successfully terminated all sessions for user ${user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "All user sessions have been terminated",
        user_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error terminating sessions:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to terminate sessions" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
