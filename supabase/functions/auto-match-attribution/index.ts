import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ================================================================================
 * AUTO-MATCH ATTRIBUTION - HARDENED VERSION
 * ================================================================================
 * 
 * ATTRIBUTION MATCHING TIERS (in order of reliability):
 * 
 * 1. DETERMINISTIC - url_exact:
 *    - Meta creative destination URL contains ?refcode=XXX
 *    - ActBlue transaction has refcode=XXX (exact match)
 *    - is_deterministic: true, match_confidence: 1.0
 * 
 * 2. HEURISTIC - url_partial:
 *    - Partial/substring match on URL refcode
 *    - is_deterministic: false, attribution_type: heuristic_partial_url
 * 
 * 3. HEURISTIC - campaign_pattern:
 *    - Pattern-based matching (meta_*, fb_*, etc.)
 *    - is_deterministic: false, attribution_type: heuristic_pattern
 * 
 * 4. HEURISTIC - fuzzy:
 *    - Fuzzy string similarity matching
 *    - is_deterministic: false, attribution_type: heuristic_fuzzy
 * 
 * CRITICAL RULES:
 * - Deterministic records can NEVER be overwritten by heuristic matches
 * - Confidence scores reflect match type, not calibrated probabilities
 * - All writes to campaign_attribution include is_deterministic + attribution_type
 * ================================================================================
 */

interface MatchResult {
  refcode: string;
  organization_id: string;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  confidence: number;
  reason: string;
  revenue: number;
  transactions: number;
  destination_url?: string;
  match_type: 'url_exact' | 'url_partial' | 'campaign_pattern' | 'fuzzy' | 'none';
}

interface UnmatchedRefcode {
  refcode: string;
  organization_id: string;
  revenue: number;
  transactions: number;
  reason: string;
}

interface CreativeWithRefcode {
  campaign_id: string;
  campaign_name: string;
  destination_url: string | null;
  extracted_refcode: string | null;
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

// URL-based matching (highest priority)
function matchRefcodeToCreative(
  refcode: string,
  creatives: CreativeWithRefcode[]
): { campaign_id: string; campaign_name: string; confidence: number; reason: string; destination_url: string; match_type: 'url_exact' | 'url_partial' } | null {
  const normalizedRefcode = refcode.toLowerCase();
  
  // Rule 1: DETERMINISTIC - Exact match on extracted_refcode from URL
  for (const creative of creatives) {
    if (creative.extracted_refcode && creative.extracted_refcode.toLowerCase() === normalizedRefcode) {
      return {
        campaign_id: creative.campaign_id,
        campaign_name: creative.campaign_name,
        confidence: 1.0,
        reason: `Exact URL refcode match: ad destination contains ?refcode=${refcode}`,
        destination_url: creative.destination_url || '',
        match_type: 'url_exact'
      };
    }
  }
  
  // Rule 2: HEURISTIC - Partial match on extracted_refcode
  for (const creative of creatives) {
    if (creative.extracted_refcode) {
      const creativeRefcode = creative.extracted_refcode.toLowerCase();
      if (creativeRefcode.includes(normalizedRefcode) || normalizedRefcode.includes(creativeRefcode)) {
        return {
          campaign_id: creative.campaign_id,
          campaign_name: creative.campaign_name,
          confidence: 0.7, // Lower confidence for partial matches
          reason: `Partial URL match: "${creative.extracted_refcode}" overlaps with "${refcode}"`,
          destination_url: creative.destination_url || '',
          match_type: 'url_partial'
        };
      }
    }
  }
  
  return null;
}

// Pattern-based matching rules (fallback heuristics)
function matchRefcodeToCampaign(
  refcode: string,
  campaigns: Array<{ campaign_id: string; campaign_name: string; organization_id: string }>
): { campaign_id: string; campaign_name: string; confidence: number; reason: string; match_type: 'campaign_pattern' | 'fuzzy' } | null {
  const normalizedRefcode = refcode.toLowerCase();
  
  // Rule 1: Direct match on campaign_id
  const directMatch = campaigns.find(c => 
    normalize(c.campaign_id) === normalize(refcode)
  );
  if (directMatch) {
    return {
      campaign_id: directMatch.campaign_id,
      campaign_name: directMatch.campaign_name,
      confidence: 0.8,
      reason: 'Pattern: refcode matches campaign ID directly',
      match_type: 'campaign_pattern'
    };
  }
  
  // Rule 2: Check for common patterns like "meta_fall_2025"
  const patterns: Array<{ refPattern: RegExp; campaignKeywords: string[]; confidence: number }> = [
    { refPattern: /meta[_\-]?(\w+)[_\-]?(\d{4})/i, campaignKeywords: ['meta', 'facebook', 'fb'], confidence: 0.6 },
    { refPattern: /fb[_\-]?(\w+)/i, campaignKeywords: ['facebook', 'fb'], confidence: 0.5 },
    { refPattern: /sms[_\-]?(\w+)/i, campaignKeywords: ['sms', 'text'], confidence: 0.5 },
    { refPattern: /email[_\-]?(\w+)/i, campaignKeywords: ['email', 'newsletter'], confidence: 0.5 },
  ];
  
  for (const pattern of patterns) {
    const refMatch = normalizedRefcode.match(pattern.refPattern);
    if (refMatch) {
      const extractedKeyword = refMatch[1];
      const extractedYear = refMatch[2];
      
      for (const campaign of campaigns) {
        const campaignLower = campaign.campaign_name.toLowerCase();
        
        if (extractedKeyword && campaignLower.includes(extractedKeyword)) {
          let confidence = pattern.confidence;
          if (extractedYear && campaignLower.includes(extractedYear)) {
            confidence = Math.min(confidence + 0.1, 0.7);
          }
          
          return {
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            confidence,
            reason: `Pattern: refcode "${refcode}" contains "${extractedKeyword}"${extractedYear ? ` and year ${extractedYear}` : ''}`,
            match_type: 'campaign_pattern'
          };
        }
      }
    }
  }
  
  // Rule 3: Fuzzy matching based on string similarity (lowest tier)
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
      confidence: Math.min(bestMatch.similarity * 0.5, 0.5), // Cap fuzzy at 50%
      reason: `Fuzzy: ${Math.round(bestMatch.similarity * 100)}% name similarity (directional only)`,
      match_type: 'fuzzy'
    };
  }
  
  return null;
}

// Convert match_type to attribution_type for database
function getAttributionType(matchType: string): string {
  switch (matchType) {
    case 'url_exact':
      return 'deterministic_url_refcode';
    case 'url_partial':
      return 'heuristic_partial_url';
    case 'campaign_pattern':
      return 'heuristic_pattern';
    case 'fuzzy':
      return 'heuristic_fuzzy';
    default:
      return 'unknown';
  }
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

    const { organizationId, dryRun = true, minConfidence = 0.5 } = await req.json();

    console.log(`[AUTO-MATCH] Starting for org: ${organizationId || 'all'}, dryRun: ${dryRun}`);

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

    // Get existing attributions - CRITICAL: track which are deterministic
    const { data: existingAttrs, error: attrError } = await supabase
      .from('campaign_attribution')
      .select('refcode, organization_id, is_deterministic');
    if (attrError) throw attrError;

    const existingSet = new Set(
      (existingAttrs || []).map(a => `${a.organization_id}:${a.refcode}`)
    );
    
    // Track deterministic attributions to NEVER overwrite
    const deterministicSet = new Set(
      (existingAttrs || [])
        .filter(a => a.is_deterministic === true)
        .map(a => `${a.organization_id}:${a.refcode}`)
    );

    console.log(`[AUTO-MATCH] ${deterministicSet.size} deterministic attributions protected from overwrite`);

    // Get Meta creatives with destination URLs and extracted refcodes
    let creativesQuery = supabase
      .from('meta_creative_insights')
      .select('campaign_id, destination_url, extracted_refcode, organization_id')
      .not('destination_url', 'is', null);

    if (organizationId) {
      creativesQuery = creativesQuery.eq('organization_id', organizationId);
    }

    const { data: creatives, error: creativeError } = await creativesQuery;
    if (creativeError) {
      console.warn('[AUTO-MATCH] Error fetching creatives:', creativeError);
    }

    console.log(`[AUTO-MATCH] Data summary:`, {
      transactions: transactions?.length || 0,
      uniqueRefcodes: refcodeAggregates.size,
      existingAttributions: existingSet.size,
      deterministicProtected: deterministicSet.size,
      creativesWithUrls: creatives?.length || 0,
      creativesWithRefcodes: creatives?.filter((c: any) => c.extracted_refcode).length || 0
    });

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

    // Group creatives by organization
    const creativesByOrg = new Map<string, CreativeWithRefcode[]>();
    for (const creative of creatives || []) {
      const campaign = (campaigns || []).find(c => c.campaign_id === creative.campaign_id);
      const list = creativesByOrg.get(creative.organization_id) || [];
      list.push({
        campaign_id: creative.campaign_id,
        campaign_name: campaign?.campaign_name || creative.campaign_id,
        destination_url: creative.destination_url,
        extracted_refcode: creative.extracted_refcode
      });
      creativesByOrg.set(creative.organization_id, list);
    }

    // Stats tracking
    let deterministicCount = 0;
    let heuristicPartialCount = 0;
    let heuristicPatternCount = 0;
    let heuristicFuzzyCount = 0;
    let skippedDeterministic = 0;

    // Match refcodes to campaigns
    const matches: MatchResult[] = [];
    const unmatched: UnmatchedRefcode[] = [];

    for (const [key, agg] of refcodeAggregates) {
      const [orgId, refcode] = key.split(':');
      
      // GUARD: Never overwrite deterministic attributions
      if (deterministicSet.has(key)) {
        skippedDeterministic++;
        continue;
      }
      
      // Skip if already has any attribution (unless we want to re-evaluate)
      if (existingSet.has(key)) continue;

      const orgCreatives = creativesByOrg.get(orgId) || [];
      const orgCampaigns = campaignsByOrg.get(orgId) || [];

      // PRIORITY 1: URL-based matching (can be deterministic)
      const urlMatch = matchRefcodeToCreative(refcode, orgCreatives);
      
      if (urlMatch && urlMatch.confidence >= minConfidence) {
        matches.push({
          refcode,
          organization_id: orgId,
          meta_campaign_id: urlMatch.campaign_id,
          meta_campaign_name: urlMatch.campaign_name,
          confidence: urlMatch.confidence,
          reason: urlMatch.reason,
          revenue: agg.revenue,
          transactions: agg.count,
          destination_url: urlMatch.destination_url,
          match_type: urlMatch.match_type
        });
        
        if (urlMatch.match_type === 'url_exact') {
          deterministicCount++;
        } else {
          heuristicPartialCount++;
        }
        continue;
      }

      // PRIORITY 2: Campaign pattern matching (always heuristic)
      const campaignMatch = matchRefcodeToCampaign(refcode, orgCampaigns);

      if (campaignMatch && campaignMatch.confidence >= minConfidence) {
        matches.push({
          refcode,
          organization_id: orgId,
          meta_campaign_id: campaignMatch.campaign_id,
          meta_campaign_name: campaignMatch.campaign_name,
          confidence: campaignMatch.confidence,
          reason: campaignMatch.reason,
          revenue: agg.revenue,
          transactions: agg.count,
          match_type: campaignMatch.match_type
        });
        
        if (campaignMatch.match_type === 'fuzzy') {
          heuristicFuzzyCount++;
        } else {
          heuristicPatternCount++;
        }
        continue;
      }

      // No match found
      let unmatchReason = 'No matching campaign found';
      if (orgCreatives.length === 0 && orgCampaigns.length === 0) {
        unmatchReason = 'No Meta ads data synced for this organization';
      } else if (orgCreatives.filter(c => c.extracted_refcode).length === 0) {
        unmatchReason = 'No refcodes found in Meta ad destination URLs';
      } else if (campaignMatch) {
        unmatchReason = `Best match below ${Math.round(minConfidence * 100)}% threshold`;
      }

      unmatched.push({
        refcode,
        organization_id: orgId,
        revenue: agg.revenue,
        transactions: agg.count,
        reason: unmatchReason
      });
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
        attributed_transactions: m.transactions,
        // CRITICAL: Correctly set determinism fields
        is_deterministic: m.match_type === 'url_exact',
        attribution_type: getAttributionType(m.match_type)
      }));

      const { error: insertError } = await supabase
        .from('campaign_attribution')
        .insert(insertData);

      if (insertError) throw insertError;
      created = matches.length;
      console.log(`[AUTO-MATCH] Created ${created} attribution mappings`);
    }

    // Summary logging
    console.log(`[AUTO-MATCH] ========== MATCH SUMMARY ==========`);
    console.log(`[AUTO-MATCH] Deterministic (url_exact): ${deterministicCount}`);
    console.log(`[AUTO-MATCH] Heuristic (url_partial): ${heuristicPartialCount}`);
    console.log(`[AUTO-MATCH] Heuristic (pattern): ${heuristicPatternCount}`);
    console.log(`[AUTO-MATCH] Heuristic (fuzzy): ${heuristicFuzzyCount}`);
    console.log(`[AUTO-MATCH] Skipped (deterministic protected): ${skippedDeterministic}`);
    console.log(`[AUTO-MATCH] Unmatched: ${unmatched.length}`);
    console.log(`[AUTO-MATCH] ===================================`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        matches,
        unmatched: unmatched.slice(0, 50),
        summary: {
          totalMatched: matches.length,
          totalUnmatched: unmatched.length,
          created,
          matchBreakdown: {
            deterministic_url_exact: deterministicCount,
            heuristic_url_partial: heuristicPartialCount,
            heuristic_pattern: heuristicPatternCount,
            heuristic_fuzzy: heuristicFuzzyCount
          },
          skippedDeterministic,
          totalMatchedRevenue: matches.reduce((sum, m) => sum + m.revenue, 0),
          totalUnmatchedRevenue: unmatched.reduce((sum, u) => sum + u.revenue, 0)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AUTO-MATCH] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
