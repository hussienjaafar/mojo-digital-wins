import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, checkRateLimit } from "../_shared/security.ts";
import { sendEmail, EmailError, isEmailConfigured } from "../_shared/email.ts";
import { parseJsonBody, userInvitationSchema } from "../_shared/validators.ts";
import { userInvite, userInviteReminder } from "../_shared/email-templates/templates/invitation.ts";

// Edge function for user invitations - v2
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is authenticated and authorized
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 10 invitations per minute per user
    const rateLimitKey = `invite:${user.id}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many invitation requests. Please try again later.',
          retry_after_seconds: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request body with Zod
    const parseResult = await parseJsonBody(req, userInvitationSchema, { allowEmpty: false });
    if (!parseResult.ok) {
      return new Response(
        JSON.stringify({ error: parseResult.error, details: parseResult.details }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('Invitation request:', { email: body.email, type: body.type, action: body.action, requestedBy: user.id });

    // Check authorization based on invitation type
    if (body.type === 'platform_admin') {
      // Only platform admins can invite other platform admins
      const { data: hasRole } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' 
      });
      
      if (!hasRole) {
        return new Response(
          JSON.stringify({ error: 'Only platform admins can send platform admin invitations' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (body.type === 'organization_member') {
      // Validate organization_id and role are provided
      if (!body.organization_id || !body.role) {
        return new Response(
          JSON.stringify({ error: 'Organization ID and role are required for organization invitations' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SEAT-BASED BILLING: Only platform admins can invite organization members
      // Organizations must request members through pending_member_requests
      const { data: hasRole } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' 
      });

      if (!hasRole) {
        return new Response(
          JSON.stringify({ 
            error: 'Only platform administrators can invite organization members. Please submit a member request instead.',
            code: 'SEAT_BILLING_RESTRICTION'
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate seat availability before allowing invitation
      const { data: seatUsage } = await supabase.rpc('get_org_seat_usage', {
        org_id: body.organization_id
      });

      if (seatUsage && seatUsage.length > 0 && seatUsage[0].available_seats <= 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Organization has reached its seat limit. Please increase the seat limit before inviting new members.',
            code: 'SEAT_LIMIT_REACHED',
            seat_limit: seatUsage[0].seat_limit,
            total_used: seatUsage[0].total_used
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await supabase
      .from('user_invitations')
      .select('id, status, token, resend_count')
      .eq('email', body.email.toLowerCase())
      .eq('invitation_type', body.type)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      if (body.action === 'resend') {
        // Handle resend: Generate new token and update expiry
        const newToken = crypto.randomUUID();
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 7); // 7 days from now
        const currentResendCount = existingInvite.resend_count || 0;

        // Limit resends to prevent abuse
        if (currentResendCount >= 5) {
          return new Response(
            JSON.stringify({ error: 'Maximum resend limit reached. Please revoke and create a new invitation.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('user_invitations')
          .update({
            token: newToken,
            expires_at: newExpiry.toISOString(),
            resend_count: currentResendCount + 1
          })
          .eq('id', existingInvite.id);

        if (updateError) {
          console.error('Error updating invitation:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update invitation' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get organization name for email
        let organizationName = '';
        if (body.type === 'organization_member' && body.organization_id) {
          const { data: org } = await supabase
            .from('client_organizations')
            .select('name')
            .eq('id', body.organization_id)
            .single();
          organizationName = org?.name || 'the organization';
        }

        // Build the invitation URL with new token
        const appUrl = Deno.env.get('APP_URL') || 'https://mojo-digital-wins.lovable.app';
        const inviteUrl = `${appUrl}/accept-invite?token=${newToken}`;

        // Build email content using template
        const emailSubject = body.type === 'platform_admin'
          ? 'Reminder: You\'ve been invited as a Platform Admin'
          : `Reminder: You've been invited to join ${organizationName}`;

        const emailHtml = userInviteReminder({
          email: body.email,
          inviteUrl: inviteUrl,
          invitationType: body.type as 'platform_admin' | 'organization_member',
          organizationName: organizationName || undefined,
          role: body.role || undefined,
          expiresIn: '7 days',
        });

        // Send email
        let emailSent = false;
        let emailError: string | null = null;

        if (isEmailConfigured()) {
          try {
            await sendEmail({
              to: body.email,
              subject: emailSubject,
              html: emailHtml,
              fromName: body.type === 'platform_admin' ? 'Platform Admin' : organizationName || 'Team',
            });
            emailSent = true;
            console.log('Resend invitation email sent successfully');
          } catch (err) {
            console.error('Email resend failed:', err);
            emailError = err instanceof EmailError ? err.message : 'Failed to send email';
          }
        } else {
          console.log('Email not configured for resend');
          emailError = 'Email service not configured';
        }

        // Log the resend action
        try {
          await supabase.rpc('log_admin_action', {
            p_action_type: 'invitation_resent',
            p_table_affected: 'user_invitations',
            p_record_id: existingInvite.id,
            p_new_value: {
              email: body.email,
              type: body.type,
              resend_count: currentResendCount + 1,
              email_sent: emailSent
            }
          });
        } catch (logErr) {
          console.error('Failed to log resend action:', logErr);
        }

        if (emailSent) {
          return new Response(
            JSON.stringify({
              success: true,
              invitation_id: existingInvite.id,
              invite_url: inviteUrl,
              email_sent: true,
              resend_count: currentResendCount + 1,
              message: 'Invitation resent successfully'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              invitation_id: existingInvite.id,
              invite_url: inviteUrl,
              email_sent: false,
              error: emailError || 'Email delivery failed',
              error_code: 'EMAIL_SEND_FAILED',
              message: 'Invitation updated but email failed to send. Please share the invite URL manually.'
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // action === 'send' but invitation already exists
        return new Response(
          JSON.stringify({ 
            error: 'There is already a pending invitation for this email',
            hint: 'Use action: "resend" to resend the invitation email'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user already exists with this access
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', body.email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      if (body.type === 'platform_admin') {
        const { data: hasAdminRole } = await supabase.rpc('has_role', { 
          _user_id: existingProfile.id, 
          _role: 'admin' 
        });
        if (hasAdminRole) {
          return new Response(
            JSON.stringify({ error: 'This user is already a platform admin' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (body.type === 'organization_member') {
        const { data: existingMembership } = await supabase
          .from('client_users')
          .select('id')
          .eq('id', existingProfile.id)
          .eq('organization_id', body.organization_id)
          .maybeSingle();
        
        if (existingMembership) {
          return new Response(
            JSON.stringify({ error: 'This user is already a member of this organization' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Get organization name for org invites
    let organizationName = '';
    if (body.type === 'organization_member' && body.organization_id) {
      const { data: org } = await supabase
        .from('client_organizations')
        .select('name')
        .eq('id', body.organization_id)
        .single();
      organizationName = org?.name || 'the organization';
    }

    // Create the invitation
    const { data: invitation, error: insertError } = await supabase
      .from('user_invitations')
      .insert({
        email: body.email.toLowerCase(),
        invitation_type: body.type,
        organization_id: body.type === 'organization_member' ? body.organization_id : null,
        role: body.type === 'organization_member' ? body.role : null,
        invited_by: user.id,
      })
      .select('id, token')
      .single();

    if (insertError) {
      console.error('Error creating invitation:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the invitation URL
    const appUrl = Deno.env.get('APP_URL') || 'https://mojo-digital-wins.lovable.app';
    const inviteUrl = `${appUrl}/accept-invite?token=${invitation.token}`;

    // Build email content using template
    const emailSubject = body.type === 'platform_admin'
      ? 'You\'ve been invited as a Platform Admin'
      : `You've been invited to join ${organizationName}`;

    const emailHtml = userInvite({
      email: body.email,
      inviteUrl: inviteUrl,
      invitationType: body.type as 'platform_admin' | 'organization_member',
      organizationName: organizationName || undefined,
      role: body.role || undefined,
      expiresIn: '7 days',
    });

    // Check if email is configured and send
    let emailSent = false;
    let emailError: string | null = null;

    if (isEmailConfigured()) {
      try {
        await sendEmail({
          to: body.email,
          subject: emailSubject,
          html: emailHtml,
          fromName: body.type === 'platform_admin' ? 'Platform Admin' : organizationName || 'Team',
        });
        emailSent = true;
        console.log('Invitation email sent successfully');
      } catch (err) {
        console.error('Email send failed:', err);
        emailError = err instanceof EmailError ? err.message : 'Failed to send email';
        // Invitation was still created, so we'll return partial success
      }
    } else {
      console.log('Email not configured - SENDER_EMAIL and RESEND_API_KEY required');
      emailError = 'Email service not configured';
    }

    // Log the action
    try {
      await supabase.rpc('log_admin_action', {
        p_action_type: 'invitation_sent',
        p_table_affected: 'user_invitations',
        p_record_id: invitation.id,
        p_new_value: {
          email: body.email,
          type: body.type,
          organization_id: body.organization_id,
          role: body.role,
          email_sent: emailSent
        }
      });
    } catch (logErr) {
      console.error('Failed to log action:', logErr);
    }

    // Return appropriate response based on email status
    if (emailSent) {
      return new Response(
        JSON.stringify({
          success: true,
          invitation_id: invitation.id,
          invite_url: inviteUrl,
          email_sent: true,
          message: 'Invitation sent successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Invitation created but email failed - return partial success with warning
      return new Response(
        JSON.stringify({
          success: false,
          invitation_id: invitation.id,
          invite_url: inviteUrl,
          email_sent: false,
          error: emailError || 'Email delivery failed',
          error_code: 'EMAIL_SEND_FAILED',
          message: 'Invitation created but email failed to send. Please share the invite URL manually.'
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in send-user-invitation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});