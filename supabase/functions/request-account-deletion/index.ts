import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";
import { transactional } from "../_shared/email-templates/index.ts";

/**
 * GDPR/CCPA Compliant Account Deletion Request
 *
 * Allows users to request deletion of their account and all associated data.
 * Per GDPR, deletion is scheduled for 30 days to allow for cancellation.
 */

interface DeletionRequest {
  action: 'request' | 'confirm' | 'cancel' | 'status';
  request_id?: string;
  reason?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
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

    const body: DeletionRequest = await req.json();
    const action = body.action || 'status';

    console.log(`[request-account-deletion] Action: ${action} for user ${user.id}`);

    switch (action) {
      case 'status': {
        // Get current deletion request status
        const { data: existingRequest } = await supabase
          .from('data_deletion_requests')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'confirmed', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return new Response(
          JSON.stringify({
            has_pending_request: !!existingRequest,
            request: existingRequest || null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'request': {
        // Check for existing request
        const { data: existingRequest } = await supabase
          .from('data_deletion_requests')
          .select('id, status')
          .eq('user_id', user.id)
          .in('status', ['pending', 'confirmed', 'processing'])
          .single();

        if (existingRequest) {
          return new Response(
            JSON.stringify({
              error: 'You already have a pending deletion request',
              request_id: existingRequest.id,
              status: existingRequest.status,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create new deletion request
        const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const { data: newRequest, error: insertError } = await supabase
          .from('data_deletion_requests')
          .insert({
            user_id: user.id,
            reason: body.reason,
            scheduled_for: scheduledFor.toISOString(),
            ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          })
          .select('*')
          .single();

        if (insertError) {
          console.error('[request-account-deletion] Insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to create deletion request' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Send confirmation email
        if (isEmailConfigured() && user.email) {
          try {
            const emailHtml = transactional.accountDeletion({
              scheduledDate: scheduledFor.toLocaleDateString(),
            });

            await sendEmail({
              to: user.email,
              subject: 'Account Deletion Request Received',
              html: emailHtml,
              fromName: 'Account Security',
            });
          } catch (emailError) {
            console.error('[request-account-deletion] Email failed:', emailError);
          }
        }

        // Log the action
        await supabase.from('admin_audit_logs').insert({
          user_id: user.id,
          action_type: 'deletion_requested',
          table_affected: 'data_deletion_requests',
          record_id: newRequest.id,
          new_value: { scheduled_for: scheduledFor.toISOString(), reason: body.reason },
        });

        return new Response(
          JSON.stringify({
            success: true,
            request_id: newRequest.id,
            scheduled_for: scheduledFor.toISOString(),
            message: 'Deletion request created. Please confirm to proceed.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'confirm': {
        if (!body.request_id) {
          return new Response(
            JSON.stringify({ error: 'request_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: request, error: updateError } = await supabase
          .from('data_deletion_requests')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', body.request_id)
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .select('*')
          .single();

        if (updateError || !request) {
          return new Response(
            JSON.stringify({ error: 'Request not found or already processed' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log confirmation
        await supabase.from('admin_audit_logs').insert({
          user_id: user.id,
          action_type: 'deletion_confirmed',
          table_affected: 'data_deletion_requests',
          record_id: request.id,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Deletion confirmed. Your account will be deleted on ' + new Date(request.scheduled_for).toLocaleDateString(),
            scheduled_for: request.scheduled_for,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel': {
        if (!body.request_id) {
          return new Response(
            JSON.stringify({ error: 'request_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: request, error: updateError } = await supabase
          .from('data_deletion_requests')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancellation_reason: body.reason,
          })
          .eq('id', body.request_id)
          .eq('user_id', user.id)
          .in('status', ['pending', 'confirmed'])
          .select('*')
          .single();

        if (updateError || !request) {
          return new Response(
            JSON.stringify({ error: 'Request not found or cannot be cancelled' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log cancellation
        await supabase.from('admin_audit_logs').insert({
          user_id: user.id,
          action_type: 'deletion_cancelled',
          table_affected: 'data_deletion_requests',
          record_id: request.id,
          new_value: { reason: body.reason },
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Deletion request cancelled successfully',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: request, confirm, cancel, or status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('[request-account-deletion] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
