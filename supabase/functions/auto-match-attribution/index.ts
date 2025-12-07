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
  destination_url?: string;
  match_type: 'url_exact' | 'url_pattern' | 'campaign_pattern' | 'fuzzy' | 'none';
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

// URL-based matching (highest priority)
function matchRefcodeToCreative(
  refcode: string,
  creatives: CreativeWithRefcode[]
): { campaign_id: string; campaign_name: string; confidence: number; reason: string; destination_url: string; match_type: 'url_exact' | 'url_pattern' } | null {
  const normalizedRefcode = refcode.toLowerCase();
  
  // Rule 1: Exact match on extracted_refcode from URL
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
  
  // Rule 2: Partial match on extracted_refcode
  for (const creative of creatives) {
    if (creative.extracted_refcode) {
      const creativeRefcode = creative.extracted_refcode.toLowerCase();
      if (creativeRefcode.includes(normalizedRefcode) || normalizedRefcode.includes(creativeRefcode)) {
        return {
          campaign_id: creative.campaign_id,
          campaign_name: creative.campaign_name,
          confidence: 0.9,
          reason: `Partial URL refcode match: "${creative.extracted_refcode}" matches "${refcode}"`,
          destination_url: creative.destination_url || '',
          match_type: 'url_pattern'
        };
      }
    }
  }
  
  return null;
}

// Pattern-based matching rules (fallback)
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
      confidence: 0.95,
      reason: 'Direct campaign ID match',
      match_type: 'campaign_pattern'
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
            confidence = Math.min(confidence + 0.1, 0.9);
          }
          
          return {
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            confidence,
            reason: `Pattern match: refcode "${refcode}" contains "${extractedKeyword}"${extractedYear ? ` and year ${extractedYear}` : ''}`,
            match_type: 'campaign_pattern'
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
      confidence: Math.min(bestMatch.similarity * 0.7, 0.65), // Cap fuzzy matches at 65%
      reason: `Fuzzy match with ${Math.round(bestMatch.similarity * 100)}% similarity`,
      match_type: 'fuzzy'
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

    console.log(`🔗 Auto-matching attribution for org: ${organizationId || 'all'}, dryRun: ${dryRun}, minConfidence: ${minConfidence}`);
    console.log(`[DEBUG][auto-match] Starting auto-match process...`);

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

    // NEW: Get Meta creatives with destination URLs and extracted refcodes
    let creativesQuery = supabase
      .from('meta_creative_insights')
      .select('campaign_id, destination_url, extracted_refcode, organization_id')
      .not('destination_url', 'is', null);

    if (organizationId) {
      creativesQuery = creativesQuery.eq('organization_id', organizationId);
    }

    const { data: creatives, error: creativeError } = await creativesQuery;
    if (creativeError) {
      console.warn('[DEBUG][auto-match] Error fetching creatives with URLs:', creativeError);
    }

    // Log data summary
    console.log(`[DEBUG][auto-match] Data fetched:`, {
      transactionCount: transactions?.length || 0,
      uniqueRefcodes: refcodeAggregates.size,
      existingAttributions: existingSet.size,
      creativesWithUrls: creatives?.length || 0,
      creativesWithRefcodes: creatives?.filter((c: any) => c.extracted_refcode).length || 0
    });

    // Log sample refcodes
    const sampleRefcodes = Array.from(refcodeAggregates.entries()).slice(0, 5);
    console.log(`[DEBUG][auto-match] Sample refcodes (top 5):`, 
      sampleRefcodes.map(([k, v]) => ({
        key: k, revenue: v.revenue.toFixed(2), count: v.count
      }))
    );

    // Log sample creatives with URLs
    console.log(`[DEBUG][auto-match] Sample creatives with URLs (top 5):`, 
      (creatives || []).slice(0, 5).map((c: any) => ({
        campaign_id: c.campaign_id,
        destination_url: c.destination_url?.substring(0, 80) || 'NONE',
        extracted_refcode: c.extracted_refcode || 'NONE'
      }))
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

    // Group creatives by organization (with campaign name lookup)
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

    // Track stats
    let urlMatchCount = 0;
    let patternMatchCount = 0;
    let fuzzyMatchCount = 0;
    let noUrlCount = 0;

    // Match refcodes to campaigns
    const matches: MatchResult[] = [];
    const unmatched: UnmatchedRefcode[] = [];

    for (const [key, agg] of refcodeAggregates) {
      const [orgId, refcode] = key.split(':');
      
      // Skip if already has attribution
      if (existingSet.has(key)) continue;

      const orgCreatives = creativesByOrg.get(orgId) || [];
      const orgCampaigns = campaignsByOrg.get(orgId) || [];

      // Log matching context for each refcode
      console.log(`[DEBUG][auto-match] Matching refcode "${refcode}" (org: ${orgId}):`, {
        creativesCount: orgCreatives.length,
        creativesWithRefcode: orgCreatives.filter(c => c.extracted_refcode).length,
        campaignsCount: orgCampaigns.length,
        availableRefcodesInAds: orgCreatives.filter(c => c.extracted_refcode).map(c => c.extracted_refcode).slice(0, 5)
      });

      // PRIORITY 1: Try URL-based matching first (highest accuracy)
      const urlMatch = matchRefcodeToCreative(refcode, orgCreatives);
      
      console.log(`[DEBUG][auto-match] URL match result for "${refcode}":`, urlMatch ? {
        campaign: urlMatch.campaign_name,
        confidence: urlMatch.confidence,
        matchType: urlMatch.match_type
      } : 'NO_MATCH');
      
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
        urlMatchCount++;
        continue;
      }

      // PRIORITY 2: Fall back to campaign pattern matching
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
          fuzzyMatchCount++;
        } else {
          patternMatchCount++;
        }
        continue;
      }

      // Determine why no match was found
      let unmatchReason = 'No matching campaign found';
      if (orgCreatives.length === 0 && orgCampaigns.length === 0) {
        unmatchReason = 'No Meta ads data synced for this organization';
      } else if (orgCreatives.filter(c => c.extracted_refcode).length === 0) {
        unmatchReason = 'No refcodes found in Meta ad destination URLs - sync ads to extract refcodes';
        noUrlCount++;
      } else if (campaignMatch) {
        unmatchReason = `Best match "${campaignMatch.campaign_name}" has ${Math.round(campaignMatch.confidence * 100)}% confidence (below ${Math.round(minConfidence * 100)}% threshold)`;
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
        attributed_transactions: m.transactions
      }));

      const { error: insertError } = await supabase
        .from('campaign_attribution')
        .insert(insertData);

      if (insertError) throw insertError;
      created = matches.length;
      console.log(`✅ Created ${created} attribution mappings`);
    }

    // Comprehensive summary logging
    console.log(`[DEBUG][auto-match] ========== MATCH SUMMARY ==========`);
    console.log(`[DEBUG][auto-match] Total matches: ${matches.length}`);
    console.log(`[DEBUG][auto-match] - URL matches: ${urlMatchCount}`);
    console.log(`[DEBUG][auto-match] - Pattern matches: ${patternMatchCount}`);
    console.log(`[DEBUG][auto-match] - Fuzzy matches: ${fuzzyMatchCount}`);
    console.log(`[DEBUG][auto-match] Total unmatched: ${unmatched.length}`);
    console.log(`[DEBUG][auto-match] - No URL data: ${noUrlCount}`);
    console.log(`[DEBUG][auto-match] Matched revenue: $${matches.reduce((sum, m) => sum + m.revenue, 0).toFixed(2)}`);
    console.log(`[DEBUG][auto-match] Unmatched revenue: $${unmatched.reduce((sum, u) => sum + u.revenue, 0).toFixed(2)}`);
    
    // Log sample unmatched reasons
    console.log(`[DEBUG][auto-match] Sample unmatched reasons:`, 
      unmatched.slice(0, 5).map(u => ({ refcode: u.refcode, reason: u.reason }))
    );
    console.log(`[DEBUG][auto-match] ===================================`);

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
          totalUnmatchedRevenue: unmatched.reduce((sum, u) => sum + u.revenue, 0),
          // Match type breakdown
          urlMatches: urlMatchCount,
          patternMatches: patternMatchCount,
          fuzzyMatches: fuzzyMatchCount,
          noUrlData: noUrlCount
        },
        // Debug info for UI
        debugInfo: {
          transactionCount: transactions?.length || 0,
          uniqueRefcodes: refcodeAggregates.size,
          creativesWithUrls: creatives?.length || 0,
          creativesWithRefcodes: (creatives || []).filter((c: any) => c.extracted_refcode).length,
          metaCampaigns: campaigns?.length || 0,
          sampleCreatives: (creatives || []).slice(0, 10).map((c: any) => ({
            campaign_id: c.campaign_id,
            destination_url: c.destination_url?.substring(0, 100) || 'NONE',
            extracted_refcode: c.extracted_refcode || 'NONE'
          }))
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
