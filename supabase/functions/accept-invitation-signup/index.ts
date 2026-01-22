import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  z,
  emailSchema,
  parseJsonBody,
} from "../_shared/validators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Password validation matching database requirements
const strongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*(),.?":{}|<>\-_=+[\]\\;'`~/]/,
    "Password must contain at least one special character"
  );

const acceptInvitationSignupSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
  email: emailSchema,
  password: strongPasswordSchema,
  full_name: z
    .string()
    .min(1, "Full name is required")
    .max(255, "Full name must be less than 255 characters"),
});

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const parsed = await parseJsonBody(req, acceptInvitationSignupSchema, {
      allowEmpty: false,
    });

    if (!parsed.ok) {
      return new Response(
        JSON.stringify({
          error: parsed.error,
          details: parsed.details,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { token, email, password, full_name } = parsed.data;

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Step 1: Validate the invitation token
    const { data: invitations, error: invError } = await supabaseAdmin.rpc(
      "get_invitation_by_token",
      { p_token: token }
    );

    if (invError) {
      console.error("Error fetching invitation:", invError);
      return new Response(
        JSON.stringify({ error: "Failed to validate invitation" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!invitations || invitations.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invitation not found or has expired" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const invitation = invitations[0];

    // Check invitation status
    if (invitation.status === "accepted") {
      return new Response(
        JSON.stringify({ error: "This invitation has already been accepted" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (invitation.status === "revoked") {
      return new Response(
        JSON.stringify({ error: "This invitation has been revoked" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify email matches invitation
    if (email.toLowerCase() !== invitation.email.toLowerCase()) {
      return new Response(
        JSON.stringify({
          error: "Email address does not match the invitation",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Step 2: Create user with auto-confirmed email using admin API
    const { data: createData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm since invitation acts as verification
        user_metadata: {
          full_name: full_name,
        },
      });

    if (createError) {
      console.error("Error creating user:", createError);

      // Handle duplicate user error - existing user wants to join new org
      if (
        createError.message.includes("already been registered") ||
        createError.message.includes("already exists")
      ) {
        console.log("User already exists, attempting to add to organization...");
        
        // Get the existing user by email
        const { data: existingUserData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          console.error("Error listing users:", listError);
          return new Response(
            JSON.stringify({ error: "Failed to find existing user" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        const existingUser = existingUserData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "User exists but could not be found" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        // Update the user's password (they just set a new one) and full_name
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          { 
            password: password,
            user_metadata: { full_name: full_name }
          }
        );
        
        if (updateError) {
          console.error("Error updating user password:", updateError);
          // Continue anyway - password update is nice-to-have
        }
        
        // Accept the invitation for the existing user
        const { data: acceptResult, error: acceptError } = await supabaseAdmin.rpc(
          "accept_invitation",
          {
            p_token: token,
            p_user_id: existingUser.id,
          }
        );
        
        if (acceptError) {
          console.error("Error accepting invitation for existing user:", acceptError);
          return new Response(
            JSON.stringify({ error: "Failed to accept invitation" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        const result = acceptResult as {
          success: boolean;
          error?: string;
          invitation_type?: string;
          organization_id?: string;
        };
        
        if (!result.success) {
          return new Response(
            JSON.stringify({ error: result.error || "Failed to accept invitation" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        // Sign in the existing user
        const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
          email: email,
          password: password,
        });
        
        if (signInError) {
          console.error("Error signing in existing user:", signInError);
          return new Response(
            JSON.stringify({
              success: true,
              user_id: existingUser.id,
              invitation_type: result.invitation_type,
              organization_id: result.organization_id,
              session: null,
              message: "Invitation accepted. Please log in with your credentials.",
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        // Return success with session
        return new Response(
          JSON.stringify({
            success: true,
            user_id: existingUser.id,
            invitation_type: result.invitation_type,
            organization_id: result.organization_id,
            session: signInData.session,
            access_token: signInData.session?.access_token,
            refresh_token: signInData.session?.refresh_token,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          error: createError.message || "Failed to create account",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const user = createData.user;

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user account" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Step 3: Accept the invitation
    const { data: acceptResult, error: acceptError } = await supabaseAdmin.rpc(
      "accept_invitation",
      {
        p_token: token,
        p_user_id: user.id,
      }
    );

    if (acceptError) {
      console.error("Error accepting invitation:", acceptError);

      // Try to clean up the created user if invitation acceptance fails
      await supabaseAdmin.auth.admin.deleteUser(user.id);

      return new Response(
        JSON.stringify({ error: "Failed to accept invitation" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const result = acceptResult as {
      success: boolean;
      error?: string;
      invitation_type?: string;
      organization_id?: string;
    };

    if (!result.success) {
      // Clean up user if invitation acceptance fails
      await supabaseAdmin.auth.admin.deleteUser(user.id);

      return new Response(
        JSON.stringify({
          error: result.error || "Failed to accept invitation",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Step 4: Create a session for immediate login
    // Use signInWithPassword since we just created the user with a known password
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: email,
        password: password,
      });

    if (signInError) {
      console.error("Error signing in user:", signInError);
      // User is created and invitation accepted, but session creation failed
      // Return success but indicate they need to log in manually
      return new Response(
        JSON.stringify({
          success: true,
          user_id: user.id,
          invitation_type: result.invitation_type,
          organization_id: result.organization_id,
          session: null,
          message:
            "Account created successfully. Please log in with your credentials.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Return success with session for immediate login
    return new Response(
      JSON.stringify({
        success: true,
        user_id: user.id,
        invitation_type: result.invitation_type,
        organization_id: result.organization_id,
        session: signInData.session,
        access_token: signInData.session?.access_token,
        refresh_token: signInData.session?.refresh_token,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Unexpected error in accept-invitation-signup:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
