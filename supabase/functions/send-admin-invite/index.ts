import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { getCorsHeaders } from "../_shared/security.ts";
import { sendEmail, EmailError, isEmailConfigured } from "../_shared/email.ts";
import { adminInvite } from "../_shared/email-templates/templates/invitation.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AdminInviteRequest {
  email: string;
  inviteCode: string;
  inviterName?: string;
  templateId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller authentication - must be an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized: No authorization header", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create a user-scoped client to verify the caller's identity
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error("Authentication failed:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired token", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the user has admin role using service role client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error("Admin role check failed for user:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin privileges required", success: false }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Admin authenticated:", user.email);

    const { email, inviteCode, inviterName, templateId }: AdminInviteRequest = await req.json();
    
    console.log("Sending admin invite to:", email);

    const supabase = supabaseAdmin;

    // Fetch template if specified, otherwise use default
    let template: any = {
      subject: "🎯 You've been invited to join as an Administrator",
      primary_color: "#667eea",
      header_text: "Admin Invitation",
      footer_text: "This is an automated message from your admin dashboard.",
      logo_url: null,
      custom_message: null
    };

    if (templateId) {
      const { data: customTemplate } = await supabase
        .from('admin_invite_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (customTemplate) {
        template = customTemplate;
      }
    } else {
      // Fetch default template
      const { data: defaultTemplate } = await supabase
        .from('admin_invite_templates')
        .select('*')
        .eq('is_default', true)
        .single();
      
      if (defaultTemplate) {
        template = defaultTemplate;
      }
    }

    const inviteUrl = `${Deno.env.get("APP_URL") || "https://mojo-digital-wins.lovable.app"}/auth?invite=${inviteCode}`;

    const htmlContent = adminInvite({
      email: email,
      inviteUrl: inviteUrl,
      inviteCode: inviteCode,
      inviterName: inviterName,
      customMessage: template.custom_message,
      expiresIn: '7 days',
    });

    // Check if email is configured
    if (!isEmailConfigured()) {
      console.error("Email not configured - SENDER_EMAIL and RESEND_API_KEY required");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please set SENDER_EMAIL and RESEND_API_KEY.",
          error_code: "EMAIL_NOT_CONFIGURED",
        }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email via shared utility
    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: htmlContent,
      fromName: "Admin Invitations",
    });

    console.log("Admin invite email sent successfully:", emailResult.messageId);

    // Update invite code with email status
    await supabase
      .from('admin_invite_codes')
      .update({
        email_sent_to: email,
        email_status: 'sent',
        email_sent_at: new Date().toISOString(),
        resend_count: templateId ? 1 : 0
      })
      .eq('code', inviteCode);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResult.messageId,
        message: "Admin invitation sent successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-admin-invite function:", error);

    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    const errorCode = error instanceof EmailError ? error.code : "UNKNOWN_ERROR";
    const statusCode = error instanceof EmailError ? error.statusCode : 500;

    // Update invite code with error status if possible
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // Try to get inviteCode from the request context if it was parsed
      // Note: This may not work in all error scenarios
    } catch (updateError) {
      console.error("Failed to update error status:", updateError);
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        error_code: errorCode,
        success: false,
      }),
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        },
      }
    );
  }
};

serve(handler);
