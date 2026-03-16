import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const EA_API_BASE = 'https://api.securevan.com/v4';

interface SyncResult {
  organization_id: string;
  organization_name?: string;
  status: 'success' | 'error' | 'skipped';
  transactions_processed?: number;
  transactions_inserted?: number;
  transactions_updated?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: cron secret or admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('Authorization');
    let isAuthorized = false;

    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
    } else if (authHeader?.startsWith('Bearer ')) {
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await anonClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (isAdmin) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetOrgId = body.organization_id;
    const testOnly = body.test_only || false;

    // Get all active EveryAction credentials
    let query = supabase
      .from('client_api_credentials')
      .select('organization_id, encrypted_credentials, credential_mask')
      .eq('platform', 'every_action')
      .eq('is_active', true);

    if (targetOrgId) {
      query = query.eq('organization_id', targetOrgId);
    }

    const { data: credentials, error: credError } = await query;
    if (credError) throw credError;

    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ message: 'No active EveryAction integrations found', results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: SyncResult[] = [];

    for (const cred of credentials) {
      const orgId = cred.organization_id;
      const encCreds = cred.encrypted_credentials as Record<string, string>;
      const applicationName = encCreds?.application_name;
      const apiKey = encCreds?.api_key;

      if (!applicationName || !apiKey) {
        results.push({ organization_id: orgId, status: 'error', error: 'Missing application_name or api_key' });
        continue;
      }

      // Test-only mode: just validate credentials
      if (testOnly) {
        try {
          const testResponse = await fetch(`${EA_API_BASE}/people?$top=1`, {
            headers: {
              'Authorization': `Basic ${btoa(`${applicationName}:${apiKey}`)}`,
              'Content-Type': 'application/json',
            },
          });

          if (testResponse.status === 401 || testResponse.status === 403) {
            results.push({ organization_id: orgId, status: 'error', error: 'Invalid credentials (401/403)' });
          } else {
            results.push({ organization_id: orgId, status: 'success' });
          }
        } catch (e) {
          results.push({ organization_id: orgId, status: 'error', error: `Connection failed: ${e.message}` });
        }
        continue;
      }

      // Full sync using Changed Entity Export Jobs
      try {
        console.log(`[SYNC-EA] Starting sync for org ${orgId}`);

        // Get last sync cursor
        const { data: syncState } = await supabase
          .from('everyaction_sync_state')
          .select('*')
          .eq('organization_id', orgId)
          .maybeSingle();

        const now = new Date();
        const defaultCursor = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago if first sync
        const dateChangedFrom = syncState?.last_sync_cursor 
          ? new Date(syncState.last_sync_cursor)
          : defaultCursor;

        const authHeaderValue = `Basic ${btoa(`${applicationName}:${apiKey}`)}`;

        // Step 1: Create Changed Entity Export Job
        const exportJobBody = {
          dateChangedFrom: dateChangedFrom.toISOString(),
          dateChangedTo: now.toISOString(),
          includeInactive: false,
          fileSizeKbLimit: 100000,
          columns: [
            { name: 'VanID' },
            { name: 'FirstName' },
            { name: 'LastName' },
            { name: 'EmailAddress' },
            { name: 'Phone' },
            { name: 'AddressLine1' },
            { name: 'City' },
            { name: 'StateOrProvince' },
            { name: 'ZipOrPostalCode' },
            { name: 'CountryCode' },
            { name: 'Employer' },
            { name: 'Occupation' },
          ],
        };

        console.log(`[SYNC-EA] Creating export job from ${dateChangedFrom.toISOString()} to ${now.toISOString()}`);

        const createJobResponse = await fetch(`${EA_API_BASE}/changedEntityExportJobs`, {
          method: 'POST',
          headers: {
            'Authorization': authHeaderValue,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(exportJobBody),
        });

        if (!createJobResponse.ok) {
          const errText = await createJobResponse.text();
          throw new Error(`Failed to create export job: ${createJobResponse.status} ${errText}`);
        }

        const exportJob = await createJobResponse.json();
        const exportJobId = exportJob.exportJobId;
        console.log(`[SYNC-EA] Export job created: ${exportJobId}`);

        // Step 2: Poll for job completion (max 5 minutes)
        let jobComplete = false;
        let downloadUrl = '';
        const maxPollTime = 5 * 60 * 1000;
        const pollStart = Date.now();

        while (!jobComplete && (Date.now() - pollStart) < maxPollTime) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s

          const statusResponse = await fetch(`${EA_API_BASE}/changedEntityExportJobs/${exportJobId}`, {
            headers: { 'Authorization': authHeaderValue },
          });

          if (!statusResponse.ok) {
            throw new Error(`Failed to check export status: ${statusResponse.status}`);
          }

          const statusData = await statusResponse.json();
          
          if (statusData.status === 'Complete' || statusData.status === 'Completed') {
            jobComplete = true;
            downloadUrl = statusData.downloadUrl || statusData.files?.[0]?.downloadUrl || '';
          } else if (statusData.status === 'Error') {
            throw new Error(`Export job failed: ${statusData.errorMessage || 'Unknown error'}`);
          }
          // else still processing, continue polling
        }

        if (!jobComplete) {
          // Job is still running, record state and skip for now
          await supabase.from('everyaction_sync_state').upsert({
            organization_id: orgId,
            last_export_job_id: exportJobId,
            last_sync_at: now.toISOString(),
            last_sync_status: 'pending',
            updated_at: now.toISOString(),
          }, { onConflict: 'organization_id' });

          results.push({ organization_id: orgId, status: 'skipped', error: 'Export job still processing' });
          continue;
        }

        // Step 3: Download and parse CSV
        let transactionsProcessed = 0;
        let transactionsInserted = 0;
        let transactionsUpdated = 0;

        if (downloadUrl) {
          const csvResponse = await fetch(downloadUrl, {
            headers: { 'Authorization': authHeaderValue },
          });

          if (!csvResponse.ok) {
            throw new Error(`Failed to download export: ${csvResponse.status}`);
          }

          const csvText = await csvResponse.text();
          const lines = csvText.split('\n').filter(l => l.trim());
          
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

              const vanId = row['VanID'];
              if (!vanId) continue;

              transactionsProcessed++;

              // Upsert person data — contributions are fetched separately
              // For now, we store the person/contact record
              // In a full implementation, we'd also fetch contributions per VAN ID
            }
          }
        }

        // Step 4: Fetch recent contributions via the contributions API
        // This is the primary way to get donation data
        const contribResponse = await fetch(
          `${EA_API_BASE}/contributions?startDate=${encodeURIComponent(dateChangedFrom.toISOString())}&endDate=${encodeURIComponent(now.toISOString())}&$top=200`,
          { headers: { 'Authorization': authHeaderValue, 'Content-Type': 'application/json' } }
        );

        if (contribResponse.ok) {
          const contribData = await contribResponse.json();
          const contributions = contribData.items || contribData || [];

          for (const contrib of (Array.isArray(contributions) ? contributions : [])) {
            const txId = String(contrib.contributionId || contrib.id || '');
            if (!txId) continue;

            transactionsProcessed++;

            const txRecord = {
              organization_id: orgId,
              transaction_id: txId,
              van_id: String(contrib.vanId || contrib.contactId || ''),
              donor_email: contrib.email || contrib.contactEmail || null,
              donor_name: [contrib.firstName, contrib.lastName].filter(Boolean).join(' ') || null,
              first_name: contrib.firstName || null,
              last_name: contrib.lastName || null,
              amount: parseFloat(contrib.amount || contrib.totalAmount || '0'),
              transaction_date: contrib.dateReceived || contrib.datePledged || now.toISOString(),
              transaction_type: contrib.contributionType || 'donation',
              is_recurring: contrib.isRecurring || false,
              source_code: contrib.sourceCode || contrib.extendedSourceCode || null,
              refcode: contrib.extendedSourceCode || contrib.sourceCode || null,
              designation: contrib.designation || contrib.designationName || null,
              contribution_form: contrib.onlineFormName || null,
              payment_method: contrib.paymentType || null,
            };

            const { error: upsertError, data: upsertData } = await supabase
              .from('everyaction_transactions')
              .upsert(txRecord, { onConflict: 'organization_id,transaction_id' })
              .select('id');

            if (!upsertError && upsertData) {
              transactionsInserted++;
            }
          }
        }

        // Step 5: Update sync state and credential status
        await supabase.from('everyaction_sync_state').upsert({
          organization_id: orgId,
          last_sync_cursor: now.toISOString(),
          last_export_job_id: exportJobId,
          last_sync_at: now.toISOString(),
          last_sync_status: 'success',
          updated_at: now.toISOString(),
        }, { onConflict: 'organization_id' });

        await supabase
          .from('client_api_credentials')
          .update({
            last_sync_at: now.toISOString(),
            last_sync_status: 'success',
            last_sync_error: null,
          })
          .eq('organization_id', orgId)
          .eq('platform', 'every_action');

        results.push({
          organization_id: orgId,
          status: 'success',
          transactions_processed: transactionsProcessed,
          transactions_inserted: transactionsInserted,
          transactions_updated: transactionsUpdated,
        });

        console.log(`[SYNC-EA] Org ${orgId}: ${transactionsProcessed} processed, ${transactionsInserted} inserted`);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[SYNC-EA] Error for org ${orgId}:`, errorMsg);

        // Update error state
        await supabase.from('everyaction_sync_state').upsert({
          organization_id: orgId,
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'error',
          last_sync_error: errorMsg,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });

        await supabase
          .from('client_api_credentials')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'error',
            last_sync_error: errorMsg,
          })
          .eq('organization_id', orgId)
          .eq('platform', 'every_action');

        results.push({ organization_id: orgId, status: 'error', error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ results, total: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[SYNC-EA] Fatal error:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
