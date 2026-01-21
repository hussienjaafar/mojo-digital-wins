import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserToCreate {
  email: string;
  full_name: string;
  role: string;
}

interface BatchCreateRequest {
  organization_id: string;
  users: UserToCreate[];
  actor_id?: string;
  actor_name?: string;
}

interface UserResult {
  email: string;
  status: "created" | "existing" | "failed";
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller has permission
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: BatchCreateRequest = await req.json();
    const { organization_id, users, actor_id, actor_name } = body;

    if (!organization_id || !users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "organization_id and users array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit batch size
    if (users.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: "Maximum 100 users per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller has permission to add to this org (must be platform admin or org admin/manager)
    const { data: callerRole } = await supabaseClient.rpc("has_role", { _role: "admin" });
    const isPlatformAdmin = callerRole === true;

    if (!isPlatformAdmin) {
      const { data: callerOrgUser } = await supabaseClient
        .from("client_users")
        .select("organization_id, role")
        .eq("id", caller.id)
        .maybeSingle();

      if (!callerOrgUser || callerOrgUser.organization_id !== organization_id || 
          !["admin", "manager"].includes(callerOrgUser.role)) {
        return new Response(
          JSON.stringify({ success: false, error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch organization name
    const { data: org } = await supabaseAdmin
      .from("client_organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    const orgName = org?.name || "Your Organization";

    const results: UserResult[] = [];
    let createdCount = 0;
    let existingCount = 0;
    let failedCount = 0;

    // Process users in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (userData) => {
        const { email, full_name, role } = userData;
        
        if (!email || !full_name) {
          return { email: email || "unknown", status: "failed" as const, error: "Email and full_name are required" };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return { email, status: "failed" as const, error: "Invalid email format" };
        }

        // Validate role
        const validRoles = ["admin", "manager", "editor", "viewer"];
        const userRole = validRoles.includes(role) ? role : "viewer";

        try {
          // Check if user exists in auth
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

          let userId: string;

          if (existingUser) {
            userId = existingUser.id;
            
            // Check if already in client_users for this org
            const { data: existingClientUser } = await supabaseAdmin
              .from("client_users")
              .select("id")
              .eq("id", userId)
              .eq("organization_id", organization_id)
              .maybeSingle();

            if (existingClientUser) {
              return { email, status: "existing" as const };
            }
          } else {
            // Create new auth user
            const tempPassword = Math.random().toString(36).slice(-8) + 
                                 Math.random().toString(36).slice(-8).toUpperCase() + "!1";
            
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { full_name }
            });

            if (createError || !newUser.user) {
              return { email, status: "failed" as const, error: createError?.message || "Failed to create user" };
            }

            userId = newUser.user.id;
          }

          // Add to client_users
          const { error: insertError } = await supabaseAdmin
            .from("client_users")
            .upsert({
              id: userId,
              organization_id,
              full_name,
              role: userRole,
              status: "active"
            }, { onConflict: "id" });

          if (insertError) {
            return { email, status: "failed" as const, error: insertError.message };
          }

          // Mark profile as onboarding complete
          await supabaseAdmin
            .from("profiles")
            .update({ 
              onboarding_completed: true, 
              onboarding_completed_at: new Date().toISOString() 
            })
            .eq("id", userId);

          // Log activity
          await supabaseAdmin.rpc("log_member_invited", {
            p_organization_id: organization_id,
            p_actor_id: actor_id || caller.id,
            p_actor_name: actor_name || caller.email,
            p_target_email: email,
            p_target_name: full_name,
            p_role: userRole
          });

          // Generate password reset link
          const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
          });

          // Send welcome email (if RESEND_API_KEY is available)
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey && resetData?.properties?.action_link) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                  from: "MojoDigital <noreply@mojodigital.io>",
                  to: [email],
                  subject: `You've been added to ${orgName}`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2>Welcome to ${orgName}!</h2>
                      <p>Hi ${full_name},</p>
                      <p>You've been added as a <strong>${userRole}</strong> to ${orgName}.</p>
                      <p>Click the link below to set your password and access your dashboard:</p>
                      <p><a href="${resetData.properties.action_link}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Set Password & Login</a></p>
                      <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
                    </div>
                  `,
                }),
              });
            } catch (emailError) {
              console.error("Failed to send welcome email:", emailError);
            }
          }

          return { email, status: "created" as const };
        } catch (error: any) {
          console.error(`Error processing ${email}:`, error);
          return { email, status: "failed" as const, error: error.message || "Unknown error" };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        results.push(result);
        if (result.status === "created") createdCount++;
        else if (result.status === "existing") existingCount++;
        else failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: users.length,
          created: createdCount,
          existing: existingCount,
          failed: failedCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Batch create error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
