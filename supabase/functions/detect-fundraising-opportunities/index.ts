import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRun {
  id: string;
  organization_id: string | null;
  started_at: string;
  finished_at: string | null;
  trends_processed: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  expired_count: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
  error_count: number;
  errors: any[];
  metadata: Record<string, any>;
}

function inferOpportunityType(entityType: string | null): string {
  if (!entityType) return 'trending';
  const type = entityType.toLowerCase();
  if (type.includes('event')) return 'event';
  if (type.includes('advocacy') || type.includes('issue')) return 'advocacy';
  if (type.includes('partner')) return 'partnership';
  return 'trending';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create audit record at START (fail-safe pattern)
  const auditData: Partial<AuditRun> = {
    organization_id: null, // Will track all orgs
    started_at: new Date().toISOString(),
    finished_at: null,
    trends_processed: 0,
    created_count: 0,
    updated_count: 0,
    skipped_count: 0,
    expired_count: 0,
    high_priority_count: 0,
    medium_priority_count: 0,
    low_priority_count: 0,
    error_count: 0,
    errors: [],
    metadata: { version: '2.0.0', trigger: 'scheduled' },
  };

  const { data: auditRun, error: auditCreateError } = await supabase
    .from('opportunity_detector_runs')
    .insert(auditData)
    .select('id')
    .single();

  if (auditCreateError) {
    console.error('Failed to create audit record:', auditCreateError);
    // Continue anyway - don't fail the whole job for audit issues
  }

  const auditId = auditRun?.id;
  const errors: any[] = [];

  try {
    console.log('🎯 Detecting fundraising opportunities...');

    // Get all active organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('client_organizations')
      .select('id')
      .eq('is_active', true);

    if (orgsError) {
      errors.push({ phase: 'fetch_orgs', error: orgsError.message });
      throw orgsError;
    }

    if (!orgs || orgs.length === 0) {
      console.log('No active organizations found');
      // Finalize audit
      if (auditId) {
        await supabase
          .from('opportunity_detector_runs')
          .update({
            finished_at: new Date().toISOString(),
            metadata: { ...auditData.metadata, message: 'No active organizations' },
          })
          .eq('id', auditId);
      }
      return new Response(JSON.stringify({ message: 'No active organizations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get trending entities - use correct column names: mentions_24h, first_seen_at
    const { data: trendingEntities, error: trendsError } = await supabase
      .from('entity_trends')
      .select('*')
      .gt('velocity', 30)
      .eq('is_trending', true)
      .order('velocity', { ascending: false })
      .limit(50);

    if (trendsError) {
      errors.push({ phase: 'fetch_trends', error: trendsError.message });
      throw trendsError;
    }

    auditData.trends_processed = trendingEntities?.length || 0;
    console.log(`📊 Processing ${trendingEntities?.length || 0} trending entities for ${orgs.length} orgs`);

    if (!trendingEntities || trendingEntities.length === 0) {
      console.log('No trending entities found');
      if (auditId) {
        await supabase
          .from('opportunity_detector_runs')
          .update({
            finished_at: new Date().toISOString(),
            trends_processed: 0,
            metadata: { ...auditData.metadata, message: 'No trending entities' },
          })
          .eq('id', auditId);
      }
      return new Response(JSON.stringify({ message: 'No trending entities', opportunities_created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let highPriorityCount = 0;
    let mediumPriorityCount = 0;
    let lowPriorityCount = 0;

    for (const org of orgs) {
      for (const entity of trendingEntities) {
        try {
          // Check historical performance (optional correlation data)
          const { data: pastCorrelations } = await supabase
            .from('event_impact_correlations')
            .select('correlation_strength, amount_raised_48h_after')
            .eq('organization_id', org.id)
            .eq('entity_name', entity.entity_name)
            .order('correlation_strength', { ascending: false })
            .limit(5);

          const historicalSuccess = pastCorrelations && pastCorrelations.length > 0;
          const avgCorrelation = historicalSuccess 
            ? pastCorrelations.reduce((sum, c) => sum + (c.correlation_strength || 0), 0) / pastCorrelations.length
            : 0;
          const avgAmount = historicalSuccess
            ? pastCorrelations.reduce((sum, c) => sum + (c.amount_raised_48h_after || 0), 0) / pastCorrelations.length
            : 0;

          // Calculate time sensitivity - use first_seen_at (correct column)
          const firstSeenAt = entity.first_seen_at ? new Date(entity.first_seen_at).getTime() : Date.now();
          const hoursTrending = (Date.now() - firstSeenAt) / (1000 * 60 * 60);
          const timeSensitivity = Math.max(0, 100 - (hoursTrending * 5));

          // Use mentions_24h (correct column) for mentions weight - more generous scoring
          const mentionsScore = Math.min((entity.mentions_24h || 0) / 5, 25); // Cap at 25 points

          // Calculate transparent opportunity score (REBALANCED: achievable without historical data)
          // Without historical correlations, max achievable = 50 + 20 + 25 = 95
          const velocityPoints = Math.min((entity.velocity || 0) / 100 * 50, 50); // Velocity: up to 50 points
          const timePoints = Math.max(0, 20 - (hoursTrending * 1)); // Time sensitivity: up to 20 points (decays slower)
          const correlationPoints = avgCorrelation * 25; // Historical: up to 25 points (bonus)
          
          const opportunityScore = Math.min(100, Math.round(
            velocityPoints +      // Up to 50 points from velocity
            mentionsScore +       // Up to 25 points from mentions
            timePoints +          // Up to 20 points from recency
            correlationPoints     // Up to 25 bonus points from historical
          ));

          // Skip low-scoring opportunities - lowered threshold from 60 to 45
          if (opportunityScore < 45) {
            skippedCount++;
            continue;
          }

          // Track priority buckets
          if (opportunityScore >= 80) highPriorityCount++;
          else if (opportunityScore >= 60) mediumPriorityCount++;
          else lowPriorityCount++;

          // Get sample mentions for context
          const { data: mentions } = await supabase
            .from('entity_mentions')
            .select('source_type, source_id, mentioned_at')
            .eq('organization_id', org.id)
            .eq('entity_name', entity.entity_name)
            .gte('mentioned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('mentioned_at', { ascending: false })
            .limit(3);

          // Upsert opportunity with all required fields
          const { data: upsertResult, error: insertError } = await supabase
            .from('fundraising_opportunities')
            .upsert({
              organization_id: org.id,
              entity_name: entity.entity_name,
              entity_type: entity.entity_type || 'topic',
              opportunity_score: opportunityScore,
              velocity: entity.velocity || 0,
              current_mentions: entity.mentions_24h || 0,
              time_sensitivity: timeSensitivity,
              estimated_value: avgAmount > 0 ? avgAmount : null,
              historical_success_rate: historicalSuccess ? (pastCorrelations!.length / 5) * 100 : null,
              similar_past_events: pastCorrelations?.length || 0,
              sample_sources: mentions || [],
              detected_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              is_active: true,
              status: 'pending',
              opportunity_type: inferOpportunityType(entity.entity_type),
            }, {
              onConflict: 'organization_id,entity_name',
              ignoreDuplicates: false,
            })
            .select('id');

          if (insertError) {
            console.error(`Error upserting opportunity for ${entity.entity_name}:`, insertError);
            errors.push({ 
              phase: 'upsert', 
              entity: entity.entity_name, 
              org: org.id, 
              error: insertError.message 
            });
          } else {
            // Check if this was a create or update (simplified - count as created)
            createdCount++;
            console.log(`✅ Created opportunity for ${entity.entity_name} (score: ${opportunityScore})`);
          }
        } catch (entityError: any) {
          console.error(`Error processing entity ${entity.entity_name}:`, entityError);
          errors.push({ 
            phase: 'process_entity', 
            entity: entity.entity_name, 
            error: entityError.message 
          });
        }
      }
    }

    // Deactivate expired opportunities
    const { data: expiredData, error: expireError } = await supabase
      .from('fundraising_opportunities')
      .update({ is_active: false, status: 'dismissed' })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)
      .select('id');

    const expiredCount = expiredData?.length || 0;
    if (expireError) {
      errors.push({ phase: 'expire', error: expireError.message });
    } else if (expiredCount > 0) {
      console.log(`🗑️ Deactivated ${expiredCount} expired opportunities`);
    }

    console.log(`✨ Opportunity detection complete. Created: ${createdCount}, Skipped: ${skippedCount}, Expired: ${expiredCount}`);

    // Finalize audit record
    if (auditId) {
      const { error: auditUpdateError } = await supabase
        .from('opportunity_detector_runs')
        .update({
          finished_at: new Date().toISOString(),
          trends_processed: trendingEntities?.length || 0,
          created_count: createdCount,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          expired_count: expiredCount,
          high_priority_count: highPriorityCount,
          medium_priority_count: mediumPriorityCount,
          low_priority_count: lowPriorityCount,
          error_count: errors.length,
          errors: errors.length > 0 ? errors : null,
          metadata: { 
            ...auditData.metadata, 
            orgs_processed: orgs.length,
            success: true 
          },
        })
        .eq('id', auditId);

      if (auditUpdateError) {
        console.error('Failed to finalize audit record:', auditUpdateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        opportunities_created: createdCount,
        opportunities_skipped: skippedCount,
        opportunities_expired: expiredCount,
        trends_processed: trendingEntities?.length || 0,
        orgs_processed: orgs.length,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in detect-fundraising-opportunities:', error);
    errors.push({ phase: 'main', error: error.message });

    // Finalize audit record with error
    if (auditId) {
      await supabase
        .from('opportunity_detector_runs')
        .update({
          finished_at: new Date().toISOString(),
          error_count: errors.length,
          errors: errors,
          metadata: { ...auditData.metadata, success: false, fatal_error: error.message },
        })
        .eq('id', auditId);
    }

    return new Response(
      JSON.stringify({ error: error.message, errors }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
