import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";
import { passwordReset } from "../_shared/email-templates/templates/transactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPasswordResetBody {
  email: string;
}

// Simple hash function for rate limiting (not for security purposes)
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function log(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    function: "request-password-reset",
    message,
    ...data,
  };
  console.log(JSON.stringify(logEntry));
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://mojo-digital-wins.lovable.app";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse request body
    const body: RequestPasswordResetBody = await req.json();
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailHash = await hashEmail(email);
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    log("info", "Password reset requested", { emailHash: emailHash.substring(0, 8) });

    // Check rate limit (3 requests per hour per email)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: requestCount } = await supabaseAdmin
      .from("password_reset_requests")
      .select("*", { count: "exact", head: true })
      .eq("email_hash", emailHash)
      .gte("requested_at", oneHourAgo);

    if (requestCount !== null && requestCount >= 3) {
      log("warn", "Rate limit exceeded", { emailHash: emailHash.substring(0, 8), count: requestCount });
      
      // Still return success to prevent email enumeration
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account with that email exists, you will receive a password reset link shortly." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record the request
    await supabaseAdmin.from("password_reset_requests").insert({
      email_hash: emailHash,
      ip_address: ipAddress,
      user_agent: userAgent,
      success: false,
    });

    // Check if user exists (but don't reveal this in the response)
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const user = userData?.users?.find(u => u.email?.toLowerCase() === email);

    if (!user) {
      log("info", "Password reset for non-existent user", { emailHash: emailHash.substring(0, 8) });
      // Return success anyway to prevent email enumeration
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account with that email exists, you will receive a password reset link shortly." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate password reset link
    const redirectTo = `${appUrl}/reset-password`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      log("error", "Failed to generate reset link", { error: linkError?.message });
      throw new Error("Failed to generate password reset link");
    }

    // Mark request as successful
    await supabaseAdmin
      .from("password_reset_requests")
      .update({ success: true })
      .eq("email_hash", emailHash)
      .order("requested_at", { ascending: false })
      .limit(1);

    // Send email if configured
    if (isEmailConfigured()) {
      try {
        const htmlContent = passwordReset({
          resetUrl: linkData.properties.action_link,
          email: email,
          expiresIn: "24 hours",
        });

        await sendEmail({
          to: email,
          subject: "Reset Your Password",
          html: htmlContent,
          fromName: "Account Security",
        });

        log("info", "Password reset email sent", { emailHash: emailHash.substring(0, 8) });
      } catch (emailError) {
        log("error", "Failed to send email", { error: String(emailError) });
        // Don't fail the request if email fails - user can try again
      }
    } else {
      log("warn", "Email not configured, reset link not sent", { 
        emailHash: emailHash.substring(0, 8),
        resetLink: linkData.properties.action_link 
      });
    }

    // Log to invitation_audit_logs for security monitoring
    try {
      await supabaseAdmin.rpc("log_invitation_event", {
        p_invitation_id: null,
        p_event_type: "password_reset_requested",
        p_event_data: {
          email_hash: emailHash.substring(0, 16),
          ip_address: ipAddress,
          success: true,
        },
        p_user_id: user.id,
      });
    } catch (auditError) {
      // Don't fail if audit logging fails
      log("warn", "Failed to log audit event", { error: String(auditError) });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account with that email exists, you will receive a password reset link shortly." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("error", "Password reset request failed", { error: String(error) });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account with that email exists, you will receive a password reset link shortly." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
