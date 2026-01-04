import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { 
  calculateOrgRelevance, 
  passesOrgThresholds,
  type OrgInterestTopic,
  type OrgInterestEntity,
  type OrgProfile,
  type OrgAlertPreferences,
} from "../_shared/orgRelevance.ts";

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
    organization_id: null,
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
    metadata: { version: '3.0.0', trigger: 'scheduled', personalization: true },
  };

  const { data: auditRun, error: auditCreateError } = await supabase
    .from('opportunity_detector_runs')
    .insert(auditData)
    .select('id')
    .single();

  if (auditCreateError) {
    console.error('Failed to create audit record:', auditCreateError);
  }

  const auditId = auditRun?.id;
  const errors: any[] = [];

  try {
    console.log('🎯 Detecting fundraising opportunities with org personalization...');

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

    // Fetch org profiles, interest topics, interest entities, and preferences for all orgs
    const orgIds = orgs.map(o => o.id);
    
    const [profilesResult, topicsResult, entitiesResult, prefsResult] = await Promise.all([
      supabase.from('organization_profiles').select('*').in('organization_id', orgIds),
      supabase.from('org_interest_topics').select('*').in('organization_id', orgIds),
      supabase.from('org_interest_entities').select('*').in('organization_id', orgIds),
      supabase.from('org_alert_preferences').select('*').in('organization_id', orgIds),
    ]);

    // Build lookup maps
    const profileMap = new Map<string, OrgProfile>();
    (profilesResult.data || []).forEach(p => {
      profileMap.set(p.organization_id, {
        org_type: p.org_type,
        display_name: p.display_name,
        mission_summary: p.mission_summary,
        focus_areas: p.focus_areas,
        key_issues: p.key_issues,
        geographies: p.geographies,
        primary_goals: p.primary_goals,
        audiences: p.audiences,
      });
    });

    const topicsMap = new Map<string, OrgInterestTopic[]>();
    (topicsResult.data || []).forEach(t => {
      const existing = topicsMap.get(t.organization_id) || [];
      existing.push({ topic: t.topic, weight: t.weight, source: t.source });
      topicsMap.set(t.organization_id, existing);
    });

    const entitiesMap = new Map<string, OrgInterestEntity[]>();
    (entitiesResult.data || []).forEach(e => {
      const existing = entitiesMap.get(e.organization_id) || [];
      existing.push({ entity_name: e.entity_name, rule_type: e.rule_type, reason: e.reason });
      entitiesMap.set(e.organization_id, existing);
    });

    const prefsMap = new Map<string, OrgAlertPreferences>();
    (prefsResult.data || []).forEach(p => {
      prefsMap.set(p.organization_id, {
        min_relevance_score: p.min_relevance_score,
        min_urgency_score: p.min_urgency_score,
        max_alerts_per_day: p.max_alerts_per_day,
        digest_mode: p.digest_mode,
      });
    });

    // Get trending entities - use last_seen_at for better time decay
    const { data: trendingEntities, error: trendsError } = await supabase
      .from('entity_trends')
      .select('*')
      .gt('velocity', 30)
      .eq('is_trending', true)
      .order('velocity', { ascending: false })
      .limit(100);

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
    let skippedCount = 0;
    let filteredByRelevance = 0;
    let filteredByThreshold = 0;
    let highPriorityCount = 0;
    let mediumPriorityCount = 0;
    let lowPriorityCount = 0;

    for (const org of orgs) {
      const profile = profileMap.get(org.id) || null;
      const interestTopics = topicsMap.get(org.id) || [];
      const interestEntities = entitiesMap.get(org.id) || [];
      const preferences = prefsMap.get(org.id) || null;

      for (const entity of trendingEntities) {
        try {
          // Calculate org-specific relevance
          const relevanceResult = calculateOrgRelevance(
            {
              entityName: entity.entity_name,
              entityType: entity.entity_type,
              topics: entity.related_topics || [],
              velocity: entity.velocity,
              mentions: entity.mentions_24h,
            },
            profile,
            interestTopics,
            interestEntities
          );

          // Skip if blocked by deny list
          if (relevanceResult.isBlocked) {
            skippedCount++;
            filteredByRelevance++;
            continue;
          }

          // Check historical performance
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

          // Calculate time sensitivity - use last_seen_at with slower decay (0.5/hour)
          const lastSeenAt = entity.last_seen_at 
            ? new Date(entity.last_seen_at).getTime() 
            : (entity.first_seen_at ? new Date(entity.first_seen_at).getTime() : Date.now());
          const hoursSinceLastSeen = (Date.now() - lastSeenAt) / (1000 * 60 * 60);
          const timeSensitivity = Math.max(0, 100 - (hoursSinceLastSeen * 2.5));

          // Calculate base opportunity score
          const mentionsScore = Math.min((entity.mentions_24h || 0) / 5, 25);
          const velocityPoints = Math.min((entity.velocity || 0) / 100 * 50, 50);
          const timePoints = Math.max(0, 20 - (hoursSinceLastSeen * 0.5)); // Slower decay
          const correlationPoints = avgCorrelation * 25;
          
          const baseOpportunityScore = Math.min(100, Math.round(
            velocityPoints + mentionsScore + timePoints + correlationPoints
          ));

          // Combine base score with org relevance (weighted blend)
          // If org has personalization set up, weight relevance more heavily
          const hasPersonalization = interestTopics.length > 0 || interestEntities.length > 0;
          const orgRelevanceWeight = hasPersonalization ? 0.4 : 0.2;
          const baseWeight = 1 - orgRelevanceWeight;
          
          const finalScore = Math.round(
            baseOpportunityScore * baseWeight + relevanceResult.score * orgRelevanceWeight
          );

          // Check against org thresholds
          const thresholdCheck = passesOrgThresholds(
            relevanceResult.score,
            finalScore,
            preferences
          );

          if (!thresholdCheck.passes) {
            skippedCount++;
            filteredByThreshold++;
            continue;
          }

          // Skip low-scoring opportunities
          if (finalScore < 40) {
            skippedCount++;
            continue;
          }

          // Track priority buckets
          if (finalScore >= 80) highPriorityCount++;
          else if (finalScore >= 60) mediumPriorityCount++;
          else lowPriorityCount++;

          // Get sample mentions
          const { data: mentions } = await supabase
            .from('entity_mentions')
            .select('source_type, source_id, mentioned_at')
            .eq('organization_id', org.id)
            .eq('entity_name', entity.entity_name)
            .gte('mentioned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('mentioned_at', { ascending: false })
            .limit(3);

          // Upsert opportunity with personalization data
          const { error: insertError } = await supabase
            .from('fundraising_opportunities')
            .upsert({
              organization_id: org.id,
              entity_name: entity.entity_name,
              entity_type: entity.entity_type || 'topic',
              opportunity_score: finalScore,
              org_relevance_score: relevanceResult.score,
              org_relevance_reasons: relevanceResult.reasons,
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
            });

          if (insertError) {
            console.error(`Error upserting opportunity for ${entity.entity_name}:`, insertError);
            errors.push({ 
              phase: 'upsert', 
              entity: entity.entity_name, 
              org: org.id, 
              error: insertError.message 
            });
          } else {
            createdCount++;
            if (relevanceResult.reasons.length > 0 && relevanceResult.score > 50) {
              console.log(`✅ Created personalized opportunity for ${entity.entity_name} (score: ${finalScore}, relevance: ${relevanceResult.score})`);
            }
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

    console.log(`✨ Opportunity detection complete. Created: ${createdCount}, Skipped: ${skippedCount} (relevance: ${filteredByRelevance}, threshold: ${filteredByThreshold})`);

    // Finalize audit record
    if (auditId) {
      await supabase
        .from('opportunity_detector_runs')
        .update({
          finished_at: new Date().toISOString(),
          trends_processed: trendingEntities?.length || 0,
          created_count: createdCount,
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
            filtered_by_relevance: filteredByRelevance,
            filtered_by_threshold: filteredByThreshold,
            success: true 
          },
        })
        .eq('id', auditId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        opportunities_created: createdCount,
        opportunities_skipped: skippedCount,
        opportunities_expired: expiredCount,
        trends_processed: trendingEntities?.length || 0,
        orgs_processed: orgs.length,
        personalization_stats: {
          filtered_by_relevance: filteredByRelevance,
          filtered_by_threshold: filteredByThreshold,
        },
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in detect-fundraising-opportunities:', error);
    errors.push({ phase: 'main', error: error.message });

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