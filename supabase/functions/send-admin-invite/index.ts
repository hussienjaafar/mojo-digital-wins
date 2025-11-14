import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminInviteRequest {
  email: string;
  inviteCode: string;
  inviterName?: string;
  templateId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviteCode, inviterName, templateId }: AdminInviteRequest = await req.json();
    
    console.log("Sending admin invite to:", email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    const inviteUrl = `${req.headers.get("origin") || "https://your-app.com"}/auth?invite=${inviteCode}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
            .logo {
              width: 60px;
              height: 60px;
              background: linear-gradient(135deg, ${template.primary_color} 0%, ${adjustColorBrightness(template.primary_color, -20)} 100%);
              border-radius: 12px;
              margin: 0 auto 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
            }
            h1 {
              color: ${template.primary_color};
              margin: 0;
              font-size: 24px;
            }
            .content {
              margin: 30px 0;
            }
            .invite-button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, ${template.primary_color} 0%, ${adjustColorBrightness(template.primary_color, -20)} 100%);
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .code-box {
              background-color: #f8f9fa;
              border: 1px dashed ${template.primary_color};
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              font-family: monospace;
              font-size: 18px;
              text-align: center;
              letter-spacing: 2px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              color: #666;
              font-size: 14px;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${template.logo_url ? `<img src="${template.logo_url}" alt="Logo" style="width: 120px; margin-bottom: 20px;" />` : '<div class="logo">🎯</div>'}
              <h1>${template.header_text}</h1>
            </div>
            
            <div class="content">
              <p>Hello,</p>
              
              <p>${inviterName ? `<strong>${inviterName}</strong> has invited you` : 'You have been invited'} to join as an administrator.</p>
              
              ${template.custom_message ? `<p style="background-color: #f0f7ff; padding: 15px; border-left: 3px solid ${template.primary_color}; margin: 20px 0;">${template.custom_message}</p>` : ''}
              
              <p>Click the button below to accept your invitation and create your admin account:</p>
              
              <div style="text-align: center;">
                <a href="${inviteUrl}" class="invite-button">
                  Accept Invitation
                </a>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Note:</strong> This invitation code is single-use and will expire in 7 days.
              </div>
              
              <p>Or use this invitation code when signing up:</p>
              
              <div class="code-box">
                ${inviteCode}
              </div>
              
              <p style="font-size: 14px; color: #666;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            
            <div class="footer">
              <p>${template.footer_text}</p>
              <p>For security reasons, please do not share this invitation code with anyone.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Helper function to adjust color brightness
    function adjustColorBrightness(color: string, percent: number): string {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return "#" + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      ).toString(16).slice(1);
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      throw new Error("Email service is not properly configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Admin Invitations <onboarding@resend.dev>",
        to: [email],
        subject: template.subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error response:", errorText);
      let errorMessage = "Failed to send invitation email";
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(`Resend API error: ${errorMessage}`);
    }

    const emailData = await emailResponse.json();
    console.log("Admin invite email sent successfully:", emailData);

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
        emailId: emailData.id,
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
  } catch (error: any) {
    console.error("Error in send-admin-invite function:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });

    // Update invite code with error status if possible
    if (error.inviteCode) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('admin_invite_codes')
          .update({
            email_status: 'failed',
            email_error: error.message
          })
          .eq('code', error.inviteCode);
      } catch (updateError) {
        console.error("Failed to update error status:", updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "An unexpected error occurred",
        success: false,
        details: error.stack ? "Check server logs for more information" : undefined
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
