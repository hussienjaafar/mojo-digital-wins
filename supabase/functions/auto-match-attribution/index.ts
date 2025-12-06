import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchResult {
  refcode: string;
  organization_id: string;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  confidence: number;
  reason: string;
  revenue: number;
  transactions: number;
}

// Normalize strings for comparison
function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/[_\-\s]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Calculate similarity between two strings (0-1)
function similarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);
  
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;
  
  // Check for common patterns
  const wordsA = a.toLowerCase().split(/[_\-\s]+/);
  const wordsB = b.toLowerCase().split(/[_\-\s]+/);
  
  let matchingWords = 0;
  for (const wordA of wordsA) {
    for (const wordB of wordsB) {
      if (wordA === wordB && wordA.length > 2) matchingWords++;
      else if (wordA.includes(wordB) || wordB.includes(wordA)) matchingWords += 0.5;
    }
  }
  
  const totalWords = Math.max(wordsA.length, wordsB.length);
  return matchingWords / totalWords;
}

// Pattern-based matching rules
function matchRefcodeToCampaign(
  refcode: string,
  campaigns: Array<{ campaign_id: string; campaign_name: string; organization_id: string }>
): { campaign_id: string; campaign_name: string; confidence: number; reason: string } | null {
  const normalizedRefcode = refcode.toLowerCase();
  
  // Rule 1: Direct match on campaign_id
  const directMatch = campaigns.find(c => 
    normalize(c.campaign_id) === normalize(refcode)
  );
  if (directMatch) {
    return {
      campaign_id: directMatch.campaign_id,
      campaign_name: directMatch.campaign_name,
      confidence: 1.0,
      reason: 'Direct campaign ID match'
    };
  }
  
  // Rule 2: Check for common patterns like "meta_fall_2025" matching "Fall 2025 Mobilization"
  const patterns: Array<{ refPattern: RegExp; campaignKeywords: string[]; confidence: number }> = [
    { refPattern: /meta[_\-]?(\w+)[_\-]?(\d{4})/i, campaignKeywords: ['meta', 'facebook', 'fb'], confidence: 0.85 },
    { refPattern: /fb[_\-]?(\w+)/i, campaignKeywords: ['facebook', 'fb'], confidence: 0.8 },
    { refPattern: /sms[_\-]?(\w+)/i, campaignKeywords: ['sms', 'text'], confidence: 0.75 },
    { refPattern: /email[_\-]?(\w+)/i, campaignKeywords: ['email', 'newsletter'], confidence: 0.75 },
  ];
  
  for (const pattern of patterns) {
    const refMatch = normalizedRefcode.match(pattern.refPattern);
    if (refMatch) {
      const extractedKeyword = refMatch[1];
      const extractedYear = refMatch[2];
      
      // Find campaigns with matching keywords
      for (const campaign of campaigns) {
        const campaignLower = campaign.campaign_name.toLowerCase();
        
        // Check if campaign contains the keyword from refcode
        if (extractedKeyword && campaignLower.includes(extractedKeyword)) {
          // Boost confidence if year also matches
          let confidence = pattern.confidence;
          if (extractedYear && campaignLower.includes(extractedYear)) {
            confidence = Math.min(confidence + 0.1, 0.95);
          }
          
          return {
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            confidence,
            reason: `Pattern match: refcode "${refcode}" contains "${extractedKeyword}"${extractedYear ? ` and year ${extractedYear}` : ''}`
          };
        }
      }
    }
  }
  
  // Rule 3: Fuzzy matching based on string similarity
  let bestMatch: { campaign_id: string; campaign_name: string; similarity: number } | null = null;
  
  for (const campaign of campaigns) {
    const sim = similarity(refcode, campaign.campaign_name);
    if (sim > 0.5 && (!bestMatch || sim > bestMatch.similarity)) {
      bestMatch = {
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        similarity: sim
      };
    }
  }
  
  if (bestMatch && bestMatch.similarity >= 0.5) {
    return {
      campaign_id: bestMatch.campaign_id,
      campaign_name: bestMatch.campaign_name,
      confidence: Math.min(bestMatch.similarity * 0.8, 0.75), // Cap fuzzy matches at 75%
      reason: `Fuzzy match with ${Math.round(bestMatch.similarity * 100)}% similarity`
    };
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { organizationId, dryRun = true, minConfidence = 0.7 } = await req.json();

    console.log(`🔗 Auto-matching attribution for org: ${organizationId || 'all'}, dryRun: ${dryRun}`);

    // Get unmatched refcodes with revenue
    let refcodesQuery = supabase
      .from('actblue_transactions')
      .select('refcode, organization_id, amount')
      .not('refcode', 'is', null);

    if (organizationId) {
      refcodesQuery = refcodesQuery.eq('organization_id', organizationId);
    }

    const { data: transactions, error: txnError } = await refcodesQuery;
    if (txnError) throw txnError;

    // Aggregate by refcode
    const refcodeAggregates = new Map<string, { 
      organization_id: string; 
      revenue: number; 
      count: number 
    }>();

    for (const txn of transactions || []) {
      const key = `${txn.organization_id}:${txn.refcode}`;
      const existing = refcodeAggregates.get(key) || { 
        organization_id: txn.organization_id, 
        revenue: 0, 
        count: 0 
      };
      existing.revenue += Number(txn.amount);
      existing.count += 1;
      refcodeAggregates.set(key, existing);
    }

    // Get existing attributions to skip
    const { data: existingAttrs, error: attrError } = await supabase
      .from('campaign_attribution')
      .select('refcode, organization_id');
    if (attrError) throw attrError;

    const existingSet = new Set(
      (existingAttrs || []).map(a => `${a.organization_id}:${a.refcode}`)
    );

    // Get Meta campaigns
    let campaignsQuery = supabase
      .from('meta_campaigns')
      .select('campaign_id, campaign_name, organization_id');

    if (organizationId) {
      campaignsQuery = campaignsQuery.eq('organization_id', organizationId);
    }

    const { data: campaigns, error: campError } = await campaignsQuery;
    if (campError) throw campError;

    // Group campaigns by organization
    const campaignsByOrg = new Map<string, Array<{ campaign_id: string; campaign_name: string; organization_id: string }>>();
    for (const camp of campaigns || []) {
      const list = campaignsByOrg.get(camp.organization_id) || [];
      list.push(camp);
      campaignsByOrg.set(camp.organization_id, list);
    }

    // Match refcodes to campaigns
    const matches: MatchResult[] = [];
    const unmatched: Array<{ refcode: string; organization_id: string; revenue: number; transactions: number }> = [];

    for (const [key, agg] of refcodeAggregates) {
      const [orgId, refcode] = key.split(':');
      
      // Skip if already has attribution
      if (existingSet.has(key)) continue;

      const orgCampaigns = campaignsByOrg.get(orgId) || [];
      const match = matchRefcodeToCampaign(refcode, orgCampaigns);

      if (match && match.confidence >= minConfidence) {
        matches.push({
          refcode,
          organization_id: orgId,
          meta_campaign_id: match.campaign_id,
          meta_campaign_name: match.campaign_name,
          confidence: match.confidence,
          reason: match.reason,
          revenue: agg.revenue,
          transactions: agg.count
        });
      } else {
        unmatched.push({
          refcode,
          organization_id: orgId,
          revenue: agg.revenue,
          transactions: agg.count
        });
      }
    }

    // Sort matches by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    // If not dry run, create the attributions
    let created = 0;
    if (!dryRun && matches.length > 0) {
      const insertData = matches.map(m => ({
        organization_id: m.organization_id,
        refcode: m.refcode,
        meta_campaign_id: m.meta_campaign_id,
        utm_source: 'facebook',
        match_confidence: m.confidence,
        is_auto_matched: true,
        match_reason: m.reason,
        last_matched_at: new Date().toISOString(),
        attributed_revenue: m.revenue,
        attributed_transactions: m.transactions
      }));

      const { error: insertError } = await supabase
        .from('campaign_attribution')
        .insert(insertData);

      if (insertError) throw insertError;
      created = matches.length;
      console.log(`✅ Created ${created} attribution mappings`);
    }

    console.log(`📊 Found ${matches.length} matches, ${unmatched.length} unmatched refcodes`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        matches,
        unmatched: unmatched.slice(0, 50), // Limit unmatched for response size
        summary: {
          totalMatched: matches.length,
          totalUnmatched: unmatched.length,
          created,
          highConfidence: matches.filter(m => m.confidence >= 0.9).length,
          mediumConfidence: matches.filter(m => m.confidence >= 0.7 && m.confidence < 0.9).length,
          lowConfidence: matches.filter(m => m.confidence < 0.7).length,
          totalMatchedRevenue: matches.reduce((sum, m) => sum + m.revenue, 0),
          totalUnmatchedRevenue: unmatched.reduce((sum, u) => sum + u.revenue, 0)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-match-attribution:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
