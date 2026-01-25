import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatternStats {
  sample_size: number;
  avg_click_rate: number;
  avg_conversion_rate: number;
  avg_roas: number;
  avg_amount_raised: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, period_days = 90 } = await req.json();

    console.log(`Calculating creative learnings${organization_id ? ` for org: ${organization_id}` : ' (all orgs + global)'}`);

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period_days);
    const periodEnd = new Date();

    let orgLearnings = 0;
    let globalLearnings = 0;

    // Get list of organizations to process
    let orgIds: string[] = [];
    if (organization_id) {
      orgIds = [organization_id];
    } else {
      const { data: orgs } = await supabase
        .from('client_organizations')
        .select('id')
        .eq('is_active', true);
      orgIds = orgs?.map(o => o.id) || [];
    }

    // Process each organization
    for (const orgId of orgIds) {
      console.log(`Processing learnings for organization: ${orgId}`);

      // ========== SMS LEARNINGS ==========
      const { data: smsInsights } = await supabase
        .from('sms_creative_insights')
        .select('*')
        .eq('organization_id', orgId)
        .not('analyzed_at', 'is', null)
        .gte('created_at', periodStart.toISOString());

      if (smsInsights && smsInsights.length > 0) {
        // Group by topic
        const topicGroups = groupBy(smsInsights, 'topic');
        for (const [topic, items] of Object.entries(topicGroups)) {
          if (topic && items.length >= 2) {
            const stats = calculateSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'sms',
              topic,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }

        // Group by tone
        const toneGroups = groupBy(smsInsights, 'tone');
        for (const [tone, items] of Object.entries(toneGroups)) {
          if (tone && items.length >= 2) {
            const stats = calculateSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'sms',
              tone,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }

        // Group by urgency_level
        const urgencyGroups = groupBy(smsInsights, 'urgency_level');
        for (const [urgency, items] of Object.entries(urgencyGroups)) {
          if (urgency && items.length >= 2) {
            const stats = calculateSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'sms',
              urgency_level: urgency,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }

        // Group by call_to_action
        const ctaGroups = groupBy(smsInsights, 'call_to_action');
        for (const [cta, items] of Object.entries(ctaGroups)) {
          if (cta && items.length >= 2) {
            const stats = calculateSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'sms',
              call_to_action: cta,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }

        // Optimal timing (hour)
        const hourGroups = groupBy(smsInsights.filter(i => i.send_hour !== null), 'send_hour');
        for (const [hour, items] of Object.entries(hourGroups)) {
          if (items.length >= 2) {
            const stats = calculateSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'sms',
              optimal_hour: parseInt(hour),
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }
      }

      // ========== META LEARNINGS ==========
      const { data: metaInsights } = await supabase
        .from('meta_creative_insights')
        .select('*')
        .eq('organization_id', orgId)
        .not('analyzed_at', 'is', null)
        .gte('created_at', periodStart.toISOString());

      if (metaInsights && metaInsights.length > 0) {
        // Group by topic
        const topicGroups = groupBy(metaInsights, 'topic');
        for (const [topic, items] of Object.entries(topicGroups)) {
          if (topic && items.length >= 2) {
            const stats = calculateMetaStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'meta',
              topic,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }

        // Group by tone
        const toneGroups = groupBy(metaInsights, 'tone');
        for (const [tone, items] of Object.entries(toneGroups)) {
          if (tone && items.length >= 2) {
            const stats = calculateMetaStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'meta',
              tone,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }

        // Group by emotional_appeal
        const emotionGroups = groupBy(metaInsights, 'emotional_appeal');
        for (const [emotion, items] of Object.entries(emotionGroups)) {
          if (emotion && items.length >= 2) {
            const stats = calculateMetaStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'meta',
              emotional_appeal: emotion,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }

        // Group by urgency_level
        const urgencyGroups = groupBy(metaInsights, 'urgency_level');
        for (const [urgency, items] of Object.entries(urgencyGroups)) {
          if (urgency && items.length >= 2) {
            const stats = calculateMetaStats(items);
            await upsertLearning(supabase, {
              organization_id: orgId,
              channel: 'meta',
              urgency_level: urgency,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            orgLearnings++;
          }
        }
      }
    }

    // ========== GLOBAL LEARNINGS (Anonymized cross-org patterns) ==========
    if (!organization_id) {
      console.log('Calculating global anonymized learnings...');

      // Global SMS patterns
      const { data: allSmsInsights } = await supabase
        .from('sms_creative_insights')
        .select('topic, tone, urgency_level, call_to_action, click_rate, conversion_rate, amount_raised')
        .not('analyzed_at', 'is', null)
        .gte('created_at', periodStart.toISOString());

      if (allSmsInsights && allSmsInsights.length >= 5) {
        // Global topic patterns
        const topicGroups = groupBy(allSmsInsights, 'topic');
        for (const [topic, items] of Object.entries(topicGroups)) {
          if (topic && items.length >= 5) {
            const stats = calculateGlobalSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: null, // Global pattern
              channel: 'sms',
              topic,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            globalLearnings++;
          }
        }

        // Global tone patterns
        const toneGroups = groupBy(allSmsInsights, 'tone');
        for (const [tone, items] of Object.entries(toneGroups)) {
          if (tone && items.length >= 5) {
            const stats = calculateGlobalSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: null,
              channel: 'sms',
              tone,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            globalLearnings++;
          }
        }

        // Global urgency patterns
        const urgencyGroups = groupBy(allSmsInsights, 'urgency_level');
        for (const [urgency, items] of Object.entries(urgencyGroups)) {
          if (urgency && items.length >= 5) {
            const stats = calculateGlobalSMSStats(items);
            await upsertLearning(supabase, {
              organization_id: null,
              channel: 'sms',
              urgency_level: urgency,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            globalLearnings++;
          }
        }
      }

      // Global Meta patterns
      const { data: allMetaInsights } = await supabase
        .from('meta_creative_insights')
        .select('topic, tone, urgency_level, emotional_appeal, ctr, roas, conversion_value')
        .not('analyzed_at', 'is', null)
        .gte('created_at', periodStart.toISOString());

      if (allMetaInsights && allMetaInsights.length >= 5) {
        // Global topic patterns
        const topicGroups = groupBy(allMetaInsights, 'topic');
        for (const [topic, items] of Object.entries(topicGroups)) {
          if (topic && items.length >= 5) {
            const stats = calculateGlobalMetaStats(items);
            await upsertLearning(supabase, {
              organization_id: null,
              channel: 'meta',
              topic,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            globalLearnings++;
          }
        }

        // Global tone patterns
        const toneGroups = groupBy(allMetaInsights, 'tone');
        for (const [tone, items] of Object.entries(toneGroups)) {
          if (tone && items.length >= 5) {
            const stats = calculateGlobalMetaStats(items);
            await upsertLearning(supabase, {
              organization_id: null,
              channel: 'meta',
              tone,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            globalLearnings++;
          }
        }

        // Global emotional appeal patterns
        const emotionGroups = groupBy(allMetaInsights, 'emotional_appeal');
        for (const [emotion, items] of Object.entries(emotionGroups)) {
          if (emotion && items.length >= 5) {
            const stats = calculateGlobalMetaStats(items);
            await upsertLearning(supabase, {
              organization_id: null,
              channel: 'meta',
              emotional_appeal: emotion,
              ...stats,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
            });
            globalLearnings++;
          }
        }
      }
    }

    // ========== CORRELATION DETECTION ==========
    console.log('Calculating creative performance correlations...');
    let correlationsCreated = 0;

    for (const orgId of orgIds) {
      // Fetch all analyzed meta creatives with performance data
      const { data: metaCreatives } = await supabase
        .from('meta_creative_insights')
        .select('*')
        .eq('organization_id', orgId)
        .not('analyzed_at', 'is', null)
        .gt('impressions', 100)
        .gte('created_at', periodStart.toISOString());

      if (!metaCreatives || metaCreatives.length < 5) continue;

      // Calculate overall average ROAS for comparison
      const allWithRoas = metaCreatives.filter(c => c.roas && c.roas > 0);
      const overallAvgRoas = allWithRoas.length > 0 
        ? allWithRoas.reduce((sum, c) => sum + c.roas, 0) / allWithRoas.length
        : 0;

      // Calculate correlations for different attributes
      const attributes = [
        { name: 'topic', type: 'topic_roas' },
        { name: 'tone', type: 'tone_performance' },
        { name: 'emotional_appeal', type: 'emotional_impact' },
        { name: 'urgency_level', type: 'urgency_effect' },
        { name: 'call_to_action_type', type: 'cta_effectiveness' },
      ];

      for (const attr of attributes) {
        const groups = groupBy(metaCreatives.filter(c => c[attr.name]), attr.name);

        for (const [value, items] of Object.entries(groups)) {
          if (items.length < 3) continue;

          const withRoas = items.filter(i => i.roas && i.roas > 0);
          if (withRoas.length < 2) continue;

          const avgRoas = withRoas.reduce((sum, i) => sum + i.roas, 0) / withRoas.length;
          const avgCtr = items.reduce((sum, i) => sum + (i.ctr || 0), 0) / items.length;
          
          // Calculate lift percentage vs overall
          const liftPercent = overallAvgRoas > 0 
            ? ((avgRoas - overallAvgRoas) / overallAvgRoas) * 100 
            : 0;

          // Simple confidence based on sample size and variance
          const variance = withRoas.reduce((sum, i) => sum + Math.pow(i.roas - avgRoas, 2), 0) / withRoas.length;
          const stdDev = Math.sqrt(variance);
          const coeffOfVar = avgRoas > 0 ? stdDev / avgRoas : 1;
          const confidenceLevel = Math.min(100, (withRoas.length * 10) * (1 - Math.min(coeffOfVar, 0.9)));

          // Generate insight text
          const direction = liftPercent > 0 ? 'higher' : 'lower';
          const insightText = `Creatives with "${value}" ${attr.name.replace('_', ' ')} show ${Math.abs(liftPercent).toFixed(0)}% ${direction} ROAS than average`;
          
          // Determine if actionable
          const isActionable = Math.abs(liftPercent) >= 15 && confidenceLevel >= 50 && withRoas.length >= 5;
          
          // Generate recommended action
          let recommendedAction = null;
          if (isActionable) {
            if (liftPercent > 20) {
              recommendedAction = `Consider increasing spend on "${value}" ${attr.name.replace('_', ' ')} creatives`;
            } else if (liftPercent < -20) {
              recommendedAction = `Consider reducing spend on "${value}" ${attr.name.replace('_', ' ')} creatives or testing alternatives`;
            }
          }

          // Upsert correlation
          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: attr.type,
              attribute_name: attr.name,
              attribute_value: value,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: withRoas.length,
              confidence_level: confidenceLevel,
              p_value: null,
              insight_text: insightText,
              is_actionable: isActionable,
              recommended_action: recommendedAction,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallAvgRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) {
            correlationsCreated++;
          } else {
            console.error('Error upserting correlation:', corrError);
          }
        }
      }

      // ========== ARRAY-BASED MOTIVATION CORRELATIONS ==========
      // These extract specific pain points, values, triggers from arrays
      console.log(`Calculating motivation-based correlations for org: ${orgId}`);

      const arrayAttributes = [
        { field: 'donor_pain_points', type: 'pain_point_roas' },
        { field: 'values_appealed', type: 'values_roas' },
        { field: 'issue_specifics', type: 'issue_specifics_roas' },
        { field: 'emotional_triggers', type: 'emotional_trigger_roas' },
        { field: 'urgency_drivers', type: 'urgency_driver_roas' },
      ];

      for (const attr of arrayAttributes) {
        // Build a map of attribute value -> creatives containing it
        const valueMap = new Map<string, any[]>();
        
        for (const creative of metaCreatives) {
          const values = creative[attr.field] as string[] | null;
          if (!values || !Array.isArray(values) || values.length === 0) continue;
          
          for (const rawValue of values) {
            if (!rawValue) continue;
            const value = String(rawValue).toLowerCase().trim();
            if (value.length < 3 || value.length > 100) continue; // Skip too short/long
            
            if (!valueMap.has(value)) {
              valueMap.set(value, []);
            }
            valueMap.get(value)!.push(creative);
          }
        }

        // Calculate correlations for values with sufficient sample size
        for (const [value, creatives] of valueMap.entries()) {
          if (creatives.length < 2) continue;

          const withRoas = creatives.filter(c => c.roas && c.roas > 0);
          if (withRoas.length < 2) continue;

          const avgRoas = withRoas.reduce((sum, c) => sum + c.roas, 0) / withRoas.length;
          const totalSpend = creatives.reduce((sum, c) => sum + (c.spend || 0), 0);
          
          const liftPercent = overallAvgRoas > 0 
            ? ((avgRoas - overallAvgRoas) / overallAvgRoas) * 100 
            : 0;

          // Higher confidence for more samples
          const confidenceLevel = Math.min(100, withRoas.length * 15);

          // Format display value (capitalize first letter)
          const displayValue = value.charAt(0).toUpperCase() + value.slice(1);
          
          const insightText = `Messaging about "${displayValue}" shows ${Math.abs(liftPercent).toFixed(0)}% ${liftPercent > 0 ? 'higher' : 'lower'} ROAS`;
          
          const isActionable = Math.abs(liftPercent) >= 20 && withRoas.length >= 3;
          
          let recommendedAction = null;
          if (isActionable) {
            if (liftPercent > 25) {
              recommendedAction = `Double down on "${displayValue}" messaging - it resonates with donors`;
            } else if (liftPercent < -25) {
              recommendedAction = `Consider testing different angles for "${displayValue}" messaging`;
            }
          }

          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: attr.type,
              attribute_name: attr.field,
              attribute_value: displayValue,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: withRoas.length,
              confidence_level: confidenceLevel,
              p_value: null,
              insight_text: insightText,
              is_actionable: isActionable,
              recommended_action: recommendedAction,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallAvgRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) {
            correlationsCreated++;
          }
        }
      }

      // ========== MULTIVARIATE ANALYSIS: Topic + Tone Combinations ==========
      console.log(`Calculating multivariate correlations for org: ${orgId}`);

      const uniqueTopics = [...new Set(metaCreatives.map(c => c.topic).filter(Boolean))];
      const uniqueTones = [...new Set(metaCreatives.map(c => c.tone).filter(Boolean))];

      for (const topic of uniqueTopics) {
        for (const tone of uniqueTones) {
          const matches = metaCreatives.filter(c => c.topic === topic && c.tone === tone);
          if (matches.length < 2) continue;

          const withRoas = matches.filter(c => c.roas && c.roas > 0);
          if (withRoas.length < 2) continue;

          const avgRoas = withRoas.reduce((sum, c) => sum + c.roas, 0) / withRoas.length;
          const liftPercent = overallAvgRoas > 0 
            ? ((avgRoas - overallAvgRoas) / overallAvgRoas) * 100 
            : 0;

          // Only record if the combination shows significant lift
          if (Math.abs(liftPercent) < 15) continue;

          const comboValue = `${topic} + ${tone}`;
          const confidenceLevel = Math.min(100, withRoas.length * 20);
          
          const insightText = `"${topic}" topic with "${tone}" tone shows ${Math.abs(liftPercent).toFixed(0)}% ${liftPercent > 0 ? 'higher' : 'lower'} ROAS`;

          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: 'topic_tone_combo',
              attribute_name: 'topic_tone',
              attribute_value: comboValue,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: withRoas.length,
              confidence_level: confidenceLevel,
              p_value: null,
              insight_text: insightText,
              is_actionable: Math.abs(liftPercent) >= 25 && withRoas.length >= 3,
              recommended_action: liftPercent > 25 
                ? `This topic + tone combination is a winning formula - scale it` 
                : liftPercent < -25 
                  ? `This combination underperforms - try different tone for this topic` 
                  : null,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallAvgRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) correlationsCreated++;
        }
      }

      // ========== MULTIVARIATE: Pain Point + Emotional Trigger Combinations ==========
      const painPointMap = new Map<string, any[]>();
      const triggerMap = new Map<string, any[]>();
      
      for (const creative of metaCreatives) {
        const painPoints = creative.donor_pain_points as string[] | null;
        const triggers = creative.emotional_triggers as string[] | null;
        
        if (painPoints) {
          for (const pp of painPoints) {
            if (!pp) continue;
            const key = pp.toLowerCase().trim();
            if (!painPointMap.has(key)) painPointMap.set(key, []);
            painPointMap.get(key)!.push(creative);
          }
        }
        
        if (triggers) {
          for (const t of triggers) {
            if (!t) continue;
            const key = t.toLowerCase().trim();
            if (!triggerMap.has(key)) triggerMap.set(key, []);
            triggerMap.get(key)!.push(creative);
          }
        }
      }

      // Find combinations
      for (const [painPoint, ppCreatives] of painPointMap.entries()) {
        if (ppCreatives.length < 2) continue;
        
        for (const [trigger, tCreatives] of triggerMap.entries()) {
          if (tCreatives.length < 2) continue;
          
          // Find creatives that have BOTH this pain point AND this trigger
          const ppIds = new Set(ppCreatives.map(c => c.id));
          const matches = tCreatives.filter(c => ppIds.has(c.id));
          
          if (matches.length < 2) continue;

          const withRoas = matches.filter(c => c.roas && c.roas > 0);
          if (withRoas.length < 2) continue;

          const avgRoas = withRoas.reduce((sum, c) => sum + c.roas, 0) / withRoas.length;
          const liftPercent = overallAvgRoas > 0 
            ? ((avgRoas - overallAvgRoas) / overallAvgRoas) * 100 
            : 0;

          if (Math.abs(liftPercent) < 20) continue;

          const ppDisplay = painPoint.charAt(0).toUpperCase() + painPoint.slice(1);
          const tDisplay = trigger.charAt(0).toUpperCase() + trigger.slice(1);
          const comboValue = `${ppDisplay} + ${tDisplay}`;
          
          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: 'motivation_combo',
              attribute_name: 'pain_trigger',
              attribute_value: comboValue,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: withRoas.length,
              confidence_level: Math.min(100, withRoas.length * 25),
              p_value: null,
              insight_text: `Pain point "${ppDisplay}" + trigger "${tDisplay}" shows ${Math.abs(liftPercent).toFixed(0)}% ${liftPercent > 0 ? 'higher' : 'lower'} ROAS`,
              is_actionable: Math.abs(liftPercent) >= 30,
              recommended_action: liftPercent > 30 
                ? `This pain point + emotion combination drives donations - use more` 
                : null,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallAvgRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) correlationsCreated++;
        }
      }

      // ========== TOPIC/MESSAGING DECAY DETECTION ==========
      // Track if specific messages are losing effectiveness over time
      console.log(`Detecting messaging decay for org: ${orgId}`);
      
      // Get creatives with dates for temporal analysis
      const creativesWithDates = metaCreatives.filter(c => 
        c.created_at && c.roas && c.roas > 0
      );

      if (creativesWithDates.length >= 10) {
        // Group by week and topic
        const getWeekNumber = (dateStr: string) => {
          const date = new Date(dateStr);
          const startOfYear = new Date(date.getFullYear(), 0, 1);
          const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
          return Math.ceil((days + startOfYear.getDay() + 1) / 7);
        };

        const topics = [...new Set(creativesWithDates.map(c => c.topic).filter(Boolean))];
        
        for (const topic of topics) {
          const topicCreatives = creativesWithDates.filter(c => c.topic === topic);
          if (topicCreatives.length < 4) continue;

          // Group by week
          const weeklyData = new Map<number, { roas: number[], count: number }>();
          for (const creative of topicCreatives) {
            const week = getWeekNumber(creative.created_at);
            if (!weeklyData.has(week)) {
              weeklyData.set(week, { roas: [], count: 0 });
            }
            weeklyData.get(week)!.roas.push(creative.roas);
            weeklyData.get(week)!.count++;
          }

          // Need at least 3 weeks of data
          if (weeklyData.size < 3) continue;

          // Calculate weekly averages and check for decline
          const weeks = [...weeklyData.keys()].sort((a, b) => a - b);
          const weeklyAvgs = weeks.map(w => {
            const data = weeklyData.get(w)!;
            return { week: w, avgRoas: data.roas.reduce((a, b) => a + b, 0) / data.roas.length };
          });

          // Check if the last 3 weeks show decline
          const recentWeeks = weeklyAvgs.slice(-3);
          if (recentWeeks.length < 3) continue;

          const isDecline = recentWeeks[0].avgRoas > recentWeeks[1].avgRoas && 
                           recentWeeks[1].avgRoas > recentWeeks[2].avgRoas;
          
          if (isDecline) {
            const declinePercent = ((recentWeeks[0].avgRoas - recentWeeks[2].avgRoas) / recentWeeks[0].avgRoas) * 100;
            
            if (declinePercent >= 15) {
              const { error: corrError } = await supabase
                .from('creative_performance_correlations')
                .upsert({
                  organization_id: orgId,
                  correlation_type: 'topic_decay',
                  attribute_name: 'topic',
                  attribute_value: topic,
                  correlated_metric: 'roas_trend',
                  correlation_coefficient: -declinePercent / 100,
                  sample_size: topicCreatives.length,
                  confidence_level: Math.min(100, topicCreatives.length * 10),
                  p_value: null,
                  insight_text: `"${topic}" messaging is declining - ROAS down ${declinePercent.toFixed(0)}% over 3 weeks`,
                  is_actionable: true,
                  recommended_action: `Refresh "${topic}" messaging or test new creative angles - this message is showing fatigue`,
                  metric_avg_with_attribute: recentWeeks[2].avgRoas,
                  metric_avg_without_attribute: recentWeeks[0].avgRoas,
                  lift_percentage: -declinePercent,
                  detected_at: new Date().toISOString(),
                }, {
                  onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
                  ignoreDuplicates: false,
                });

              if (!corrError) correlationsCreated++;
            }
          }
        }

        // Same decay detection for pain points
        const allPainPoints = new Set<string>();
        for (const c of creativesWithDates) {
          if (c.donor_pain_points && Array.isArray(c.donor_pain_points)) {
            for (const pp of c.donor_pain_points) {
              if (pp) allPainPoints.add(pp.toLowerCase().trim());
            }
          }
        }

        for (const painPoint of allPainPoints) {
          const ppCreatives = creativesWithDates.filter(c => 
            c.donor_pain_points && 
            Array.isArray(c.donor_pain_points) && 
            c.donor_pain_points.some((pp: string) => pp && pp.toLowerCase().trim() === painPoint)
          );
          if (ppCreatives.length < 4) continue;

          // Group by week
          const weeklyData = new Map<number, { roas: number[], count: number }>();
          for (const creative of ppCreatives) {
            const week = getWeekNumber(creative.created_at);
            if (!weeklyData.has(week)) {
              weeklyData.set(week, { roas: [], count: 0 });
            }
            weeklyData.get(week)!.roas.push(creative.roas);
            weeklyData.get(week)!.count++;
          }

          if (weeklyData.size < 3) continue;

          const weeks = [...weeklyData.keys()].sort((a, b) => a - b);
          const weeklyAvgs = weeks.map(w => {
            const data = weeklyData.get(w)!;
            return { week: w, avgRoas: data.roas.reduce((a, b) => a + b, 0) / data.roas.length };
          });

          const recentWeeks = weeklyAvgs.slice(-3);
          if (recentWeeks.length < 3) continue;

          const isDecline = recentWeeks[0].avgRoas > recentWeeks[1].avgRoas && 
                           recentWeeks[1].avgRoas > recentWeeks[2].avgRoas;
          
          if (isDecline) {
            const declinePercent = ((recentWeeks[0].avgRoas - recentWeeks[2].avgRoas) / recentWeeks[0].avgRoas) * 100;
            
            if (declinePercent >= 20) {
              const displayPP = painPoint.charAt(0).toUpperCase() + painPoint.slice(1);
              
              const { error: corrError } = await supabase
                .from('creative_performance_correlations')
                .upsert({
                  organization_id: orgId,
                  correlation_type: 'pain_point_decay',
                  attribute_name: 'donor_pain_points',
                  attribute_value: displayPP,
                  correlated_metric: 'roas_trend',
                  correlation_coefficient: -declinePercent / 100,
                  sample_size: ppCreatives.length,
                  confidence_level: Math.min(100, ppCreatives.length * 12),
                  p_value: null,
                  insight_text: `"${displayPP}" pain point messaging is losing effectiveness - down ${declinePercent.toFixed(0)}%`,
                  is_actionable: true,
                  recommended_action: `This pain point is burning out - test new angles or reduce spend`,
                  metric_avg_with_attribute: recentWeeks[2].avgRoas,
                  metric_avg_without_attribute: recentWeeks[0].avgRoas,
                  lift_percentage: -declinePercent,
                  detected_at: new Date().toISOString(),
                }, {
                  onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
                  ignoreDuplicates: false,
                });

              if (!corrError) correlationsCreated++;
            }
          }
        }
      }

      // Video-specific correlations (thruplay rate vs ROAS)
      const videoCreatives = metaCreatives.filter(c => 
        c.creative_type === 'video' && 
        c.video_thruplay && 
        c.impressions > 0 && 
        c.roas && c.roas > 0
      );

      if (videoCreatives.length >= 5) {
        // Calculate thruplay rate buckets
        const buckets = {
          low: videoCreatives.filter(c => c.video_thruplay / c.impressions < 0.25),
          medium: videoCreatives.filter(c => c.video_thruplay / c.impressions >= 0.25 && c.video_thruplay / c.impressions < 0.5),
          high: videoCreatives.filter(c => c.video_thruplay / c.impressions >= 0.5),
        };

        const overallVideoRoas = videoCreatives.reduce((sum, c) => sum + c.roas, 0) / videoCreatives.length;

        for (const [bucket, items] of Object.entries(buckets)) {
          if (items.length < 2) continue;

          const avgRoas = items.reduce((sum, i) => sum + i.roas, 0) / items.length;
          const liftPercent = overallVideoRoas > 0 
            ? ((avgRoas - overallVideoRoas) / overallVideoRoas) * 100 
            : 0;

          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: 'video_retention',
              attribute_name: 'thruplay_rate',
              attribute_value: bucket,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: items.length,
              confidence_level: Math.min(100, items.length * 15),
              insight_text: `Videos with ${bucket} retention (${bucket === 'high' ? '>50%' : bucket === 'medium' ? '25-50%' : '<25%'} thruplay) show ${Math.abs(liftPercent).toFixed(0)}% ${liftPercent > 0 ? 'higher' : 'lower'} ROAS`,
              is_actionable: Math.abs(liftPercent) >= 20 && items.length >= 3,
              recommended_action: liftPercent > 20 ? 'Prioritize videos with strong early engagement hooks' : null,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallVideoRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) correlationsCreated++;
        }
      }

      // ========== CTR TO ROAS CORRELATION ==========
      // Does higher CTR predict higher ROAS?
      const creativesWithCtr = metaCreatives.filter(c => 
        c.ctr && c.ctr > 0 && c.roas && c.roas > 0
      );

      if (creativesWithCtr.length >= 10) {
        // Calculate CTR buckets
        const sortedByCtr = [...creativesWithCtr].sort((a, b) => a.ctr - b.ctr);
        const thirdLen = Math.floor(sortedByCtr.length / 3);
        
        const ctrBuckets = {
          low: sortedByCtr.slice(0, thirdLen),
          medium: sortedByCtr.slice(thirdLen, thirdLen * 2),
          high: sortedByCtr.slice(thirdLen * 2),
        };

        const overallAvgRoas = creativesWithCtr.reduce((sum, c) => sum + c.roas, 0) / creativesWithCtr.length;

        for (const [bucket, items] of Object.entries(ctrBuckets)) {
          if (items.length < 2) continue;

          const avgRoas = items.reduce((sum, i) => sum + i.roas, 0) / items.length;
          const avgCtr = items.reduce((sum, i) => sum + i.ctr, 0) / items.length;
          const liftPercent = overallAvgRoas > 0 
            ? ((avgRoas - overallAvgRoas) / overallAvgRoas) * 100 
            : 0;

          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: 'ctr_roas_correlation',
              attribute_name: 'ctr_bucket',
              attribute_value: bucket,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: items.length,
              confidence_level: Math.min(100, items.length * 12),
              insight_text: `Creatives with ${bucket} CTR (avg ${(avgCtr * 100).toFixed(2)}%) show ${Math.abs(liftPercent).toFixed(0)}% ${liftPercent > 0 ? 'higher' : 'lower'} ROAS`,
              is_actionable: bucket === 'high' && liftPercent > 15,
              recommended_action: bucket === 'high' && liftPercent > 15 
                ? 'CTR is a strong predictor of ROAS - optimize for click-through to improve revenue' 
                : null,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallAvgRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) correlationsCreated++;
        }
      }

      // ========== FREQUENCY BURNOUT CORRELATION ==========
      // Does high frequency correlate with lower performance?
      const creativesWithFreq = metaCreatives.filter(c => 
        c.frequency && c.frequency > 0 && c.roas && c.roas > 0
      );

      if (creativesWithFreq.length >= 8) {
        const freqBuckets = {
          fresh: creativesWithFreq.filter(c => c.frequency < 2),
          moderate: creativesWithFreq.filter(c => c.frequency >= 2 && c.frequency < 4),
          saturated: creativesWithFreq.filter(c => c.frequency >= 4 && c.frequency < 6),
          burned_out: creativesWithFreq.filter(c => c.frequency >= 6),
        };

        const overallAvgRoas = creativesWithFreq.reduce((sum, c) => sum + c.roas, 0) / creativesWithFreq.length;

        for (const [bucket, items] of Object.entries(freqBuckets)) {
          if (items.length < 2) continue;

          const avgRoas = items.reduce((sum, i) => sum + i.roas, 0) / items.length;
          const avgFreq = items.reduce((sum, i) => sum + i.frequency, 0) / items.length;
          const liftPercent = overallAvgRoas > 0 
            ? ((avgRoas - overallAvgRoas) / overallAvgRoas) * 100 
            : 0;

          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: 'frequency_burnout',
              attribute_name: 'frequency_bucket',
              attribute_value: bucket,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: items.length,
              confidence_level: Math.min(100, items.length * 12),
              insight_text: `Ads with ${bucket.replace('_', ' ')} frequency (avg ${avgFreq.toFixed(1)}) show ${Math.abs(liftPercent).toFixed(0)}% ${liftPercent > 0 ? 'higher' : 'lower'} ROAS`,
              is_actionable: bucket === 'burned_out' && liftPercent < -15,
              recommended_action: bucket === 'burned_out' && liftPercent < -15 
                ? 'High frequency ads are underperforming - consider refreshing creatives or expanding audience' 
                : null,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallAvgRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) correlationsCreated++;
        }
      }

      // ========== VIDEO DURATION CORRELATION ==========
      // Which video durations perform best?
      const videosWithDuration = metaCreatives.filter(c => 
        c.creative_type === 'video' && 
        c.video_duration_seconds && 
        c.video_duration_seconds > 0 && 
        c.roas && c.roas > 0
      );

      if (videosWithDuration.length >= 5) {
        const durationBuckets = {
          short: videosWithDuration.filter(c => c.video_duration_seconds < 15),
          medium: videosWithDuration.filter(c => c.video_duration_seconds >= 15 && c.video_duration_seconds < 30),
          long: videosWithDuration.filter(c => c.video_duration_seconds >= 30 && c.video_duration_seconds < 60),
          extended: videosWithDuration.filter(c => c.video_duration_seconds >= 60),
        };

        const overallVideoRoas = videosWithDuration.reduce((sum, c) => sum + c.roas, 0) / videosWithDuration.length;

        for (const [bucket, items] of Object.entries(durationBuckets)) {
          if (items.length < 2) continue;

          const avgRoas = items.reduce((sum, i) => sum + i.roas, 0) / items.length;
          const avgDuration = items.reduce((sum, i) => sum + i.video_duration_seconds, 0) / items.length;
          const liftPercent = overallVideoRoas > 0 
            ? ((avgRoas - overallVideoRoas) / overallVideoRoas) * 100 
            : 0;

          const { error: corrError } = await supabase
            .from('creative_performance_correlations')
            .upsert({
              organization_id: orgId,
              correlation_type: 'video_duration',
              attribute_name: 'duration_bucket',
              attribute_value: bucket,
              correlated_metric: 'roas',
              correlation_coefficient: liftPercent / 100,
              sample_size: items.length,
              confidence_level: Math.min(100, items.length * 15),
              insight_text: `${bucket.charAt(0).toUpperCase() + bucket.slice(1)} videos (avg ${avgDuration.toFixed(0)}s) show ${Math.abs(liftPercent).toFixed(0)}% ${liftPercent > 0 ? 'higher' : 'lower'} ROAS`,
              is_actionable: Math.abs(liftPercent) >= 20 && items.length >= 3,
              recommended_action: liftPercent > 20 
                ? `Prioritize ${bucket} video formats (around ${avgDuration.toFixed(0)} seconds)` 
                : null,
              metric_avg_with_attribute: avgRoas,
              metric_avg_without_attribute: overallVideoRoas,
              lift_percentage: liftPercent,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,correlation_type,attribute_name,attribute_value,correlated_metric',
              ignoreDuplicates: false,
            });

          if (!corrError) correlationsCreated++;
        }
      }
    }

    console.log(`Creative learnings calculation complete. Org learnings: ${orgLearnings}, Global learnings: ${globalLearnings}, Correlations: ${correlationsCreated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        org_learnings: orgLearnings,
        global_learnings: globalLearnings,
        correlations_created: correlationsCreated,
        total: orgLearnings + globalLearnings,
        message: `Calculated ${orgLearnings + globalLearnings} creative performance learnings and ${correlationsCreated} correlations` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calculate-creative-learnings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to group array by key
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key] || 'unknown');
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

// Calculate SMS stats
function calculateSMSStats(items: any[]): PatternStats & { effectiveness_score: number; confidence_level: number } {
  const validItems = items.filter(i => i.messages_delivered > 0);
  const sample_size = validItems.length;
  
  const avg_click_rate = sample_size > 0 
    ? validItems.reduce((sum, i) => sum + (i.click_rate || 0), 0) / sample_size 
    : 0;
  
  const avg_conversion_rate = sample_size > 0 
    ? validItems.reduce((sum, i) => sum + (i.conversion_rate || 0), 0) / sample_size 
    : 0;
  
  const avg_amount_raised = sample_size > 0 
    ? validItems.reduce((sum, i) => sum + (i.amount_raised || 0), 0) / sample_size 
    : 0;

  // Effectiveness score: weighted combination of metrics
  const effectiveness_score = Math.min(100, (avg_click_rate * 10 + avg_conversion_rate * 20 + Math.log10(avg_amount_raised + 1) * 10));
  
  // Confidence based on sample size
  const confidence_level = Math.min(1, sample_size / 20);

  return {
    sample_size,
    avg_click_rate,
    avg_conversion_rate,
    avg_roas: 0, // N/A for SMS
    avg_amount_raised,
    effectiveness_score,
    confidence_level,
  };
}

// Calculate Meta stats
function calculateMetaStats(items: any[]): PatternStats & { effectiveness_score: number; confidence_level: number } {
  const validItems = items.filter(i => i.impressions > 0);
  const sample_size = validItems.length;
  
  const avg_click_rate = sample_size > 0 
    ? validItems.reduce((sum, i) => sum + (i.ctr || 0), 0) / sample_size 
    : 0;
  
  const itemsWithConversions = validItems.filter(i => i.clicks > 0);
  const avg_conversion_rate = itemsWithConversions.length > 0 
    ? itemsWithConversions.reduce((sum, i) => sum + ((i.conversions / i.clicks) * 100 || 0), 0) / itemsWithConversions.length 
    : 0;
  
  const avg_roas = sample_size > 0 
    ? validItems.reduce((sum, i) => sum + (i.roas || 0), 0) / sample_size 
    : 0;
  
  const avg_amount_raised = sample_size > 0 
    ? validItems.reduce((sum, i) => sum + (i.conversion_value || 0), 0) / sample_size 
    : 0;

  // Effectiveness score: weighted combination of metrics
  const effectiveness_score = Math.min(100, (avg_click_rate * 5 + avg_conversion_rate * 15 + avg_roas * 5 + Math.log10(avg_amount_raised + 1) * 5));
  
  // Confidence based on sample size
  const confidence_level = Math.min(1, sample_size / 15);

  return {
    sample_size,
    avg_click_rate,
    avg_conversion_rate,
    avg_roas,
    avg_amount_raised,
    effectiveness_score,
    confidence_level,
  };
}

// Calculate global SMS stats (simplified)
function calculateGlobalSMSStats(items: any[]): PatternStats & { effectiveness_score: number; confidence_level: number } {
  const sample_size = items.length;
  const avg_click_rate = items.reduce((sum, i) => sum + (i.click_rate || 0), 0) / sample_size;
  const avg_conversion_rate = items.reduce((sum, i) => sum + (i.conversion_rate || 0), 0) / sample_size;
  const avg_amount_raised = items.reduce((sum, i) => sum + (i.amount_raised || 0), 0) / sample_size;
  
  const effectiveness_score = Math.min(100, (avg_click_rate * 10 + avg_conversion_rate * 20 + Math.log10(avg_amount_raised + 1) * 10));
  const confidence_level = Math.min(1, sample_size / 50);

  return {
    sample_size,
    avg_click_rate,
    avg_conversion_rate,
    avg_roas: 0,
    avg_amount_raised,
    effectiveness_score,
    confidence_level,
  };
}

// Calculate global Meta stats (simplified)
function calculateGlobalMetaStats(items: any[]): PatternStats & { effectiveness_score: number; confidence_level: number } {
  const sample_size = items.length;
  const avg_click_rate = items.reduce((sum, i) => sum + (i.ctr || 0), 0) / sample_size;
  const avg_roas = items.reduce((sum, i) => sum + (i.roas || 0), 0) / sample_size;
  const avg_amount_raised = items.reduce((sum, i) => sum + (i.conversion_value || 0), 0) / sample_size;
  
  const effectiveness_score = Math.min(100, (avg_click_rate * 5 + avg_roas * 10 + Math.log10(avg_amount_raised + 1) * 5));
  const confidence_level = Math.min(1, sample_size / 50);

  return {
    sample_size,
    avg_click_rate,
    avg_conversion_rate: 0,
    avg_roas,
    avg_amount_raised,
    effectiveness_score,
    confidence_level,
  };
}

// Upsert learning to database
async function upsertLearning(supabase: any, learning: any) {
  // Build a composite key for the learning (matches the unique index using COALESCE)
  const orgId = learning.organization_id || '00000000-0000-0000-0000-000000000000';
  const channel = learning.channel || '';
  const topic = learning.topic || '';
  const tone = learning.tone || '';
  const urgencyLevel = learning.urgency_level || '';
  const callToAction = learning.call_to_action || '';
  const emotionalAppeal = learning.emotional_appeal || '';
  const optimalHour = learning.optimal_hour !== undefined && learning.optimal_hour !== null ? String(learning.optimal_hour) : '-1';
  const optimalDay = learning.optimal_day !== undefined && learning.optimal_day !== null ? String(learning.optimal_day) : '-1';

  // First try to find existing
  const { data: existing } = await supabase
    .from('creative_performance_learnings')
    .select('id')
    .eq('channel', learning.channel)
    .is('organization_id', learning.organization_id ? undefined : null)
    .eq(learning.organization_id ? 'organization_id' : 'channel', learning.organization_id || learning.channel)
    .limit(1);

  // Insert with generated id or update existing
  const { error } = await supabase
    .from('creative_performance_learnings')
    .upsert({
      ...learning,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error upserting learning:', error);
  }
}