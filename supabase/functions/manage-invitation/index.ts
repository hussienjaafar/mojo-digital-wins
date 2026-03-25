import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";

/**
 * Manage Invitation Edge Function
 * 
 * Handles invitation mutations (revoke) for portal.molitico.com
 * where direct REST API calls are blocked by CORS.
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
    const { action, invitation_id } = await req.json();

    if (!action || !invitation_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: action, invitation_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is a platform admin
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin"
    });

    // Get the invitation to check org permissions if not platform admin
    const { data: invitation, error: fetchError } = await adminClient
      .from("user_invitations")
      .select("id, organization_id, status")
      .eq("id", invitation_id)
      .single();

    if (fetchError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not platform admin, check if user is org admin for this invitation's org
    if (!isAdmin && invitation.organization_id) {
      const { data: orgMembership } = await adminClient
        .from("client_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", invitation.organization_id)
        .single();

      if (!orgMembership || orgMembership.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Forbidden - insufficient permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!isAdmin && !invitation.organization_id) {
      // Platform admin invitations can only be revoked by platform admins
      return new Response(
        JSON.stringify({ error: "Forbidden - only platform admins can revoke platform admin invitations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle actions
    if (action === "revoke") {
      if (invitation.status !== "pending") {
        return new Response(
          JSON.stringify({ error: `Cannot revoke invitation with status: ${invitation.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await adminClient
        .from("user_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation_id);

      if (updateError) {
        console.error("Error revoking invitation:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to revoke invitation", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Invitation ${invitation_id} revoked by user ${user.id}`);

      return new Response(
        JSON.stringify({ success: true, message: "Invitation revoked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("manage-invitation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
