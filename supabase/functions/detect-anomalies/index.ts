import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate z-score
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// Calculate standard deviation
function calculateStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const anomalies = [];
    const Z_SCORE_THRESHOLD = 2.5; // Anomaly if z-score > 2.5

    console.log('[detect-anomalies] Starting anomaly detection');

    // 1. Detect topic velocity anomalies
    const { data: trends, error: trendsError } = await supabase
      .from('bluesky_trends')
      .select('topic, velocity, mentions_last_hour, mentions_last_24_hours')
      .eq('is_trending', true)
      .order('velocity', { ascending: false })
      .limit(100);

    if (trendsError) throw trendsError;

    if (trends && trends.length > 0) {
      const velocities = trends.map(t => t.velocity || 0).filter(v => v > 0);
      const { mean, stdDev } = calculateStdDev(velocities);

      for (const trend of trends) {
        if (!trend.velocity) continue;
        const zScore = calculateZScore(trend.velocity, mean, stdDev);
        
        if (Math.abs(zScore) > Z_SCORE_THRESHOLD) {
          anomalies.push({
            anomaly_type: 'topic_velocity',
            entity_type: 'topic',
            entity_id: trend.topic,
            entity_name: trend.topic,
            z_score: zScore,
            baseline_value: mean,
            current_value: trend.velocity,
            severity: Math.abs(zScore) > 4 ? 'critical' : Math.abs(zScore) > 3 ? 'high' : 'medium',
            metadata: {
              mentions_last_hour: trend.mentions_last_hour,
              mentions_last_24_hours: trend.mentions_last_24_hours,
            },
          });
        }
      }
    }

    // 2. Detect sentiment shift anomalies
    const { data: sentimentData, error: sentimentError } = await supabase
      .from('sentiment_snapshots')
      .select('*')
      .eq('platform', 'combined')
      .gte('snapshot_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false });

    if (sentimentError) throw sentimentError;

    if (sentimentData && sentimentData.length > 0) {
      const groupedByAffectedGroup = new Map<string, any[]>();
      sentimentData.forEach(snapshot => {
        if (!groupedByAffectedGroup.has(snapshot.affected_group)) {
          groupedByAffectedGroup.set(snapshot.affected_group, []);
        }
        groupedByAffectedGroup.get(snapshot.affected_group)!.push(snapshot);
      });

      for (const [group, snapshots] of groupedByAffectedGroup.entries()) {
        if (snapshots.length < 3) continue;

        const sentiments = snapshots.map(s => s.avg_sentiment).filter(s => s !== null);
        const { mean, stdDev } = calculateStdDev(sentiments);
        const latest = snapshots[0];

        if (latest.avg_sentiment !== null) {
          const zScore = calculateZScore(latest.avg_sentiment, mean, stdDev);

          if (Math.abs(zScore) > Z_SCORE_THRESHOLD) {
            anomalies.push({
              anomaly_type: 'sentiment_shift',
              entity_type: 'group',
              entity_id: group,
              entity_name: group,
              z_score: zScore,
              baseline_value: mean,
              current_value: latest.avg_sentiment,
              severity: Math.abs(zScore) > 4 ? 'critical' : Math.abs(zScore) > 3 ? 'high' : 'medium',
              metadata: {
                positive_count: latest.positive_count,
                negative_count: latest.negative_count,
                neutral_count: latest.neutral_count,
                total_mentions: latest.total_mentions,
              },
            });
          }
        }
      }
    }

    // 3. Detect mention spike anomalies for topics
    const { data: topicMentions, error: topicError } = await supabase
      .from('bluesky_trends')
      .select('topic, mentions_last_hour, mentions_last_24_hours')
      .not('mentions_last_hour', 'is', null)
      .order('mentions_last_hour', { ascending: false })
      .limit(100);

    if (topicError) throw topicError;

    if (topicMentions && topicMentions.length > 0) {
      const hourlyMentions = topicMentions.map(t => t.mentions_last_hour || 0);
      const { mean, stdDev } = calculateStdDev(hourlyMentions);

      for (const topic of topicMentions) {
        if (!topic.mentions_last_hour) continue;
        const zScore = calculateZScore(topic.mentions_last_hour, mean, stdDev);

        if (Math.abs(zScore) > Z_SCORE_THRESHOLD) {
          anomalies.push({
            anomaly_type: 'mention_spike',
            entity_type: 'topic',
            entity_id: topic.topic,
            entity_name: topic.topic,
            z_score: zScore,
            baseline_value: mean,
            current_value: topic.mentions_last_hour,
            severity: Math.abs(zScore) > 4 ? 'critical' : Math.abs(zScore) > 3 ? 'high' : 'medium',
            metadata: {
              mentions_last_24_hours: topic.mentions_last_24_hours,
            },
          });
        }
      }
    }

    // Insert anomalies
    if (anomalies.length > 0) {
      const { error: insertError } = await supabase
        .from('detected_anomalies')
        .insert(anomalies);

      if (insertError) throw insertError;
    }

    console.log(`[detect-anomalies] Detected ${anomalies.length} anomalies`);

    return new Response(
      JSON.stringify({
        success: true,
        anomalies_detected: anomalies.length,
        by_type: {
          topic_velocity: anomalies.filter(a => a.anomaly_type === 'topic_velocity').length,
          sentiment_shift: anomalies.filter(a => a.anomaly_type === 'sentiment_shift').length,
          mention_spike: anomalies.filter(a => a.anomaly_type === 'mention_spike').length,
        },
        by_severity: {
          critical: anomalies.filter(a => a.severity === 'critical').length,
          high: anomalies.filter(a => a.severity === 'high').length,
          medium: anomalies.filter(a => a.severity === 'medium').length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[detect-anomalies] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
