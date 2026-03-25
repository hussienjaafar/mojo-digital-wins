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

// Structured logging helper
interface LogContext {
  requestId: string;
  email?: string;
  invitationId?: string;
  userId?: string;
  organizationId?: string;
  step?: string;
}

function createLogger(requestId: string) {
  const baseContext: LogContext = { requestId };
  
  return {
    setContext(ctx: Partial<LogContext>) {
      Object.assign(baseContext, ctx);
    },
    
    info(message: string, data?: Record<string, unknown>) {
      console.log(JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        ...baseContext,
        message,
        ...data,
      }));
    },
    
    warn(message: string, data?: Record<string, unknown>) {
      console.warn(JSON.stringify({
        level: "WARN",
        timestamp: new Date().toISOString(),
        ...baseContext,
        message,
        ...data,
      }));
    },
    
    error(message: string, error?: unknown, data?: Record<string, unknown>) {
      console.error(JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        ...baseContext,
        message,
        error: error instanceof Error 
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
        ...data,
      }));
    },
  };
}

// Generate a request ID for tracing
function generateRequestId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Audit log helper - writes to invitation_audit_logs table
// deno-lint-ignore no-explicit-any
async function logAuditEvent(
  supabase: any,
  event: {
    invitationId?: string;
    eventType: string;
    email?: string;
    userId?: string;
    organizationId?: string;
    invitationType?: string;
    status?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.rpc("log_invitation_event", {
      p_invitation_id: event.invitationId || null,
      p_event_type: event.eventType,
      p_email: event.email || null,
      p_user_id: event.userId || null,
      p_organization_id: event.organizationId || null,
      p_invitation_type: event.invitationType || null,
      p_status: event.status || null,
      p_error_message: event.errorMessage || null,
      p_metadata: event.metadata || {},
      p_source: "edge_function",
    });
  } catch (err) {
    // Don't fail the request if audit logging fails
    console.error("Failed to write audit log:", err);
  }
}

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
  confirm_password: z.string().min(1, "Password confirmation is required"),
  full_name: z
    .string()
    .min(1, "Full name is required")
    .max(255, "Full name must be less than 255 characters"),
});

serve(async (req: Request) => {
  const requestId = generateRequestId();
  const log = createLogger(requestId);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract request metadata for security logging
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  log.info("Invitation signup request started", { clientIp });

  try {
    // Parse and validate request body
    const parsed = await parseJsonBody(req, acceptInvitationSignupSchema, {
      allowEmpty: false,
    });

    if (!parsed.ok) {
      log.warn("Validation failed", { error: parsed.error, details: parsed.details });
      return new Response(
        JSON.stringify({
          error: parsed.error,
          details: parsed.details,
          requestId,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { token, email, password, confirm_password, full_name } = parsed.data;
    
    // Validate password confirmation BEFORE any other processing
    // Note: confirm_password is intentionally NOT logged or stored
    if (password !== confirm_password) {
      log.warn("Password confirmation mismatch");
      return new Response(
        JSON.stringify({
          error: "Passwords do not match",
          code: "PASSWORD_MISMATCH",
          requestId,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    log.setContext({ email, step: "validated" });
    log.info("Request validated", { tokenPrefix: token.substring(0, 8) + "..." });

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
    log.setContext({ step: "fetch_invitation" });
    log.info("Fetching invitation by token");
    
    const { data: invitations, error: invError } = await supabaseAdmin.rpc(
      "get_invitation_by_token",
      { p_token: token }
    );

    if (invError) {
      log.error("Failed to fetch invitation", invError);
      await logAuditEvent(supabaseAdmin, {
        eventType: "fetch_invitation_error",
        email,
        errorMessage: invError.message,
        metadata: { requestId },
      });
      return new Response(
        JSON.stringify({ error: "Failed to validate invitation", requestId }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!invitations || invitations.length === 0) {
      log.warn("Invitation not found or expired");
      await logAuditEvent(supabaseAdmin, {
        eventType: "invitation_not_found",
        email,
        errorMessage: "Invitation not found or has expired",
        metadata: { requestId },
      });
      return new Response(
        JSON.stringify({ error: "Invitation not found or has expired", requestId }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const invitation = invitations[0];
    log.setContext({ 
      invitationId: invitation.id, 
      organizationId: invitation.organization_id,
      step: "validate_status" 
    });
    log.info("Invitation found", { 
      status: invitation.status, 
      type: invitation.invitation_type,
      role: invitation.role,
      expiresAt: invitation.expires_at,
    });

    // Security: Check if token has already been used (single-use enforcement)
    if (invitation.used_at) {
      log.warn("Invitation already used", { usedAt: invitation.used_at });
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "token_reuse_attempt",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        errorMessage: "This invitation has already been used",
        metadata: { requestId, clientIp, userAgent, usedAt: invitation.used_at },
      });
      return new Response(
        JSON.stringify({ error: "This invitation has already been used", requestId }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Security: Check for too many failed attempts (rate limiting)
    const MAX_FAILED_ATTEMPTS = 5;
    const failedAttempts = invitation.failed_attempts || 0;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      log.warn("Invitation blocked due to failed attempts", { failedAttempts });
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "invitation_blocked",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        errorMessage: "Invitation blocked due to too many failed attempts",
        metadata: { requestId, clientIp, userAgent, failedAttempts },
      });
      return new Response(
        JSON.stringify({ 
          error: "This invitation link has been blocked due to too many failed attempts", 
          requestId 
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check invitation status
    if (invitation.status === "accepted") {
      log.warn("Invitation already accepted");
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "already_accepted",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        status: "accepted",
        metadata: { requestId, clientIp, userAgent },
      });
      return new Response(
        JSON.stringify({ error: "This invitation has already been accepted", requestId }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (invitation.status === "revoked") {
      log.warn("Invitation was revoked");
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "revoked_attempt",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        status: "revoked",
        metadata: { requestId, clientIp, userAgent },
      });
      return new Response(
        JSON.stringify({ error: "This invitation has been revoked", requestId }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      log.warn("Invitation expired", { expiresAt: invitation.expires_at });
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "expired_attempt",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        status: "expired",
        metadata: { requestId, clientIp, userAgent, expiresAt: invitation.expires_at },
      });
      return new Response(
        JSON.stringify({ error: "This invitation has expired", requestId }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify email matches invitation
    if (email.toLowerCase() !== invitation.email.toLowerCase()) {
      log.warn("Email mismatch", { invitationEmail: invitation.email });
      
      // Increment failed attempts for email mismatch
      await supabaseAdmin.rpc('increment_invitation_failed_attempts', {
        p_invitation_id: invitation.id
      });
      
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "email_mismatch",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        errorMessage: "Email address does not match the invitation",
        metadata: { requestId, clientIp, userAgent, invitationEmail: invitation.email },
      });
      return new Response(
        JSON.stringify({
          error: "Email address does not match the invitation",
          requestId,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Step 2: Create user with auto-confirmed email using admin API
    log.setContext({ step: "create_user" });
    log.info("Attempting to create user account");
    
    const { data: createData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name,
        },
      });

    if (createError) {
      log.warn("User creation error", { errorMessage: createError.message });

      // Handle duplicate user error - existing user wants to join new org
      if (
        createError.message.includes("already been registered") ||
        createError.message.includes("already exists")
      ) {
        log.info("User already exists, handling existing user flow");
        await logAuditEvent(supabaseAdmin, {
          invitationId: invitation.id,
          eventType: "existing_user_detected",
          email,
          organizationId: invitation.organization_id,
          invitationType: invitation.invitation_type,
          metadata: { requestId, clientIp, userAgent },
        });
        
        // Get the existing user by email
        log.setContext({ step: "find_existing_user" });
        const { data: existingUserData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          log.error("Failed to list users", listError);
          await logAuditEvent(supabaseAdmin, {
            invitationId: invitation.id,
            eventType: "list_users_error",
            email,
            organizationId: invitation.organization_id,
            errorMessage: listError.message,
            metadata: { requestId, clientIp, userAgent },
          });
          return new Response(
            JSON.stringify({ error: "Failed to find existing user", requestId }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        const existingUser = existingUserData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        
        if (!existingUser) {
          log.error("User exists but not found in list", null, { email });
          await logAuditEvent(supabaseAdmin, {
            invitationId: invitation.id,
            eventType: "user_not_found_in_list",
            email,
            organizationId: invitation.organization_id,
            errorMessage: "User exists but could not be found",
            metadata: { requestId, clientIp, userAgent },
          });
          return new Response(
            JSON.stringify({ error: "User exists but could not be found", requestId }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        log.setContext({ userId: existingUser.id, step: "update_existing_user" });
        log.info("Found existing user", { userId: existingUser.id });
        
        // Update the user's password, confirm email, and full_name
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          { 
            password: password,
            email_confirm: true,
            user_metadata: { full_name: full_name }
          }
        );
        
        if (updateError) {
          log.warn("Failed to update user password (continuing)", { errorMessage: updateError.message });
          await logAuditEvent(supabaseAdmin, {
            invitationId: invitation.id,
            eventType: "password_update_failed",
            email,
            userId: existingUser.id,
            organizationId: invitation.organization_id,
            errorMessage: updateError.message,
            metadata: { requestId, clientIp, userAgent },
          });
        } else {
          log.info("Updated user password and metadata");
        }
        
        // Accept the invitation for the existing user
        log.setContext({ step: "accept_invitation_existing" });
        log.info("Calling accept_invitation RPC for existing user");
        
        const { data: acceptResult, error: acceptError } = await supabaseAdmin.rpc(
          "accept_invitation",
          {
            p_token: token,
            p_user_id: existingUser.id,
          }
        );
        
        if (acceptError) {
          log.error("Failed to accept invitation for existing user", acceptError);
          await logAuditEvent(supabaseAdmin, {
            invitationId: invitation.id,
            eventType: "accept_rpc_error_existing",
            email,
            userId: existingUser.id,
            organizationId: invitation.organization_id,
            errorMessage: acceptError.message,
            metadata: { requestId, clientIp, userAgent },
          });
          return new Response(
            JSON.stringify({ error: "Failed to accept invitation", requestId }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        const result = acceptResult as {
          success: boolean;
          error?: string;
          invitation_type?: string;
          organization_id?: string;
        };
        
        log.info("Accept invitation RPC result", { success: result.success, error: result.error });
        
        if (!result.success) {
          log.error("Invitation acceptance failed", null, { error: result.error });
          await logAuditEvent(supabaseAdmin, {
            invitationId: invitation.id,
            eventType: "accept_failed_existing",
            email,
            userId: existingUser.id,
            organizationId: invitation.organization_id,
            errorMessage: result.error,
            metadata: { requestId, clientIp, userAgent },
          });
          return new Response(
            JSON.stringify({ error: result.error || "Failed to accept invitation", requestId }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        // Sign in the existing user
        log.setContext({ step: "signin_existing" });
        log.info("Signing in existing user");
        
        const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
          email: email,
          password: password,
        });
        
        if (signInError) {
          log.warn("Failed to sign in existing user", { errorMessage: signInError.message });
          await logAuditEvent(supabaseAdmin, {
            invitationId: invitation.id,
            eventType: "signin_failed_existing",
            email,
            userId: existingUser.id,
            organizationId: result.organization_id,
            invitationType: result.invitation_type,
            status: "accepted",
            errorMessage: signInError.message,
            metadata: { requestId, clientIp, userAgent },
          });
          return new Response(
            JSON.stringify({
              success: true,
              user_id: existingUser.id,
              invitation_type: result.invitation_type,
              organization_id: result.organization_id,
              session: null,
              message: "Invitation accepted. Please log in with your credentials.",
              requestId,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        log.info("Existing user flow completed successfully");
        await logAuditEvent(supabaseAdmin, {
          invitationId: invitation.id,
          eventType: "signup_success_existing",
          email,
          userId: existingUser.id,
          organizationId: result.organization_id,
          invitationType: result.invitation_type,
          status: "accepted",
          metadata: { requestId, clientIp, userAgent },
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            user_id: existingUser.id,
            invitation_type: result.invitation_type,
            organization_id: result.organization_id,
            session: signInData.session,
            access_token: signInData.session?.access_token,
            refresh_token: signInData.session?.refresh_token,
            requestId,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      log.error("Unexpected user creation error", createError);
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "create_user_error",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        errorMessage: createError.message,
        metadata: { requestId, clientIp, userAgent },
      });
      return new Response(
        JSON.stringify({
          error: createError.message || "Failed to create account",
          requestId,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const user = createData.user;

    if (!user) {
      log.error("User creation returned null user", null);
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "create_user_null",
        email,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        errorMessage: "User creation returned null",
        metadata: { requestId, clientIp, userAgent },
      });
      return new Response(
        JSON.stringify({ error: "Failed to create user account", requestId }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    log.setContext({ userId: user.id, step: "accept_invitation" });
    log.info("User created successfully", { userId: user.id });
    await logAuditEvent(supabaseAdmin, {
      invitationId: invitation.id,
      eventType: "user_created",
      email,
      userId: user.id,
      organizationId: invitation.organization_id,
      invitationType: invitation.invitation_type,
      metadata: { requestId, clientIp, userAgent, fullName: full_name },
    });

    // Step 3: Accept the invitation
    log.info("Calling accept_invitation RPC");
    const { data: acceptResult, error: acceptError } = await supabaseAdmin.rpc(
      "accept_invitation",
      {
        p_token: token,
        p_user_id: user.id,
      }
    );

    if (acceptError) {
      log.error("Failed to accept invitation, cleaning up user", acceptError);
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "accept_rpc_error",
        email,
        userId: user.id,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        errorMessage: acceptError.message,
        metadata: { requestId, clientIp, userAgent },
      });

      // Clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      log.info("Deleted user after acceptance failure");

      return new Response(
        JSON.stringify({ error: "Failed to accept invitation", requestId }),
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

    log.info("Accept invitation RPC result", { success: result.success, error: result.error });

    if (!result.success) {
      log.error("Invitation acceptance failed, cleaning up user", null, { error: result.error });
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "accept_failed",
        email,
        userId: user.id,
        organizationId: invitation.organization_id,
        invitationType: invitation.invitation_type,
        errorMessage: result.error,
        metadata: { requestId, clientIp, userAgent },
      });

      // Clean up user
      await supabaseAdmin.auth.admin.deleteUser(user.id);

      return new Response(
        JSON.stringify({
          error: result.error || "Failed to accept invitation",
          requestId,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Step 4: Create a session for immediate login
    log.setContext({ step: "signin" });
    log.info("Signing in new user");
    
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: email,
        password: password,
      });

    if (signInError) {
      log.warn("Failed to create session (user created successfully)", { errorMessage: signInError.message });
      await logAuditEvent(supabaseAdmin, {
        invitationId: invitation.id,
        eventType: "signin_failed",
        email,
        userId: user.id,
        organizationId: result.organization_id,
        invitationType: result.invitation_type,
        status: "accepted",
        errorMessage: signInError.message,
        metadata: { requestId, clientIp, userAgent },
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          user_id: user.id,
          invitation_type: result.invitation_type,
          organization_id: result.organization_id,
          session: null,
          message:
            "Account created successfully. Please log in with your credentials.",
          requestId,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    log.info("Invitation signup completed successfully");
    await logAuditEvent(supabaseAdmin, {
      invitationId: invitation.id,
      eventType: "signup_success",
      email,
      userId: user.id,
      organizationId: result.organization_id,
      invitationType: result.invitation_type,
      status: "accepted",
      metadata: { requestId, clientIp, userAgent },
    });

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
        requestId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    log.error("Unexpected error in accept-invitation-signup", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An unexpected error occurred",
        requestId,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
