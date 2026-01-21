/**
 * ActBlue CSV Backfill Orchestrator
 * 
 * This function creates a scalable backfill job by:
 * 1. Splitting the date range into monthly chunks
 * 2. Inserting chunk records into actblue_backfill_chunks table
 * 3. Creating a job entry in backfill_status for progress tracking
 * 4. Returning immediately with job ID (processing happens via cron)
 * 
 * This avoids timeouts by delegating actual processing to process-actblue-chunk
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";
import { createLogger } from "../_shared/logger.ts";

interface BackfillRequest {
  organization_id: string;
  days_back?: number;  // Default 365 (1 year)
  chunk_size_days?: number;  // Default 30 (monthly chunks)
  start_immediately?: boolean;  // Whether to start processing first chunk immediately
}

interface ChunkData {
  chunk_index: number;
  start_date: string;
  end_date: string;
}

/**
 * Generate monthly chunks for the backfill period
 */
function generateChunks(daysBack: number, chunkSizeDays: number): ChunkData[] {
  const chunks: ChunkData[] = [];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 1); // Include today
  
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysBack);
  
  let chunkIndex = 0;
  let currentEnd = new Date(endDate);
  
  while (currentEnd > startDate) {
    const chunkStart = new Date(currentEnd);
    chunkStart.setDate(chunkStart.getDate() - chunkSizeDays);
    
    // Don't go before the overall start date
    if (chunkStart < startDate) {
      chunkStart.setTime(startDate.getTime());
    }
    
    chunks.push({
      chunk_index: chunkIndex,
      start_date: chunkStart.toISOString().split('T')[0],
      end_date: currentEnd.toISOString().split('T')[0],
    });
    
    // Move to next chunk (going backwards in time)
    currentEnd = new Date(chunkStart);
    currentEnd.setDate(currentEnd.getDate() - 1);
    chunkIndex++;
  }
  
  return chunks;
}

serve(async (req) => {
  const logger = createLogger('backfill-actblue-csv-orchestrator');
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate authentication (admin or cron)
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      logger.warn('Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: BackfillRequest = await req.json();
    const { 
      organization_id, 
      days_back = 365,
      chunk_size_days = 30,
      start_immediately = false
    } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info(`Starting backfill orchestration for org ${organization_id}`, {
      days_back,
      chunk_size_days,
      start_immediately
    });

    // Verify organization has ActBlue credentials
    const { data: credentials, error: credError } = await supabase
      .from('client_api_credentials')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('platform', 'actblue')
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      logger.warn(`No ActBlue credentials for org ${organization_id}`);
      return new Response(
        JSON.stringify({ 
          error: 'No active ActBlue credentials found for this organization',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing running backfill job
    const { data: existingJob } = await supabase
      .from('backfill_status')
      .select('id, status, task_name')
      .eq('task_name', `actblue_csv_backfill_${organization_id}`)
      .eq('status', 'running')
      .maybeSingle();

    if (existingJob) {
      logger.info(`Existing backfill job found for org ${organization_id}`);
      return new Response(
        JSON.stringify({ 
          error: 'A backfill job is already running for this organization',
          job_id: existingJob.id,
          success: false 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate chunks
    const chunks = generateChunks(days_back, chunk_size_days);
    const jobId = crypto.randomUUID();

    logger.info(`Generated ${chunks.length} chunks for backfill job ${jobId}`);

    // Create backfill_status entry
    const { error: statusError } = await supabase
      .from('backfill_status')
      .upsert({
        id: jobId,
        task_name: `actblue_csv_backfill_${organization_id}`,
        status: 'running',
        total_items: chunks.length,
        processed_items: 0,
        failed_items: 0,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'task_name'
      });

    if (statusError) {
      logger.error('Failed to create backfill status', { message: statusError.message, code: statusError.code });
      throw statusError;
    }

    // Insert all chunks
    const chunkRecords = chunks.map(chunk => ({
      organization_id,
      job_id: jobId,
      chunk_index: chunk.chunk_index,
      start_date: chunk.start_date,
      end_date: chunk.end_date,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 3,
    }));

    const { error: chunksError } = await supabase
      .from('actblue_backfill_chunks')
      .insert(chunkRecords);

    if (chunksError) {
      logger.error('Failed to insert chunk records', { message: chunksError.message, code: chunksError.code });
      
      // Clean up the status entry
      await supabase
        .from('backfill_status')
        .update({ status: 'failed', error_message: chunksError.message })
        .eq('id', jobId);
      
      throw chunksError;
    }

    // Calculate estimated time (approximately 2-3 minutes per chunk)
    const estimatedMinutes = chunks.length * 2.5;

    // If start_immediately is true, trigger the first chunk processing
    if (start_immediately) {
      logger.info('Triggering immediate processing of first chunk');
      
      // Use EdgeRuntime.waitUntil to process in background without blocking response
      const processFirstChunk = async () => {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/process-actblue-chunk`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'x-cron-secret': Deno.env.get('CRON_SECRET') || '',
            },
            body: JSON.stringify({ job_id: jobId }),
          });
          
          if (!response.ok) {
            logger.error('Failed to trigger first chunk processing', { 
              status: response.status,
              statusText: response.statusText 
            });
          }
        } catch (e: any) {
          logger.error('Error triggering first chunk', { message: e?.message || String(e) });
        }
      };
      
      // @ts-ignore - EdgeRuntime is available in Deno Deploy
      if (typeof EdgeRuntime !== 'undefined') {
        // @ts-ignore
        EdgeRuntime.waitUntil(processFirstChunk());
      }
    }

    logger.info(`Backfill job ${jobId} created successfully`, {
      chunks: chunks.length,
      estimated_minutes: estimatedMinutes
    });

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        organization_id,
        chunks_created: chunks.length,
        estimated_minutes: Math.round(estimatedMinutes),
        message: `Backfill job created with ${chunks.length} chunks. Processing will start automatically.`,
        date_range: {
          start: chunks[chunks.length - 1]?.start_date,
          end: chunks[0]?.end_date,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Orchestrator error', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
