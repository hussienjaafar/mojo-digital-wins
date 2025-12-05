import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ActBlue CSV can have variations in column names depending on export type
// The parser normalizes headers: "Donor First Name" -> "donor_first_name"
interface CSVRow {
  lineitem_id: string;
  date: string;
  amount: string;
  recurring_total_months: string;
  recurrence_number: string;
  recipient: string;
  fundraising_page: string;
  fundraising_partner: string;
  reference_code: string;
  reference_code_2: string;
  reference_code_source: string;
  // Support both naming conventions for donor fields
  donor_firstname?: string;
  donor_first_name?: string;
  donor_lastname?: string;
  donor_last_name?: string;
  donor_addr1: string;
  donor_addr2: string;
  donor_city: string;
  donor_state: string;
  donor_zip: string;
  donor_country: string;
  donor_occupation: string;
  donor_employer: string;
  donor_email: string;
  donor_phone: string;
  new_express_signup: string;
  comments: string;
  check_number: string;
  check_date: string;
  employer_addr1: string;
  employer_addr2: string;
  employer_city: string;
  employer_state: string;
  employer_country: string;
  donor_id: string;
  fundraiser_id: string;
  fundraiser_recipient_id: string;
  fundraiser_contact_email: string;
  fundraiser_contact_first_name: string;
  fundraiser_contact_last_name: string;
  partner_id: string;
  partner_contact_email: string;
  partner_contact_first_name: string;
  partner_contact_last_name: string;
  disbursement_id: string;
  disbursement_date: string;
  recovery_id: string;
  recovery_date: string;
  refund_id: string;
  refund_date: string;
  fee: string;
  recur_weekly: string;
  actblue_express_lane: string;
  card_type: string;
  mobile: string;
  recurring_upsell_shown: string;
  recurring_upsell_succeeded: string;
  double_down: string;
  smart_recurring: string;
  monthly_recurring_amount: string;
  weekly_recurring_amount: string;
  smart_boost_amount: string;
  smart_boost_shown: string;
  ab_test_name: string;
  ab_variation: string;
  text_message_option: string;
  gift_identifier: string;
  gift_declined: string;
  shipping_addr1: string;
  shipping_addr2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  shipping_country: string;
  weekday_paid: string;
  payment_id: string;
  paid_at: string;
  entity_id: string;
  account_type: string;
  fec_id: string;
  transaction_type: string;
}

// Helper to get donor first name from CSV row (handles multiple naming conventions)
// ActBlue CSV headers can vary: "Donor First Name", "Donor FirstName", "Donor First", etc.
function getDonorFirstName(row: any): string | null {
  return row.donor_firstname || row.donor_first_name || row.donor_first || row.firstname || row.first_name || null;
}

// Helper to get donor last name from CSV row (handles multiple naming conventions)
function getDonorLastName(row: any): string | null {
  return row.donor_lastname || row.donor_last_name || row.donor_last || row.lastname || row.last_name || null;
}

function parseCSV(csvText: string): { rows: CSVRow[], headers: string[] } {
  const lines = csvText.split('\n');
  if (lines.length < 2) return { rows: [], headers: [] };
  
  const headers = lines[0].split(',').map(h => 
    h.trim().replace(/"/g, '').toLowerCase().replace(/\s+/g, '_')
  );
  
  // Log headers for debugging
  console.log('CSV headers found:', headers.slice(0, 30).join(', '));
  console.log('Donor-related headers:', headers.filter(h => h.includes('donor') || h.includes('first') || h.includes('last')).join(', '));
  
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle quoted values with commas inside
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
    rows.push(row as CSVRow);
  }
  
  return { rows, headers };
}

async function fetchActBlueCSV(
  username: string,
  password: string,
  entityId: string,
  startDate: string,
  endDate: string,
  offset: number = 0,
  limit: number = 1000
): Promise<{ rows: CSVRow[]; hasMore: boolean }> {
  const baseUrl = 'https://secure.actblue.com/api/v1/csvs';
  const auth = btoa(`${username}:${password}`);
  
  console.log(`Creating ActBlue CSV request: dates=${startDate} to ${endDate}`);
  
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
  
  // ActBlue returns 202 Accepted for successful CSV creation requests
  if (createResponse.status !== 202 && createResponse.status !== 200) {
    const errorText = await createResponse.text();
    console.error(`ActBlue API error: status=${createResponse.status}, body=${errorText}`);
    throw new Error(`ActBlue API error ${createResponse.status}: ${errorText}`);
  }
  
  const createData = await createResponse.json();
  const csvId = createData.id;
  
  if (!csvId) {
    console.error('ActBlue response missing CSV ID:', createData);
    throw new Error('ActBlue API did not return a CSV ID');
  }
  
  console.log(`CSV request created with ID: ${csvId}`);
  
  // Step 2: Poll the status endpoint until CSV is ready
  let csvUrl = null;
  let attempts = 0;
  const maxAttempts = 30; // Max 30 attempts (up to 5 minutes with 10s delays)
  
  while (!csvUrl && attempts < maxAttempts) {
    attempts++;
    
    const statusResponse = await fetch(`${baseUrl}/${csvId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`ActBlue status check error ${statusResponse.status}: ${errorText}`);
    }
    
    const statusData = await statusResponse.json();
    console.log(`CSV status (attempt ${attempts}): ${statusData.status}`);
    
    if (statusData.status === 'complete') {
      csvUrl = statusData.download_url;
      break;
    } else if (statusData.status === 'failed') {
      throw new Error('ActBlue CSV generation failed');
    }
    
    // Wait 10 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  if (!csvUrl) {
    throw new Error('ActBlue CSV generation timed out');
  }
  
  console.log('CSV ready, downloading...');
  
  // Step 3: Download the CSV from the provided URL
  const csvResponse = await fetch(csvUrl);
  
  if (!csvResponse.ok) {
    throw new Error(`Failed to download ActBlue CSV: ${csvResponse.status}`);
  }
  
  const csvText = await csvResponse.text();
  const { rows, headers } = parseCSV(csvText);
  
  // Log first row's donor fields for debugging
  if (rows.length > 0) {
    const firstRow = rows[0] as any;
    console.log('Sample row donor fields:', {
      donor_firstname: firstRow.donor_firstname,
      donor_first_name: firstRow.donor_first_name,
      donor_first: firstRow.donor_first,
      firstname: firstRow.firstname,
      first_name: firstRow.first_name,
    });
  }
  
  console.log(`Fetched ${rows.length} rows from ActBlue CSV`);
  
  // ActBlue CSV API doesn't support pagination - returns all data for date range
  return { rows, hasMore: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body first to check mode
    const requestBody = await req.json();
    const { 
      organization_id, 
      start_date, 
      end_date,
      mode = 'incremental' // 'incremental' or 'backfill'
    } = requestBody;
    
    // Check for service-level invocation (internal trigger for backfill)
    const authHeader = req.headers.get('Authorization');
    const internalKey = req.headers.get('x-internal-key');
    
    // Allow internal backfill calls without auth
    const isInternalBackfill = mode === 'backfill' && organization_id && internalKey;
    
    let user: any = null;
    let isServiceCall = false;
    
    if (isInternalBackfill) {
      // Internal service call - bypass user auth for backfill
      isServiceCall = true;
      console.log(`Internal backfill call detected for organization: ${organization_id}`);
    } else if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Get user from JWT token
      const { data: userData, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      user = userData.user;
    }

    // Check if user is admin (skip for service calls)
    let isAdmin = isServiceCall;
    if (!isServiceCall && user) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      isAdmin = userRoles?.some(r => r.role === 'admin') || false;
    }

    // If no org specified, process all active ActBlue integrations
    let credentials: any[] = [];
    
    if (organization_id) {
      // Service calls, admins can sync any organization, regular users must belong to the organization
      if (!isServiceCall && !isAdmin) {
        const { data: clientUser, error: accessError } = await supabase
          .from('client_users')
          .select('organization_id')
          .eq('id', user?.id)
          .maybeSingle();

        if (accessError || !clientUser || clientUser.organization_id !== organization_id) {
          return new Response(
            JSON.stringify({ error: 'You do not have access to this organization' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`ActBlue sync initiated by ${isServiceCall ? 'service' : isAdmin ? 'admin' : 'user'}: ${user?.id || 'internal'} for organization: ${organization_id}`);

      const { data, error } = await supabase
        .from('client_api_credentials')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('platform', 'actblue')
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        throw new Error(`No ActBlue credentials found for organization ${organization_id}`);
      }
      credentials = [data];
    } else {
      // For batch processing (no org specified), only allow admin/service users
      if (!isServiceCall && !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Admin access required for batch sync' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Batch ActBlue sync initiated by ${isServiceCall ? 'service' : 'admin'}: ${user?.id || 'internal'}`);

      const { data, error } = await supabase
        .from('client_api_credentials')
        .select('*')
        .eq('platform', 'actblue')
        .eq('is_active', true);
      
      if (error) throw error;
      credentials = data || [];
    }

    if (credentials.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No ActBlue integrations to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const cred of credentials) {
      const orgId = cred.organization_id;
      const config = cred.encrypted_credentials as any;
      
      if (!config.username || !config.password || !config.entity_id) {
        console.error(`Missing ActBlue credentials for org ${orgId}`);
        results.push({ organization_id: orgId, error: 'Missing credentials' });
        continue;
      }

      // Determine date range
      let syncEndDate = end_date || new Date().toISOString().split('T')[0];
      let syncStartDate = start_date;
      
      // Generate date ranges (ActBlue API only allows 6-month chunks)
      const dateRanges: { start: string; end: string }[] = [];
      
      if (!syncStartDate) {
        if (mode === 'backfill') {
          // For backfill, go back 1 year but in 6-month chunks
          const now = new Date();
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          
          // Create 6-month chunks
          let chunkEnd = new Date(now);
          while (chunkEnd > oneYearAgo) {
            const chunkStart = new Date(chunkEnd);
            chunkStart.setMonth(chunkStart.getMonth() - 5); // 5 months back (inclusive = ~6 months)
            chunkStart.setDate(1); // Start of month to be safe
            
            if (chunkStart < oneYearAgo) {
              chunkStart.setTime(oneYearAgo.getTime());
            }
            
            dateRanges.push({
              start: chunkStart.toISOString().split('T')[0],
              end: chunkEnd.toISOString().split('T')[0]
            });
            
            // Move to previous chunk
            chunkEnd = new Date(chunkStart);
            chunkEnd.setDate(chunkEnd.getDate() - 1);
          }
          
          console.log(`Backfill: Created ${dateRanges.length} date range chunks`);
        } else {
          // For incremental, use last sync date or last 24 hours
          if (cred.last_sync_at) {
            syncStartDate = new Date(cred.last_sync_at).toISOString().split('T')[0];
          } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            syncStartDate = yesterday.toISOString().split('T')[0];
          }
          dateRanges.push({ start: syncStartDate, end: syncEndDate });
        }
      } else {
        // Custom date range provided - check if it exceeds 6 months
        const startDateObj = new Date(syncStartDate);
        const endDateObj = new Date(syncEndDate);
        const monthsDiff = (endDateObj.getFullYear() - startDateObj.getFullYear()) * 12 + 
                          (endDateObj.getMonth() - startDateObj.getMonth());
        
        if (monthsDiff > 5) {
          // Split into chunks
          let chunkEnd = new Date(endDateObj);
          while (chunkEnd > startDateObj) {
            const chunkStart = new Date(chunkEnd);
            chunkStart.setMonth(chunkStart.getMonth() - 5);
            
            if (chunkStart < startDateObj) {
              chunkStart.setTime(startDateObj.getTime());
            }
            
            dateRanges.push({
              start: chunkStart.toISOString().split('T')[0],
              end: chunkEnd.toISOString().split('T')[0]
            });
            
            chunkEnd = new Date(chunkStart);
            chunkEnd.setDate(chunkEnd.getDate() - 1);
          }
        } else {
          dateRanges.push({ start: syncStartDate, end: syncEndDate });
        }
      }

      console.log(`Syncing ActBlue for org ${orgId}: ${dateRanges.length} date range(s) (${mode} mode)`);

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalSkipped = 0;
      let totalUpdated = 0;

      try {
        // Process each date range chunk
        for (const dateRange of dateRanges) {
          console.log(`Processing chunk: ${dateRange.start} to ${dateRange.end}`);
          
          let offset = 0;
          const batchSize = 1000;
          let hasMore = true;
          
          while (hasMore) {
            const { rows, hasMore: more } = await fetchActBlueCSV(
              config.username,
              config.password,
              config.entity_id,
              dateRange.start,
              dateRange.end,
              offset,
              batchSize
            );
          
            hasMore = more;
            offset += batchSize;
          
            for (const row of rows) {
              totalProcessed++;
            
              // Skip if no lineitem_id
              if (!row.lineitem_id) {
                totalSkipped++;
                continue;
              }

              // Determine transaction type
              let transactionType = 'donation';
              if (row.refund_id && row.refund_date) {
                transactionType = 'refund';
              }

              // Extract source campaign from refcode
              let sourceCampaign = null;
              const refcode = row.reference_code || '';
              if (refcode) {
                const lowerRefcode = refcode.toLowerCase();
                if (lowerRefcode.includes('meta')) sourceCampaign = 'meta';
                else if (lowerRefcode.includes('sms')) sourceCampaign = 'sms';
                else if (lowerRefcode.includes('email')) sourceCampaign = 'email';
              }

              // Build donor name - use helpers to handle both naming conventions
              const firstName = getDonorFirstName(row);
              const lastName = getDonorLastName(row);
              const donorName = firstName && lastName
                ? `${firstName} ${lastName}`.trim()
                : (firstName || lastName || null);

              // Check if transaction exists
              const { data: existing } = await supabase
                .from('actblue_transactions')
                .select('id, transaction_type, first_name, last_name, donor_name')
                .eq('transaction_id', row.lineitem_id)
                .eq('organization_id', orgId)
                .maybeSingle();

              const transactionData = {
                organization_id: orgId,
                transaction_id: row.lineitem_id,
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
                ab_test_name: row.ab_test_name || null,
                ab_test_variation: row.ab_variation || null,
                is_mobile: row.mobile === 'true' || row.mobile === '1',
                is_express: row.actblue_express_lane === 'true' || row.actblue_express_lane === '1',
                text_message_option: row.text_message_option || null,
                lineitem_id: parseInt(row.lineitem_id) || null,
                entity_id: row.entity_id || config.entity_id,
                committee_name: row.recipient || null,
                fec_id: row.fec_id || null,
                recurring_period: row.recurring_total_months ? 'monthly' : null,
                recurring_duration: parseInt(row.recurring_total_months) || null,
                is_recurring: !!row.recurring_total_months,
                transaction_type: transactionType,
                transaction_date: row.paid_at || row.date,
              };

              if (existing) {
                // Update existing record with donor info if missing, and transaction type if changed
                const updateFields: any = {};
                
                // Always update donor names if we have them and existing record doesn't
                if (firstName && !existing.first_name) updateFields.first_name = firstName;
                if (lastName && !existing.last_name) updateFields.last_name = lastName;
                if (firstName || lastName) {
                  const newDonorName = firstName && lastName 
                    ? `${firstName} ${lastName}`.trim() 
                    : (firstName || lastName || null);
                  if (newDonorName && !existing.donor_name) updateFields.donor_name = newDonorName;
                }
                
                // Update transaction type if changed
                if (existing.transaction_type !== transactionType) {
                  updateFields.transaction_type = transactionType;
                }
                
                if (Object.keys(updateFields).length > 0) {
                  await supabase
                    .from('actblue_transactions')
                    .update(updateFields)
                    .eq('id', existing.id);
                  totalUpdated++;
                } else {
                  totalSkipped++;
                }
              } else {
                // Insert new transaction
                const { error: insertError } = await supabase
                  .from('actblue_transactions')
                  .insert(transactionData);

                if (insertError) {
                  if (insertError.code === '23505') {
                    // Duplicate - skip
                    totalSkipped++;
                  } else {
                    console.error('Insert error:', insertError);
                  }
                } else {
                  totalInserted++;

                  // Update donor demographics for new transactions
                  if (row.donor_email) {
                    await supabase.from('donor_demographics')
                      .upsert({
                        organization_id: orgId,
                        donor_email: row.donor_email,
                        first_name: firstName,
                        last_name: lastName,
                        address: row.donor_addr1 || null,
                        city: row.donor_city || null,
                        state: row.donor_state || null,
                        zip: row.donor_zip || null,
                        country: row.donor_country || null,
                        phone: row.donor_phone || null,
                        employer: row.donor_employer || null,
                        occupation: row.donor_occupation || null,
                        last_donation_date: row.paid_at || row.date,
                      }, {
                        onConflict: 'organization_id,donor_email',
                        ignoreDuplicates: false,
                      });
                  }
                }
              }
            }
          
            // Add delay between batches to avoid rate limiting
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        // Update last sync timestamp
        await supabase
          .from('client_api_credentials')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'success',
          })
          .eq('id', cred.id);

        results.push({
          organization_id: orgId,
          success: true,
          processed: totalProcessed,
          inserted: totalInserted,
          updated: totalUpdated,
          skipped: totalSkipped,
          date_range: { 
            start: dateRanges[dateRanges.length - 1]?.start || 'unknown', 
            end: dateRanges[0]?.end || 'unknown' 
          },
          chunks_processed: dateRanges.length,
        });

        console.log(`Sync complete for org ${orgId}: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped`);

      } catch (orgError: any) {
        console.error(`Error syncing org ${orgId}:`, orgError);
        
        await supabase
          .from('client_api_credentials')
          .update({
            last_sync_status: `error: ${orgError.message}`,
          })
          .eq('id', cred.id);

        results.push({
          organization_id: orgId,
          success: false,
          error: orgError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync-actblue-csv:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
