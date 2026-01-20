import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { getCorsHeaders } from "../_shared/security.ts";
import { sendEmail, EmailError, isEmailConfigured } from "../_shared/email.ts";
import { transactional } from "../_shared/email-templates/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://mojo-digital-wins.lovable.app";

interface ResetPasswordRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and validate the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create a user-scoped client to verify the caller's identity
    const supabaseUser = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // Get the authenticated user
    const { data: { user: callerUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callerUser) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { user_id }: ResetPasswordRequest = await req.json();
    
    console.log("Initiating password reset for user:", user_id, "requested by:", callerUser.id);

    // Get target user's organization
    const { data: targetUser } = await supabaseAdmin
      .from('client_users')
      .select('organization_id')
      .eq('id', user_id)
      .single();

    // Verify the caller is authorized to reset this user's password
    const { data: callerClientUser } = await supabaseAdmin
      .from('client_users')
      .select('role, organization_id')
      .eq('id', callerUser.id)
      .single();

    // Check if caller is a system admin
    const { data: isSystemAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: callerUser.id,
      _role: 'admin'
    });

    if (!isSystemAdmin) {
      // Must be a client admin/manager in the same organization
      if (!callerClientUser) {
        return new Response(
          JSON.stringify({ error: "You are not authorized to reset passwords", success: false }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const canManageUsers = ['admin', 'manager'].includes(callerClientUser.role);
      const sameOrg = targetUser && callerClientUser.organization_id === targetUser.organization_id;

      if (!canManageUsers || !sameOrg) {
        return new Response(
          JSON.stringify({ error: "You can only reset passwords for users in your own organization", success: false }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Get user details
    const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    if (getUserError || !authUser.user) {
      throw new Error(`Failed to get user: ${getUserError?.message || 'User not found'}`);
    }

    const email = authUser.user.email;
    if (!email) {
      throw new Error("User has no email address");
    }

    // Get client user details for name and organization
    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('full_name, organization_id')
      .eq('id', user_id)
      .single();

    // Get organization name
    const { data: org } = await supabaseAdmin
      .from('client_organizations')
      .select('name')
      .eq('id', clientUser?.organization_id)
      .single();

    const loginUrl = `${req.headers.get("origin") || APP_URL}/client-login`;

    // Generate a secure password reset link using Supabase's built-in functionality
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: loginUrl
      }
    });

    if (resetError) {
      console.error("Reset link generation error:", resetError);
      throw new Error(`Failed to generate reset link: ${resetError.message}`);
    }

    console.log("Password reset link generated successfully");

    const resetLink = resetData?.properties?.action_link || loginUrl;

    const htmlContent = transactional.passwordReset({
      resetUrl: resetLink,
      email: email,
      expiresIn: '24 hours',
      organizationName: org?.name,
    });

    // Check if email is configured
    if (!isEmailConfigured()) {
      console.error("Email not configured - SENDER_EMAIL and RESEND_API_KEY required");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please set SENDER_EMAIL and RESEND_API_KEY.",
          error_code: "EMAIL_NOT_CONFIGURED",
          reset_link: resetLink,  // Provide link for manual sending
        }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email via shared utility
    try {
      await sendEmail({
        to: email,
        subject: `Password Reset - ${org?.name || 'Client Portal'}`,
        html: htmlContent,
        fromName: "Client Portal",
      });

      console.log("Reset email sent successfully");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Password reset link sent successfully",
          email_sent: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (emailError) {
      console.error("Email sending failed:", emailError);

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
        { status: statusCode, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error in reset-client-password function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "An unexpected error occurred",
        success: false
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
