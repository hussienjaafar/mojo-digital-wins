import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_API_KEY = Deno.env.get('CONGRESS_GOV_API_KEY');
const CONGRESS_API_BASE = 'https://api.congress.gov/v3';

// Keywords to search for relevant bills
const KEYWORDS = [
  'muslim', 'arab', 'immigration', 'civil rights', 'religious freedom',
  'middle east', 'foreign aid', 'discrimination', 'hate crime',
  'visa', 'refugee', 'asylum', 'islam', 'palestinian', 'gaza'
];

// Helper function to make authenticated Congress.gov API calls
async function fetchCongressAPI(url: string): Promise<Response> {
  console.log('Fetching from Congress.gov:', url);
  
  // Try with X-API-Key header first (recommended method)
  let response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-API-Key': CONGRESS_API_KEY || ''
    }
  });

  // If forbidden, try query parameter as fallback
  if (response.status === 403) {
    console.log('Header auth failed (403), retrying with query parameter...');
    const separator = url.includes('?') ? '&' : '?';
    response = await fetch(`${url}${separator}api_key=${CONGRESS_API_KEY}`, {
      headers: { 'Accept': 'application/json' }
    });
  }

  // Log detailed error information if still failing
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Congress.gov API Error:', {
      url: url,
      status: response.status,
      statusText: response.statusText,
      body: errorBody.substring(0, 500),
      headers: Object.fromEntries(response.headers.entries())
    });
  }

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Congress.gov bill sync...');

    // Validate API key is configured
    if (!CONGRESS_API_KEY) {
      console.error('CONGRESS_GOV_API_KEY environment variable is not set');
      return new Response(
        JSON.stringify({ 
          error: 'API key not configured',
          message: 'Please add CONGRESS_GOV_API_KEY secret in Lovable Cloud settings'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('API key configured, length:', CONGRESS_API_KEY.length);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current congress number (119th Congress in 2025)
    const currentCongress = 119;
    let totalBillsFetched = 0;
    let totalBillsInserted = 0;

    // Fetch recent bills from both House and Senate
    for (const billType of ['hr', 's']) {
      console.log(`Fetching ${billType.toUpperCase()} bills...`);
      
      const response = await fetchCongressAPI(
        `${CONGRESS_API_BASE}/bill/${currentCongress}/${billType}?limit=100&sort=updateDate+desc`
      );

      if (!response.ok) {
        console.error(`Failed to fetch ${billType} bills after retries`);
        continue;
      }

      const data = await response.json();
      const bills = data.bills || [];
      totalBillsFetched += bills.length;

      console.log(`Found ${bills.length} ${billType.toUpperCase()} bills`);

      // Process each bill
      for (const bill of bills) {
        try {
          // Fetch detailed bill information
          const detailResponse = await fetchCongressAPI(bill.url);

          if (!detailResponse.ok) {
            console.error(`Failed to fetch bill details for ${bill.number}`);
            continue;
          }

          const detailData = await detailResponse.json();
          const billDetail = detailData.bill;

          // Calculate relevance score based on keywords in title and summary
          const titleLower = (billDetail.title || '').toLowerCase();
          const summaryLower = (billDetail.summaries?.[0]?.text || '').toLowerCase();
          let relevanceScore = 0;
          
          for (const keyword of KEYWORDS) {
            if (titleLower.includes(keyword)) {
              relevanceScore += 15;
            }
            if (summaryLower.includes(keyword)) {
              relevanceScore += 10;
            }
          }

          // Log all bills for debugging, save those with relevance > 0
          console.log(`Bill ${billDetail.number}: relevance score ${relevanceScore}`);
          
          if (relevanceScore === 0) {
            continue;
          }

          // Get sponsor information
          const sponsors = billDetail.sponsors || [];
          const sponsor = sponsors[0] || {};

          // Get cosponsor count and party breakdown
          // Handle both array and object formats from API
          let cosponsorsArray = [];
          if (Array.isArray(billDetail.cosponsors)) {
            cosponsorsArray = billDetail.cosponsors;
          } else if (billDetail.cosponsors?.cosponsors) {
            cosponsorsArray = billDetail.cosponsors.cosponsors;
          }
          
          const cosponsorPartyBreakdown: Record<string, number> = {};
          
          for (const cosponsor of cosponsorsArray) {
            const party = cosponsor.party || 'Unknown';
            cosponsorPartyBreakdown[party] = (cosponsorPartyBreakdown[party] || 0) + 1;
          }

          // Get latest action
          const actions = billDetail.actions?.actions || [];
          const latestAction = actions[0];

          // Extract committee assignments
          const committees = billDetail.committees || [];
          const committeeAssignments = committees.map((c: any) => c.name);

          // Get related bills
          const relatedBills = (billDetail.relatedBills || []).map((rb: any) => rb.number);

          // Determine current status
          let currentStatus = 'introduced';
          if (billDetail.enacted) {
            currentStatus = 'enacted';
          } else if (billDetail.vetoed) {
            currentStatus = 'vetoed';
          } else if (latestAction) {
            const actionText = (latestAction.text || '').toLowerCase();
            if (actionText.includes('passed') && actionText.includes('senate') && actionText.includes('house')) {
              currentStatus = 'passed_both';
            } else if (actionText.includes('passed senate')) {
              currentStatus = 'passed_senate';
            } else if (actionText.includes('passed house')) {
              currentStatus = 'passed_house';
            } else if (actionText.includes('committee')) {
              currentStatus = 'in_committee';
            }
          }

          // Upsert bill into database (matching Lovable's schema)
          const { error: billError } = await supabaseClient
            .from('bills')
            .upsert({
              bill_number: billDetail.number,
              bill_type: billDetail.type,
              congress: billDetail.congress,
              title: billDetail.title,
              short_title: billDetail.shortTitle || null,
              origin_chamber: billDetail.originChamber,
              introduced_date: billDetail.introducedDate,
              latest_action_date: latestAction?.actionDate || null,
              latest_action_text: latestAction?.text || null,
              current_status: currentStatus,
              sponsor_id: sponsor.bioguideId || null,
              sponsor_name: sponsor.fullName || null,
              sponsor_party: sponsor.party || null,
              sponsor_state: sponsor.state || null,
              cosponsor_count: cosponsorsArray.length,
              cosponsor_party_breakdown: cosponsorPartyBreakdown,
              committee_assignments: committeeAssignments,
              related_bills: relatedBills,
              bill_text_url: billDetail.textVersions?.[0]?.formats?.[0]?.url || null,
              relevance_score: Math.min(relevanceScore, 100),
            }, {
              onConflict: 'bill_number'
            });

          // Log successful inserts for debugging
          if (!billError) {
            console.log(`Inserted bill: ${billDetail.number} with relevance ${relevanceScore}`);
          }

          if (billError) {
            console.error(`Error upserting bill ${billDetail.number}:`, billError);
            continue;
          }

          totalBillsInserted++;

          // Insert bill actions
          if (actions.length > 0) {
            const { data: existingBill } = await supabaseClient
              .from('bills')
              .select('id')
              .eq('bill_number', billDetail.number)
              .single();

            if (existingBill) {
              // Delete old actions first
              await supabaseClient
                .from('bill_actions')
                .delete()
                .eq('bill_id', existingBill.id);

              // Insert new actions
              const actionsToInsert = actions.slice(0, 10).map((action: any) => ({
                bill_id: existingBill.id,
                action_date: action.actionDate,
                action_text: action.text,
                action_code: action.actionCode || null,
                chamber: action.chamber || null,
              }));

              await supabaseClient
                .from('bill_actions')
                .insert(actionsToInsert);
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`Error processing bill:`, error);
        }
      }
    }

    console.log(`Sync complete: ${totalBillsFetched} bills fetched, ${totalBillsInserted} relevant bills saved`);

    return new Response(
      JSON.stringify({
        success: true,
        billsFetched: totalBillsFetched,
        billsInserted: totalBillsInserted,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-congress-bills function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
