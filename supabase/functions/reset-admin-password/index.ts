import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";
import { sendEmail, EmailError, isEmailConfigured } from "../_shared/email.ts";
import { transactional } from "../_shared/email-templates/index.ts";

interface ResetPasswordRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - No auth header", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller
    const { data: { user: caller }, error: callerError } = await supabaseUser.auth.getUser();
    if (callerError || !caller) {
      console.error("Error getting caller:", callerError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Caller: ${caller.id} (${caller.email})`);

    // Check if caller is a system admin
    const { data: isCallerAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });

    if (roleError) {
      console.error("Error checking caller role:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isCallerAdmin) {
      console.error("Caller is not an admin");
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { user_id }: ResetPasswordRequest = await req.json();
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${caller.email} requesting password reset for user ${user_id}`);

    // Check if target user is also an admin
    const { data: isTargetAdmin, error: targetRoleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: user_id,
      _role: "admin",
    });

    if (targetRoleError) {
      console.error("Error checking target role:", targetRoleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify target user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isTargetAdmin) {
      console.error("Target user is not an admin - use reset-client-password instead");
      return new Response(
        JSON.stringify({ error: "Target user is not a platform admin. Use reset-client-password for client users." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user details
    const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    if (targetUserError || !targetUser?.user) {
      console.error("Error getting target user:", targetUserError);
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetEmail = targetUser.user.email;
    if (!targetEmail) {
      return new Response(
        JSON.stringify({ error: "Target user has no email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating password reset link for ${targetEmail}`);

    // Generate password reset link
    const siteUrl = Deno.env.get("APP_URL") || "https://mojo-digital-wins.lovable.app";
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: targetEmail,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Error generating reset link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate password reset link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = linkData.properties.action_link;
    console.log("Reset link generated successfully");

    // Build email HTML using template
    const emailHtml = transactional.passwordReset({
      resetUrl: resetLink,
      email: targetEmail,
      expiresIn: '1 hour',
    });

    // Check if email is configured
    if (!isEmailConfigured()) {
      console.error("Email not configured - SENDER_EMAIL and RESEND_API_KEY required");

      // Log the action with email not configured
      await supabaseAdmin.from("admin_audit_logs").insert({
        user_id: caller.id,
        action_type: "admin_password_reset",
        record_id: user_id,
        new_value: { target_email: targetEmail, email_sent: false, reason: "email_not_configured" },
      });

      // Return error status - do NOT return success when email can't be sent
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please set SENDER_EMAIL and RESEND_API_KEY.",
          error_code: "EMAIL_NOT_CONFIGURED",
          reset_link: resetLink,  // Provide link for manual sending
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via shared utility (throws on failure)
    try {
      const emailResult = await sendEmail({
        to: targetEmail,
        subject: "Password Reset Request - Admin Account",
        html: emailHtml,
        fromName: "Admin System",
      });

      console.log("Password reset email sent successfully");

      // Log the action
      await supabaseAdmin.from("admin_audit_logs").insert({
        user_id: caller.id,
        action_type: "admin_password_reset",
        record_id: user_id,
        new_value: { target_email: targetEmail, email_sent: true, message_id: emailResult.messageId },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Password reset email sent to ${targetEmail}`,
          email_sent: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailError) {
      console.error("Email sending failed:", emailError);

      // Log the failure
      await supabaseAdmin.from("admin_audit_logs").insert({
        user_id: caller.id,
        action_type: "admin_password_reset",
        record_id: user_id,
        new_value: {
          target_email: targetEmail,
          email_sent: false,
          error: emailError instanceof EmailError ? emailError.code : "unknown"
        },
      });

      // Return proper error - do NOT return success when email failed
      const errorMessage = emailError instanceof EmailError
        ? emailError.message
        : "Failed to send email";
      const errorCode = emailError instanceof EmailError
        ? emailError.code
        : "EMAIL_SEND_FAILED";
      const statusCode = emailError instanceof EmailError
        ? emailError.statusCode
        : 502;

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          error_code: errorCode,
          reset_link: resetLink,  // Provide link for manual sending as fallback
        }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
