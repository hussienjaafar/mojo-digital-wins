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

    console.log('Starting entity trends calculation...');

    // Get all entity mentions from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: mentions, error: mentionsError } = await supabase
      .from('entity_mentions')
      .select('*')
      .gte('mentioned_at', sevenDaysAgo);

    if (mentionsError) throw mentionsError;

    console.log(`Processing ${mentions?.length || 0} mentions`);

    // Group mentions by entity_name
    const entityGroups = new Map<string, any[]>();
    
    mentions?.forEach(mention => {
      const existing = entityGroups.get(mention.entity_name) || [];
      existing.push(mention);
      entityGroups.set(mention.entity_name, existing);
    });

    console.log(`Found ${entityGroups.size} unique entities`);

    // Calculate trends for each entity
    const trends = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const [entityName, entityMentions] of entityGroups) {
      const mentions1h = entityMentions.filter(m => new Date(m.mentioned_at) > oneHourAgo).length;
      const mentions6h = entityMentions.filter(m => new Date(m.mentioned_at) > sixHoursAgo).length;
      const mentions24h = entityMentions.filter(m => new Date(m.mentioned_at) > oneDayAgo).length;
      const mentions7d = entityMentions.length;

      // Calculate velocity (change in mentions per hour over last 6h)
      const velocity = mentions6h > 0 ? (mentions1h / mentions6h) * 100 : 0;

      // Calculate average sentiment
      const sentiments = entityMentions
        .filter(m => m.sentiment_score !== null)
        .map(m => m.sentiment_score);
      const avgSentiment = sentiments.length > 0 
        ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
        : 0;

      // Get first and last seen
      const timestamps = entityMentions.map(m => new Date(m.mentioned_at).getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();

      trends.push({
        entity_name: entityName,
        mentions_last_hour: mentions1h,
        mentions_last_6_hours: mentions6h,
        mentions_last_24_hours: mentions24h,
        mentions_last_7_days: mentions7d,
        velocity,
        sentiment_avg: avgSentiment,
        first_seen_at: firstSeen,
        last_seen_at: lastSeen,
        calculated_at: now.toISOString(),
      });
    }

    console.log(`Calculated trends for ${trends.length} entities`);

    // Upsert trends into entity_trends table
    if (trends.length > 0) {
      const { error: upsertError } = await supabase
        .from('entity_trends')
        .upsert(trends, { 
          onConflict: 'entity_name',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error('Error upserting trends:', upsertError);
        throw upsertError;
      }
    }

    console.log('Entity trends calculation complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        trendsCalculated: trends.length,
        mentionsProcessed: mentions?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error calculating entity trends:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
