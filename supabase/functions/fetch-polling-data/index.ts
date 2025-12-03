import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PollData {
  poll_type: string;
  pollster: string | null;
  race_id: string;
  state: string | null;
  district: string | null;
  candidate_name: string | null;
  issue_name: string | null;
  result_value: number | null;
  poll_date: string;
  sample_size: number | null;
  margin_of_error: number | null;
  source_url: string | null;
  source: string;
  fetched_at: string;
  lead_margin: number | null;
  raw_data: Record<string, unknown> | null;
}

interface PollAlert {
  alert_type: string;
  race_id: string;
  candidate_name: string | null;
  previous_result: number;
  new_result: number;
  change_amount: number;
  poll_date: string;
  severity: string;
}

// RealClearPolling data sources
const pollSources = [
  // Presidential Approval - main source
  { url: 'https://www.realclearpolling.com/polls/approval/donald-trump/approval-rating', type: 'presidential_approval', category: 'approval' },
  
  // Issue Polls
  { url: 'https://www.realclearpolling.com/polls/approval/donald-trump/issues/economy', type: 'issue_economy', category: 'issue' },
  { url: 'https://www.realclearpolling.com/polls/approval/donald-trump/issues/immigration', type: 'issue_immigration', category: 'issue' },
  { url: 'https://www.realclearpolling.com/polls/approval/donald-trump/issues/foreign-policy', type: 'issue_foreign_policy', category: 'issue' },
  
  // Election Polls
  { url: 'https://www.realclearpolling.com/latest-polls/president', type: 'presidential', category: 'election' },
  { url: 'https://www.realclearpolling.com/latest-polls/senate', type: 'senate', category: 'election' },
  { url: 'https://www.realclearpolling.com/latest-polls/governor', type: 'governor', category: 'election' },
  { url: 'https://www.realclearpolling.com/latest-polls/house', type: 'house', category: 'election' },
];

// Parse date from RCP format
function parseDateRange(dateStr: string): string {
  const currentYear = new Date().getFullYear();
  
  // Format: "11/25 - 12/1" or "11/3 - 12/1"
  const rangeMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
  if (rangeMatch) {
    const [, , , endMonth, endDay] = rangeMatch;
    return `${currentYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
  }
  
  // Format: "12/1"
  const singleMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (singleMatch) {
    const [, month, day] = singleMatch;
    return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return new Date().toISOString().split('T')[0];
}

// Parse spread value (e.g., "Spread-12.3" or "Spread+4")
function parseSpread(spreadStr: string): number | null {
  if (!spreadStr) return null;
  const match = spreadStr.match(/Spread([+-]?\d+\.?\d*)/i);
  return match ? parseFloat(match[1]) : null;
}

// Parse sample size (e.g., "1456 RV" or "1000 A" or "1500 LV")
function parseSampleSize(sampleStr: string): number | null {
  if (!sampleStr || sampleStr === '—') return null;
  const match = sampleStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Extract pollster name from markdown link
function extractPollster(cell: string): { name: string; url: string | null } {
  // Format: [Economist/YouGov](https://...) or just "RCP Average"
  const linkMatch = cell.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (linkMatch) {
    return { name: linkMatch[1], url: linkMatch[2] };
  }
  return { name: cell.trim(), url: null };
}

// Parse approval/issue poll tables (markdown format)
function parseApprovalTable(text: string, pollType: string): PollData[] {
  const polls: PollData[] = [];
  const now = new Date().toISOString();
  const lines = text.split('\n');
  
  let inTable = false;
  let headers: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect table header: | pollster | date | sample | Approve | Disapprove | spread |
    if (trimmed.startsWith('| pollster') || trimmed.startsWith('|pollster')) {
      inTable = true;
      headers = trimmed.split('|').map(h => h.trim().toLowerCase()).filter(h => h);
      console.log(`Found approval table headers: ${headers.join(', ')}`);
      continue;
    }
    
    // Skip separator row
    if (trimmed.match(/^\|\s*[-:]+\s*\|/)) continue;
    
    // Parse data rows
    if (inTable && trimmed.startsWith('|') && trimmed.includes('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);
      
      if (cells.length < 5) continue;
      
      const pollsterInfo = extractPollster(cells[0]);
      const dateRange = cells[1] || '';
      const sampleStr = cells[2] || '';
      const approveStr = cells[3] || '';
      const disapproveStr = cells[4] || '';
      const spreadStr = cells[5] || '';
      
      // Skip RCP Average row
      if (pollsterInfo.name.includes('RCP Average')) continue;
      
      const pollDate = parseDateRange(dateRange);
      const sampleSize = parseSampleSize(sampleStr);
      const approveValue = parseFloat(approveStr);
      const disapproveValue = parseFloat(disapproveStr);
      const spread = parseSpread(spreadStr);
      
      if (isNaN(approveValue) || isNaN(disapproveValue)) continue;
      
      const raceId = `${pollType}_${pollDate}_${pollsterInfo.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`;
      
      // Approve record
      polls.push({
        poll_type: pollType,
        pollster: pollsterInfo.name,
        race_id: raceId,
        state: null,
        district: null,
        candidate_name: 'Approve',
        issue_name: pollType.startsWith('issue_') ? pollType.replace('issue_', '') : null,
        result_value: approveValue,
        poll_date: pollDate,
        sample_size: sampleSize,
        margin_of_error: null,
        source_url: pollsterInfo.url,
        source: 'realclearpolling',
        fetched_at: now,
        lead_margin: spread,
        raw_data: { dateRange, sampleStr, spreadStr },
      });
      
      // Disapprove record
      polls.push({
        poll_type: pollType,
        pollster: pollsterInfo.name,
        race_id: raceId,
        state: null,
        district: null,
        candidate_name: 'Disapprove',
        issue_name: pollType.startsWith('issue_') ? pollType.replace('issue_', '') : null,
        result_value: disapproveValue,
        poll_date: pollDate,
        sample_size: sampleSize,
        margin_of_error: null,
        source_url: pollsterInfo.url,
        source: 'realclearpolling',
        fetched_at: now,
        lead_margin: null,
        raw_data: null,
      });
    }
  }
  
  return polls;
}

// Parse election poll tables (markdown format)
// Format: | Race | Poll | Results | Spread |
function parseElectionTable(text: string, pollType: string): PollData[] {
  const polls: PollData[] = [];
  const now = new Date().toISOString();
  const lines = text.split('\n');
  
  let inTable = false;
  let currentDate = new Date().toISOString().split('T')[0];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect date headers like "Tuesday, December 2"
    const dateHeaderMatch = trimmed.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i);
    if (dateHeaderMatch) {
      const months: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
      };
      const month = months[dateHeaderMatch[2].toLowerCase()];
      const day = dateHeaderMatch[3].padStart(2, '0');
      currentDate = `${new Date().getFullYear()}-${month}-${day}`;
      console.log(`Found date header: ${currentDate}`);
      continue;
    }
    
    // Detect table header: | Race | Poll | Results | Spread |
    if (trimmed.match(/^\|\s*Race\s*\|/i)) {
      inTable = true;
      continue;
    }
    
    // Skip separator row
    if (trimmed.match(/^\|\s*[-:]+\s*\|/)) continue;
    
    // Parse data rows
    if (inTable && trimmed.startsWith('|') && trimmed.includes('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);
      
      if (cells.length < 4) continue;
      
      // Extract race info: [2026 Michigan Senate](url)
      const raceInfo = extractPollster(cells[0]);
      const pollsterInfo = extractPollster(cells[1]);
      const resultsStr = cells[2] || '';
      const spreadStr = cells[3] || '';
      
      // Skip if no valid pollster
      if (!pollsterInfo.name || pollsterInfo.name.length < 2) continue;
      
      // Extract state from race name
      const statePattern = /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i;
      const stateMatch = raceInfo.name.match(statePattern);
      const state = stateMatch ? stateMatch[1] : null;
      
      // Parse results: "Vance 62, Trump Jr. 10, DeSantis 10" or "Smith 48, Jones 45"
      const resultPattern = /([A-Za-z\s.]+?)\s*(\d{1,2}(?:\.\d)?)/g;
      let resultMatch;
      const candidates: { name: string; value: number }[] = [];
      
      // Clean up results string - remove markdown links
      const cleanResults = resultsStr.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      
      while ((resultMatch = resultPattern.exec(cleanResults)) !== null) {
        const candidateName = resultMatch[1].trim();
        const value = parseFloat(resultMatch[2]);
        
        // Filter valid candidates
        if (candidateName && candidateName.length > 1 && candidateName.length < 30 &&
            !candidateName.match(/^(LV|RV|MoE|vs|to|the|a|an)$/i) && value > 0 && value <= 100) {
          candidates.push({ name: candidateName, value });
        }
      }
      
      if (candidates.length === 0) continue;
      
      const spread = parseSpread(spreadStr);
      const raceId = `${pollType}_${raceInfo.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`;
      
      for (const candidate of candidates) {
        polls.push({
          poll_type: pollType,
          pollster: pollsterInfo.name,
          race_id: raceId,
          state,
          district: null,
          candidate_name: candidate.name,
          issue_name: null,
          result_value: candidate.value,
          poll_date: currentDate,
          sample_size: null,
          margin_of_error: null,
          source_url: pollsterInfo.url || raceInfo.url,
          source: 'realclearpolling',
          fetched_at: now,
          lead_margin: spread,
          raw_data: { race: raceInfo.name, results: cleanResults },
        });
      }
    }
  }
  
  return polls;
}

// Convert HTML to simple text for parsing
function htmlToText(html: string): string {
  return html
    // Convert links to markdown format
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)')
    // Remove script and style content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Convert table elements to pipes
    .replace(/<tr[^>]*>/gi, '\n|')
    .replace(/<\/tr>/gi, '|')
    .replace(/<t[dh][^>]*>/gi, '')
    .replace(/<\/t[dh]>/gi, ' |')
    // Convert other tags
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Clean up whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n');
}

// Process batch of polls
// deno-lint-ignore no-explicit-any
async function processBatch(
  supabase: any,
  batch: PollData[],
  alerts: PollAlert[]
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const pollData of batch) {
    try {
      // Check for existing poll
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
        if (insertError.code === '23505') {
          duplicates++;
        } else {
          console.error(`Insert error: ${insertError.message}`);
          errors++;
        }
        continue;
      }

      inserted++;

      // Check for significant changes
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
            const severity = Math.abs(change) > 10 ? 'critical' : 'high';
            alerts.push({
              alert_type: 'significant_change',
              race_id: pollData.race_id,
              candidate_name: pollData.candidate_name,
              previous_result: previousPoll.result_value,
              new_result: pollData.result_value,
              change_amount: change,
              poll_date: pollData.poll_date,
              severity,
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== Starting RealClearPolling Scrape ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Sources to fetch: ${pollSources.length}`);

    // Clear bad data
    const { data: badRecords } = await supabase
      .from('polling_data')
      .select('id', { count: 'exact' })
      .is('candidate_name', null);

    if (badRecords && badRecords.length > 0) {
      console.log(`Clearing ${badRecords.length} malformed records...`);
      await supabase.from('polling_data').delete().is('candidate_name', null);
    }

    let totalPolls = 0;
    let newPolls = 0;
    let duplicatePolls = 0;
    let errorPolls = 0;
    const alerts: PollAlert[] = [];
    const results: Record<string, { fetched: number; parsed: number; inserted: number; error?: string }> = {};

    for (const source of pollSources) {
      console.log(`\n--- Processing: ${source.type} (${source.category}) ---`);
      results[source.type] = { fetched: 0, parsed: 0, inserted: 0 };

      try {
        // Fetch HTML
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        results[source.type].fetched = html.length;
        console.log(`Fetched ${(html.length / 1024).toFixed(1)}KB`);

        // Convert HTML to text for parsing
        const text = htmlToText(html);
        console.log(`Converted to ${(text.length / 1024).toFixed(1)}KB of text`);
        
        // Debug: Show sample of converted text
        const sampleText = text.substring(0, 2000);
        if (sampleText.includes('pollster') || sampleText.includes('Approve')) {
          console.log(`Found table markers in text`);
        }

        let polls: PollData[] = [];

        // Parse based on category
        if (source.category === 'approval' || source.category === 'issue') {
          polls = parseApprovalTable(text, source.type);
        } else if (source.category === 'election') {
          polls = parseElectionTable(text, source.type);
        }

        results[source.type].parsed = polls.length;
        console.log(`Parsed ${polls.length} polls from ${source.type}`);
        
        // Debug: Log first few polls
        if (polls.length > 0) {
          console.log(`Sample poll: ${polls[0].pollster} - ${polls[0].candidate_name}: ${polls[0].result_value}%`);
        }

        if (polls.length > 0) {
          const BATCH_SIZE = 50;
          for (let i = 0; i < polls.length; i += BATCH_SIZE) {
            const batch = polls.slice(i, i + BATCH_SIZE);
            const batchResult = await processBatch(supabase, batch, alerts);
            
            newPolls += batchResult.inserted;
            duplicatePolls += batchResult.duplicates;
            errorPolls += batchResult.errors;
            results[source.type].inserted += batchResult.inserted;
          }
        }

        totalPolls += polls.length;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error fetching ${source.type}: ${errorMsg}`);
        results[source.type].error = errorMsg;
      }
    }

    // Insert alerts
    if (alerts.length > 0) {
      console.log(`\nInserting ${alerts.length} alerts...`);
      const { error: alertError } = await supabase
        .from('polling_alerts')
        .insert(alerts.map(a => ({
          alert_type: a.alert_type,
          race_id: a.race_id,
          candidate_name: a.candidate_name,
          previous_result: a.previous_result,
          new_result: a.new_result,
          change_amount: a.change_amount,
          poll_date: a.poll_date,
          severity: a.severity,
        })));

      if (alertError) {
        console.error('Alert insert error:', alertError.message);
      }
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      totalPollsParsed: totalPolls,
      newPollsInserted: newPolls,
      duplicatesSkipped: duplicatePolls,
      errors: errorPolls,
      alertsGenerated: alerts.length,
      sourceResults: results,
    };

    console.log('\n=== SCRAPE COMPLETE ===');
    console.log(`Total parsed: ${totalPolls}`);
    console.log(`New inserted: ${newPolls}`);
    console.log(`Duplicates: ${duplicatePolls}`);
    console.log(`Errors: ${errorPolls}`);
    console.log(`Alerts: ${alerts.length}`);

    return new Response(
      JSON.stringify(summary, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
