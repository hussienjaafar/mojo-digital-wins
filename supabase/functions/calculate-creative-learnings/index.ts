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

    console.log(`Creative learnings calculation complete. Org learnings: ${orgLearnings}, Global learnings: ${globalLearnings}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        org_learnings: orgLearnings,
        global_learnings: globalLearnings,
        total: orgLearnings + globalLearnings,
        message: `Calculated ${orgLearnings + globalLearnings} creative performance learnings` 
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
  const { error } = await supabase
    .from('creative_performance_learnings')
    .upsert({
      ...learning,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,channel,topic,tone,urgency_level,call_to_action,emotional_appeal,optimal_hour,optimal_day'
    });

  if (error) {
    console.error('Error upserting learning:', error);
  }
}