/**
 * ActBlue Data Reconciliation Function
 * 
 * This function runs daily (via cron) to detect and fix gaps in ActBlue transaction data.
 * It compares our stored transaction count with a fresh count from ActBlue's API
 * for the last 7 days and triggers a mini-backfill if discrepancies are found.
 * 
 * Triggered by: Cron job (daily at 6am ET)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";
import { createLogger } from "../_shared/logger.ts";

interface ReconciliationResult {
  organization_id: string;
  organization_name: string;
  our_count: number;
  our_total: number;
  actblue_count: number | null;
  actblue_total: number | null;
  difference_count: number;
  difference_amount: number;
  status: 'ok' | 'discrepancy' | 'error';
  backfill_triggered: boolean;
  error?: string;
}

interface OrganizationCredentials {
  organization_id: string;
  organization_name: string;
  username: string;
  password: string;
}

const RECONCILIATION_DAYS = 7;  // Look back 7 days
const DISCREPANCY_THRESHOLD_PERCENT = 1;  // 1% difference triggers backfill
const DISCREPANCY_THRESHOLD_AMOUNT = 100; // Or $100 difference

serve(async (req) => {
  const logger = createLogger('reconcile-actblue-data');
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate authentication (cron or admin)
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      logger.warn('Unauthorized reconciliation attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse optional request body for specific org
    let targetOrgId: string | null = null;
    try {
      const body = await req.json();
      targetOrgId = body?.organization_id || null;
    } catch {
      // No body, reconcile all orgs
    }

    logger.info('Starting ActBlue data reconciliation', { targetOrgId });

    // Get all organizations with active ActBlue credentials
    let query = supabase
      .from('client_api_credentials')
      .select(`
        organization_id,
        encrypted_credentials,
        client_organizations!inner(name)
      `)
      .eq('platform', 'actblue')
      .eq('is_active', true);
    
    if (targetOrgId) {
      query = query.eq('organization_id', targetOrgId);
    }

    const { data: credentials, error: credError } = await query;

    if (credError) {
      logger.error('Failed to fetch credentials', { message: credError.message });
      throw credError;
    }

    if (!credentials || credentials.length === 0) {
      logger.info('No organizations with active ActBlue credentials found');
      return new Response(
        JSON.stringify({ success: true, message: 'No organizations to reconcile', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - RECONCILIATION_DAYS);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    logger.info(`Reconciling data from ${startDateStr} to ${endDateStr}`);

    const results: ReconciliationResult[] = [];

    for (const cred of credentials) {
      const orgId = cred.organization_id;
      const orgName = (cred.client_organizations as any)?.name || 'Unknown';
      const config = cred.encrypted_credentials as any;

      try {
        // Get our stored count
        const { data: ourData, error: ourError } = await supabase
          .from('actblue_transactions')
          .select('amount')
          .eq('organization_id', orgId)
          .gte('transaction_date', startDateStr)
          .lte('transaction_date', endDateStr);

        if (ourError) throw ourError;

        const ourCount = ourData?.length || 0;
        const ourTotal = ourData?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;

        // Get ActBlue count via API (quick count request)
        let actblueCount: number | null = null;
        let actblueTotal: number | null = null;
        
        try {
          const actblueResult = await fetchActBlueCount(
            config.username,
            config.password,
            startDateStr,
            endDateStr,
            logger
          );
          actblueCount = actblueResult.count;
          actblueTotal = actblueResult.total;
        } catch (apiError: any) {
          logger.warn(`Failed to fetch ActBlue count for ${orgName}`, { error: apiError.message });
        }

        // Calculate difference
        const diffCount = actblueCount !== null ? actblueCount - ourCount : 0;
        const diffAmount = actblueTotal !== null ? actblueTotal - ourTotal : 0;

        // Determine if discrepancy exceeds threshold
        const percentDiff = ourTotal > 0 ? Math.abs(diffAmount) / ourTotal * 100 : 0;
        const hasDiscrepancy = 
          Math.abs(diffCount) > 0 ||
          percentDiff > DISCREPANCY_THRESHOLD_PERCENT ||
          Math.abs(diffAmount) > DISCREPANCY_THRESHOLD_AMOUNT;

        let backfillTriggered = false;

        // Trigger backfill if discrepancy found and ActBlue has more data
        if (hasDiscrepancy && diffCount > 0) {
          logger.info(`Discrepancy found for ${orgName}: missing ${diffCount} transactions ($${diffAmount.toFixed(2)})`);
          
          // Trigger a mini-backfill for the reconciliation period
          try {
            const backfillResponse = await fetch(`${supabaseUrl}/functions/v1/backfill-actblue-csv-orchestrator`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'x-cron-secret': Deno.env.get('CRON_SECRET') || '',
              },
              body: JSON.stringify({
                organization_id: orgId,
                start_date: startDateStr,
                end_date: endDateStr,
                start_immediately: true,
              }),
            });

            if (backfillResponse.ok) {
              backfillTriggered = true;
              logger.info(`Backfill triggered for ${orgName}`);
            } else {
              const errorText = await backfillResponse.text();
              logger.warn(`Failed to trigger backfill for ${orgName}: ${errorText}`);
            }
          } catch (backfillError: any) {
            logger.warn(`Backfill trigger error for ${orgName}`, { error: backfillError.message });
          }
        }

        results.push({
          organization_id: orgId,
          organization_name: orgName,
          our_count: ourCount,
          our_total: Math.round(ourTotal * 100) / 100,
          actblue_count: actblueCount,
          actblue_total: actblueTotal !== null ? Math.round(actblueTotal * 100) / 100 : null,
          difference_count: diffCount,
          difference_amount: Math.round(diffAmount * 100) / 100,
          status: hasDiscrepancy ? 'discrepancy' : 'ok',
          backfill_triggered: backfillTriggered,
        });

      } catch (orgError: any) {
        logger.error(`Error reconciling ${orgName}`, { error: orgError.message });
        results.push({
          organization_id: orgId,
          organization_name: orgName,
          our_count: 0,
          our_total: 0,
          actblue_count: null,
          actblue_total: null,
          difference_count: 0,
          difference_amount: 0,
          status: 'error',
          backfill_triggered: false,
          error: orgError.message,
        });
      }
    }

    // Log summary
    const discrepancies = results.filter(r => r.status === 'discrepancy');
    const backfills = results.filter(r => r.backfill_triggered);
    
    logger.info('Reconciliation complete', {
      total_orgs: results.length,
      discrepancies: discrepancies.length,
      backfills_triggered: backfills.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        date_range: { start: startDateStr, end: endDateStr },
        summary: {
          total_organizations: results.length,
          discrepancies_found: discrepancies.length,
          backfills_triggered: backfills.length,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Reconciliation failed', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Fetch transaction count from ActBlue API
 * Uses a quick CSV request to get row count without downloading full data
 */
async function fetchActBlueCount(
  username: string,
  password: string,
  startDate: string,
  endDate: string,
  logger: ReturnType<typeof createLogger>
): Promise<{ count: number; total: number }> {
  const baseUrl = 'https://secure.actblue.com/api/v1/csvs';
  const auth = btoa(`${username}:${password}`);

  // Create CSV request
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
    throw new Error(`ActBlue API error ${createResponse.status}`);
  }

  const createData = await createResponse.json();
  const csvId = createData.id;

  if (!csvId) {
    throw new Error('ActBlue API did not return a CSV ID');
  }

  // Poll until ready (timeout after 2 minutes)
  let csvUrl = null;
  let attempts = 0;
  const maxAttempts = 12;

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

  // Download and count rows
  const csvResponse = await fetch(csvUrl);
  if (!csvResponse.ok) {
    throw new Error(`Failed to download CSV: ${csvResponse.status}`);
  }

  const csvText = await csvResponse.text();
  const lines = csvText.split('\n').filter(line => line.trim());
  
  // First line is header, rest are data
  const count = Math.max(0, lines.length - 1);
  
  // Parse to get total amount
  let total = 0;
  if (lines.length > 1) {
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const amountIndex = headers.findIndex(h => h === 'amount');
    
    if (amountIndex >= 0) {
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const amount = parseFloat(values[amountIndex]) || 0;
        total += amount;
      }
    }
  }

  return { count, total };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/"/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/"/g, ''));
  
  return values;
}
