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

interface CreateClientUserRequest {
  email: string;
  full_name: string;
  organization_id: string;
  role: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, full_name, organization_id, role, password }: CreateClientUserRequest = await req.json();
    
    console.log("Creating client user:", email);

    // Create Supabase admin client with service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      console.log("User already exists in auth:", existingUser.id);
      
      // Check if they already have a client_users record
      const { data: existingClientUser } = await supabaseAdmin
        .from('client_users')
        .select('id')
        .eq('id', existingUser.id)
        .single();

      if (existingClientUser) {
        throw new Error("A client user with this email already exists");
      }

      userId = existingUser.id;
      console.log("Reusing existing auth user for client_users record");
    } else {
      // Create new user via admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm the email
        user_metadata: {
          full_name
        }
      });

      if (authError) {
        console.error("Auth error:", authError);
        throw new Error(`Failed to create user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error("User creation succeeded but no user data returned");
      }

      userId = authData.user.id;
      console.log("User created in auth:", userId);
    }

    // Create client_users record
    const { error: clientUserError } = await supabaseAdmin
      .from('client_users')
      .insert({
        id: userId,
        full_name,
        organization_id,
        role
      });

    if (clientUserError) {
      console.error("Client user error:", clientUserError);
      // Only try to clean up if we created a new user
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      throw new Error(`Failed to create client user record: ${clientUserError.message}`);
    }

    console.log("Client user record created");

    // Get organization name for email
    const { data: org } = await supabaseAdmin
      .from('client_organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    // Send welcome email via Resend
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
                <h1>Welcome to ${org?.name || 'the Portal'}</h1>
              </div>
              
              <div class="content">
                <p>Hello ${full_name},</p>
                
                <p>Your client portal account has been created. Use the credentials below to log in:</p>
                
                <div class="credentials">
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Temporary Password:</strong> ${password}</p>
                  <p><strong>Role:</strong> ${role}</p>
                </div>
                
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="login-button">
                    Log In to Portal
                  </a>
                </div>
                
                <p style="margin-top: 20px; font-size: 14px; color: #666;">
                  Please change your password after your first login for security purposes.
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
            subject: `Welcome to ${org?.name || 'Client Portal'}`,
            html: htmlContent,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Failed to send welcome email:", await emailResponse.text());
          // Don't fail the whole operation if email fails
        } else {
          console.log("Welcome email sent successfully");
        }
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Don't fail the whole operation if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: userId,
          email: email
        },
        message: "Client user created successfully" 
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
    console.error("Error in create-client-user function:", error);
    
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
