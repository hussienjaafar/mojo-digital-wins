/**
 * ActBlue Chunk Processor
 * 
 * This function processes MULTIPLE chunks in parallel from actblue_backfill_chunks:
 * 1. Picks up the next N pending/retrying chunks (default: 3)
 * 2. Locks them (sets status to 'processing')
 * 3. Fetches data from ActBlue API for each date range in parallel
 * 4. Processes in batches with upserts
 * 5. Updates chunk statuses (completed/failed/retrying)
 * 6. Updates overall backfill_status progress
 * 
 * Called by cron every 2 minutes to continuously process chunks
 * Parallel processing significantly speeds up large backfills
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";
import { createLogger } from "../_shared/logger.ts";

// Configuration
const MAX_PARALLEL_CHUNKS = 3; // Process up to 3 chunks simultaneously
const RETRY_DELAYS = [60, 300, 900]; // Retry delays in seconds: 1min, 5min, 15min

interface ChunkRecord {
  id: string;
  organization_id: string;
  job_id: string;
  chunk_index: number;
  start_date: string;
  end_date: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
}

interface ChunkResult {
  chunkId: string;
  chunkIndex: number;
  success: boolean;
  processed?: number;
  inserted?: number;
  error?: string;
  willRetry?: boolean;
}

/**
 * Fetch ActBlue CSV data for a date range
 */
async function fetchActBlueData(
  username: string,
  password: string,
  startDate: string,
  endDate: string,
  logger: ReturnType<typeof createLogger>
): Promise<any[]> {
  const baseUrl = 'https://secure.actblue.com/api/v1/csvs';
  const auth = btoa(`${username}:${password}`);
  
  logger.info(`Creating ActBlue CSV request: ${startDate} to ${endDate}`);
  
  // Step 1: POST to create the CSV request
  const createResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      csv_type: 'paid_contributions',
      date_range_start: startDate,
      date_range_end: endDate,
    }),
  });
  
  if (createResponse.status !== 202 && createResponse.status !== 200) {
    const errorText = await createResponse.text();
    throw new Error(`ActBlue API error ${createResponse.status}: ${errorText}`);
  }
  
  const createData = await createResponse.json();
  const csvId = createData.id;
  
  if (!csvId) {
    throw new Error('ActBlue API did not return a CSV ID');
  }
  
  logger.info(`CSV request created with ID: ${csvId}`);
  
  // Step 2: Poll until CSV is ready (max 5 minutes)
  let csvUrl = null;
  let attempts = 0;
  const maxAttempts = 30;
  
  while (!csvUrl && attempts < maxAttempts) {
    attempts++;
    
    const statusResponse = await fetch(`${baseUrl}/${csvId}`, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` },
    });
    
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`ActBlue status check error ${statusResponse.status}: ${errorText}`);
    }
    
    const statusData = await statusResponse.json();
    logger.debug(`CSV status (attempt ${attempts}): ${statusData.status}`);
    
    if (statusData.status === 'complete') {
      csvUrl = statusData.download_url;
      break;
    } else if (statusData.status === 'failed') {
      throw new Error('ActBlue CSV generation failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  if (!csvUrl) {
    throw new Error('ActBlue CSV generation timed out');
  }
  
  // Step 3: Download and parse CSV
  const csvResponse = await fetch(csvUrl);
  if (!csvResponse.ok) {
    throw new Error(`Failed to download ActBlue CSV: ${csvResponse.status}`);
  }
  
  const csvText = await csvResponse.text();
  const rows = parseCSV(csvText);
  
  logger.info(`Fetched ${rows.length} rows from ActBlue`);
  return rows;
}

/**
 * Parse CSV text into array of row objects
 */
function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => 
    h.trim().replace(/"/g, '').toLowerCase().replace(/\s+/g, '_')
  );
  
  const rows: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Helper functions for parsing ActBlue data
 */
function parseBoolean(value: string | undefined | null): boolean {
  if (!value) return false;
  const lowered = value.toLowerCase().trim();
  return lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'y';
}

function getDonorFirstName(row: any): string | null {
  return row.donor_firstname || row.donor_first_name || row.donor_first || row.firstname || row.first_name || null;
}

function getDonorLastName(row: any): string | null {
  return row.donor_lastname || row.donor_last_name || row.donor_last || row.lastname || row.last_name || null;
}

function getABTestName(row: any): string | null {
  return row.ab_test_name || row['a/b_test_name'] || row.abtest_name || null;
}

function getABTestVariation(row: any): string | null {
  return row.ab_variation || row['a/b_variation'] || row.ab_test_variation || null;
}

/**
 * Process rows and upsert to database in batches
 */
async function processRows(
  supabase: any,
  rows: any[],
  organizationId: string,
  logger: ReturnType<typeof createLogger>
): Promise<{ processed: number; inserted: number; updated: number; skipped: number }> {
  const stats = { processed: 0, inserted: 0, updated: 0, skipped: 0 };
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const transactions: any[] = [];
    
    for (const row of batch) {
      stats.processed++;
      
      const lineitemIdStr = row.lineitem_id;
      const receiptIdStr = row.receipt_id;
      const transactionId = lineitemIdStr || receiptIdStr;
      
      if (!transactionId) {
        stats.skipped++;
        continue;
      }
      
      const firstName = getDonorFirstName(row);
      const lastName = getDonorLastName(row);
      const donorName = firstName && lastName
        ? `${firstName} ${lastName}`.trim()
        : (firstName || lastName || null);
      
      let transactionType = 'donation';
      if (row.refund_id && row.refund_date) {
        transactionType = 'refund';
      }
      
      // Extract source campaign from refcode
      let sourceCampaign = null;
      const refcode = row.reference_code || '';
      if (refcode) {
        const lowerRefcode = refcode.toLowerCase();
        if (lowerRefcode.includes('meta') || lowerRefcode.includes('fb_') || lowerRefcode.includes('ig_') || lowerRefcode.includes('facebook')) {
          sourceCampaign = 'meta';
        } else if (lowerRefcode.includes('sms') || lowerRefcode.includes('sw_') || lowerRefcode.includes('text') || lowerRefcode.includes('switchboard')) {
          sourceCampaign = 'sms';
        } else if (lowerRefcode.includes('email') || lowerRefcode.includes('em_') || lowerRefcode.includes('eoy') || lowerRefcode.includes('eod')) {
          sourceCampaign = 'email';
        } else if (lowerRefcode.includes('organic') || lowerRefcode.includes('direct') || lowerRefcode.includes('web')) {
          sourceCampaign = 'organic';
        } else if (lowerRefcode.includes('google') || lowerRefcode.includes('gdn') || lowerRefcode.includes('search')) {
          sourceCampaign = 'google';
        }
      }
      
      transactions.push({
        organization_id: organizationId,
        transaction_id: transactionId,
        lineitem_id: lineitemIdStr ? parseInt(lineitemIdStr) : null,
        receipt_id: receiptIdStr || null,
        donor_email: row.donor_email || null,
        donor_name: donorName,
        first_name: firstName,
        last_name: lastName,
        addr1: row.donor_addr1 || null,
        city: row.donor_city || null,
        state: row.donor_state || null,
        zip: row.donor_zip || null,
        country: row.donor_country || null,
        phone: row.donor_phone || null,
        employer: row.donor_employer || null,
        occupation: row.donor_occupation || null,
        amount: parseFloat(row.amount) || 0,
        order_number: row.payment_id || null,
        contribution_form: row.fundraising_page || null,
        refcode: row.reference_code || null,
        refcode2: row.reference_code_2 || null,
        source_campaign: sourceCampaign,
        ab_test_name: getABTestName(row),
        ab_test_variation: getABTestVariation(row),
        is_mobile: parseBoolean(row.mobile) || parseBoolean(row.is_mobile),
        is_express: parseBoolean(row.actblue_express_lane) || parseBoolean(row.new_express_signup),
        fee: row.fee ? parseFloat(row.fee) : null,
        card_type: row.card_type || null,
        recurring_upsell_shown: parseBoolean(row.recurring_upsell_shown),
        recurring_upsell_succeeded: parseBoolean(row.recurring_upsell_succeeded),
        smart_boost_amount: row.smart_boost_amount ? parseFloat(row.smart_boost_amount) : null,
        double_down: parseBoolean(row.double_down),
        text_message_option: row.text_message_option || null,
        entity_id: row.entity_id || null,
        committee_name: row.recipient || null,
        fec_id: row.fec_id || null,
        recurring_period: row.recurring_total_months ? 'monthly' : null,
        recurring_duration: parseInt(row.recurring_total_months) || null,
        is_recurring: !!row.recurring_total_months,
        transaction_type: transactionType,
        transaction_date: row.paid_at || row.date,
      });
    }
    
    if (transactions.length === 0) continue;
    
    // Batch upsert with ON CONFLICT
    const { data, error } = await supabase
      .from('actblue_transactions')
      .upsert(transactions, {
        onConflict: 'transaction_id,organization_id',
        ignoreDuplicates: false,
      })
      .select('id');
    
    if (error) {
      // If batch fails, try individual inserts
      logger.warn(`Batch upsert failed, falling back to individual inserts: ${error.message}`);
      
      for (const tx of transactions) {
        const { error: singleError } = await supabase
          .from('actblue_transactions')
          .upsert(tx, {
            onConflict: 'transaction_id,organization_id',
            ignoreDuplicates: false,
          });
        
        if (singleError) {
          if (singleError.code === '23505') {
            stats.skipped++;
          } else {
            logger.error(`Single insert error: ${singleError.message}`);
          }
        } else {
          stats.inserted++;
        }
      }
    } else {
      stats.inserted += data?.length || transactions.length;
    }
    
    // Log progress every 500 rows
    if (stats.processed % 500 === 0) {
      logger.info(`Progress: ${stats.processed} processed, ${stats.inserted} inserted`);
    }
  }
  
  return stats;
}

/**
 * Process a single chunk - used for parallel execution
 */
async function processSingleChunk(
  supabase: any,
  chunk: ChunkRecord,
  credentials: any,
  logger: ReturnType<typeof createLogger>
): Promise<ChunkResult> {
  const chunkLogger = createLogger(`process-chunk-${chunk.chunk_index}`);
  
  try {
    // Fetch data from ActBlue
    const rows = await fetchActBlueData(
      credentials.username,
      credentials.password,
      chunk.start_date,
      chunk.end_date,
      chunkLogger
    );

    // Process rows
    const stats = await processRows(supabase, rows, chunk.organization_id, chunkLogger);

    // Mark chunk as completed
    await supabase
      .from('actblue_backfill_chunks')
      .update({
        status: 'completed',
        processed_rows: stats.processed,
        inserted_rows: stats.inserted,
        updated_rows: stats.updated,
        skipped_rows: stats.skipped,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', chunk.id);

    chunkLogger.info(`Chunk ${chunk.chunk_index} completed`, stats);

    return {
      chunkId: chunk.id,
      chunkIndex: chunk.chunk_index,
      success: true,
      processed: stats.processed,
      inserted: stats.inserted,
    };

  } catch (error: any) {
    chunkLogger.error(`Chunk ${chunk.chunk_index} failed`, error);

    // Determine if we should retry
    const newAttemptCount = chunk.attempt_count + 1;
    const shouldRetry = newAttemptCount < chunk.max_attempts;

    if (shouldRetry) {
      const retryDelay = RETRY_DELAYS[newAttemptCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      const nextRetryAt = new Date(Date.now() + retryDelay * 1000).toISOString();

      await supabase
        .from('actblue_backfill_chunks')
        .update({
          status: 'retrying',
          error_message: error.message,
          next_retry_at: nextRetryAt,
        })
        .eq('id', chunk.id);

      chunkLogger.info(`Chunk ${chunk.chunk_index} scheduled for retry at ${nextRetryAt}`);
    } else {
      await supabase
        .from('actblue_backfill_chunks')
        .update({
          status: 'failed',
          error_message: `Failed after ${chunk.max_attempts} attempts: ${error.message}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', chunk.id);

      chunkLogger.error(`Chunk ${chunk.chunk_index} permanently failed`);
    }

    return {
      chunkId: chunk.id,
      chunkIndex: chunk.chunk_index,
      success: false,
      error: error.message,
      willRetry: shouldRetry,
    };
  }
}

serve(async (req) => {
  const logger = createLogger('process-actblue-chunk');
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate cron or admin authentication
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      logger.warn('Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: target a specific job
    let targetJobId: string | null = null;
    try {
      const body = await req.json();
      targetJobId = body.job_id || null;
    } catch {
      // No body provided, that's OK
    }

    // Find next chunks to process (up to MAX_PARALLEL_CHUNKS)
    let query = supabase
      .from('actblue_backfill_chunks')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order('chunk_index', { ascending: true })
      .limit(MAX_PARALLEL_CHUNKS);

    if (targetJobId) {
      query = query.eq('job_id', targetJobId);
    }

    const { data: chunks, error: queryError } = await query;

    if (queryError) {
      logger.error('Failed to query chunks', { message: queryError.message, code: queryError.code });
      throw queryError;
    }

    if (!chunks || chunks.length === 0) {
      logger.info('No pending chunks to process');
      return new Response(
        JSON.stringify({ message: 'No pending chunks', processed: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if any parent jobs are cancelled - skip those chunks
    const jobIds = [...new Set(chunks.map(c => c.job_id))];
    const { data: jobs } = await supabase
      .from('backfill_status')
      .select('id, status')
      .in('id', jobIds);

    const cancelledJobIds = new Set(
      (jobs || []).filter((j: any) => j.status === 'cancelled').map((j: any) => j.id)
    );

    // If any jobs are cancelled, mark their chunks as cancelled
    if (cancelledJobIds.size > 0) {
      for (const chunk of chunks) {
        if (cancelledJobIds.has(chunk.job_id)) {
          await supabase
            .from('actblue_backfill_chunks')
            .update({
              status: 'cancelled',
              error_message: 'Job was cancelled by user',
              completed_at: new Date().toISOString(),
            })
            .eq('id', chunk.id);
        }
      }
      // Filter out cancelled chunks
      const activeChunks = chunks.filter(c => !cancelledJobIds.has(c.job_id));
      if (activeChunks.length === 0) {
        logger.info('All chunks belong to cancelled jobs');
        return new Response(
          JSON.stringify({ message: 'All pending chunks cancelled', processed: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      chunks.length = 0;
      chunks.push(...activeChunks);
    }

    logger.info(`Found ${chunks.length} chunks to process in parallel`);

    // Group chunks by organization to get credentials once per org
    const chunksByOrg = new Map<string, ChunkRecord[]>();
    for (const chunk of chunks) {
      const orgChunks = chunksByOrg.get(chunk.organization_id) || [];
      orgChunks.push(chunk as ChunkRecord);
      chunksByOrg.set(chunk.organization_id, orgChunks);
    }

    // Lock all chunks first
    const chunkIds = chunks.map(c => c.id);
    const { error: lockError } = await supabase
      .from('actblue_backfill_chunks')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .in('id', chunkIds)
      .in('status', ['pending', 'retrying']);

    if (lockError) {
      logger.warn('Failed to lock some chunks', { message: lockError.message });
    }

    // Update attempt counts
    for (const chunk of chunks) {
      await supabase
        .from('actblue_backfill_chunks')
        .update({ attempt_count: (chunk.attempt_count || 0) + 1 })
        .eq('id', chunk.id);
    }

    // Get credentials for each organization
    const credentialsByOrg = new Map<string, any>();
    for (const orgId of chunksByOrg.keys()) {
      const { data: credentials, error: credError } = await supabase
        .from('client_api_credentials')
        .select('encrypted_credentials')
        .eq('organization_id', orgId)
        .eq('platform', 'actblue')
        .eq('is_active', true)
        .single();

      if (credError || !credentials) {
        logger.error('No ActBlue credentials found', { orgId });
        // Mark all chunks for this org as failed
        const orgChunks = chunksByOrg.get(orgId) || [];
        for (const chunk of orgChunks) {
          await supabase
            .from('actblue_backfill_chunks')
            .update({
              status: 'failed',
              error_message: 'No ActBlue credentials found',
              completed_at: new Date().toISOString(),
            })
            .eq('id', chunk.id);
        }
        chunksByOrg.delete(orgId);
      } else {
        credentialsByOrg.set(orgId, credentials.encrypted_credentials);
      }
    }

    // Process all chunks in parallel
    const processingPromises: Promise<ChunkResult>[] = [];
    
    for (const [orgId, orgChunks] of chunksByOrg) {
      const credentials = credentialsByOrg.get(orgId);
      if (!credentials) continue;
      
      for (const chunk of orgChunks) {
        processingPromises.push(
          processSingleChunk(supabase, chunk, credentials, logger)
        );
      }
    }

    // Wait for all chunks to complete
    const results = await Promise.allSettled(processingPromises);

    // Compile results
    const successfulChunks: ChunkResult[] = [];
    const failedChunks: ChunkResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successfulChunks.push(result.value);
        } else {
          failedChunks.push(result.value);
        }
      } else {
        // Promise rejected - unexpected error
        logger.error('Chunk processing promise rejected', { reason: result.reason });
      }
    }

    // Update job progress for all affected jobs
    const affectedJobIds = new Set(chunks.map(c => c.job_id));
    for (const jobId of affectedJobIds) {
      await updateJobProgress(supabase, jobId, logger);
    }

    const totalProcessed = successfulChunks.reduce((sum, r) => sum + (r.processed || 0), 0);
    const totalInserted = successfulChunks.reduce((sum, r) => sum + (r.inserted || 0), 0);

    logger.info(`Parallel processing complete`, {
      chunksAttempted: chunks.length,
      successful: successfulChunks.length,
      failed: failedChunks.length,
      totalProcessed,
      totalInserted,
    });

    return new Response(
      JSON.stringify({
        success: true,
        parallel: true,
        chunks_attempted: chunks.length,
        chunks_successful: successfulChunks.length,
        chunks_failed: failedChunks.length,
        total_processed: totalProcessed,
        total_inserted: totalInserted,
        results: {
          successful: successfulChunks,
          failed: failedChunks,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Processor error', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Update overall job progress in backfill_status
 * 
 * IMPORTANT: This function now respects the 'cancelled' status and treats
 * cancelled chunks as terminal (done). It will NOT overwrite a job that
 * has already been marked as 'cancelled'.
 */
async function updateJobProgress(
  supabase: any,
  jobId: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    // First, check the current job status - if already cancelled, don't overwrite
    const { data: currentJob } = await supabase
      .from('backfill_status')
      .select('status, completed_at')
      .eq('id', jobId)
      .single();

    if (!currentJob) {
      logger.warn(`Job ${jobId} not found during progress update`);
      return;
    }

    // If job is already cancelled, only update completed_at if not set
    if (currentJob.status === 'cancelled') {
      if (!currentJob.completed_at) {
        await supabase
          .from('backfill_status')
          .update({
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }
      logger.info(`Job ${jobId} is cancelled, not updating status`);
      return;
    }

    // Get chunk stats for this job
    const { data: chunks } = await supabase
      .from('actblue_backfill_chunks')
      .select('status, processed_rows, inserted_rows')
      .eq('job_id', jobId);

    if (!chunks) return;

    const total = chunks.length;
    const completed = chunks.filter((c: any) => c.status === 'completed').length;
    const failed = chunks.filter((c: any) => c.status === 'failed').length;
    const cancelled = chunks.filter((c: any) => c.status === 'cancelled').length;
    const totalProcessed = chunks.reduce((sum: number, c: any) => sum + (c.processed_rows || 0), 0);
    const totalInserted = chunks.reduce((sum: number, c: any) => sum + (c.inserted_rows || 0), 0);

    // Terminal chunks include completed, failed, AND cancelled
    const terminalChunks = completed + failed + cancelled;
    const allDone = terminalChunks === total;

    // Determine the appropriate status
    let status: string;
    if (allDone) {
      if (cancelled > 0 && cancelled === total - completed) {
        // All non-completed chunks were cancelled
        status = 'cancelled';
      } else if (failed > 0) {
        status = 'completed_with_errors';
      } else {
        status = 'completed';
      }
    } else {
      status = 'running';
    }

    // Update the job progress (processed_items now includes cancelled for accurate progress)
    await supabase
      .from('backfill_status')
      .update({
        status,
        processed_items: terminalChunks, // Include cancelled in progress
        failed_items: failed,
        total_items: total,
        updated_at: new Date().toISOString(),
        completed_at: allDone ? new Date().toISOString() : null,
      })
      .eq('id', jobId);

    if (allDone) {
      logger.info(`Job ${jobId} finished: status=${status}, completed=${completed}, failed=${failed}, cancelled=${cancelled}, rows=${totalInserted}`);
    }
  } catch (e: any) {
    logger.error('Failed to update job progress', { message: e?.message || String(e) });
  }
}
