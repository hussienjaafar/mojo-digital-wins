import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { POLICY_DOMAIN_KEYWORDS, getMatchingDomains } from "../_shared/policyDomainKeywords.ts";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Extract Campaign Topics
 *
 * Extracts policy domains, topics, and entities from campaign content
 * for trend-campaign correlation and affinity learning.
 */

interface Campaign {
  id: string;
  organization_id: string;
  campaign_type: 'sms' | 'meta_ad' | 'email';
  sms_copy?: string;
  ad_headline?: string;
  ad_body?: string;
  video_transcript?: string;
  email_subject?: string;
  email_body?: string;
  sent_at?: string;
  created_at: string;
}

interface CampaignTopicExtraction {
  campaign_id: string;
  campaign_type: string;
  organization_id: string;
  policy_domains: string[];
  topics: string[];
  entities: string[];
  emotional_appeals: string[];
  raw_content: string;
  extracted_at: string;
}

function getCampaignContent(campaign: Campaign): string {
  if (campaign.campaign_type === 'sms') {
    return campaign.sms_copy || '';
  } else if (campaign.campaign_type === 'meta_ad') {
    return [
      campaign.ad_headline,
      campaign.ad_body,
      campaign.video_transcript,
    ].filter(Boolean).join(' ');
  } else if (campaign.campaign_type === 'email') {
    return [
      campaign.email_subject,
      campaign.email_body,
    ].filter(Boolean).join(' ');
  }
  return '';
}

// Emotional appeal keywords
const EMOTIONAL_APPEALS: Record<string, string[]> = {
  urgency: ['urgent', 'now', 'today', 'deadline', 'last chance', 'act now', 'immediately', 'time is running out'],
  fear: ['danger', 'threat', 'risk', 'attack', 'destroy', 'lose', 'losing', 'crisis', 'emergency'],
  hope: ['hope', 'dream', 'future', 'better', 'change', 'together', 'possible', 'believe', 'imagine'],
  anger: ['outrage', 'unacceptable', 'shameful', 'corrupt', 'betrayal', 'fight', 'stand up', 'enough'],
  solidarity: ['together', 'we', 'us', 'community', 'family', 'neighbors', 'allies', 'unite'],
  pride: ['proud', 'achievement', 'victory', 'success', 'honor', 'heritage', 'history'],
};

function detectEmotionalAppeals(text: string): string[] {
  const appeals: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [appeal, keywords] of Object.entries(EMOTIONAL_APPEALS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      appeals.push(appeal);
    }
  }

  return appeals;
}

// Extract specific topics (more granular than policy domains)
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lowerText = text.toLowerCase();

  // Topic patterns (specific issues)
  const topicPatterns: Record<string, RegExp[]> = {
    'Medicare expansion': [/medicare\s*(expansion|for all|coverage)/i],
    'Student debt relief': [/student\s*(loan|debt)\s*(relief|forgiveness|cancel)/i],
    'Climate bill': [/climate\s*(bill|legislation|act|action)/i],
    'Voting rights': [/voting\s*rights/i, /voter\s*suppression/i],
    'Police reform': [/police\s*(reform|accountability|brutality)/i],
    'Abortion access': [/abortion\s*(access|rights|ban)/i, /reproductive\s*(rights|health)/i],
    'Gun control': [/gun\s*(control|reform|safety|violence)/i],
    'Immigration reform': [/immigration\s*(reform|policy)/i, /path\s*to\s*citizenship/i],
    'Minimum wage': [/minimum\s*wage/i, /\$15\s*(an\s*)?hour/i],
    'Healthcare costs': [/health\s*care\s*costs?/i, /prescription\s*drug\s*prices?/i],
  };

  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    if (patterns.some(p => p.test(text))) {
      topics.push(topic);
    }
  }

  return topics;
}

// Extract named entities (simplified)
function extractEntities(text: string): string[] {
  const entities: string[] = [];

  // Common political figure patterns
  const entityPatterns = [
    /(?:President|Senator|Rep(?:resentative)?\.?|Gov(?:ernor)?\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /(?:Biden|Trump|Harris|Obama|Pelosi|McConnell|Schumer|Sanders|Warren|AOC)/gi,
  ];

  for (const pattern of entityPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push(match[1] || match[0]);
    }
  }

  return [...new Set(entities)];
}

async function extractCampaignTopics(campaign: Campaign): Promise<CampaignTopicExtraction> {
  const content = getCampaignContent(campaign);
  const policyDomains = getMatchingDomains(content, 1);
  const topics = extractTopics(content);
  const entities = extractEntities(content);
  const emotionalAppeals = detectEmotionalAppeals(content);

  return {
    campaign_id: campaign.id,
    campaign_type: campaign.campaign_type,
    organization_id: campaign.organization_id,
    policy_domains: policyDomains,
    topics,
    entities,
    emotional_appeals: emotionalAppeals,
    raw_content: content.substring(0, 1000),
    extracted_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!validateCronSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaign_id;
    const batchSize = body.batch_size || 50;

    console.log('📝 Starting campaign topic extraction...');

    // Build query for campaigns without extractions
    // Note: This requires joining with campaign_topic_extractions
    // For simplicity, we'll get recent campaigns and check if extraction exists

    let campaignsQuery;

    if (campaignId) {
      // Single campaign
      campaignsQuery = supabase
        .from('sms_campaigns')
        .select('id, organization_id, sms_copy, sent_at, created_at')
        .eq('id', campaignId);
    } else {
      // Get recent SMS campaigns without extractions
      const { data: existingExtractions } = await supabase
        .from('campaign_topic_extractions')
        .select('campaign_id')
        .gte('extracted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const extractedIds = (existingExtractions || []).map(e => e.campaign_id);

      campaignsQuery = supabase
        .from('sms_campaigns')
        .select('id, organization_id, sms_copy, sent_at, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(batchSize);

      if (extractedIds.length > 0) {
        campaignsQuery = campaignsQuery.not('id', 'in', `(${extractedIds.join(',')})`);
      }
    }

    const { data: smsCampaigns, error: smsError } = await campaignsQuery;

    // Also get meta ads
    const { data: metaAds } = await supabase
      .from('meta_ads')
      .select('id, organization_id, headline, body, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(batchSize);

    console.log(`📊 Processing ${smsCampaigns?.length || 0} SMS campaigns, ${metaAds?.length || 0} Meta ads`);

    const extractions: CampaignTopicExtraction[] = [];

    // Process SMS campaigns
    for (const campaign of smsCampaigns || []) {
      const campaignObj: Campaign = {
        id: campaign.id,
        organization_id: campaign.organization_id,
        campaign_type: 'sms',
        sms_copy: campaign.sms_copy,
        sent_at: campaign.sent_at,
        created_at: campaign.created_at,
      };

      const extraction = await extractCampaignTopics(campaignObj);
      extractions.push(extraction);
    }

    // Process Meta ads
    for (const ad of metaAds || []) {
      const campaignObj: Campaign = {
        id: ad.id,
        organization_id: ad.organization_id,
        campaign_type: 'meta_ad',
        ad_headline: ad.headline,
        ad_body: ad.body,
        created_at: ad.created_at,
      };

      const extraction = await extractCampaignTopics(campaignObj);
      extractions.push(extraction);
    }

    // Insert extractions
    if (extractions.length > 0) {
      const { error: insertError } = await supabase
        .from('campaign_topic_extractions')
        .upsert(extractions, {
          onConflict: 'campaign_id',
          ignoreDuplicates: true,
        });

      if (insertError) {
        console.warn('Insert error:', insertError);
      }
    }

    console.log(`✅ Extracted topics for ${extractions.length} campaigns`);

    return new Response(
      JSON.stringify({
        success: true,
        campaignsProcessed: extractions.length,
        smsCampaigns: smsCampaigns?.length || 0,
        metaAds: metaAds?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error extracting campaign topics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
