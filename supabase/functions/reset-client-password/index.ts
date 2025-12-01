import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "hussein@ryzeup.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id }: ResetPasswordRequest = await req.json();
    
    console.log("Resetting password for user:", user_id);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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

    // Generate new temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + "!1";

    // Update password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    console.log("Password reset successfully");

    // Send email with new credentials
    if (RESEND_API_KEY) {
      const loginUrl = `${req.headers.get("origin") || "https://your-app.com"}/client-login`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
              }
              .container {
                background-color: white;
                border-radius: 8px;
                padding: 40px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              h1 {
                color: #667eea;
                margin: 0;
                font-size: 24px;
              }
              .credentials {
                background-color: #f8f9fa;
                border-radius: 6px;
                padding: 20px;
                margin: 20px 0;
              }
              .login-button {
                display: inline-block;
                padding: 14px 32px;
                background: linear-gradient(135deg, #667eea 0%, #5568d3 100%);
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                text-align: center;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset - ${org?.name || 'Client Portal'}</h1>
              </div>
              
              <div class="content">
                <p>Hello ${clientUser?.full_name || 'User'},</p>
                
                <p>Your password has been reset by an administrator. Use these new credentials to log in:</p>
                
                <div class="credentials">
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Temporary Password:</strong> ${tempPassword}</p>
                </div>
                
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="login-button">
                    Log In to Portal
                  </a>
                </div>
                
                <p style="margin-top: 20px; font-size: 14px; color: #666;">
                  Please change your password after logging in for security purposes.
                </p>
              </div>
              
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `Client Portal <${SENDER_EMAIL}>`,
            to: [email],
            subject: `Password Reset - ${org?.name || 'Client Portal'}`,
            html: htmlContent,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Failed to send reset email:", await emailResponse.text());
          // Don't fail the whole operation if email fails
        } else {
          console.log("Reset email sent successfully");
        }
      } catch (emailError) {
        console.error("Error sending reset email:", emailError);
        // Don't fail the whole operation if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Password reset successfully" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
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