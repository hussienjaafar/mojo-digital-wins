/**
 * Cancel Backfill Job
 * 
 * Cancels a backfill job and all its pending/retrying chunks.
 * Requires authentication and authorization (user must belong to org or be admin).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";
import { createLogger } from "../_shared/logger.ts";

serve(async (req) => {
  const logger = createLogger('cancel-backfill');
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let jobId: string | null = null;
    let organizationId: string | null = null;
    try {
      const body = await req.json();
      jobId = body.job_id || null;
      organizationId = body.organization_id || null;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate authorization - allow CRON_SECRET or admin, or authenticated user with org membership
    const authResult = await validateCronOrAdmin(req, supabase);
    let isAuthorized = authResult.valid;
    
    if (!isAuthorized) {
      // Try user JWT auth - check if user is logged in and has access to the organization
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (!userError && user) {
          // Check if user belongs to the organization (if organizationId provided)
          if (organizationId) {
            const { data: membership } = await supabase
              .from('organization_members')
              .select('id')
              .eq('user_id', user.id)
              .eq('organization_id', organizationId)
              .maybeSingle();
            
            if (membership) {
              isAuthorized = true;
            }
          } else {
            // If no org provided, check if the job belongs to an org the user is a member of
            const { data: job } = await supabase
              .from('backfill_status')
              .select('task_name')
              .eq('id', jobId)
              .single();
            
            if (job?.task_name) {
              // Extract org ID from task_name (format: "actblue CSV backfill_{org_id}")
              const match = job.task_name.match(/actblue CSV backfill_([a-f0-9-]+)/i);
              if (match) {
                const extractedOrgId = match[1];
                const { data: membership } = await supabase
                  .from('organization_members')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('organization_id', extractedOrgId)
                  .maybeSingle();
                
                if (membership) {
                  isAuthorized = true;
                }
              }
            }
          }
          
          // Also check if user is admin
          if (!isAuthorized) {
            const { data: adminRole } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .eq('role', 'admin')
              .maybeSingle();
            
            if (adminRole) {
              isAuthorized = true;
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      logger.warn('Unauthorized cancellation attempt', { jobId });
      return new Response(
        JSON.stringify({ error: 'Unauthorized - you must be a member of the organization or an admin' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify job exists and is in a cancellable state
    const { data: job, error: jobFetchError } = await supabase
      .from('backfill_status')
      .select('id, status')
      .eq('id', jobId)
      .single();

    if (jobFetchError || !job) {
      logger.error('Job not found', { jobId, error: jobFetchError?.message });
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: true, message: 'Job already cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.status === 'completed' || job.status === 'completed_with_errors') {
      return new Response(
        JSON.stringify({ error: 'Cannot cancel a completed job' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Cancelling backfill job', { jobId, previousStatus: job.status });

    // Update job status to cancelled
    const { error: jobUpdateError } = await supabase
      .from('backfill_status')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Cancelled by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (jobUpdateError) {
      logger.error('Failed to update job status', { jobId, error: jobUpdateError.message });
      throw new Error(`Failed to cancel job: ${jobUpdateError.message}`);
    }

    // Cancel all pending, retrying, and processing chunks
    const { data: updatedChunks, error: chunkUpdateError } = await supabase
      .from('actblue_backfill_chunks')
      .update({
        status: 'cancelled',
        error_message: 'Job was cancelled by user',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId)
      .in('status', ['pending', 'retrying', 'processing'])
      .select('id');

    if (chunkUpdateError) {
      logger.warn('Failed to cancel some chunks', { jobId, error: chunkUpdateError.message });
      // Don't throw - the job is already cancelled
    }

    const cancelledChunksCount = updatedChunks?.length || 0;
    logger.info('Backfill job cancelled successfully', { 
      jobId, 
      cancelledChunks: cancelledChunksCount 
    });

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        cancelled_chunks: cancelledChunksCount,
        message: `Job cancelled. ${cancelledChunksCount} pending chunks were cancelled.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Cancel backfill error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
