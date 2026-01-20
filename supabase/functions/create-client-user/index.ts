import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { transactional } from "../_shared/email-templates/index.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL");  // Required - no fallback
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://your-app.com";

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
    // Extract and validate the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client with service role for admin operations
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

    const { email, full_name, organization_id, role, password }: CreateClientUserRequest = await req.json();
    
    console.log("Creating client user:", email, "requested by:", callerUser.id);

    // Verify the caller is an admin or manager of the target organization
    const { data: callerClientUser, error: callerError } = await supabaseAdmin
      .from('client_users')
      .select('role, organization_id')
      .eq('id', callerUser.id)
      .single();

    if (callerError || !callerClientUser) {
      // Check if caller is a system admin
      const { data: isSystemAdmin } = await supabaseAdmin.rpc('has_role', {
        _user_id: callerUser.id,
        _role: 'admin'
      });

      if (!isSystemAdmin) {
        console.error("Unauthorized: caller is not a client user or system admin");
        return new Response(
          JSON.stringify({ error: "You are not authorized to create users", success: false }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      // Caller is a client user - verify they can create users in target org
      const canManageUsers = ['admin', 'manager'].includes(callerClientUser.role);
      const sameOrg = callerClientUser.organization_id === organization_id;

      if (!canManageUsers || !sameOrg) {
        console.error("Unauthorized: caller cannot create users in this organization");
        return new Response(
          JSON.stringify({ error: "You can only create users in your own organization with admin/manager role", success: false }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Prevent privilege escalation - can't create users with higher role than yourself
      const roleHierarchy = { 'viewer': 1, 'editor': 2, 'manager': 3, 'admin': 4 };
      const callerLevel = roleHierarchy[callerClientUser.role as keyof typeof roleHierarchy] || 0;
      const newUserLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 0;

      if (newUserLevel > callerLevel) {
        console.error("Privilege escalation attempt blocked");
        return new Response(
          JSON.stringify({ error: "You cannot create users with a higher role than your own", success: false }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

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

    // Generate a secure password reset link instead of sending plaintext password
    const loginUrl = `${req.headers.get("origin") || PUBLIC_SITE_URL}/client-login`;
    
    // Generate password reset link using Supabase's built-in functionality
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: loginUrl
      }
    });

    // Send welcome email via Resend with secure reset link (no plaintext password)
    if (RESEND_API_KEY) {
      const resetLink = resetData?.properties?.action_link || loginUrl;

      const htmlContent = transactional.welcome({
        fullName: full_name,
        email: email,
        organizationName: org?.name || 'Client Portal',
        role: role,
        resetUrl: resetLink,
        expiresIn: '24 hours',
      });

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
            subject: `Welcome to ${org?.name || 'Client Portal'} - Set Your Password`,
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
