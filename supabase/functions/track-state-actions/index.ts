import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive keywords for threat detection
const THREAT_KEYWORDS = {
  critical: [
    'terrorist designation',
    'terrorist organization',
    'material support',
    'foreign terrorist',
    'designated entity',
    'sanctions',
    'asset freeze',
    'travel ban',
    'muslim ban',
    'immigration ban',
    'mosque surveillance',
    'religious registry',
    'executive order',
    'emergency declaration',
  ],
  high: [
    'muslim',
    'islam',
    'islamic',
    'arab',
    'middle east',
    'palestine',
    'palestinian',
    'gaza',
    'cair',
    'mpac',
    'immigration enforcement',
    'deportation',
    'visa restriction',
    'refugee',
    'asylum',
    'surveillance',
    'national security',
    'counterterrorism',
    'radicalization',
    'extremism',
    'foreign influence',
    'religious freedom',
    'civil liberties',
    'discrimination',
    'hate crime',
    'profiling',
    'anti-bds',
    'boycott',
  ],
  medium: [
    'immigration',
    'border',
    'national security',
    'homeland security',
    'nonprofit',
    'charitable',
    'religious organization',
    'first amendment',
    'free speech',
    'protest',
  ]
};

// Organizations to track for specific mentions
const TRACKED_ORGANIZATIONS = [
  { name: 'CAIR', full: 'Council on American-Islamic Relations' },
  { name: 'MPAC', full: 'Muslim Public Affairs Council' },
  { name: 'ISNA', full: 'Islamic Society of North America' },
  { name: 'ADC', full: 'American-Arab Anti-Discrimination Committee' },
  { name: 'AAI', full: 'Arab American Institute' },
  { name: 'MAS', full: 'Muslim American Society' },
  { name: 'ICNA', full: 'Islamic Circle of North America' },
  { name: 'NAIT', full: 'North American Islamic Trust' },
  { name: 'KIND', full: 'Kids in Need of Defense' },
  { name: 'IRW', full: 'Islamic Relief' },
  { name: 'ACLU', full: 'American Civil Liberties Union' },
];

// Key states to monitor
const MONITORED_STATES = [
  { code: 'TX', name: 'Texas' },
  { code: 'FL', name: 'Florida' },
  { code: 'OH', name: 'Ohio' },
  { code: 'MI', name: 'Michigan' },
  { code: 'VA', name: 'Virginia' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'NY', name: 'New York' },
  { code: 'CA', name: 'California' },
  { code: 'GA', name: 'Georgia' },
  { code: 'AZ', name: 'Arizona' },
];

function calculateThreatLevel(text: string): {
  level: string;
  score: number;
  matchedKeywords: string[];
  affectedOrgs: string[];
} {
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  const affectedOrgs: string[] = [];
  let score = 0;

  // Check critical keywords
  for (const keyword of THREAT_KEYWORDS.critical) {
    if (lowerText.includes(keyword)) {
      score += 50;
      matchedKeywords.push(keyword);
    }
  }

  // Check high-priority keywords
  for (const keyword of THREAT_KEYWORDS.high) {
    if (lowerText.includes(keyword)) {
      score += 15;
      matchedKeywords.push(keyword);
    }
  }

  // Check medium-priority keywords
  for (const keyword of THREAT_KEYWORDS.medium) {
    if (lowerText.includes(keyword)) {
      score += 5;
      matchedKeywords.push(keyword);
    }
  }

  // Check for tracked organizations
  for (const org of TRACKED_ORGANIZATIONS) {
    if (lowerText.includes(org.name.toLowerCase()) || lowerText.includes(org.full.toLowerCase())) {
      score += 40; // High weight for direct org mentions
      affectedOrgs.push(org.name);
    }
  }

  // Determine threat level
  let level = 'low';
  if (score >= 50) {
    level = 'critical';
  } else if (score >= 30) {
    level = 'high';
  } else if (score >= 15) {
    level = 'medium';
  }

  return {
    level,
    score: Math.min(score, 100),
    matchedKeywords: [...new Set(matchedKeywords)],
    affectedOrgs: [...new Set(affectedOrgs)]
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // Handle manual state action submission
    if (body.action === 'add') {
      console.log('Adding manual state action...');

      const {
        state_code,
        state_name,
        action_type,
        title,
        description,
        source_url,
        official_name,
        official_title,
        action_date,
      } = body;

      // Calculate threat level
      const textToAnalyze = `${title} ${description || ''}`;
      const { level, score, matchedKeywords, affectedOrgs } = calculateThreatLevel(textToAnalyze);

      // Insert state action
      const { data, error } = await supabaseClient
        .from('state_actions')
        .insert({
          state: state_name || state_code,
          action_type,
          title,
          description,
          source_url,
          sponsor: official_name || official_title,
          introduced_date: action_date,
          relevance_score: score,
          threat_level: level,
          tags: matchedKeywords,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Create notifications for critical/high threat items
      if (level === 'critical' || level === 'high') {
        const { data: users } = await supabaseClient
          .from('user_article_preferences')
          .select('user_id')
          .limit(100);

        if (users && users.length > 0) {
          const priorityEmoji = level === 'critical' ? '🚨' : '⚠️';
          const notifications = users.map((user: any) => ({
            user_id: user.user_id,
            title: `${priorityEmoji} ${level.toUpperCase()}: State Action - ${state_code}`,
            message: `${official_name || official_title}: ${title}`,
            priority: level,
            threat_type: action_type,
            source_type: 'state_action',
            source_id: data.id,
            link: source_url,
          }));

          await supabaseClient
            .from('notifications')
            .insert(notifications);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          stateAction: data,
          threatLevel: level,
          affectedOrganizations: affectedOrgs,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle fetching from state RSS feeds
    if (body.action === 'fetch' || !body.action) {
      console.log('Fetching state government RSS feeds...');

      // OPTIMIZED: Limit to 3 sources per run to prevent timeout
      const { limit = 3 } = body;
      
      const { data: sources, error: sourcesError } = await supabaseClient
        .from('rss_sources')
        .select('*')
        .eq('category', 'state_government')
        .eq('is_active', true)
        .order('last_fetched_at', { ascending: true, nullsFirst: true })
        .limit(limit);

      if (sourcesError) throw sourcesError;

      let totalProcessed = 0;
      let relevantFound = 0;
      const startTime = Date.now();
      const maxDuration = 50000; // 50 seconds max

      for (const source of sources || []) {
        // Check timeout
        if (Date.now() - startTime > maxDuration) {
          console.log('⏱️ Approaching timeout, stopping early');
          break;
        }
        try {
          // Determine state from source name
          const stateMatch = MONITORED_STATES.find(s =>
            source.name.toLowerCase().includes(s.name.toLowerCase())
          );

          if (!stateMatch) continue;

          // OPTIMIZED: Reduced timeout to 10s
          const response = await fetch(source.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelligenceBot/1.0)' },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            console.error(`Failed to fetch ${source.name}: ${response.status}`);
            continue;
          }
          
          const text = await response.text();

          // Basic RSS parsing
          const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
          const extractText = (xml: string, tag: string): string => {
            const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = xml.match(regex);
            return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
          };

          let matches = text.matchAll(itemRegex);

          for (const match of matches) {
            const itemXml = match[1];
            const title = extractText(itemXml, 'title');
            const description = extractText(itemXml, 'description');
            const link = extractText(itemXml, 'link');
            const pubDate = extractText(itemXml, 'pubDate');

            if (!title) continue;
            totalProcessed++;

            // Calculate threat level
            const textToAnalyze = `${title} ${description}`;
            const { level, score, matchedKeywords, affectedOrgs } = calculateThreatLevel(textToAnalyze);

            // Only save relevant items
            if (score === 0) continue;
            relevantFound++;

            // Upsert state action
            await supabaseClient
              .from('state_actions')
              .upsert({
                state: stateMatch.name,
                action_type: 'announcement',
                title: title.substring(0, 500),
                description: description.replace(/<[^>]*>/g, '').substring(0, 1000),
                source_url: link,
                sponsor: 'Governor',
                introduced_date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                relevance_score: score,
                threat_level: level,
                tags: matchedKeywords,
                status: 'active'
              }, {
                onConflict: 'source_url'
              });
          }

          // Update source last fetch time
          await supabaseClient
            .from('rss_sources')
            .update({ last_fetched_at: new Date().toISOString() })
            .eq('id', source.id);

        } catch (err) {
          console.error(`Error processing ${source.name}:`, err);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalProcessed,
          relevantFound,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in track-state-actions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
