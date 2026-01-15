import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
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
        JSON.stringify({ error: "Unauthorized - No auth header" }),
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
    const siteUrl = Deno.env.get("SITE_URL") || "https://mojo-digital-wins.lovable.app";
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

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Password Reset</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>A password reset has been requested for your admin account by another system administrator.</p>
                <p>Click the button below to reset your password:</p>
                <p style="text-align: center;">
                  <a href="${resetLink}" class="button">Reset Password</a>
                </p>
                <p style="font-size: 14px; color: #6b7280;">
                  This link will expire in 1 hour. If you did not expect this email, please contact your system administrator.
                </p>
              </div>
              <div class="footer">
                <p>This is an automated message from the admin system.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const { error: emailError } = await resend.emails.send({
          from: Deno.env.get("RESEND_FROM_EMAIL") || "Admin System <noreply@resend.dev>",
          to: [targetEmail],
          subject: "Password Reset Request - Admin Account",
          html: emailHtml,
        });

        if (emailError) {
          console.error("Failed to send email:", emailError);
          // Don't fail the request if email fails - return the link for manual sending
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Password reset link generated but email failed to send",
              email_sent: false,
              reset_link: resetLink,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Password reset email sent successfully");

        // Log the action
        await supabaseAdmin.from("admin_audit_logs").insert({
          user_id: caller.id,
          action_type: "admin_password_reset",
          record_id: user_id,
          new_value: { target_email: targetEmail, email_sent: true },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Password reset email sent to ${targetEmail}`,
            email_sent: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Password reset link generated but email failed",
            email_sent: false,
            reset_link: resetLink,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.log("RESEND_API_KEY not configured - returning link only");
      
      // Log the action
      await supabaseAdmin.from("admin_audit_logs").insert({
        user_id: caller.id,
        action_type: "admin_password_reset",
        record_id: user_id,
        new_value: { target_email: targetEmail, email_sent: false },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Password reset link generated (email not configured)",
          email_sent: false,
          reset_link: resetLink,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
