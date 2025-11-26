import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

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

    console.log('Detecting fundraising opportunities...');

    // Get all organizations
    const { data: orgs } = await supabase
      .from('client_organizations')
      .select('id')
      .eq('is_active', true);

    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ message: 'No active organizations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalOpportunities = 0;

    for (const org of orgs) {
      // Get current trending entities for this org
      const { data: trendingEntities } = await supabase
        .from('entity_trends')
        .select('*')
        .eq('organization_id', org.id)
        .gte('trend_window_start', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .gt('velocity', 30)
        .order('velocity', { ascending: false })
        .limit(10);

      if (!trendingEntities || trendingEntities.length === 0) continue;

      for (const entity of trendingEntities) {
        // Check historical performance
        const { data: pastCorrelations } = await supabase
          .from('event_impact_correlations')
          .select('*')
          .eq('organization_id', org.id)
          .eq('entity_name', entity.entity_name)
          .order('correlation_strength', { ascending: false })
          .limit(5);

        // Calculate opportunity score
        const historicalSuccess = pastCorrelations && pastCorrelations.length > 0;
        const avgCorrelation = historicalSuccess 
          ? pastCorrelations.reduce((sum, c) => sum + c.correlation_strength, 0) / pastCorrelations.length
          : 0;
        const avgAmount = historicalSuccess
          ? pastCorrelations.reduce((sum, c) => sum + c.amount_raised_48h_after, 0) / pastCorrelations.length
          : 0;

        // Calculate time sensitivity (how long has it been trending)
        const hoursTrending = (Date.now() - new Date(entity.trend_window_start).getTime()) / (1000 * 60 * 60);
        const timeSensitivity = Math.max(0, 100 - (hoursTrending * 5)); // Decays over time

        // Overall opportunity score
        const opportunityScore = Math.min(100,
          (entity.velocity * 0.3) +
          (avgCorrelation * 0.3) +
          (timeSensitivity * 0.2) +
          (entity.current_mentions * 0.2)
        );

        // Only create opportunity if score is high enough
        if (opportunityScore >= 60) {
          // Get sample mentions for context
          const { data: mentions } = await supabase
            .from('entity_mentions')
            .select('source_type, source_id, mentioned_at')
            .eq('organization_id', org.id)
            .eq('entity_name', entity.entity_name)
            .gte('mentioned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('mentioned_at', { ascending: false })
            .limit(3);

          const { error: insertError } = await supabase
            .from('fundraising_opportunities')
            .upsert({
              organization_id: org.id,
              entity_name: entity.entity_name,
              entity_type: entity.entity_type,
              opportunity_score: opportunityScore,
              velocity: entity.velocity,
              current_mentions: entity.current_mentions,
              time_sensitivity: timeSensitivity,
              estimated_value: avgAmount > 0 ? avgAmount : null,
              historical_success_rate: historicalSuccess ? (pastCorrelations.length / 5) * 100 : null,
              similar_past_events: pastCorrelations?.length || 0,
              sample_sources: mentions || [],
              detected_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              is_active: true,
            }, {
              onConflict: 'organization_id,entity_name',
              ignoreDuplicates: false,
            });

          if (!insertError) {
            totalOpportunities++;
            console.log(`Created opportunity for ${entity.entity_name} (score: ${opportunityScore.toFixed(1)})`);
          } else {
            console.error('Error creating opportunity:', insertError);
          }
        }
      }
    }

    // Deactivate expired opportunities
    await supabase
      .from('fundraising_opportunities')
      .update({ is_active: false })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true);

    console.log(`Opportunity detection complete. Created ${totalOpportunities} opportunities.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        opportunities_created: totalOpportunities,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in detect-fundraising-opportunities:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
