import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Proper CSV line parser that handles quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PollRecord {
  [key: string]: string | undefined;
}

interface PollData {
  poll_type: string;
  pollster: string | null;
  race_id: string;
  state: string | null;
  district: string | null;
  candidate_name: string | null;
  result_value: number | null;
  poll_date: string;
  sample_size: number | null;
  margin_of_error: number | null;
  source_url: string | null;
  source: string;
  fetched_at: string;
  raw_data: Record<string, unknown> | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting comprehensive polling data fetch...');

    // First, clear existing bad data (records with NULL candidate_name)
    const { data: badRecords, error: countError } = await supabase
      .from('polling_data')
      .select('id', { count: 'exact' })
      .is('candidate_name', null);

    if (badRecords && badRecords.length > 0) {
      console.log(`Clearing ${badRecords.length} empty/malformed poll records...`);
      const { error: deleteError } = await supabase
        .from('polling_data')
        .delete()
        .is('candidate_name', null);
      
      if (deleteError) {
        console.error('Error clearing bad data:', deleteError);
      } else {
        console.log('Bad data cleared successfully');
      }
    }

    // FiveThirtyEight polling data from GitHub (their projects site redirects)
    const pollsToFetch = [
      {
        url: 'https://raw.githubusercontent.com/fivethirtyeight/data/master/pollster-ratings/raw-polls.csv',
        type: 'historical',
        description: 'Historical raw polls (all types)'
      },
      {
        url: 'https://raw.githubusercontent.com/fivethirtyeight/data/master/pollster-ratings/pollster-ratings.csv',
        type: 'pollster_ratings',
        description: 'Pollster ratings data'
      },
    ];

    let totalPolls = 0;
    let newPolls = 0;
    let duplicatePolls = 0;
    let errorPolls = 0;
    const alerts: Array<{
      alert_type: string;
      race_id: string;
      candidate_name: string | null;
      previous_result: number;
      new_result: number;
      change_amount: number;
      poll_date: string;
    }> = [];
    const pollTypeSummary: Record<string, { total: number; new: number; states: Set<string> }> = {};

    for (const pollSource of pollsToFetch) {
      console.log(`\n=== Fetching ${pollSource.description} from FiveThirtyEight ===`);
      pollTypeSummary[pollSource.type] = { total: 0, new: 0, states: new Set() };

      try {
        const response = await fetch(pollSource.url);
        if (!response.ok) {
          console.error(`Failed to fetch ${pollSource.type} polls: HTTP ${response.status}`);
          continue;
        }

        const csvText = await response.text();
        console.log(`Downloaded ${(csvText.length / 1024).toFixed(1)}KB of CSV data`);
        console.log(`First 500 chars: ${csvText.substring(0, 500)}`);

        // Use proper CSV parser from Deno standard library
        let records: PollRecord[];
        try {
          // Parse CSV - first row contains headers, use them as column names
          const lines = csvText.split('\n');
          console.log(`Total lines: ${lines.length}`);
          const headerLine = lines[0];
          console.log(`Raw header line: ${headerLine.substring(0, 200)}`);
          const headers = parseCSVLine(headerLine);
          
          console.log(`CSV Headers (first 10): ${headers.slice(0, 10).join(', ')}`);
          
          records = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = parseCSVLine(line);
            const record: PollRecord = {};
            headers.forEach((header: string, idx: number) => {
              record[header] = values[idx] || undefined;
            });
            records.push(record);
          }
          
          console.log(`Parsed ${records.length} records`);
          if (records.length > 0) {
            console.log(`Sample record keys: ${Object.keys(records[0]).slice(0, 10).join(', ')}`);
            console.log(`Sample values: pollster=${records[0].pollster}, candidate_name=${records[0].candidate_name}, pct=${records[0].pct}, state=${records[0].state}`);
          }
        } catch (parseError) {
          console.error(`CSV parse error for ${pollSource.type}:`, parseError);
          continue;
        }

        console.log(`Parsed ${records.length} poll records for ${pollSource.type}`);

        // Process in batches of 100 for efficiency
        const BATCH_SIZE = 100;
        const pollDataBatch: PollData[] = [];

        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          totalPolls++;
          pollTypeSummary[pollSource.type].total++;

          // Extract data based on FiveThirtyEight's actual column names
          const pollster = record.pollster || record.display_name || record.sponsor || null;
          const state = record.state || null;
          const candidateName = record.candidate_name || record.answer || record.politician || null;
          const pctValue = record.pct || record.yes || record.approve || null;
          const endDate = record.end_date || record.created_at || null;
          const pollId = record.poll_id || record.question_id || null;
          const sampleSize = record.sample_size || record.n || null;

          // Skip records without essential data
          if (!candidateName && !record.answer && !record.politician) {
            continue;
          }

          // Build race_id
          let raceId: string;
          if (record.race_id) {
            raceId = String(record.race_id);
          } else if (pollSource.type === 'generic_ballot') {
            raceId = `generic_ballot_${endDate || 'unknown'}`;
          } else if (pollSource.type === 'approval') {
            raceId = `approval_${record.politician || 'president'}_${endDate || 'unknown'}`;
          } else if (pollSource.type === 'favorability') {
            raceId = `favorability_${record.politician || candidateName || 'unknown'}_${endDate || 'unknown'}`;
          } else {
            raceId = `${pollSource.type}_${state || 'national'}_${record.seat_name || record.office_type || 'general'}`;
          }

          // Track states covered
          if (state) {
            pollTypeSummary[pollSource.type].states.add(state);
          }

          const pollData: PollData = {
            poll_type: pollSource.type,
            pollster: pollster,
            race_id: raceId,
            state: state,
            district: record.seat_name || record.district || null,
            candidate_name: candidateName,
            result_value: pctValue ? parseFloat(pctValue) : null,
            poll_date: endDate || new Date().toISOString().split('T')[0],
            sample_size: sampleSize ? parseInt(sampleSize) : null,
            margin_of_error: record.margin_of_error ? parseFloat(record.margin_of_error) : null,
            source_url: record.url || null,
            source: 'fivethirtyeight',
            fetched_at: new Date().toISOString(),
            raw_data: record as Record<string, unknown>,
          };

          pollDataBatch.push(pollData);

          // Process batch when full
          if (pollDataBatch.length >= BATCH_SIZE) {
            const result = await processBatch(supabase, pollDataBatch, alerts);
            newPolls += result.inserted;
            duplicatePolls += result.duplicates;
            errorPolls += result.errors;
            pollTypeSummary[pollSource.type].new += result.inserted;
            pollDataBatch.length = 0; // Clear batch
          }
        }

        // Process remaining records in final batch
        if (pollDataBatch.length > 0) {
          const result = await processBatch(supabase, pollDataBatch, alerts);
          newPolls += result.inserted;
          duplicatePolls += result.duplicates;
          errorPolls += result.errors;
          pollTypeSummary[pollSource.type].new += result.inserted;
        }

        console.log(`Completed ${pollSource.type}: ${pollTypeSummary[pollSource.type].new} new polls, ${pollTypeSummary[pollSource.type].states.size} states`);

      } catch (error) {
        console.error(`Error processing ${pollSource.type} polls:`, error);
      }
    }

    // Insert polling alerts for significant changes
    if (alerts.length > 0) {
      console.log(`\nInserting ${alerts.length} polling alerts for significant changes...`);
      const { error: alertsError } = await supabase
        .from('polling_alerts')
        .insert(alerts);

      if (alertsError) {
        console.error('Error inserting polling alerts:', alertsError);
      }
    }

    // Build summary
    const summary = {
      success: true,
      totalPolls,
      newPolls,
      duplicatePolls,
      errorPolls,
      alertsGenerated: alerts.length,
      pollTypes: Object.fromEntries(
        Object.entries(pollTypeSummary).map(([type, data]) => [
          type,
          { total: data.total, new: data.new, statesCovered: data.states.size }
        ])
      )
    };

    console.log('\n=== POLLING DATA FETCH COMPLETE ===');
    console.log(`Total processed: ${totalPolls}`);
    console.log(`New polls inserted: ${newPolls}`);
    console.log(`Duplicates skipped: ${duplicatePolls}`);
    console.log(`Errors: ${errorPolls}`);
    console.log(`Alerts generated: ${alerts.length}`);
    console.log('Summary by type:', JSON.stringify(summary.pollTypes, null, 2));

    return new Response(
      JSON.stringify(summary),
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

// deno-lint-ignore no-explicit-any
async function processBatch(
  supabase: any,
  batch: PollData[],
  alerts: Array<{
    alert_type: string;
    race_id: string;
    candidate_name: string | null;
    previous_result: number;
    new_result: number;
    change_amount: number;
    poll_date: string;
  }>
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const pollData of batch) {
    try {
      // Check for existing poll using composite key
      const { data: existing } = await supabase
        .from('polling_data')
        .select('id, result_value')
        .eq('pollster', pollData.pollster || '')
        .eq('race_id', pollData.race_id)
        .eq('candidate_name', pollData.candidate_name || '')
        .eq('poll_date', pollData.poll_date)
        .maybeSingle();

      if (existing) {
        duplicates++;
        continue;
      }

      // Insert new poll
      const { error: insertError } = await supabase
        .from('polling_data')
        .insert(pollData);

      if (insertError) {
        // Check if it's a constraint violation (likely duplicate)
        if (insertError.code === '23505') {
          duplicates++;
        } else {
          console.error(`Insert error for ${pollData.race_id}:`, insertError.message);
          errors++;
        }
        continue;
      }

      inserted++;

      // Check for significant changes compared to previous polls
      if (pollData.result_value !== null) {
        const { data: previousPoll } = await supabase
          .from('polling_data')
          .select('result_value')
          .eq('race_id', pollData.race_id)
          .eq('candidate_name', pollData.candidate_name || '')
          .lt('poll_date', pollData.poll_date)
          .order('poll_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (previousPoll?.result_value !== null && previousPoll?.result_value !== undefined) {
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
    } catch (err) {
      console.error('Error processing poll:', err);
      errors++;
    }
  }

  return { inserted, duplicates, errors };
}
