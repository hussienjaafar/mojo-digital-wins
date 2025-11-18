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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Congress.gov bill sync...');

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
      
      const response = await fetch(
        `${CONGRESS_API_BASE}/bill/${currentCongress}/${billType}?api_key=${CONGRESS_API_KEY}&limit=100&sort=updateDate+desc`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch ${billType} bills:`, response.statusText);
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
          const detailResponse = await fetch(
            `${bill.url}?api_key=${CONGRESS_API_KEY}`,
            {
              headers: {
                'Accept': 'application/json'
              }
            }
          );

          if (!detailResponse.ok) {
            console.error(`Failed to fetch bill details for ${bill.number}`);
            continue;
          }

          const detailData = await detailResponse.json();
          const billDetail = detailData.bill;

          // Calculate relevance score based on keywords in title and text
          const titleLower = (billDetail.title || '').toLowerCase();
          let relevanceScore = 0;
          
          for (const keyword of KEYWORDS) {
            if (titleLower.includes(keyword)) {
              relevanceScore += 15;
            }
          }

          // Skip bills with no relevance
          if (relevanceScore === 0) {
            continue;
          }

          // Get sponsor information
          const sponsors = billDetail.sponsors || [];
          const sponsor = sponsors[0] || {};

          // Get cosponsor count and party breakdown
          const cosponsors = billDetail.cosponsors || [];
          const cosponsorPartyBreakdown: Record<string, number> = {};
          
          for (const cosponsor of cosponsors) {
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
              cosponsor_count: cosponsors.length,
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
