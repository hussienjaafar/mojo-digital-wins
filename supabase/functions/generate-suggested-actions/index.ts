import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  calculateOrgRelevance, 
  passesOrgThresholds,
  type OrgInterestTopic,
  type OrgInterestEntity,
  type OrgProfile,
  type OrgAlertPreferences,
} from "../_shared/orgRelevance.ts";
import { 
  calculateDecisionScore, 
  type DecisionScoreInput,
  type DecisionScoreResult,
  DEFAULT_THRESHOLDS,
} from "../_shared/decisionScoring.ts";
import { 
  runComplianceChecks, 
  cleanMessageForCompliance,
  appendOptOut,
  type ComplianceCheckResult,
} from "../_shared/complianceChecker.ts";
import { z, parseJsonBody, uuidSchema } from "../_shared/validators.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SMS Compliance constants
const OPT_OUT_TEXT = " Reply STOP to opt out.";
const MAX_SMS_LENGTH = 160;
const MAX_COPY_LENGTH = MAX_SMS_LENGTH - OPT_OUT_TEXT.length;

// Variant types for multi-variant generation
type VariantType = 'safe' | 'urgency' | 'values' | 'contrast';

interface VariantSpec {
  type: VariantType;
  prompt_suffix: string;
  risk_threshold: number; // Min risk score required
}

const VARIANT_SPECS: VariantSpec[] = [
  { 
    type: 'safe', 
    prompt_suffix: 'Write a conservative, low-risk message with broad appeal. Avoid controversy.',
    risk_threshold: 0 // Always allowed
  },
  { 
    type: 'urgency', 
    prompt_suffix: 'Write a time-sensitive, action-oriented message emphasizing momentum and urgency.',
    risk_threshold: 50 // Need moderate safety
  },
  { 
    type: 'values', 
    prompt_suffix: 'Write a mission-aligned, values-driven message with emotional resonance.',
    risk_threshold: 30 // Moderate safety required
  },
  { 
    type: 'contrast', 
    prompt_suffix: 'Write a message that contrasts your position with opposition, if appropriate.',
    risk_threshold: 70 // High safety required (contentious)
  },
];

// Generate dedupe key
function generateDedupeKey(orgId: string, alertId: string, variantType: string): string {
  const version = 'v4.0';
  return `${orgId}-${alertId}-${variantType}-${version}`;
}

// Map alert type to action type
function mapAlertToActionType(alertType: string): string {
  switch (alertType) {
    case 'trending_spike':
    case 'breaking_trend':
      return 'rapid_response';
    case 'sentiment_shift':
      return 'strategic_message';
    case 'cross_source_breakthrough':
      return 'multi_channel';
    default:
      return 'monitoring';
  }
}

// Generate fallback suggestion without AI
function generateFallbackSuggestion(
  alert: any, 
  orgProfile: OrgProfile | null,
  variantType: VariantType
): string {
  const { entity_name, alert_type, severity } = alert;
  const orgType = orgProfile?.org_type;
  const displayName = orgProfile?.display_name || 'We';
  
  let baseCopy = '';
  
  switch (variantType) {
    case 'safe':
      baseCopy = `${displayName}: ${entity_name} is in the news. Stay informed and join our community.`;
      break;
    case 'urgency':
      if (alert_type === 'trending_spike' || severity === 'critical') {
        baseCopy = `NOW: ${entity_name} is trending. ${displayName} needs your support right now.`;
      } else {
        baseCopy = `Time-sensitive: ${entity_name} update. ${displayName} is taking action - join us.`;
      }
      break;
    case 'values':
      if (orgType === 'foreign_policy') {
        baseCopy = `${entity_name} matters for global security. ${displayName} is standing up - stand with us.`;
      } else if (orgType === 'human_rights') {
        baseCopy = `${entity_name}: Human rights are at stake. ${displayName} is fighting - fight with us.`;
      } else {
        baseCopy = `${entity_name} reflects our shared values. ${displayName} is taking a stand.`;
      }
      break;
    case 'contrast':
      baseCopy = `On ${entity_name}: While others stay silent, ${displayName} is speaking up. Join us.`;
      break;
  }
  
  // Ensure we're within limit
  if (baseCopy.length > MAX_COPY_LENGTH) {
    baseCopy = baseCopy.substring(0, MAX_COPY_LENGTH - 3) + '...';
  }
  
  return baseCopy;
}

// Build AI prompt for variant generation
function buildVariantPrompt(
  alert: any,
  orgProfile: OrgProfile | null,
  variantSpec: VariantSpec,
  decisionScore: DecisionScoreResult
): string {
  const orgContext = orgProfile?.mission_summary 
    ? `Organization mission: ${orgProfile.mission_summary}` 
    : '';
  const orgName = orgProfile?.display_name || 'the organization';
  const orgType = orgProfile?.org_type 
    ? `Organization type: ${orgProfile.org_type}` 
    : '';
  const focusAreas = orgProfile?.focus_areas?.length 
    ? `Focus areas: ${orgProfile.focus_areas.join(', ')}` 
    : '';

  const opportunitySignals = decisionScore.signals.opportunity.join('; ');
  const fitSignals = decisionScore.signals.fit.join('; ');

  return `Generate a brief SMS message (under 130 characters) for a nonprofit organization.

TOPIC: ${alert.entity_name}
ALERT TYPE: ${alert.alert_type}
SEVERITY: ${alert.severity}
MENTIONS (24h): ${alert.current_mentions || 'Unknown'}
VELOCITY: ${alert.velocity?.toFixed(0) || 0}%

ORGANIZATION CONTEXT:
- Name: ${orgName}
${orgContext}
${orgType}
${focusAreas}

WHY NOW (opportunity signals):
${opportunitySignals || 'Trending topic'}

WHY THIS ORG (fit signals):
${fitSignals || 'General relevance'}

VARIANT TYPE: ${variantSpec.type.toUpperCase()}
${variantSpec.prompt_suffix}

REQUIREMENTS:
- Keep under 130 characters (opt-out text added separately)
- Include "${orgName}" or a clear reference to sender
- Be actionable with a clear call to action
- Match the organization's tone
- Do NOT include opt-out language (added automatically)

Generate only the SMS text, nothing else.`;
}

// Generate actions using AI with multi-variant support
async function generateAIVariants(
  alert: any,
  orgProfile: OrgProfile | null,
  decisionScore: DecisionScoreResult,
  lovableApiKey: string
): Promise<Array<{ copy: string; variantType: VariantType; method: 'ai' | 'template_fallback' }>> {
  const results: Array<{ copy: string; variantType: VariantType; method: 'ai' | 'template_fallback' }> = [];
  
  // Determine which variants to generate based on risk score
  const allowedVariants = VARIANT_SPECS.filter(v => decisionScore.risk_score >= v.risk_threshold);
  
  // Always include at least safe variant
  if (!allowedVariants.find(v => v.type === 'safe')) {
    allowedVariants.unshift(VARIANT_SPECS[0]);
  }
  
  // Limit to 3 variants max
  const variantsToGenerate = allowedVariants.slice(0, 3);
  
  for (const variantSpec of variantsToGenerate) {
    try {
      const prompt = buildVariantPrompt(alert, orgProfile, variantSpec, decisionScore);
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert political communications copywriter specializing in SMS fundraising. Generate concise, compliant messages tailored to the organization and variant type requested.' 
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let aiCopy = data.choices?.[0]?.message?.content?.trim();
        
        if (aiCopy) {
          // Clean up any quotes or extra formatting
          aiCopy = aiCopy.replace(/^["']|["']$/g, '').trim();
          
          if (aiCopy.length > MAX_COPY_LENGTH) {
            aiCopy = aiCopy.substring(0, MAX_COPY_LENGTH - 3) + '...';
          }
          
          results.push({
            copy: aiCopy,
            variantType: variantSpec.type,
            method: 'ai'
          });
          continue;
        }
      } else {
        console.error(`AI generation failed for ${variantSpec.type}:`, response.status);
      }
    } catch (error) {
      console.error(`AI variant error (${variantSpec.type}):`, error);
    }
    
    // Fallback to template for this variant
    results.push({
      copy: generateFallbackSuggestion(alert, orgProfile, variantSpec.type),
      variantType: variantSpec.type,
      method: 'template_fallback'
    });
  }
  
  return results;
}

// Main server handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse request body for force generate options
  let forceMode = false;
  let lookbackDays = 7;
  let minActionableScore = 50;
  let targetOrgId: string | null = null;

  const bodySchema = z.object({
    force: z.coerce.boolean().optional(),
    lookback_days: z.coerce.number().int().min(1).max(30).optional(),
    min_actionable_score: z.coerce.number().int().min(0).max(100).optional(),
    organization_id: uuidSchema.nullable().optional(),
  }).passthrough();

  const parsedBody = await parseJsonBody(req, bodySchema, { allowEmpty: true, allowInvalidJson: true });
  if (!parsedBody.ok) {
    return new Response(
      JSON.stringify({ error: parsedBody.error, details: parsedBody.details }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const body = parsedBody.data;
  forceMode = body.force === true;
  lookbackDays = Math.min(body.lookback_days ?? 7, 30);
  minActionableScore = Math.max(body.min_actionable_score ?? 50, 20);
  targetOrgId = body.organization_id ?? null;

  if (forceMode) {
    console.log(`🔧 Force mode enabled: lookback=${lookbackDays}d, minScore=${minActionableScore}`);
  }


  // Create audit record
  const auditData = {
    organization_id: targetOrgId,
    started_at: new Date().toISOString(),
    finished_at: null as string | null,
    alerts_processed: 0,
    actions_created: 0,
    ai_generated_count: 0,
    template_generated_count: 0,
    skipped_count: 0,
    error_count: 0,
    errors: [] as any[],
    metadata: { 
      version: '4.0.0', 
      trigger: forceMode ? 'manual_force' : 'scheduled',
      multi_variant: true,
      decision_scoring: true,
      compliance_checks: true,
      lookback_days: lookbackDays,
      min_actionable_score: minActionableScore,
    },
  };

  const { data: auditRun, error: auditCreateError } = await supabase
    .from('action_generator_runs')
    .insert(auditData)
    .select('id')
    .single();

  if (auditCreateError) {
    console.error('Failed to create audit record:', auditCreateError);
  }

  const auditId = auditRun?.id;
  const errors: any[] = [];

  try {
    console.log('🎯 Generating suggested actions with decision scoring + multi-variant...');

    // Build query for alerts
    let alertsQuery = supabase
      .from('client_entity_alerts')
      .select(`
        id,
        organization_id,
        entity_name,
        alert_type,
        severity,
        actionable_score,
        current_mentions,
        velocity,
        sample_sources,
        suggested_action,
        created_at
      `)
      .eq('is_actionable', true)
      .gte('actionable_score', minActionableScore)
      .gte('created_at', new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString())
      .order('actionable_score', { ascending: false })
      .limit(100);

    if (targetOrgId) {
      alertsQuery = alertsQuery.eq('organization_id', targetOrgId);
    }

    const { data: alerts, error: alertsError } = await alertsQuery;

    if (alertsError) {
      errors.push({ phase: 'fetch_alerts', error: alertsError.message });
      throw alertsError;
    }

    auditData.alerts_processed = alerts?.length || 0;
    console.log(`📋 Processing ${alerts?.length || 0} alerts`);

    if (!alerts || alerts.length === 0) {
      // Record health snapshot
      await recordPipelineHealth(supabase, targetOrgId, 0, 0, 0, 0);
      
      if (auditId) {
        await supabase
          .from('action_generator_runs')
          .update({
            finished_at: new Date().toISOString(),
            alerts_processed: 0,
            metadata: { ...auditData.metadata, message: 'No actionable alerts found' },
          })
          .eq('id', auditId);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          actionsGenerated: 0,
          message: `No actionable alerts found in last ${lookbackDays} days with score >= ${minActionableScore}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch org data
    const orgIds = [...new Set(alerts.map(a => a.organization_id).filter(Boolean))];
    
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

    const prefsMap = new Map<string, OrgAlertPreferences & { min_decision_score?: number; always_generate_safe_variant?: boolean }>();
    (prefsResult.data || []).forEach(p => {
      prefsMap.set(p.organization_id, {
        min_relevance_score: p.min_relevance_score,
        min_urgency_score: p.min_urgency_score,
        max_alerts_per_day: p.max_alerts_per_day,
        digest_mode: p.digest_mode,
        min_decision_score: p.min_decision_score || DEFAULT_THRESHOLDS.min_decision_score,
        always_generate_safe_variant: p.always_generate_safe_variant ?? true,
      });
    });

    const suggestedActions: any[] = [];
    let aiGeneratedCount = 0;
    let templateGeneratedCount = 0;
    let skippedCount = 0;
    let filteredByRelevance = 0;
    let filteredByDecisionScore = 0;

    for (const alert of alerts) {
      try {
        const profile = profileMap.get(alert.organization_id) || null;
        const interestTopics = topicsMap.get(alert.organization_id) || [];
        const interestEntities = entitiesMap.get(alert.organization_id) || [];
        const preferences = prefsMap.get(alert.organization_id) || null;

        // Calculate org-specific relevance
        const relevanceResult = calculateOrgRelevance(
          {
            entityName: alert.entity_name,
            topics: [],
            velocity: alert.velocity,
            mentions: alert.current_mentions,
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

        // Calculate alert age in hours
        const alertAge = (Date.now() - new Date(alert.created_at).getTime()) / (1000 * 60 * 60);

        // Calculate decision score
        const decisionScoreInput: DecisionScoreInput = {
          entityName: alert.entity_name,
          alertType: alert.alert_type,
          velocity: alert.velocity,
          mentions: alert.current_mentions,
          actionableScore: alert.actionable_score,
          orgRelevanceResult: relevanceResult,
          sampleSources: alert.sample_sources,
          alertAge,
        };

        const decisionScore = calculateDecisionScore(
          decisionScoreInput,
          profile,
          interestTopics,
          interestEntities
        );

        // Check decision score threshold
        const minDecisionScore = preferences?.min_decision_score || DEFAULT_THRESHOLDS.min_decision_score;
        const alwaysGenerateSafe = preferences?.always_generate_safe_variant ?? true;
        
        if (decisionScore.decision_score < minDecisionScore) {
          // Still generate safe variant if opportunity is high and flag is set
          if (!alwaysGenerateSafe || decisionScore.opportunity_score < DEFAULT_THRESHOLDS.min_opportunity_for_safe_variant) {
            skippedCount++;
            filteredByDecisionScore++;
            continue;
          }
        }

        // Generate variant group ID
        const variantGroupId = crypto.randomUUID();

        // Generate variants (AI with template fallback)
        let variants: Array<{ copy: string; variantType: VariantType; method: 'ai' | 'template_fallback' }>;
        
        if (lovableApiKey && decisionScore.confidence_score >= DEFAULT_THRESHOLDS.min_confidence_for_ai) {
          variants = await generateAIVariants(alert, profile, decisionScore, lovableApiKey);
        } else {
          // Template-only mode
          variants = VARIANT_SPECS
            .filter(v => decisionScore.risk_score >= v.risk_threshold)
            .slice(0, 3)
            .map(v => ({
              copy: generateFallbackSuggestion(alert, profile, v.type),
              variantType: v.type,
              method: 'template_fallback' as const
            }));
        }

        // Process each variant
        for (const variant of variants) {
          const dedupeKey = generateDedupeKey(alert.organization_id, alert.id, variant.variantType);
          
          // Run compliance checks
          const complianceResult = runComplianceChecks(variant.copy, {
            orgName: profile?.display_name || undefined,
            maxCharacters: MAX_SMS_LENGTH,
            includeOptOutInLimit: true,
          });

          // Skip blocked messages
          if (complianceResult.status === 'blocked') {
            console.log(`⛔ Blocked variant ${variant.variantType} for ${alert.entity_name}: ${complianceResult.issues.join(', ')}`);
            continue;
          }

          // Add opt-out text
          const finalCopy = variant.copy + OPT_OUT_TEXT;
          
          // Track generation method
          if (variant.method === 'ai') {
            aiGeneratedCount++;
          } else {
            templateGeneratedCount++;
          }

          // Build rationale
          const rationale = {
            signals: decisionScore.signals,
            assumptions: [
              `Alert type: ${alert.alert_type}`,
              `Severity: ${alert.severity}`,
            ],
            risks: complianceResult.warnings,
          };

          const actionType = mapAlertToActionType(alert.alert_type);

          suggestedActions.push({
            alert_id: alert.id,
            organization_id: alert.organization_id,
            action_type: actionType,
            entity_name: alert.entity_name,
            suggested_copy: finalCopy,
            original_copy: finalCopy,
            topic_relevance: Math.round(relevanceResult.score),
            urgency_score: Math.round(decisionScore.opportunity_score),
            org_relevance_score: relevanceResult.score,
            org_relevance_reasons: relevanceResult.reasons,
            
            // New decision scoring fields
            decision_score: decisionScore.decision_score,
            opportunity_score: decisionScore.opportunity_score,
            fit_score: decisionScore.fit_score,
            risk_score: decisionScore.risk_score,
            confidence_score: decisionScore.confidence_score,
            
            // Compliance
            compliance_status: complianceResult.status,
            compliance_checks: complianceResult.checks,
            
            // Variant info
            variant_type: variant.variantType,
            variant_group_id: variantGroupId,
            
            // Rationale
            generation_rationale: rationale,
            dedupe_key: dedupeKey,
            
            // Standard fields
            value_prop: `Trending with ${alert.velocity?.toFixed(0) || 0}% velocity increase`,
            audience_segment: 'Active supporters',
            status: 'pending',
            is_used: false,
            is_dismissed: false,
            generation_method: variant.method,
            character_count: finalCopy.length,
            estimated_impact: `${alert.current_mentions || 0} mentions, ${alert.severity} severity`,
          });
        }

        // Update alert with suggestion preview (use first variant)
        if (variants.length > 0) {
          const preview = variants[0].copy.substring(0, 500);
          if (preview !== alert.suggested_action) {
            await supabase
              .from('client_entity_alerts')
              .update({ suggested_action: preview })
              .eq('id', alert.id);
          }
        }
      } catch (alertError: any) {
        console.error(`Error processing alert ${alert.id}:`, alertError);
        errors.push({ phase: 'process_alert', alert_id: alert.id, error: alertError.message });
        skippedCount++;
      }
    }

    console.log(`📝 Generated ${suggestedActions.length} suggested actions (${aiGeneratedCount} AI, ${templateGeneratedCount} template)`);
    console.log(`📊 Filtered: ${filteredByRelevance} by relevance, ${filteredByDecisionScore} by decision score`);

    // Insert/upsert suggested actions
    let actionsCreated = 0;
    if (suggestedActions.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('suggested_actions')
        .upsert(suggestedActions, {
          onConflict: 'dedupe_key',
          ignoreDuplicates: false,
        })
        .select('id');

      if (insertError) {
        console.error('Error inserting suggested actions:', insertError);
        errors.push({ phase: 'insert_actions', error: insertError.message });
        
        // Fallback: try inserting without dedupe constraint
        console.log('Attempting insert without upsert...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('suggested_actions')
          .insert(suggestedActions.map(a => ({ ...a, dedupe_key: null })))
          .select('id');
        
        if (!fallbackError) {
          actionsCreated = fallbackData?.length || 0;
        }
      } else {
        actionsCreated = insertedData?.length || suggestedActions.length;
        console.log(`✅ Inserted/updated ${actionsCreated} suggested actions`);
      }
    }

    // Record pipeline health snapshot
    await recordPipelineHealth(
      supabase, 
      targetOrgId, 
      alerts.length, 
      actionsCreated, 
      aiGeneratedCount, 
      templateGeneratedCount
    );

    // Finalize audit
    if (auditId) {
      await supabase
        .from('action_generator_runs')
        .update({
          finished_at: new Date().toISOString(),
          alerts_processed: alerts?.length || 0,
          actions_created: actionsCreated,
          ai_generated_count: aiGeneratedCount,
          template_generated_count: templateGeneratedCount,
          skipped_count: skippedCount,
          error_count: errors.length,
          errors: errors.length > 0 ? errors : null,
          metadata: { 
            ...auditData.metadata, 
            success: true,
            filtered_by_relevance: filteredByRelevance,
            filtered_by_decision_score: filteredByDecisionScore,
            variants_generated: suggestedActions.length,
          },
        })
        .eq('id', auditId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        actionsGenerated: actionsCreated,
        variantsGenerated: suggestedActions.length,
        aiGeneratedCount,
        templateGeneratedCount,
        alertsProcessed: alerts?.length || 0,
        filteredByRelevance,
        filteredByDecisionScore,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error generating suggested actions:', error);
    errors.push({ phase: 'main', error: error.message });

    if (auditId) {
      await supabase
        .from('action_generator_runs')
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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Record pipeline health snapshot
async function recordPipelineHealth(
  supabase: any,
  orgId: string | null,
  alertsProcessed: number,
  actionsGenerated: number,
  aiCount: number,
  templateCount: number
) {
  try {
    // Get last run info for match_entity_watchlist
    const { data: matchJob } = await supabase
      .from('scheduled_jobs')
      .select('last_run_at, last_error, interval_minutes')
      .eq('job_type', 'match_entity_watchlist')
      .maybeSingle();

    // Determine statuses
    const now = Date.now();
    const matchLastRun = matchJob?.last_run_at ? new Date(matchJob.last_run_at).getTime() : 0;
    const matchInterval = (matchJob?.interval_minutes || 5) * 60 * 1000;
    const matchStale = (now - matchLastRun) > (matchInterval * 2);
    
    await supabase.from('pipeline_health_snapshots').insert({
      organization_id: orgId,
      match_watchlist_status: matchJob?.last_error ? 'error' : matchStale ? 'stale' : 'ok',
      match_watchlist_last_run: matchJob?.last_run_at,
      match_watchlist_last_error: matchJob?.last_error,
      match_watchlist_alerts_created: alertsProcessed,
      generate_actions_status: 'ok',
      generate_actions_last_run: new Date().toISOString(),
      generate_actions_count: actionsGenerated,
      actionable_alerts_24h: alertsProcessed,
      actions_generated_24h: actionsGenerated,
      ai_generated_count: aiCount,
      template_generated_count: templateCount,
    });
  } catch (error) {
    console.error('Failed to record pipeline health:', error);
  }
}
