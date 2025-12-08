import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

// CORS with allowed origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const getCorsHeaders = (origin?: string) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || 'https://lovable.dev';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

// Alert throttling - prevent duplicate alerts within window
const ALERT_THROTTLE_HOURS = 4;

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
  const origin = req.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check: require either CRON_SECRET header or valid admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');

    let isAuthorized = false;

    // Check CRON secret first (for scheduled invocations)
    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
      console.log('[detect-anomalies] Authorized via CRON_SECRET');
    }
    // Fall back to JWT auth for admin users
    else if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        const { data: isAdmin } = await supabaseAuth.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (isAdmin) {
          isAuthorized = true;
          console.log('[detect-anomalies] Authorized via admin JWT');
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET or admin JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const anomalies: any[] = [];
    const Z_SCORE_THRESHOLD = 2.5;

    console.log('[detect-anomalies] Starting anomaly detection');

    // Pre-fetch recent alerts for throttling
    const throttleCutoff = new Date(Date.now() - ALERT_THROTTLE_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
      .from('alert_queue')
      .select('title, alert_type')
      .gte('created_at', throttleCutoff);
    
    const recentAlertKeys = new Set(
      (recentAlerts || []).map(a => `${a.alert_type}-${a.title}`)
    );

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

    // Insert anomalies into both tables
    if (anomalies.length > 0) {
      // Legacy table (detected_anomalies)
      const { error: insertError } = await supabase
        .from('detected_anomalies')
        .insert(anomalies);

      if (insertError) {
        console.warn('[detect-anomalies] Error inserting to detected_anomalies:', insertError);
      }

      // New table (trend_anomalies) with deduplication
      const recentCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: existingAnomalies } = await supabase
        .from('trend_anomalies')
        .select('topic, anomaly_type')
        .gte('detected_at', recentCutoff);

      const existingKeys = new Set(
        (existingAnomalies || []).map(a => `${a.topic}-${a.anomaly_type}`)
      );

      const newTrendAnomalies = anomalies
        .filter(a => !existingKeys.has(`${a.entity_name}-${a.anomaly_type}`))
        .map(a => ({
          topic: a.entity_name,
          anomaly_type: a.anomaly_type === 'topic_velocity' ? 'velocity_spike' : 
                       a.anomaly_type === 'mention_spike' ? 'volume_surge' : 
                       a.anomaly_type,
          current_value: a.current_value,
          expected_value: a.baseline_value,
          z_score: a.z_score,
          deviation_percentage: a.baseline_value !== 0 
            ? ((a.current_value - a.baseline_value) / Math.abs(a.baseline_value)) * 100 
            : null,
          source_type: a.entity_type === 'topic' ? 'social' : 'combined',
          severity: a.severity,
          context: a.metadata
        }));

      if (newTrendAnomalies.length > 0) {
        const { error: trendError } = await supabase
          .from('trend_anomalies')
          .insert(newTrendAnomalies);
        
        if (trendError) {
          console.warn('[detect-anomalies] Error inserting to trend_anomalies:', trendError);
        } else {
          console.log(`[detect-anomalies] Inserted ${newTrendAnomalies.length} to trend_anomalies`);
        }
      }

      // Create alerts for critical/high severity anomalies - WITH THROTTLING
      const criticalAnomalies = anomalies.filter(a => 
        a.severity === 'critical' || a.severity === 'high'
      );

      if (criticalAnomalies.length > 0) {
        const alerts = criticalAnomalies
          .map(anomaly => ({
            alert_type: anomaly.anomaly_type,
            severity: anomaly.severity,
            title: `${anomaly.severity.toUpperCase()}: ${anomaly.entity_name}`,
            message: `Anomaly detected: ${anomaly.anomaly_type} for ${anomaly.entity_type} "${anomaly.entity_name}". Z-score: ${anomaly.z_score.toFixed(2)}. Current value: ${anomaly.current_value?.toFixed(2)}, Baseline: ${anomaly.baseline_value?.toFixed(2)}`,
            data: {
              entity_type: anomaly.entity_type,
              entity_id: anomaly.entity_id,
              z_score: anomaly.z_score,
              metadata: anomaly.metadata
            }
          }))
          // Filter out recently sent alerts (throttling)
          .filter(alert => !recentAlertKeys.has(`${alert.alert_type}-${alert.title}`));

        if (alerts.length > 0) {
          await supabase.from('alert_queue').insert(alerts);
          console.log(`[detect-anomalies] Created ${alerts.length} alerts (${criticalAnomalies.length - alerts.length} throttled)`);
        } else {
          console.log(`[detect-anomalies] All ${criticalAnomalies.length} alerts throttled`);
        }
      }
    }
    
    // Also refresh group sentiment
    try {
      await supabase.rpc('refresh_daily_group_sentiment');
      console.log('[detect-anomalies] Refreshed daily group sentiment');
    } catch (e) {
      console.warn('[detect-anomalies] Could not refresh group sentiment:', e);
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
      { status: 500, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
});
