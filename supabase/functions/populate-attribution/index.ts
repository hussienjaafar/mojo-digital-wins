import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Populate donation_attribution table by matching actblue_transactions to Meta campaigns
 * via refcode mappings and click_id/fbclid matching.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, start_date, end_date, limit = 1000 } = await req.json();
    
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`[POPULATE ATTRIBUTION] Starting for org ${organization_id}`);

    // 1. Fetch refcode mappings for this organization
    const { data: refcodeMappings, error: refcodeErr } = await supabase
      .from('refcode_mappings')
      .select('refcode, campaign_id, ad_id, creative_id, platform')
      .eq('organization_id', organization_id);

    if (refcodeErr) {
      console.error('[POPULATE ATTRIBUTION] Failed to fetch refcode mappings:', refcodeErr);
    }

    const refcodeMap = new Map<string, { campaign_id: string; ad_id: string; creative_id: string; platform: string }>();
    (refcodeMappings || []).forEach(m => {
      if (m.refcode) {
        refcodeMap.set(m.refcode.toLowerCase(), {
          campaign_id: m.campaign_id,
          ad_id: m.ad_id,
          creative_id: m.creative_id,
          platform: m.platform || 'meta',
        });
      }
    });

    console.log(`[POPULATE ATTRIBUTION] Loaded ${refcodeMap.size} refcode mappings`);

    // Note: meta_click_mappings table doesn't exist - skip click_id/fbclid mapping
    // Attribution is done via refcode mappings only
    const clickIdMap = new Map<string, { campaign_id: string; ad_id: string; creative_id: string }>();
    const fbclidMap = new Map<string, { campaign_id: string; ad_id: string; creative_id: string }>();

    console.log(`[POPULATE ATTRIBUTION] Click/fbclid mapping via meta_click_mappings not available`);

    // 2. Fetch actblue transactions
    let query = supabase
      .from('actblue_transactions')
      .select('id, transaction_id, transaction_date, amount, net_amount, fee, refcode, refcode2, click_id, fbclid, donor_email, transaction_type, source_campaign, is_recurring')
      .eq('organization_id', organization_id)
      .eq('transaction_type', 'donation')
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }
    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    const { data: transactions, error: txErr } = await query;

    if (txErr) {
      console.error('[POPULATE ATTRIBUTION] Failed to fetch transactions:', txErr);
      throw txErr;
    }

    console.log(`[POPULATE ATTRIBUTION] Processing ${transactions?.length || 0} transactions`);

    // 3. Fetch creative insights for topic/tone
    const { data: creativeInsights, error: insightErr } = await supabase
      .from('meta_creative_insights')
      .select('creative_id, primary_topic, tone')
      .eq('organization_id', organization_id);

    const creativeTopicMap = new Map<string, { topic: string; tone: string }>();
    (creativeInsights || []).forEach(c => {
      if (c.creative_id) {
        creativeTopicMap.set(c.creative_id, { topic: c.primary_topic, tone: c.tone });
      }
    });

    // 4. Process transactions and create attribution records
    const attributionRecords: any[] = [];
    let matched = 0;
    let unmatched = 0;

    for (const tx of transactions || []) {
      let platform: string | null = null;
      let campaignId: string | null = null;
      let adId: string | null = null;
      let creativeId: string | null = null;
      let attributionMethod: string | null = null;

      // Try refcode matching first
      const refcode = tx.refcode?.toLowerCase();
      if (refcode && refcodeMap.has(refcode)) {
        const mapping = refcodeMap.get(refcode)!;
        platform = mapping.platform;
        campaignId = mapping.campaign_id;
        adId = mapping.ad_id;
        creativeId = mapping.creative_id;
        attributionMethod = 'refcode';
      }

      // Try click_id matching (if mappings exist)
      if (!campaignId && tx.click_id && clickIdMap.has(tx.click_id)) {
        const mapping = clickIdMap.get(tx.click_id)!;
        platform = 'meta';
        campaignId = mapping.campaign_id;
        adId = mapping.ad_id;
        creativeId = mapping.creative_id;
        attributionMethod = 'click_id';
      }

      // Try fbclid matching (if mappings exist)
      if (!campaignId && tx.fbclid && fbclidMap.has(tx.fbclid)) {
        const mapping = fbclidMap.get(tx.fbclid)!;
        platform = 'meta';
        campaignId = mapping.campaign_id;
        adId = mapping.ad_id;
        creativeId = mapping.creative_id;
        attributionMethod = 'fbclid';
      }

      // Get creative topic/tone if we have a creative_id
      let creativeTopic: string | null = null;
      let creativeTone: string | null = null;
      if (creativeId && creativeTopicMap.has(creativeId)) {
        const insight = creativeTopicMap.get(creativeId)!;
        creativeTopic = insight.topic;
        creativeTone = insight.tone;
      }

      // Create donor hash for privacy
      const donorIdHash = tx.donor_email 
        ? await hashEmail(tx.donor_email)
        : null;

      if (campaignId) {
        matched++;
      } else {
        unmatched++;
      }

      // Match the actual donation_attribution table schema
      attributionRecords.push({
        organization_id,
        transaction_id: tx.transaction_id,
        transaction_date: tx.transaction_date,
        amount: tx.amount,
        net_amount: tx.net_amount,
        fee: tx.fee,
        transaction_type: tx.transaction_type,
        refcode: tx.refcode,
        source_campaign: tx.source_campaign,
        is_recurring: tx.is_recurring,
        donor_id_hash: donorIdHash,
        donor_email: tx.donor_email,
        attributed_platform: platform,
        attributed_campaign_id: campaignId,
        attributed_ad_id: adId,
        attributed_creative_id: creativeId,
        creative_topic: creativeTopic,
        creative_tone: creativeTone,
        attribution_method: attributionMethod,
      });
    }

    console.log(`[POPULATE ATTRIBUTION] Matched: ${matched}, Unmatched: ${unmatched}`);

    // 5. Upsert attribution records in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < attributionRecords.length; i += batchSize) {
      const batch = attributionRecords.slice(i, i + batchSize);
      
      const { error: upsertErr } = await supabase
        .from('donation_attribution')
        .upsert(batch, { 
          onConflict: 'organization_id,transaction_id',
          ignoreDuplicates: false 
        });

      if (upsertErr) {
        console.error(`[POPULATE ATTRIBUTION] Batch upsert error:`, upsertErr);
      } else {
        inserted += batch.length;
      }
    }

    // 6. Update data freshness
    await supabase
      .from('data_freshness')
      .upsert({
        organization_id,
        source: 'donation_attribution',
        scope: 'organization',
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'success',
        records_synced: inserted,
      }, { onConflict: 'organization_id,source,scope' });

    console.log(`[POPULATE ATTRIBUTION] Completed. Inserted ${inserted} records.`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: transactions?.length || 0,
      matched,
      unmatched,
      inserted,
    }), { headers: corsHeaders });

  } catch (error: any) {
    console.error('[POPULATE ATTRIBUTION] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});

async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
