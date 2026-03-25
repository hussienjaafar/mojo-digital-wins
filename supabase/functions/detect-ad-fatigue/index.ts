import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * detect-ad-fatigue
 * 
 * Analyzes 7-day rolling CTR trends to detect ad fatigue.
 * Identifies ads with declining engagement and predicts exhaustion dates.
 * 
 * Runs hourly or on-demand.
 */

interface DailyMetric {
  ad_id: string;
  date: string;
  clicks: number;
  impressions: number;
  link_clicks: number;
  spend: number;
}

interface AdTrend {
  ad_id: string;
  creative_id: string | null;
  baseline_ctr: number;
  current_ctr: number;
  decline_percent: number;
  days_declining: number;
  total_spend: number;
  predicted_exhaustion_date: Date | null;
  severity: 'watch' | 'warning' | 'critical';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, min_spend = 50, decline_threshold = 15 } = await req.json();

    console.log(`Detecting ad fatigue${organization_id ? ` for org: ${organization_id}` : ' (all orgs)'}`);

    // Get organizations to process
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

    let totalAlerts = 0;
    let processedAds = 0;

    for (const orgId of orgIds) {
      console.log(`Processing organization: ${orgId}`);

      // Get last 14 days of daily metrics for this org
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: dailyMetrics, error: metricsError } = await supabase
        .from('meta_ad_metrics_daily')
        .select('ad_id, date, clicks, impressions, link_clicks, spend, frequency')
        .eq('organization_id', orgId)
        .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (metricsError) {
        console.error(`Error fetching metrics for org ${orgId}:`, metricsError);
        continue;
      }

      if (!dailyMetrics || dailyMetrics.length === 0) {
        console.log(`No daily metrics found for org ${orgId}`);
        continue;
      }

      // Group metrics by ad_id
      const adMetrics = new Map<string, DailyMetric[]>();
      for (const metric of dailyMetrics) {
        const existing = adMetrics.get(metric.ad_id) || [];
        existing.push(metric as DailyMetric);
        adMetrics.set(metric.ad_id, existing);
      }

      // Analyze each ad for fatigue
      const fatigueAlerts: AdTrend[] = [];

      for (const [adId, metrics] of adMetrics) {
        processedAds++;

        // Calculate total spend
        const totalSpend = metrics.reduce((sum, m) => sum + (m.spend || 0), 0);
        
        // Skip low-spend ads
        if (totalSpend < min_spend) continue;

        // Split into baseline (days 8-14) and recent (days 1-7)
        const baselineMetrics = metrics.filter(m => 
          new Date(m.date) < sevenDaysAgo
        );
        const recentMetrics = metrics.filter(m => 
          new Date(m.date) >= sevenDaysAgo
        );

        if (baselineMetrics.length < 3 || recentMetrics.length < 3) {
          // Not enough data for reliable comparison
          continue;
        }

        // Calculate baseline CTR
        const baselineImpressions = baselineMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
        const baselineClicks = baselineMetrics.reduce((sum, m) => sum + (m.link_clicks || m.clicks || 0), 0);
        const baselineCtr = baselineImpressions > 0 ? baselineClicks / baselineImpressions : 0;

        // Calculate recent CTR
        const recentImpressions = recentMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
        const recentClicks = recentMetrics.reduce((sum, m) => sum + (m.link_clicks || m.clicks || 0), 0);
        const recentCtr = recentImpressions > 0 ? recentClicks / recentImpressions : 0;

        // Skip if baseline CTR is too low (unreliable)
        if (baselineCtr < 0.001) continue;

        // Calculate decline percentage
        const declinePercent = ((baselineCtr - recentCtr) / baselineCtr) * 100;

        // Only alert if declining beyond threshold
        if (declinePercent < decline_threshold) continue;

        // Calculate consecutive days of decline
        let daysDeclined = 0;
        const sortedRecent = [...recentMetrics].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        let prevCtr = 0;
        for (const day of sortedRecent) {
          const dayCtr = day.impressions > 0 ? (day.link_clicks || day.clicks || 0) / day.impressions : 0;
          if (prevCtr === 0) {
            prevCtr = dayCtr;
            daysDeclined = 1;
          } else if (dayCtr < prevCtr * 1.1) { // Allow 10% variance
            daysDeclined++;
            prevCtr = dayCtr;
          } else {
            break;
          }
        }

        // Check average frequency (leading indicator of fatigue)
        const avgFrequency = metrics.reduce((sum, m) => sum + ((m as any).frequency || 0), 0) / metrics.length;

        // Determine severity (consider both decline and frequency)
        let severity: 'watch' | 'warning' | 'critical';
        if (declinePercent >= 30 || daysDeclined >= 5 || avgFrequency >= 8) {
          severity = 'critical';
        } else if (declinePercent >= 20 || daysDeclined >= 3 || avgFrequency >= 6) {
          severity = 'warning';
        } else {
          severity = 'watch';
        }

        // Predict exhaustion date (simple linear projection)
        let predictedExhaustion: Date | null = null;
        if (declinePercent > 0 && recentCtr > 0) {
          const declineRatePerDay = (baselineCtr - recentCtr) / 7;
          const daysUntilZero = recentCtr / declineRatePerDay;
          if (daysUntilZero > 0 && daysUntilZero < 90) {
            predictedExhaustion = new Date();
            predictedExhaustion.setDate(predictedExhaustion.getDate() + Math.ceil(daysUntilZero));
          }
        }

        // Get creative_id from insights table
        const { data: creative } = await supabase
          .from('meta_creative_insights')
          .select('id')
          .eq('ad_id', adId)
          .limit(1)
          .single();

        fatigueAlerts.push({
          ad_id: adId,
          creative_id: creative?.id || null,
          baseline_ctr: baselineCtr,
          current_ctr: recentCtr,
          decline_percent: declinePercent,
          days_declining: daysDeclined,
          total_spend: totalSpend,
          predicted_exhaustion_date: predictedExhaustion,
          severity,
        });
      }

      console.log(`Found ${fatigueAlerts.length} fatigue alerts for org ${orgId}`);

      // Upsert alerts to database
      for (const alert of fatigueAlerts) {
        const { error: upsertError } = await supabase
          .from('ad_fatigue_alerts')
          .upsert({
            organization_id: orgId,
            ad_id: alert.ad_id,
            creative_id: alert.creative_id,
            baseline_ctr: alert.baseline_ctr,
            current_ctr: alert.current_ctr,
            decline_percent: alert.decline_percent,
            days_declining: alert.days_declining,
            total_spend_at_detection: alert.total_spend,
            predicted_exhaustion_date: alert.predicted_exhaustion_date?.toISOString().split('T')[0] || null,
            alert_severity: alert.severity,
            is_acknowledged: false,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'organization_id,ad_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Error upserting alert for ad ${alert.ad_id}:`, upsertError);
        } else {
          totalAlerts++;
        }
      }

      // Mark resolved alerts (ads that improved)
      const alertedAdIds = fatigueAlerts.map(a => a.ad_id);
      const { data: existingAlerts } = await supabase
        .from('ad_fatigue_alerts')
        .select('id, ad_id')
        .eq('organization_id', orgId)
        .eq('is_acknowledged', false);

      if (existingAlerts) {
        const resolvedAlerts = existingAlerts.filter(e => !alertedAdIds.includes(e.ad_id));
        for (const resolved of resolvedAlerts) {
          await supabase
            .from('ad_fatigue_alerts')
            .update({
              is_acknowledged: true,
              resolution_action: 'auto_resolved',
              resolved_at: new Date().toISOString(),
            })
            .eq('id', resolved.id);
        }
      }
    }

    console.log(`Ad fatigue detection complete. Processed ${processedAds} ads, created ${totalAlerts} alerts.`);

    return new Response(
      JSON.stringify({
        success: true,
        processed_ads: processedAds,
        alerts_created: totalAlerts,
        message: `Detected ${totalAlerts} ad fatigue alerts across ${processedAds} ads`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in detect-ad-fatigue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
