/**
 * ActBlue CSV Backfill Orchestrator
 * 
 * This function creates a scalable backfill job by:
 * 1. Using smart chunk sizing based on date range
 * 2. Splitting the date range into optimally-sized chunks
 * 3. For small ranges (≤7 days), processing inline for instant results
 * 4. For larger ranges, creating chunk records for parallel cron processing
 * 
 * This avoids timeouts by delegating actual processing to process-actblue-chunk
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";
import { createLogger } from "../_shared/logger.ts";

interface BackfillRequest {
  organization_id: string;
  days_back?: number;  // Default 365 (1 year) - used if start_date/end_date not provided
  start_date?: string;  // Explicit start date (YYYY-MM-DD) - takes priority over days_back
  end_date?: string;    // Explicit end date (YYYY-MM-DD) - defaults to today
  chunk_size_days?: number;  // Override auto chunk size calculation
  start_immediately?: boolean;  // Whether to start processing first chunk immediately
}

interface ChunkData {
  chunk_index: number;
  start_date: string;
  end_date: string;
}

/**
 * Calculate optimal chunk size based on date range
 * Smaller ranges = smaller/no chunks for faster processing
 */
function calculateOptimalChunkSize(rangeDays: number): { chunkSizeDays: number; processInline: boolean } {
  if (rangeDays <= 7) {
    // 7 days or less: process inline (instant mode)
    return { chunkSizeDays: rangeDays + 1, processInline: true };
  } else if (rangeDays <= 14) {
    // 2 weeks: single chunk, but use cron
    return { chunkSizeDays: 15, processInline: false };
  } else if (rangeDays <= 30) {
    // 1 month: 2 chunks of ~15 days
    return { chunkSizeDays: 15, processInline: false };
  } else if (rangeDays <= 90) {
    // 3 months: weekly chunks (more parallel processing)
    return { chunkSizeDays: 7, processInline: false };
  } else {
    // Large backfills: monthly chunks
    return { chunkSizeDays: 30, processInline: false };
  }
}

/**
 * Generate chunks for the backfill period
 * @param rangeStart - Start of the date range
 * @param rangeEnd - End of the date range (inclusive)
 * @param chunkSizeDays - Size of each chunk in days
 */
function generateChunks(rangeStart: Date, rangeEnd: Date, chunkSizeDays: number): ChunkData[] {
  const chunks: ChunkData[] = [];
  
  // Include the end date (add 1 day)
  const endDate = new Date(rangeEnd);
  endDate.setDate(endDate.getDate() + 1);
  
  const startDate = new Date(rangeStart);
  
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

/**
 * Fetch ActBlue data for inline processing (small date ranges)
 */
async function fetchActBlueDataInline(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  logger: ReturnType<typeof createLogger>
): Promise<{ processed: number; inserted: number; success: boolean; error?: string }> {
  // Get ActBlue credentials
  const { data: credentials, error: credError } = await supabase
    .from('client_api_credentials')
    .select('encrypted_credentials')
    .eq('organization_id', organizationId)
    .eq('platform', 'actblue')
    .eq('is_active', true)
    .single();

  if (credError || !credentials) {
    return { processed: 0, inserted: 0, success: false, error: 'No ActBlue credentials found' };
  }

  const config = credentials.encrypted_credentials as any;
  const baseUrl = 'https://secure.actblue.com/api/v1/csvs';
  const auth = btoa(`${config.username}:${config.password}`);

  logger.info(`Inline processing: ${startDate} to ${endDate}`);

  try {
    // Step 1: Create CSV request
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

    // Step 2: Poll until ready (shorter timeout for inline - 3 minutes)
    let csvUrl = null;
    let attempts = 0;
    const maxAttempts = 18; // 3 minutes at 10s intervals

    while (!csvUrl && attempts < maxAttempts) {
      attempts++;
      
      const statusResponse = await fetch(`${baseUrl}/${csvId}`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` },
      });

      if (!statusResponse.ok) {
        throw new Error(`ActBlue status check error ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      
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

    // Step 3: Download and parse
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      throw new Error(`Failed to download CSV: ${csvResponse.status}`);
    }

    const csvText = await csvResponse.text();
    const rows = parseCSVInline(csvText);

    logger.info(`Fetched ${rows.length} rows from ActBlue`);

    // Step 4: Process and insert
    const stats = await processRowsInline(supabase, rows, organizationId, logger);

    return { 
      processed: stats.processed, 
      inserted: stats.inserted, 
      success: true 
    };

  } catch (error: any) {
    logger.error('Inline processing failed', { message: error.message });
    return { 
      processed: 0, 
      inserted: 0, 
      success: false, 
      error: error.message 
    };
  }
}

function parseCSVInline(csvText: string): any[] {
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

async function processRowsInline(
  supabase: any,
  rows: any[],
  organizationId: string,
  logger: ReturnType<typeof createLogger>
): Promise<{ processed: number; inserted: number }> {
  const stats = { processed: 0, inserted: 0 };
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const transactions: any[] = [];

    for (const row of batch) {
      stats.processed++;
      
      const lineitemIdStr = row.lineitem_id;
      const receiptIdStr = row.receipt_id;
      const transactionId = lineitemIdStr || receiptIdStr;
      
      if (!transactionId) continue;

      const firstName = row.donor_firstname || row.donor_first_name || null;
      const lastName = row.donor_lastname || row.donor_last_name || null;
      const donorName = firstName && lastName
        ? `${firstName} ${lastName}`.trim()
        : (firstName || lastName || null);

      transactions.push({
        organization_id: organizationId,
        transaction_id: transactionId,
        lineitem_id: lineitemIdStr ? parseInt(lineitemIdStr) : null,
        receipt_id: receiptIdStr || null,
        donor_email: row.donor_email || null,
        donor_name: donorName,
        first_name: firstName,
        last_name: lastName,
        amount: parseFloat(row.amount) || 0,
        contribution_form: row.fundraising_page || null,
        refcode: row.reference_code || null,
        transaction_date: row.paid_at || row.date,
        addr1: row.donor_addr1 || null,
        city: row.donor_city || null,
        state: row.donor_state || null,
        zip: row.donor_zip || null,
        country: row.donor_country || null,
      });
    }

    if (transactions.length === 0) continue;

    const { data, error } = await supabase
      .from('actblue_transactions')
      .upsert(transactions, {
        onConflict: 'transaction_id,organization_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (!error) {
      stats.inserted += data?.length || transactions.length;
    } else {
      logger.warn(`Batch upsert error: ${error.message}`);
    }
  }

  return stats;
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
      start_date,
      end_date,
      chunk_size_days: overrideChunkSize,
      start_immediately = false
    } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range - explicit dates take priority over days_back
    const now = new Date();
    const rangeEnd = end_date ? new Date(end_date) : now;
    const rangeStart = start_date 
      ? new Date(start_date) 
      : new Date(now.getTime() - days_back * 24 * 60 * 60 * 1000);

    // Calculate range in days
    const rangeDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000));

    // Smart chunk sizing
    const { chunkSizeDays, processInline } = overrideChunkSize 
      ? { chunkSizeDays: overrideChunkSize, processInline: false }
      : calculateOptimalChunkSize(rangeDays);

    logger.info(`Starting backfill orchestration for org ${organization_id}`, {
      start_date: rangeStart.toISOString().split('T')[0],
      end_date: rangeEnd.toISOString().split('T')[0],
      range_days: rangeDays,
      chunk_size_days: chunkSizeDays,
      process_inline: processInline,
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

    // INSTANT MODE: For small date ranges, process inline
    if (processInline) {
      logger.info('Using instant mode for small date range');
      
      const startDateStr = rangeStart.toISOString().split('T')[0];
      const endDateStr = rangeEnd.toISOString().split('T')[0];
      
      const result = await fetchActBlueDataInline(
        supabase,
        organization_id,
        startDateStr,
        endDateStr,
        logger
      );

      if (result.success) {
        logger.info(`Instant import completed: ${result.inserted} rows`);
        return new Response(
          JSON.stringify({
            success: true,
            instant: true,
            organization_id,
            processed: result.processed,
            inserted: result.inserted,
            message: `Imported ${result.inserted} transactions instantly.`,
            date_range: { start: startDateStr, end: endDateStr }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        logger.error('Instant import failed, falling back to chunked processing');
        // Fall through to chunked processing
      }
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

    // Generate chunks using calculated date range
    const chunks = generateChunks(rangeStart, rangeEnd, chunkSizeDays);
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

    // Calculate estimated time (3 chunks processed per 2-minute cron = ~40s per chunk effective)
    const CHUNKS_PER_CRON = 3;
    const CRON_INTERVAL_MINUTES = 2;
    const cronRuns = Math.ceil(chunks.length / CHUNKS_PER_CRON);
    const estimatedMinutes = cronRuns * CRON_INTERVAL_MINUTES;

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
        estimated_minutes: Math.max(2, Math.round(estimatedMinutes)),
        parallel_chunks: CHUNKS_PER_CRON,
        message: `Backfill job created with ${chunks.length} chunks. Processing ${CHUNKS_PER_CRON} chunks in parallel.`,
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
