import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting polling data fetch...');

    // Fetch FiveThirtyEight polling data from GitHub
    // https://projects.fivethirtyeight.com/polls/data/
    const pollsToFetch = [
      {
        url: 'https://projects.fivethirtyeight.com/polls-page/data/senate_polls.csv',
        type: 'senate',
      },
      {
        url: 'https://projects.fivethirtyeight.com/polls-page/data/house_polls.csv',
        type: 'house',
      },
      {
        url: 'https://projects.fivethirtyeight.com/polls-page/data/president_polls.csv',
        type: 'presidential',
      },
    ];

    let totalPolls = 0;
    let newPolls = 0;
    const alerts = [];

    for (const pollSource of pollsToFetch) {
      console.log(`Fetching ${pollSource.type} polls from FiveThirtyEight...`);

      try {
        const response = await fetch(pollSource.url);
        if (!response.ok) {
          console.error(`Failed to fetch ${pollSource.type} polls:`, response.status);
          continue;
        }

        const csvText = await response.text();
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Process CSV (simplified - real implementation would use proper CSV parser)
        for (let i = 1; i < Math.min(lines.length, 100); i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const poll: any = {};
          headers.forEach((header, idx) => {
            poll[header] = values[idx];
          });

          totalPolls++;

          // Extract relevant data - matching actual table columns
          const pollData = {
            poll_type: pollSource.type,
            pollster: poll.pollster || poll.sponsor || 'FiveThirtyEight',
            race_id: poll.race_id || `${pollSource.type}_${poll.state || 'national'}`,
            state: poll.state || null,
            district: poll.district || null,
            candidate_name: poll.candidate_name || poll.answer || null,
            result_value: parseFloat(poll.pct) || null,
            poll_date: poll.end_date || poll.created_at || new Date().toISOString().split('T')[0],
            sample_size: parseInt(poll.sample_size) || null,
            margin_of_error: parseFloat(poll.margin_of_error) || null,
            source_url: poll.url || null,
            source: 'FiveThirtyEight',
            fetched_at: new Date().toISOString(),
          };

          // Check if poll already exists
          const { data: existing } = await supabase
            .from('polling_data')
            .select('id, poll_result')
            .eq('race_id', pollData.race_id)
            .eq('candidate_name', pollData.candidate_name)
            .eq('poll_date', pollData.poll_date)
            .single();

          if (!existing) {
            // Insert new poll
            const { error: insertError } = await supabase
              .from('polling_data')
              .insert(pollData);

            if (insertError) {
              console.error(`Insert error for ${pollData.race_id}:`, insertError);
            } else {
              newPolls++;
              console.log(`Inserted poll: ${pollData.race_id} - ${pollData.candidate_name}`);

              // Check for significant changes (if we have historical data)
              const { data: previousPoll } = await supabase
                .from('polling_data')
                .select('result_value')
                .eq('race_id', pollData.race_id)
                .eq('candidate_name', pollData.candidate_name)
                .lt('poll_date', pollData.poll_date)
                .order('poll_date', { ascending: false })
                .limit(1)
                .single();

              if (previousPoll && pollData.result_value) {
                const change = pollData.result_value - previousPoll.result_value;
                if (Math.abs(change) > 5) {
                  alerts.push({
                    alert_type: 'significant_change',
                    race_id: pollData.race_id,
                    candidate_name: pollData.candidate_name,
                    previous_result: previousPoll.result_value,
                    new_result: pollData.result_value,
                    change_amount: change,
                    poll_date: pollData.poll_date,
                  });
                }
              }
            }
          } else {
            // Log when poll already exists (for debugging)
            if (i < 5) console.log(`Poll exists: ${pollData.race_id} - ${pollData.candidate_name} on ${pollData.poll_date}`);
          }
        }

        console.log(`Processed ${pollSource.type} polls`);
      } catch (error) {
        console.error(`Error processing ${pollSource.type} polls:`, error);
      }
    }

    // Insert polling alerts
    if (alerts.length > 0) {
      const { error: alertsError } = await supabase
        .from('polling_alerts')
        .insert(alerts);

      if (alertsError) {
        console.error('Error inserting polling alerts:', alertsError);
      }
    }

    console.log(`Polling data fetch complete. Total: ${totalPolls}, New: ${newPolls}, Alerts: ${alerts.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalPolls,
        newPolls,
        alertsGenerated: alerts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching polling data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
