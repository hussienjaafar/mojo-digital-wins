import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_API_KEY = Deno.env.get('CONGRESS_GOV_API_KEY');
const CONGRESS_API_BASE = 'https://api.congress.gov/v3';

// Keywords to search for relevant bills - comprehensive list
const KEYWORDS = {
  // Critical priority - direct community/humanitarian impact (30 points each)
  critical: [
    // Palestinian/Gaza humanitarian crisis
    'palestinian', 'gaza', 'west bank', 'genocide', 'ethnic cleansing',
    'apartheid', 'occupation', 'blockade', 'ceasefire', 'war crimes',
    // Muslim/Arab American community
    'muslim', 'arab', 'islam', 'islamic', 'mosque', 'islamophobia', 'anti-muslim',
    // Organizations serving the community (potential targets)
    'cair', 'isna', 'mpac', 'ams', 'msa', 'icna', 'mas',
    // Organization targeting language
    'terrorist organization', 'terrorist designation', 'material support',
    'foreign terrorist', 'designated entity', 'unindicted co-conspirator',
    'muslim brotherhood', 'brotherhood-linked',
  ],
  // High priority - regional conflicts (20 points each)
  high: [
    'israel', 'hamas', 'hezbollah', 'idf', 'netanyahu',
    'iran', 'iraq', 'syria', 'yemen', 'libya', 'lebanon',
    'humanitarian', 'civilian casualties', 'refugee', 'asylum',
    'hijab', 'halal', 'ramadan',
    // Additional targeting terms
    'radical islam', 'extremism', 'radicalization', 'sharia',
  ],
  // Medium priority - broader regional/policy (12 points each)
  medium: [
    'middle east', 'jordan', 'egypt', 'saudi', 'qatar', 'uae', 'bahrain',
    'afghanistan', 'pakistan', 'terrorism', 'counterterrorism',
    'foreign aid', 'sanctions', 'arms sales', 'military aid',
  ],
  // Lower priority - civil liberties generally (8 points each)
  low: [
    'civil rights', 'religious freedom', 'discrimination', 'hate crime',
    'immigration', 'visa', 'surveillance', 'profiling', 'civil liberties',
    'xenophobia', 'national security', 'homeland security',
  ]
};

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

    // Fetch recent bills from House, Senate, and resolutions
    // Resolutions (hres, sres, hjres, sjres) often contain relevant foreign policy content
    const billTypes = ['hr', 's', 'hres', 'sres', 'hjres', 'sjres'];

    for (const billType of billTypes) {
      console.log(`Fetching ${billType.toUpperCase()} bills...`);

      // Reduced limit since we now make 3 API calls per bill (detail, summary, subjects)
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

          // Calculate relevance score based on keywords in title, summary, and subjects
          const titleLower = (billDetail.title || '').toLowerCase();

          // Fetch summaries (it's a separate endpoint in Congress.gov API)
          let summaryLower = '';
          if (billDetail.summaries?.url) {
            try {
              const summaryResponse = await fetchCongressAPI(billDetail.summaries.url);
              if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                const summaries = summaryData.summaries || [];
                if (summaries.length > 0) {
                  // Get the most recent/detailed summary
                  summaryLower = (summaries[0]?.text || '').toLowerCase();
                }
              }
            } catch (e) {
              console.log(`Could not fetch summaries for ${billDetail.number}`);
            }
          }

          // Fetch subjects (also a separate endpoint)
          let subjectsText = '';
          if (billDetail.subjects?.url) {
            try {
              const subjectsResponse = await fetchCongressAPI(billDetail.subjects.url);
              if (subjectsResponse.ok) {
                const subjectsData = await subjectsResponse.json();
                const subjects = subjectsData.subjects || {};

                // Get legislative subjects
                if (subjects.legislativeSubjects) {
                  subjectsText = subjects.legislativeSubjects
                    .map((s: any) => s.name || '')
                    .join(' ')
                    .toLowerCase();
                }
                // Add policy area
                if (subjects.policyArea?.name) {
                  subjectsText += ' ' + subjects.policyArea.name.toLowerCase();
                }
              }
            } catch (e) {
              console.log(`Could not fetch subjects for ${billDetail.number}`);
            }
          }

          // Log what we're searching through for debugging
          console.log(`Bill ${billDetail.number}: title=${titleLower.substring(0, 50)}..., summary=${summaryLower.length} chars, subjects=${subjectsText.substring(0, 100)}`)

          let relevanceScore = 0;
          const matchedKeywords: string[] = [];
          let criticalMatches = 0;

          // Critical priority keywords (30 points in title, 25 in summary, 20 in subjects)
          for (const keyword of KEYWORDS.critical) {
            if (titleLower.includes(keyword)) {
              relevanceScore += 30;
              criticalMatches++;
              matchedKeywords.push(`${keyword}(title)`);
            } else if (summaryLower.includes(keyword)) {
              relevanceScore += 25;
              criticalMatches++;
              matchedKeywords.push(`${keyword}(summary)`);
            } else if (subjectsText.includes(keyword)) {
              relevanceScore += 20;
              criticalMatches++;
              matchedKeywords.push(`${keyword}(subject)`);
            }
          }

          // High priority keywords (20 points in title, 15 in summary, 12 in subjects)
          for (const keyword of KEYWORDS.high) {
            if (titleLower.includes(keyword)) {
              relevanceScore += 20;
              matchedKeywords.push(`${keyword}(title)`);
            } else if (summaryLower.includes(keyword)) {
              relevanceScore += 15;
              matchedKeywords.push(`${keyword}(summary)`);
            } else if (subjectsText.includes(keyword)) {
              relevanceScore += 12;
              matchedKeywords.push(`${keyword}(subject)`);
            }
          }

          // Medium priority keywords (12 points in title, 10 in summary, 8 in subjects)
          for (const keyword of KEYWORDS.medium) {
            if (titleLower.includes(keyword)) {
              relevanceScore += 12;
              matchedKeywords.push(`${keyword}(title)`);
            } else if (summaryLower.includes(keyword)) {
              relevanceScore += 10;
              matchedKeywords.push(`${keyword}(summary)`);
            } else if (subjectsText.includes(keyword)) {
              relevanceScore += 8;
              matchedKeywords.push(`${keyword}(subject)`);
            }
          }

          // Low priority keywords (8 points in title, 6 in summary, 4 in subjects)
          for (const keyword of KEYWORDS.low) {
            if (titleLower.includes(keyword)) {
              relevanceScore += 8;
              matchedKeywords.push(`${keyword}(title)`);
            } else if (summaryLower.includes(keyword)) {
              relevanceScore += 6;
              matchedKeywords.push(`${keyword}(summary)`);
            } else if (subjectsText.includes(keyword)) {
              relevanceScore += 4;
              matchedKeywords.push(`${keyword}(subject)`);
            }
          }

          // Bonus multiplier for multiple critical keyword matches
          // Bills with 2+ critical matches are highly relevant
          if (criticalMatches >= 3) {
            relevanceScore = Math.round(relevanceScore * 1.3);
          } else if (criticalMatches >= 2) {
            relevanceScore = Math.round(relevanceScore * 1.15);
          }

          // Log bills with relevance for debugging
          if (relevanceScore > 0) {
            console.log(`Bill ${billDetail.number}: score ${relevanceScore}, matches: ${matchedKeywords.join(', ')}`);
          }

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

          // Extract committee assignments - handle both array and object formats
          let committeeAssignments = [];
          if (Array.isArray(billDetail.committees)) {
            committeeAssignments = billDetail.committees.map((c: any) => c.name);
          } else if (billDetail.committees?.committees) {
            committeeAssignments = billDetail.committees.committees.map((c: any) => c.name);
          }

          // Get related bills - handle both array and object formats
          let relatedBills = [];
          if (Array.isArray(billDetail.relatedBills)) {
            relatedBills = billDetail.relatedBills.map((rb: any) => rb.number);
          } else if (billDetail.relatedBills?.relatedBills) {
            relatedBills = billDetail.relatedBills.relatedBills.map((rb: any) => rb.number);
          }

          // Determine current status with improved detection
          let currentStatus = 'introduced';

          // Check API flags first (most reliable)
          if (billDetail.laws && billDetail.laws.length > 0) {
            currentStatus = 'enacted';
          } else if (billDetail.vetoed) {
            currentStatus = 'vetoed';
          } else {
            // Analyze all actions to determine status (not just latest)
            let passedHouse = false;
            let passedSenate = false;
            let inCommittee = false;

            for (const action of actions) {
              const actionText = (action.text || '').toLowerCase();
              const actionCode = (action.actionCode || '').toUpperCase();

              // Check for passage
              if (actionText.includes('passed house') ||
                  actionText.includes('passed the house') ||
                  actionCode === 'H8D' || actionCode === '8000') {
                passedHouse = true;
              }
              if (actionText.includes('passed senate') ||
                  actionText.includes('passed the senate') ||
                  actionCode === '17000') {
                passedSenate = true;
              }

              // Check for committee activity
              if (actionText.includes('referred to') && actionText.includes('committee')) {
                inCommittee = true;
              }
              if (actionText.includes('reported') && actionText.includes('committee')) {
                inCommittee = true;
              }
              if (actionText.includes('ordered to be reported')) {
                inCommittee = true;
              }

              // Check for floor activity (beyond committee)
              if (actionText.includes('placed on') && actionText.includes('calendar')) {
                inCommittee = true; // Still mark as in process
              }
            }

            // Determine final status
            if (passedHouse && passedSenate) {
              currentStatus = 'passed_both';
            } else if (passedSenate) {
              currentStatus = 'passed_senate';
            } else if (passedHouse) {
              currentStatus = 'passed_house';
            } else if (inCommittee) {
              currentStatus = 'in_committee';
            }
          }

          console.log(`Bill ${billDetail.number}: status=${currentStatus}, actions=${actions.length}`);

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

          // Delay to avoid rate limiting (increased since we make 3 API calls per bill)
          await new Promise(resolve => setTimeout(resolve, 200));

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
