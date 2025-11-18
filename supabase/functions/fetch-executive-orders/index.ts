import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1';

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
  ],
  medium: [
    'immigration',
    'border',
    'national security',
    'foreign policy',
    'state department',
    'homeland security',
    'intelligence',
    'law enforcement',
    'nonprofit',
    'charitable',
    'religious organization',
    'first amendment',
    'free speech',
    'assembly',
    'protest',
  ]
};

// Organizations to specifically track
const TRACKED_ORGANIZATIONS = [
  'cair', 'council on american-islamic relations',
  'mpac', 'muslim public affairs council',
  'isna', 'islamic society of north america',
  'adc', 'american-arab anti-discrimination committee',
  'aai', 'arab american institute',
  'mas', 'muslim american society',
  'icna', 'islamic circle of north america',
  'nait', 'north american islamic trust',
  'holy land foundation',
  'kind',
  'irw', 'islamic relief',
  'helping hand',
  'aclu',
  'brennan center',
];

function calculateThreatLevel(text: string): { level: string; score: number; matchedKeywords: string[] } {
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let score = 0;

  // Check critical keywords (highest priority)
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
    if (lowerText.includes(org)) {
      score += 30;
      matchedKeywords.push(org);
    }
  }

  // Determine threat level based on score
  let level = 'low';
  if (score >= 50) {
    level = 'critical';
  } else if (score >= 30) {
    level = 'high';
  } else if (score >= 15) {
    level = 'medium';
  }

  return { level, score: Math.min(score, 100), matchedKeywords: [...new Set(matchedKeywords)] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Executive Order fetch from Federal Register...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get date range (last 30 days by default)
    const { daysBack = 30 } = await req.json().catch(() => ({}));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    let totalFetched = 0;
    let totalInserted = 0;
    let criticalFound = 0;

    // Fetch Executive Orders
    const documentTypes = [
      'executive_order',
      'proclamation',
      'presidential_memorandum',
      'determination',
    ];

    for (const docType of documentTypes) {
      console.log(`Fetching ${docType}s...`);

      const url = `${FEDERAL_REGISTER_API}/documents.json?` + new URLSearchParams({
        'conditions[type][]': 'PRESDOCU',
        'conditions[presidential_document_type][]': docType,
        'conditions[publication_date][gte]': startDateStr,
        'per_page': '100',
        'order': 'newest',
      });

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.error(`Failed to fetch ${docType}s:`, response.statusText);
        continue;
      }

      const data = await response.json();
      const documents = data.results || [];
      totalFetched += documents.length;

      console.log(`Found ${documents.length} ${docType}s`);

      for (const doc of documents) {
        try {
          // Combine title and abstract for analysis
          const textToAnalyze = `${doc.title || ''} ${doc.abstract || ''} ${(doc.topics || []).join(' ')}`;
          const { level, score, matchedKeywords } = calculateThreatLevel(textToAnalyze);

          // Skip if no relevance at all
          if (score === 0) continue;

          // Upsert the executive order
          const { error } = await supabaseClient
            .from('executive_orders')
            .upsert({
              document_number: doc.document_number,
              title: doc.title,
              abstract: doc.abstract,
              full_text_url: doc.full_text_xml_url,
              pdf_url: doc.pdf_url,
              html_url: doc.html_url,
              signing_date: doc.signing_date,
              publication_date: doc.publication_date,
              president: doc.president?.name,
              executive_order_number: doc.executive_order_number,
              document_type: docType,
              agencies: doc.agencies?.map((a: any) => a.name) || [],
              topics: doc.topics || [],
              relevance_score: score,
              threat_level: level,
              auto_tags: matchedKeywords,
              is_processed: false,
            }, {
              onConflict: 'document_number'
            });

          if (error) {
            console.error(`Error upserting ${doc.document_number}:`, error);
            continue;
          }

          totalInserted++;

          if (level === 'critical') {
            criticalFound++;
            console.log(`⚠️ CRITICAL: ${doc.title}`);

            // Create notification for critical items
            const { data: users } = await supabaseClient
              .from('user_article_preferences')
              .select('user_id')
              .limit(100);

            if (users && users.length > 0) {
              const notifications = users.map((user: any) => ({
                user_id: user.user_id,
                title: '🚨 Critical Executive Action',
                message: doc.title,
                priority: 'critical',
                threat_type: 'executive_order',
                source_type: 'executive_order',
                link: doc.html_url,
              }));

              await supabaseClient
                .from('notifications')
                .insert(notifications);
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err) {
          console.error(`Error processing document:`, err);
        }
      }
    }

    console.log(`Fetch complete: ${totalFetched} documents, ${totalInserted} relevant, ${criticalFound} critical`);

    return new Response(
      JSON.stringify({
        success: true,
        totalFetched,
        relevantInserted: totalInserted,
        criticalFound,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in fetch-executive-orders:', error);
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
