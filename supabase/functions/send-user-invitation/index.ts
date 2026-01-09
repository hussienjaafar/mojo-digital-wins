import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  email: string;
  type: 'platform_admin' | 'organization_member';
  organization_id?: string;
  role?: 'admin' | 'manager' | 'viewer';
}

serve(async (req) => {
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

    const body: InvitationRequest = await req.json();
    console.log('Invitation request:', { ...body, requestedBy: user.id });

    // Validate request
    if (!body.email || !body.type) {
      return new Response(
        JSON.stringify({ error: 'Email and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

      // Check if user is platform admin OR org admin for this organization
      const { data: hasRole } = await supabase.rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' 
      });

      if (!hasRole) {
        // Check if user is org admin
        const { data: orgUser } = await supabase
          .from('client_users')
          .select('role')
          .eq('id', user.id)
          .eq('organization_id', body.organization_id)
          .single();

        if (!orgUser || orgUser.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'You must be a platform admin or organization admin to send invitations' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await supabase
      .from('user_invitations')
      .select('id, status')
      .eq('email', body.email.toLowerCase())
      .eq('invitation_type', body.type)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: 'There is already a pending invitation for this email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const appUrl = Deno.env.get('APP_URL') || supabaseUrl.replace('.supabase.co', '.lovable.app');
    const inviteUrl = `${appUrl}/accept-invite?token=${invitation.token}`;

    // Send the invitation email using Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (resendApiKey) {
      const emailSubject = body.type === 'platform_admin' 
        ? 'You\'ve been invited as a Platform Admin'
        : `You've been invited to join ${organizationName}`;

      const roleText = body.type === 'organization_member' 
        ? `You've been invited to join <strong>${organizationName}</strong> as a <strong>${body.role}</strong>.`
        : 'You\'ve been invited to become a <strong>Platform Admin</strong> with full system access.';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">You're Invited!</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">${roleText}</p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">Click the button below to accept your invitation:</p>
            <a href="${inviteUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0;">Accept Invitation</a>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">This invitation expires in 7 days.</p>
            <p style="color: #999; font-size: 12px;">If the button doesn't work, copy this link: ${inviteUrl}</p>
          </div>
        </body>
        </html>
      `;

      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: Deno.env.get('FROM_EMAIL') || 'noreply@resend.dev',
            to: body.email,
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          console.error('Email send failed:', emailError);
        } else {
          console.log('Invitation email sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the request if email fails - invitation is still created
      }
    } else {
      console.log('RESEND_API_KEY not configured, skipping email send');
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
          role: body.role 
        }
      });
    } catch (logErr) {
      console.error('Failed to log action:', logErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation_id: invitation.id,
        invite_url: inviteUrl,
        message: resendApiKey ? 'Invitation sent successfully' : 'Invitation created (email not configured)'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-user-invitation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});